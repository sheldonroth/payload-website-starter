import type { Payload } from 'payload'

/**
 * Risk Prediction Utility
 *
 * Predicts contamination risk and lab testing priority for products.
 * Uses a rule-based scoring system (can be enhanced with ML later).
 *
 * Risk factors considered:
 * - Ingredient profile (known problem ingredients)
 * - Brand history (recall history, trust score)
 * - Product category (some categories higher risk)
 * - Manufacturing signals (imported vs domestic, etc.)
 * - Community reports (reaction reports, complaints)
 */

interface RiskFactor {
    name: string
    weight: number
    score: number
    details: string
}

interface RiskPrediction {
    productId: number
    overallRisk: number // 0-100
    riskLevel: 'low' | 'medium' | 'high' | 'critical'
    testingPriority: number // 1-10 scale
    factors: RiskFactor[]
    recommendedTests: string[]
    confidence: number
}

// Risk weights by category
const CATEGORY_RISK_WEIGHTS: Record<string, number> = {
    'baby-food': 40,
    'baby-formula': 45,
    'childrens-vitamins': 35,
    'protein-powder': 30,
    'supplements': 28,
    'imported-spices': 35,
    'candy': 25,
    'packaged-snacks': 20,
    'beverages': 18,
    'canned-goods': 15,
    'fresh-produce': 12,
    'default': 15,
}

// Ingredient risk signals
const INGREDIENT_RISK_SIGNALS: Record<string, number> = {
    'artificial colors': 25,
    'red 40': 30,
    'yellow 5': 28,
    'yellow 6': 28,
    'blue 1': 25,
    'titanium dioxide': 30,
    'bht': 20,
    'bha': 20,
    'propylparaben': 25,
    'sodium nitrite': 22,
    'high fructose corn syrup': 15,
    'aspartame': 18,
    'sucralose': 15,
    'carrageenan': 20,
    'potassium bromate': 35,
    'azodicarbonamide': 30,
}

// Heavy metals commonly tested
const HEAVY_METAL_TESTS = ['lead', 'arsenic', 'cadmium', 'mercury']

/**
 * Calculate risk prediction for a product
 */
