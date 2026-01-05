import type { PayloadRequest } from 'payload'

/**
 * Product Report API Endpoint
 *
 * Returns comprehensive health analysis for products by barcode.
 * Uses Open Food Facts as the primary source for product identification,
 * then enriches with our proprietary health analysis when available.
 *
 * Response sources:
 * - 'complete': Full health report (OFF + our health data)
 * - 'external': Product identified via OFF, no health data yet (triggers vote)
 * - 'internal': Only our data (rare edge case)
 * - null: Unknown product (triggers photo capture)
 *
 * GET /api/product-report/:barcode
 */

// Open Food Facts product response
interface OpenFoodFactsProduct {
    product_name?: string
    brands?: string
    image_url?: string
    image_front_url?: string
    categories?: string
    ingredients_text?: string
    nutriscore_grade?: string
    nova_group?: number
    nutriments?: {
        energy_kcal_100g?: number
        fat_100g?: number
        saturated_fat_100g?: number
        carbohydrates_100g?: number
        sugars_100g?: number
        fiber_100g?: number
        proteins_100g?: number
        salt_100g?: number
        sodium_100g?: number
    }
}

interface ProductReportResponse {
    source: 'complete' | 'external' | 'internal'
    barcode: string
    productName: string
    brand: string
    imageUrl?: string
    category?: string
    ingredients?: string

    // Only present when we have health analysis
    overallScore?: number
    overallGrade?: 'A' | 'B' | 'C' | 'D' | 'F'
    healthSummary?: string
    quickVerdict?: string

    categoryScores?: Array<{
        category: string
        score: number
        grade: 'A' | 'B' | 'C' | 'D' | 'F'
        label: string
        summary: string
        factors: Array<{
            name: string
            impact: 'positive' | 'negative' | 'neutral'
            description: string
            value?: string
        }>
    }>

    nutritionalHighlights?: Array<{
        nutrient: string
        value: string
        unit: string
        dailyValue?: number
        status: 'good' | 'moderate' | 'high' | 'low'
        context: string
    }>

    additives?: Array<{
        name: string
        code?: string
        type: string
        safetyRating: 'safe' | 'generally_safe' | 'controversial' | 'avoid'
        description: string
        potentialEffects?: string[]
    }>

    processingAssessment?: {
        level: 'unprocessed' | 'minimally_processed' | 'processed' | 'ultra_processed'
        score: number
        indicators: string[]
        explanation: string
    }

    recommendations?: Array<{
        id: string
        type: 'swap' | 'tip' | 'warning' | 'education'
        priority: 'high' | 'medium' | 'low'
        title: string
        description: string
        actionText?: string
        actionUrl?: string
        relatedProductId?: string
        icon?: string
    }>

    educationalTips?: Array<{
        id: string
        title: string
        content: string
        category: string
        learnMoreUrl?: string
        icon?: string
    }>

    // External data from Open Food Facts (when available)
    externalData?: {
        nutriscoreGrade?: string
        novaGroup?: number
        nutriments?: OpenFoodFactsProduct['nutriments']
    }

    lastUpdated: string
    dataSource: string
    confidence: number
}

function getGradeFromScore(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (score >= 80) return 'A'
    if (score >= 60) return 'B'
    if (score >= 40) return 'C'
    if (score >= 20) return 'D'
    return 'F'
}

function getVerdictFromGrade(grade: 'A' | 'B' | 'C' | 'D' | 'F'): string {
    const verdicts: Record<typeof grade, string> = {
        A: 'Excellent choice for your health',
        B: 'Good choice with minor considerations',
        C: 'Moderate health impact - consume in moderation',
        D: 'Consider healthier alternatives',
        F: 'Not recommended - seek healthier options',
    }
    return verdicts[grade]
}

/**
 * Fetch product data from Open Food Facts API
 * Returns null if product not found or on error
 */
async function fetchOpenFoodFacts(barcode: string): Promise<OpenFoodFactsProduct | null> {
    try {
        const fields = [
            'product_name',
            'brands',
            'image_url',
            'image_front_url',
            'categories',
            'ingredients_text',
            'nutriscore_grade',
            'nova_group',
            'nutriments',
        ].join(',')

        const response = await fetch(
            `https://world.openfoodfacts.org/api/v2/product/${barcode}?fields=${fields}`,
            {
                headers: {
                    'User-Agent': 'TheProductReport/1.0 (contact@theproductreport.org)',
                },
            }
        )

        if (!response.ok) {
            console.log(`[product-report] OFF returned ${response.status} for barcode ${barcode}`)
            return null
        }

        const data = await response.json()

        // OFF returns status: 0 when product not found
        if (data.status === 0 || !data.product) {
            console.log(`[product-report] Product not found in OFF: ${barcode}`)
            return null
        }

        return data.product as OpenFoodFactsProduct
    } catch (error) {
        console.error('[product-report] Open Food Facts fetch error:', error)
        return null
    }
}

/**
 * Map NOVA group to processing level
 */
function getProcessingLevel(novaGroup?: number): 'unprocessed' | 'minimally_processed' | 'processed' | 'ultra_processed' {
    switch (novaGroup) {
        case 1: return 'unprocessed'
        case 2: return 'minimally_processed'
        case 3: return 'processed'
        case 4: return 'ultra_processed'
        default: return 'processed'
    }
}

