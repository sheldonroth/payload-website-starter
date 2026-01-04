import type { PayloadHandler, PayloadRequest, Payload } from 'payload'
import { createAuditLog } from '../collections/AuditLog'
import { normalizeSizeToOz, runGlobalAnomalyDetection, analyzeProductPriceHistory } from '../utilities/anomaly-detection'

/**
 * Skimpflation Detector Endpoint
 * POST /api/skimpflation/check
 *
 * Detects shrinkflation, skimpflation, and price increases.
 * Can be triggered manually or via cron job.
 *
 * Operations:
 * - scrape: Capture current prices for products
 * - analyze: Run anomaly detection on price history
 * - report: Generate skimpflation report
 */

interface ScrapeResult {
    productId: number
    productName: string
    retailer: string
    price?: number
    size?: string
    success: boolean
    error?: string
}

interface DetectorResult {
    success: boolean
    operation: 'scrape' | 'analyze' | 'report'
    productsProcessed: number
    anomaliesDetected: number
    details: unknown[]
    errors: string[]
}

// Simple price extraction from product page (mock for now - would use Playwright in production)
async function scrapeProductPrice(
    productUrl: string,
    retailer: string
): Promise<{
    price?: number
    salePrice?: number
    size?: string
    inStock?: boolean
    error?: string
}> {
    try {
        // In production, this would use Playwright or a scraping service
        // For now, we'll use a simple fetch to get page content
        const response = await fetch(productUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; ProductReportBot/1.0)',
            },
        })

        if (!response.ok) {
            return { error: `HTTP ${response.status}` }
        }

        const html = await response.text()

        // Simple regex patterns for common price formats
        // In production, this would be retailer-specific parsing
        let price: number | undefined
        let size: string | undefined

        // Try to find price patterns
        const pricePatterns = [
            /\$(\d+\.\d{2})/,
            /price["\s:]+\$?(\d+\.\d{2})/i,
            /data-price="(\d+\.\d{2})"/i,
        ]

        for (const pattern of pricePatterns) {
            const match = html.match(pattern)
            if (match) {
                price = parseFloat(match[1])
                break
            }
        }

        // Try to find size patterns
        const sizePatterns = [
            /(\d+(?:\.\d+)?\s*(?:oz|fl\.?\s*oz|ml|l|lb|g|kg))/i,
        ]

        for (const pattern of sizePatterns) {
            const match = html.match(pattern)
            if (match) {
                size = match[1]
                break
            }
        }

        return { price, size }
    } catch (error) {
        return { error: error instanceof Error ? error.message : 'Scrape failed' }
    }
}

// Scrape prices for products with URLs
async function scrapeProductPrices(
    payload: Payload,
    options: { limit?: number; retailer?: string } = {}
): Promise<ScrapeResult[]> {
    const { limit = 50, retailer } = options
    const results: ScrapeResult[] = []

    // Get products with purchaseLinks
    const products = await payload.find({
        collection: 'products',
        where: {
            'purchaseLinks.0.url': { exists: true },
        },
        limit,
    })

    for (const product of products.docs) {
        const productData = product as {
            id: number
            name: string
            purchaseLinks?: Array<{ retailer?: string; url?: string; price?: string }>
            ingredientsRaw?: string
        }

        // Get all purchase links for this product
        const links = productData.purchaseLinks || []
        if (links.length === 0) {
            results.push({
                productId: productData.id,
                productName: productData.name,
                retailer: 'unknown',
                success: false,
                error: 'No purchase links available',
            })
            continue
        }

        // Process each purchase link
        for (const link of links) {
            const url = link.url
            if (!url) continue

            // Detect retailer from URL or use provided name
            let detectedRetailer = link.retailer?.toLowerCase() || 'unknown'
            if (detectedRetailer === 'unknown') {
                if (url.includes('amazon.com')) detectedRetailer = 'amazon'
                else if (url.includes('walmart.com')) detectedRetailer = 'walmart'
                else if (url.includes('target.com')) detectedRetailer = 'target'
                else if (url.includes('costco.com')) detectedRetailer = 'costco'
            }

            if (retailer && detectedRetailer !== retailer.toLowerCase()) {
                continue // Skip if retailer filter doesn't match
            }

            // Scrape the price
            const scrapeResult = await scrapeProductPrice(url, detectedRetailer)

            if (scrapeResult.price) {
                // Store in price history
                const sizeNormalized = scrapeResult.size ? normalizeSizeToOz(scrapeResult.size) : undefined

                // Count ingredients for skimpflation tracking
                const ingredientCount = productData.ingredientsRaw
                    ? productData.ingredientsRaw.split(',').length
                    : undefined

                try {
                    await (payload.create as Function)({
                        collection: 'price-history',
                        data: {
                            product: productData.id,
                            price: scrapeResult.price,
                            salePrice: scrapeResult.salePrice,
                            size: scrapeResult.size,
                            sizeNormalized,
                            retailer: detectedRetailer,
                            sourceUrl: url,
                            capturedAt: new Date().toISOString(),
                            ingredientsSnapshot: productData.ingredientsRaw,
                            ingredientCount,
                        },
                    })

                    results.push({
                        productId: productData.id,
                        productName: productData.name,
                        retailer: detectedRetailer,
                        price: scrapeResult.price,
                        size: scrapeResult.size,
                        success: true,
                    })
                } catch (error) {
                    results.push({
                        productId: productData.id,
                        productName: productData.name,
                        retailer: detectedRetailer,
                        success: false,
                        error: error instanceof Error ? error.message : 'Database error',
                    })
                }
            } else {
                results.push({
                    productId: productData.id,
                    productName: productData.name,
                    retailer: detectedRetailer,
                    success: false,
                    error: scrapeResult.error || 'Could not extract price',
                })
            }

            // Rate limit between scrapes
            await new Promise(resolve => setTimeout(resolve, 1000))
        }
    }

    return results
}