export async function predictProductRisk(
    productId: number,
    payload: Payload
): Promise<RiskPrediction> {
    const factors: RiskFactor[] = []
    const recommendedTests: string[] = []

    // Fetch product with related data
    const product = await payload.findByID({
        collection: 'products',
        id: productId,
        depth: 2,
    }) as {
        id: number
        name: string
        brand?: string
        category?: { slug?: string; name?: string } | number
        ingredientsList?: Array<{ id: number; name: string; verdict?: string }>
        ingredientsRaw?: string
        source?: string
        sourceUrl?: string
    }

    if (!product) {
        return {
            productId,
            overallRisk: 0,
            riskLevel: 'low',
            testingPriority: 1,
            factors: [],
            recommendedTests: [],
            confidence: 0,
        }
    }

    // === FACTOR 1: Category Risk ===
    const categorySlug = typeof product.category === 'object' ? product.category?.slug : 'default'
    const categoryRisk = CATEGORY_RISK_WEIGHTS[categorySlug || 'default'] || CATEGORY_RISK_WEIGHTS.default

    factors.push({
        name: 'Category Risk',
        weight: 0.2,
        score: categoryRisk,
        details: `Category "${categorySlug}" has base risk of ${categoryRisk}`,
    })

    // Baby/children products always get heavy metal testing
    if (categorySlug?.includes('baby') || categorySlug?.includes('children')) {
        recommendedTests.push(...HEAVY_METAL_TESTS)
    }

    // === FACTOR 2: Ingredient Risk ===
    let ingredientRiskScore = 0
    const flaggedIngredients: string[] = []

    // Check linked ingredients
    if (product.ingredientsList && Array.isArray(product.ingredientsList)) {
        for (const ing of product.ingredientsList) {
            if (ing.verdict === 'avoid') {
                ingredientRiskScore += 30
                flaggedIngredients.push(ing.name)
            } else if (ing.verdict === 'caution') {
                ingredientRiskScore += 15
            }
        }
    }

    // Check raw ingredients text for signals
    if (product.ingredientsRaw) {
        const rawLower = product.ingredientsRaw.toLowerCase()
        for (const [ingredient, risk] of Object.entries(INGREDIENT_RISK_SIGNALS)) {
            if (rawLower.includes(ingredient.toLowerCase())) {
                ingredientRiskScore += risk * 0.5 // Half weight since not verified
                if (!flaggedIngredients.includes(ingredient)) {
                    flaggedIngredients.push(ingredient)
                }
            }
        }
    }

    ingredientRiskScore = Math.min(ingredientRiskScore, 100)

    factors.push({
        name: 'Ingredient Profile',
        weight: 0.35,
        score: ingredientRiskScore,
        details: flaggedIngredients.length > 0
            ? `Flagged ingredients: ${flaggedIngredients.slice(0, 5).join(', ')}`
            : 'No known problem ingredients detected',
    })

    if (flaggedIngredients.some(i => i.toLowerCase().includes('color') || i.toLowerCase().includes('dye'))) {
        recommendedTests.push('artificial colors panel')
    }

    // === FACTOR 3: Brand Trust ===
    let brandRiskScore = 50 // Default neutral
    let brandDetails = 'Brand not in database'

    if (product.brand) {
        const brand = await (payload.find as Function)({
            collection: 'brands',
            where: { name: { equals: product.brand } },
            limit: 1,
        })

        if (brand.totalDocs > 0) {
            const brandData = brand.docs[0] as {
                trustScore?: number
                recallCount?: number
                avoidCount?: number
            }

            // Invert trust score to risk (high trust = low risk)
            brandRiskScore = 100 - (brandData.trustScore || 50)

            // Boost risk for brands with recalls
            if (brandData.recallCount && brandData.recallCount > 0) {
                brandRiskScore = Math.min(brandRiskScore + brandData.recallCount * 10, 100)
            }

            brandDetails = `Trust score: ${brandData.trustScore || 'N/A'}, Recalls: ${brandData.recallCount || 0}`
        }
    }

    factors.push({
        name: 'Brand History',
        weight: 0.2,
        score: brandRiskScore,
        details: brandDetails,
    })

    // === FACTOR 4: Community Reports ===
    let communityRiskScore = 0
    let communityDetails = 'No community reports'

    const reactionReports = await (payload.find as Function)({
        collection: 'user-submissions',
        where: {
            product: { equals: productId },
            type: { equals: 'reaction_report' },
            status: { equals: 'verified' },
        },
        limit: 50,
    })

    if (reactionReports.totalDocs > 0) {
        communityRiskScore = Math.min(reactionReports.totalDocs * 10, 80)

        // Check severity
        let severeCount = 0
        for (const report of reactionReports.docs) {
            const r = report as { reactionDetails?: { severity?: string } }
            if (r.reactionDetails?.severity === 'severe' || r.reactionDetails?.severity === 'medical') {
                severeCount++
            }
        }

        if (severeCount > 0) {
            communityRiskScore = Math.min(communityRiskScore + severeCount * 15, 100)
        }

        communityDetails = `${reactionReports.totalDocs} reports (${severeCount} severe)`
    }

    factors.push({
        name: 'Community Reports',
        weight: 0.15,
        score: communityRiskScore,
        details: communityDetails,
    })

    // === FACTOR 5: Data Freshness ===
    let freshnessRiskScore = 0
    let freshnessDetails = 'Recently updated'

    const productFull = product as { updatedAt?: string; freshnessStatus?: string }
    if (productFull.updatedAt) {
        const daysSinceUpdate = Math.floor(
            (Date.now() - new Date(productFull.updatedAt).getTime()) / (1000 * 60 * 60 * 24)
        )

        if (daysSinceUpdate > 365) {
            freshnessRiskScore = 30
            freshnessDetails = `Not updated in ${daysSinceUpdate} days`
        } else if (daysSinceUpdate > 180) {
            freshnessRiskScore = 20
            freshnessDetails = `Last updated ${daysSinceUpdate} days ago`
        }
    }

    if (productFull.freshnessStatus === 'needs_review') {
        freshnessRiskScore += 15
        freshnessDetails += ' (needs review)'
    }

    factors.push({
        name: 'Data Freshness',
        weight: 0.1,
        score: freshnessRiskScore,
        details: freshnessDetails,
    })

    // === CALCULATE OVERALL RISK ===
    let overallRisk = 0
    for (const factor of factors) {
        overallRisk += factor.score * factor.weight
    }
    overallRisk = Math.round(overallRisk)

    // Determine risk level
    let riskLevel: 'low' | 'medium' | 'high' | 'critical'
    if (overallRisk >= 70) riskLevel = 'critical'
    else if (overallRisk >= 50) riskLevel = 'high'
    else if (overallRisk >= 25) riskLevel = 'medium'
    else riskLevel = 'low'

    // Calculate testing priority (1-10)
    const testingPriority = Math.ceil(overallRisk / 10)

    // Add default tests if none recommended
    if (recommendedTests.length === 0 && overallRisk > 30) {
        recommendedTests.push('pesticides', 'heavy metals screen')
    }

    // Confidence based on data completeness
    let confidence = 0.5 // Base confidence
    if (product.ingredientsList && product.ingredientsList.length > 0) confidence += 0.2
    if (product.brand) confidence += 0.15
    if (reactionReports.totalDocs > 0) confidence += 0.15
    confidence = Math.round(confidence * 100)

    return {
        productId,
        overallRisk,
        riskLevel,
        testingPriority,
        factors,
        recommendedTests: [...new Set(recommendedTests)],
        confidence,
    }
}

/**
 * Batch predict risk for multiple products
 */
export async function batchPredictRisk(
    payload: Payload,
    options: { category?: string; limit?: number; minRisk?: number } = {}
): Promise<RiskPrediction[]> {
    const { category, limit = 100, minRisk = 0 } = options

    const whereClause = category
        ? { 'category.slug': { equals: category } }
        : {}

    const products = await payload.find({
        collection: 'products',
        where: whereClause as Record<string, { equals: string }>,
        limit,
    })

    const predictions: RiskPrediction[] = []

    for (const product of products.docs) {
        const productData = product as { id: number }
        const prediction = await predictProductRisk(productData.id, payload)

        if (prediction.overallRisk >= minRisk) {
            predictions.push(prediction)
        }
    }

    // Sort by risk (highest first)
    predictions.sort((a, b) => b.overallRisk - a.overallRisk)

    return predictions
}

/**
 * Get testing queue prioritized by risk
 */
export async function getTestingQueue(
    payload: Payload,
    limit = 20
): Promise<Array<RiskPrediction & { productName: string }>> {
    // Get predictions for all products
    const predictions = await batchPredictRisk(payload, { limit: 500, minRisk: 30 })

    // Get product names
    const queue: Array<RiskPrediction & { productName: string }> = []

    for (const pred of predictions.slice(0, limit)) {
        const product = await payload.findByID({
            collection: 'products',
            id: pred.productId,
        }) as { name: string }

        queue.push({
            ...pred,
            productName: product.name,
        })
    }

    return queue
}