export const productReportHandler = async (req: PayloadRequest): Promise<Response> => {
    if (req.method !== 'GET') {
        return Response.json({ error: 'Method not allowed' }, { status: 405 })
    }

    try {
        // Extract barcode from URL path
        const url = new URL(req.url || '', 'http://localhost')
        const pathParts = url.pathname.split('/')
        const barcode = pathParts[pathParts.length - 1]

        if (!barcode || barcode === 'product-report') {
            return Response.json({ error: 'Barcode is required' }, { status: 400 })
        }

        console.log(`[product-report] Looking up barcode: ${barcode}`)

        // Step 1: Fetch from Open Food Facts (primary source for product identity)
        const offProduct = await fetchOpenFoodFacts(barcode)

        // Step 2: Check our database for health analysis
        const products = await req.payload.find({
            collection: 'products',
            where: {
                upc: { equals: barcode },
            },
            limit: 1,
            depth: 1,
        })

        const hasHealthData = products.docs.length > 0
        const internalProduct = hasHealthData
            ? (products.docs[0] as {
                  id: number
                  name: string
                  brand?: string
                  imageUrl?: string
                  overallScore?: number
                  summary?: string
                  category?: { name: string } | string
                  updatedAt?: string
              })
            : null

        // Step 3: Determine response based on available data

        // Case 1: Neither source has data - true unknown
        if (!offProduct && !hasHealthData) {
            console.log(`[product-report] Unknown product: ${barcode}`)
            return Response.json(
                {
                    source: null,
                    barcode,
                    error: 'Product not found',
                    code: 'PRODUCT_NOT_FOUND',
                },
                { status: 404 }
            )
        }

        // Case 2: OFF has product but we don't have health data - trigger vote flow
        if (offProduct && !hasHealthData) {
            console.log(`[product-report] External product (OFF only): ${barcode}`)

            const response: ProductReportResponse = {
                source: 'external',
                barcode,
                productName: offProduct.product_name || 'Unknown Product',
                brand: offProduct.brands || 'Unknown Brand',
                imageUrl: offProduct.image_front_url || offProduct.image_url,
                category: offProduct.categories?.split(',')[0]?.trim(),
                ingredients: offProduct.ingredients_text,

                // Include OFF nutritional data for context
                externalData: {
                    nutriscoreGrade: offProduct.nutriscore_grade,
                    novaGroup: offProduct.nova_group,
                    nutriments: offProduct.nutriments,
                },

                lastUpdated: new Date().toISOString(),
                dataSource: 'Open Food Facts',
                confidence: 0.7,
            }

            return Response.json(response)
        }

        // Case 3: We have health data (with or without OFF data) - full report
        if (internalProduct) {
            const overallScore = internalProduct.overallScore || 0
            const overallGrade = getGradeFromScore(overallScore)

            // Get category name from our data
            let categoryName: string | undefined
            if (internalProduct.category) {
                if (typeof internalProduct.category === 'object' && 'name' in internalProduct.category) {
                    categoryName = internalProduct.category.name
                } else if (typeof internalProduct.category === 'string') {
                    categoryName = internalProduct.category
                }
            }

            // Prefer OFF data for product info, fallback to our data
            const response: ProductReportResponse = {
                source: offProduct ? 'complete' : 'internal',
                barcode,
                productName: offProduct?.product_name || internalProduct.name || 'Unknown Product',
                brand: offProduct?.brands || internalProduct.brand || 'Unknown Brand',
                imageUrl: offProduct?.image_front_url || offProduct?.image_url || internalProduct.imageUrl,
                category: offProduct?.categories?.split(',')[0]?.trim() || categoryName,
                ingredients: offProduct?.ingredients_text,

                // Our proprietary health analysis
                overallScore,
                overallGrade,
                healthSummary: internalProduct.summary || '',
                quickVerdict: getVerdictFromGrade(overallGrade),

                categoryScores: [
                    {
                        category: 'overall',
                        score: overallScore,
                        grade: overallGrade,
                        label: 'Overall Health Score',
                        summary: internalProduct.summary || 'Based on lab analysis',
                        factors: [],
                    },
                ],

                nutritionalHighlights: [],
                additives: [],

                processingAssessment: {
                    level: getProcessingLevel(offProduct?.nova_group),
                    score: overallScore,
                    indicators: [],
                    explanation: offProduct?.nova_group
                        ? `NOVA Group ${offProduct.nova_group} classification from Open Food Facts.`
                        : 'Processing assessment based on ingredient analysis.',
                },

                recommendations: [],
                educationalTips: [],

                // Include OFF data if available
                externalData: offProduct
                    ? {
                          nutriscoreGrade: offProduct.nutriscore_grade,
                          novaGroup: offProduct.nova_group,
                          nutriments: offProduct.nutriments,
                      }
                    : undefined,

                lastUpdated: internalProduct.updatedAt || new Date().toISOString(),
                dataSource: offProduct ? 'The Product Report Lab + Open Food Facts' : 'The Product Report Lab',
                confidence: 0.85,
            }

            return Response.json(response)
        }

        // Fallback (shouldn't reach here)
        return Response.json(
            { error: 'Unexpected state', barcode },
            { status: 500 }
        )
    } catch (error) {
        console.error('[product-report] Error:', error)
        return Response.json(
            { error: 'Failed to fetch product report', details: String(error) },
            { status: 500 }
        )
    }
}