export const skimpflationDetectorHandler: PayloadHandler = async (req: PayloadRequest) => {
    // Verify authentication
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    const isAuthenticated = req.user ||
        (cronSecret && authHeader === `Bearer ${cronSecret}`)

    if (!isAuthenticated) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const body = await req.json?.()
        const { operation = 'analyze', productId, retailer, limit } = body || {}

        const result: DetectorResult = {
            success: true,
            operation,
            productsProcessed: 0,
            anomaliesDetected: 0,
            details: [],
            errors: [],
        }

        switch (operation) {
            case 'scrape': {
                // Scrape current prices
                const scrapeResults = await scrapeProductPrices(req.payload, { limit, retailer })
                result.productsProcessed = scrapeResults.length
                result.details = scrapeResults
                result.errors = scrapeResults
                    .filter(r => !r.success)
                    .map(r => `${r.productName}: ${r.error}`)

                // Create audit log
                await createAuditLog(req.payload, {
                    action: 'freshness_check',
                    sourceType: 'system',
                    metadata: {
                        type: 'skimpflation_scrape',
                        productsProcessed: result.productsProcessed,
                        successful: scrapeResults.filter(r => r.success).length,
                        failed: result.errors.length,
                    },
                })
                break
            }

            case 'analyze': {
                if (productId) {
                    // Analyze single product
                    const analysis = await analyzeProductPriceHistory(productId, req.payload)
                    result.productsProcessed = 1
                    result.anomaliesDetected = analysis.summary.anomalyCount
                    result.details = [analysis]
                } else {
                    // Run global analysis
                    const globalAnalysis = await runGlobalAnomalyDetection(req.payload)
                    result.productsProcessed = globalAnalysis.productsAnalyzed
                    result.anomaliesDetected = globalAnalysis.anomaliesFound
                    result.details = globalAnalysis.details
                }

                // Create audit log
                await createAuditLog(req.payload, {
                    action: 'freshness_check',
                    sourceType: 'system',
                    metadata: {
                        type: 'skimpflation_analysis',
                        productsAnalyzed: result.productsProcessed,
                        anomaliesFound: result.anomaliesDetected,
                    },
                })
                break
            }

            case 'report': {
                // Generate a summary report of all detected anomalies
                const recentAnomalies = await (req.payload.find as Function)({
                    collection: 'price-history',
                    where: {
                        anomalyDetected: { equals: true },
                    },
                    sort: '-capturedAt',
                    limit: 100,
                })

                // Group by anomaly type
                const byType: Record<string, number> = {}
                for (const doc of recentAnomalies.docs) {
                    const record = doc as { anomalyType?: string }
                    const type = record.anomalyType || 'unknown'
                    byType[type] = (byType[type] || 0) + 1
                }

                result.productsProcessed = recentAnomalies.totalDocs
                result.details = [{
                    totalAnomalies: recentAnomalies.totalDocs,
                    byType,
                    recentRecords: recentAnomalies.docs.slice(0, 20),
                }]
                break
            }

            default:
                return Response.json({
                    error: 'Invalid operation. Use: scrape, analyze, or report',
                }, { status: 400 })
        }

        console.log(`Skimpflation Detector [${operation}]: ${result.productsProcessed} products, ${result.anomaliesDetected} anomalies`)
        return Response.json(result)
    } catch (error) {
        console.error('Skimpflation Detector error:', error)
        return Response.json({
            success: false,
            error: error instanceof Error ? error.message : 'Detector failed',
        }, { status: 500 })
    }
}

/**
 * Cron job wrapper
 */
export async function runSkimpflationDetector(payload: Payload): Promise<DetectorResult> {
    const result: DetectorResult = {
        success: true,
        operation: 'analyze',
        productsProcessed: 0,
        anomaliesDetected: 0,
        details: [],
        errors: [],
    }

    try {
        const globalAnalysis = await runGlobalAnomalyDetection(payload)
        result.productsProcessed = globalAnalysis.productsAnalyzed
        result.anomaliesDetected = globalAnalysis.anomaliesFound
        result.details = globalAnalysis.details
        return result
    } catch (error) {
        result.success = false
        result.errors.push(error instanceof Error ? error.message : 'Unknown error')
        return result
    }
}
