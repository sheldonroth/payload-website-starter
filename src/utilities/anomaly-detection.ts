import type { Payload } from 'payload'

/**
 * Anomaly Detection Utility
 *
 * Detects price and size anomalies for the Skimpflation Detector.
 * Identifies:
 * - Shrinkflation: Same price, smaller size
 * - Skimpflation: Same price/size, cheaper ingredients
 * - Price increases
 * - Double whammy: Both shrink and price increase
 */

interface PriceRecord {
    id: number
    product: number | { id: number }
    price: number
    salePrice?: number
    pricePerUnit?: number
    size?: string
    sizeNormalized?: number
    ingredientsSnapshot?: string
    ingredientCount?: number
    capturedAt: string
    retailer: string
}

interface AnomalyResult {
    type: 'price_increase' | 'shrinkflation' | 'skimpflation' | 'double_whammy' | null
    detected: boolean
    details: {
        previousPrice?: number
        currentPrice?: number
        priceChangePercent?: number
        previousSize?: number
        currentSize?: number
        sizeChangePercent?: number
        previousIngredientCount?: number
        currentIngredientCount?: number
        ingredientsDiff?: number
    }
    severity: 'low' | 'medium' | 'high'
    message: string
}

// Thresholds for anomaly detection
const THRESHOLDS = {
    PRICE_INCREASE_MIN: 5, // 5% price increase is notable
    PRICE_INCREASE_HIGH: 15, // 15%+ is high severity
    SIZE_DECREASE_MIN: 3, // 3% size decrease is notable
    SIZE_DECREASE_HIGH: 10, // 10%+ is high severity
    INGREDIENT_DECREASE_MIN: 1, // Any ingredient removed
    INGREDIENT_DECREASE_HIGH: 3, // 3+ ingredients removed
}

/**
 * Compare two price records to detect anomalies
 */
export function detectAnomaly(
    previous: PriceRecord,
    current: PriceRecord
): AnomalyResult {
    const result: AnomalyResult = {
        type: null,
        detected: false,
        details: {},
        severity: 'low',
        message: '',
    }

    // Calculate price change
    const priceChangePercent = previous.price > 0
        ? ((current.price - previous.price) / previous.price) * 100
        : 0

    result.details.previousPrice = previous.price
    result.details.currentPrice = current.price
    result.details.priceChangePercent = Math.round(priceChangePercent * 10) / 10

    // Calculate size change (if normalized sizes available)
    let sizeChangePercent = 0
    if (previous.sizeNormalized && current.sizeNormalized && previous.sizeNormalized > 0) {
        sizeChangePercent = ((current.sizeNormalized - previous.sizeNormalized) / previous.sizeNormalized) * 100
        result.details.previousSize = previous.sizeNormalized
        result.details.currentSize = current.sizeNormalized
        result.details.sizeChangePercent = Math.round(sizeChangePercent * 10) / 10
    }

    // Calculate ingredient change
    const ingredientsDiff = (previous.ingredientCount || 0) - (current.ingredientCount || 0)
    if (previous.ingredientCount && current.ingredientCount) {
        result.details.previousIngredientCount = previous.ingredientCount
        result.details.currentIngredientCount = current.ingredientCount
        result.details.ingredientsDiff = ingredientsDiff
    }

    // Detect shrinkflation (size decreased, price same or higher)
    const isShrinkflation = sizeChangePercent <= -THRESHOLDS.SIZE_DECREASE_MIN && priceChangePercent >= 0

    // Detect price increase
    const isPriceIncrease = priceChangePercent >= THRESHOLDS.PRICE_INCREASE_MIN

    // Detect skimpflation (fewer ingredients, price same or higher)
    const isSkimpflation = ingredientsDiff >= THRESHOLDS.INGREDIENT_DECREASE_MIN && priceChangePercent >= 0

    // Determine anomaly type
    if (isShrinkflation && isPriceIncrease) {
        result.type = 'double_whammy'
        result.detected = true
        result.severity = 'high'
        result.message = `Double whammy! Size decreased ${Math.abs(sizeChangePercent).toFixed(1)}% AND price increased ${priceChangePercent.toFixed(1)}%`
    } else if (isShrinkflation) {
        result.type = 'shrinkflation'
        result.detected = true
        result.severity = Math.abs(sizeChangePercent) >= THRESHOLDS.SIZE_DECREASE_HIGH ? 'high' : 'medium'
        result.message = `Shrinkflation detected! Size decreased ${Math.abs(sizeChangePercent).toFixed(1)}% while price stayed ${priceChangePercent >= 0 ? 'same or increased' : 'similar'}`
    } else if (isSkimpflation) {
        result.type = 'skimpflation'
        result.detected = true
        result.severity = ingredientsDiff >= THRESHOLDS.INGREDIENT_DECREASE_HIGH ? 'high' : 'medium'
        result.message = `Skimpflation detected! ${ingredientsDiff} ingredient(s) removed from formula`
    } else if (isPriceIncrease) {
        result.type = 'price_increase'
        result.detected = true
        result.severity = priceChangePercent >= THRESHOLDS.PRICE_INCREASE_HIGH ? 'high' : 'low'
        result.message = `Price increased ${priceChangePercent.toFixed(1)}%`
    }

    return result
}

/**
 * Analyze price history for a product and detect all anomalies
 */
export async function analyzeProductPriceHistory(
    productId: number,
    payload: Payload,
    options: { retailer?: string; lookbackDays?: number } = {}
): Promise<{
    anomalies: Array<AnomalyResult & { date: string; recordId: number }>
    summary: {
        totalRecords: number
        anomalyCount: number
        totalPriceChange: number
        totalSizeChange: number
    }
}> {
    const { retailer, lookbackDays = 365 } = options

    const lookbackDate = new Date()
    lookbackDate.setDate(lookbackDate.getDate() - lookbackDays)

    // Fetch price history
    const whereClause = {
        product: { equals: productId },
        capturedAt: { greater_than: lookbackDate.toISOString() },
        ...(retailer ? { retailer: { equals: retailer } } : {}),
    }

    const history = await (payload.find as Function)({
        collection: 'price-history',
        where: whereClause,
        sort: 'capturedAt',
        limit: 1000,
    })

    const records = history.docs as unknown as PriceRecord[]
    const anomalies: Array<AnomalyResult & { date: string; recordId: number }> = []

    // Compare each record to the previous one
    for (let i = 1; i < records.length; i++) {
        const previous = records[i - 1]
        const current = records[i]
        const result = detectAnomaly(previous, current)

        if (result.detected) {
            anomalies.push({
                ...result,
                date: current.capturedAt,
                recordId: current.id,
            })
        }
    }

    // Calculate summary
    const firstRecord = records[0]
    const lastRecord = records[records.length - 1]
    const totalPriceChange = firstRecord && lastRecord && firstRecord.price > 0
        ? ((lastRecord.price - firstRecord.price) / firstRecord.price) * 100
        : 0
    const totalSizeChange = firstRecord?.sizeNormalized && lastRecord?.sizeNormalized && firstRecord.sizeNormalized > 0
        ? ((lastRecord.sizeNormalized - firstRecord.sizeNormalized) / firstRecord.sizeNormalized) * 100
        : 0

    return {
        anomalies,
        summary: {
            totalRecords: records.length,
            anomalyCount: anomalies.length,
            totalPriceChange: Math.round(totalPriceChange * 10) / 10,
            totalSizeChange: Math.round(totalSizeChange * 10) / 10,
        },
    }
}

/**
 * Parse size string to normalized oz value
 * Examples: "12 oz" -> 12, "500ml" -> 16.9, "1 lb" -> 16
 */
export function normalizeSizeToOz(sizeStr: string): number | null {
    if (!sizeStr) return null

    const cleaned = sizeStr.toLowerCase().trim()

    // Try different patterns
    const patterns = [
        { regex: /([\d.]+)\s*oz/i, multiplier: 1 },
        { regex: /([\d.]+)\s*fl\.?\s*oz/i, multiplier: 1 },
        { regex: /([\d.]+)\s*ml/i, multiplier: 0.033814 }, // ml to oz
        { regex: /([\d.]+)\s*l\b/i, multiplier: 33.814 }, // liters to oz
        { regex: /([\d.]+)\s*lb/i, multiplier: 16 }, // lb to oz
        { regex: /([\d.]+)\s*g\b/i, multiplier: 0.035274 }, // grams to oz
        { regex: /([\d.]+)\s*kg/i, multiplier: 35.274 }, // kg to oz
    ]

    for (const { regex, multiplier } of patterns) {
        const match = cleaned.match(regex)
        if (match) {
            const value = parseFloat(match[1])
            if (!isNaN(value)) {
                return Math.round(value * multiplier * 100) / 100
            }
        }
    }

    return null
}

/**
 * Run anomaly detection across all products and flag issues
 */
export async function runGlobalAnomalyDetection(
    payload: Payload
): Promise<{
    productsAnalyzed: number
    anomaliesFound: number
    productsFlagged: number
    details: Array<{
        productId: number
        productName: string
        anomalyType: string
        message: string
    }>
}> {
    const result = {
        productsAnalyzed: 0,
        anomaliesFound: 0,
        productsFlagged: 0,
        details: [] as Array<{
            productId: number
            productName: string
            anomalyType: string
            message: string
        }>,
    }

    // Get products with price history
    const productsWithHistory = await (payload.find as Function)({
        collection: 'price-history',
        limit: 100,
    })

    // Group by product ID - get distinct products
    const productIds = productsWithHistory.docs.map((d: { product: number | { id: number } }) => {
        return typeof d.product === 'number' ? d.product : d.product?.id
    }).filter(Boolean)

    if (productIds.length === 0) {
        return result
    }

    const distinctProducts = await payload.find({
        collection: 'products',
        where: {
            id: { in: productIds },
        },
        limit: 500,
    })

    for (const product of distinctProducts.docs) {
        const productData = product as { id: number; name: string }
        result.productsAnalyzed++

        const analysis = await analyzeProductPriceHistory(productData.id, payload)

        if (analysis.anomalies.length > 0) {
            result.anomaliesFound += analysis.anomalies.length

            // Get the most severe/recent anomaly
            const recentAnomaly = analysis.anomalies[analysis.anomalies.length - 1]

            if (recentAnomaly.severity === 'high') {
                result.productsFlagged++
                result.details.push({
                    productId: productData.id,
                    productName: productData.name,
                    anomalyType: recentAnomaly.type || 'unknown',
                    message: recentAnomaly.message,
                })

                // Flag the product
                await payload.update({
                    collection: 'products',
                    id: productData.id,
                    data: {
                        freshnessStatus: 'needs_review',
                    } as Record<string, unknown>,
                })
            }
        }
    }

    return result
}
