import type { PayloadHandler, PayloadRequest, Payload } from 'payload'
import { createAuditLog } from '../collections/AuditLog'

/**
 * Brand Trust Index Endpoint
 * POST /api/brand/trust
 *
 * Calculates and updates brand trust scores based on:
 * - Product ingredient quality across all products
 * - Recall history
 * - Transparency practices
 * - Formulation consistency
 * - Community reports
 */

interface TrustCalculation {
    brandId: number
    brandName: string
    trustScore: number
    trustGrade: 'A' | 'B' | 'C' | 'D' | 'F'
    breakdown: {
        ingredientQuality: number
        recallHistory: number
        transparency: number
        consistency: number
        responsiveness: number
    }
    stats: {
        productCount: number
        avoidCount: number
        recallCount: number
    }
}

interface TrustResult {
    success: boolean
    brandsProcessed: number
    calculations: TrustCalculation[]
    errors: string[]
}

/**
 * Calculate trust score for a single brand
 */
async function calculateBrandTrust(
    brandId: number,
    payload: Payload
): Promise<TrustCalculation | null> {
    const brand = await (payload.findByID as Function)({
        collection: 'brands',
        id: brandId,
    }) as {
        id: number
        name: string
        recalls?: Array<{ severity?: string }>
    }

    if (!brand) return null

    // Get all products for this brand
    const products = await payload.find({
        collection: 'products',
        where: {
            brand: { equals: brand.name },
        },
        limit: 500,
    })

    const productCount = products.totalDocs
    if (productCount === 0) {
        // No products, return neutral score
        return {
            brandId,
            brandName: brand.name,
            trustScore: 50,
            trustGrade: 'C',
            breakdown: {
                ingredientQuality: 50,
                recallHistory: 100,
                transparency: 50,
                consistency: 50,
                responsiveness: 50,
            },
            stats: {
                productCount: 0,
                avoidCount: 0,
                recallCount: brand.recalls?.length || 0,
            },
        }
    }

    // === INGREDIENT QUALITY (35% weight) ===
    let avoidCount = 0
    let cautionCount = 0
    let safeCount = 0

    for (const product of products.docs) {
        const productData = product as { verdict?: string }
        if (productData.verdict === 'avoid') avoidCount++
        else if (productData.verdict === 'caution') cautionCount++
        else if (productData.verdict === 'recommend') safeCount++
    }

    // Score: 100 if all safe, penalize for avoids and cautions
    const avoidPenalty = (avoidCount / productCount) * 100
    const cautionPenalty = (cautionCount / productCount) * 30
    const ingredientQuality = Math.max(0, 100 - avoidPenalty - cautionPenalty)

    // === RECALL HISTORY (25% weight) ===
    const recallCount = brand.recalls?.length || 0
    const severeRecalls = brand.recalls?.filter(r =>
        r.severity === 'class_i'
    ).length || 0

    // Score: 100 if no recalls, penalize for each recall
    const recallHistory = Math.max(0, 100 - (recallCount * 15) - (severeRecalls * 20))

    // === TRANSPARENCY (15% weight) ===
    // Check how many products have complete ingredient data
    let productsWithIngredients = 0
    for (const product of products.docs) {
        const productData = product as { ingredientsRaw?: string; ingredientsList?: unknown[] }
        if (productData.ingredientsRaw || (productData.ingredientsList && productData.ingredientsList.length > 0)) {
            productsWithIngredients++
        }
    }
    const transparency = (productsWithIngredients / productCount) * 100

    // === CONSISTENCY (15% weight) ===
    // Check for skimpflation/shrinkflation anomalies
    // For now, use a placeholder - would check price-history in production
    const consistency = 80 // Placeholder - would calculate from price history

    // === RESPONSIVENESS (10% weight) ===
    // Check for reaction reports and resolutions
    const reactionReports = await (payload.find as Function)({
        collection: 'user-submissions',
        where: {
            type: { equals: 'reaction_report' },
            status: { equals: 'verified' },
        },
        limit: 100,
    })

    // Filter for this brand's products
    const brandReports = reactionReports.docs.filter((r: unknown) => {
        const report = r as { product?: number | { brand?: string } }
        // Would need to join with products to get brand
        return false // Placeholder
    }).length

    // Score: Start at 80, penalize for unaddressed reports
    const responsiveness = Math.max(0, 80 - (brandReports * 5))

    // === CALCULATE OVERALL TRUST SCORE ===
    const trustScore = Math.round(
        ingredientQuality * 0.35 +
        recallHistory * 0.25 +
        transparency * 0.15 +
        consistency * 0.15 +
        responsiveness * 0.10
    )

    // Determine grade
    let trustGrade: 'A' | 'B' | 'C' | 'D' | 'F'
    if (trustScore >= 85) trustGrade = 'A'
    else if (trustScore >= 70) trustGrade = 'B'
    else if (trustScore >= 55) trustGrade = 'C'
    else if (trustScore >= 40) trustGrade = 'D'
    else trustGrade = 'F'

    return {
        brandId,
        brandName: brand.name,
        trustScore,
        trustGrade,
        breakdown: {
            ingredientQuality: Math.round(ingredientQuality),
            recallHistory: Math.round(recallHistory),
            transparency: Math.round(transparency),
            consistency: Math.round(consistency),
            responsiveness: Math.round(responsiveness),
        },
        stats: {
            productCount,
            avoidCount,
            recallCount,
        },
    }
}

export const brandTrustHandler: PayloadHandler = async (req: PayloadRequest) => {
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
        const { brandId, recalculateAll = false } = body || {}

        const result: TrustResult = {
            success: true,
            brandsProcessed: 0,
            calculations: [],
            errors: [],
        }

        if (brandId) {
            // Calculate for single brand
            const calculation = await calculateBrandTrust(brandId, req.payload)

            if (calculation) {
                // Update the brand
                await (req.payload.update as Function)({
                    collection: 'brands',
                    id: brandId,
                    data: {
                        trustScore: calculation.trustScore,
                        trustGrade: calculation.trustGrade,
                        scoreBreakdown: calculation.breakdown,
                        productCount: calculation.stats.productCount,
                        avoidCount: calculation.stats.avoidCount,
                        recallCount: calculation.stats.recallCount,
                        trustScoreLastCalculated: new Date().toISOString(),
                    },
                })

                result.calculations.push(calculation)
                result.brandsProcessed = 1
            } else {
                result.errors.push(`Brand ${brandId} not found`)
            }
        } else if (recalculateAll) {
            // Recalculate all brands
            const brands = await (req.payload.find as Function)({
                collection: 'brands',
                limit: 500,
            })

            for (const brand of brands.docs) {
                const brandData = brand as { id: number; name: string }

                try {
                    const calculation = await calculateBrandTrust(brandData.id, req.payload)

                    if (calculation) {
                        await (req.payload.update as Function)({
                            collection: 'brands',
                            id: brandData.id,
                            data: {
                                trustScore: calculation.trustScore,
                                trustGrade: calculation.trustGrade,
                                scoreBreakdown: calculation.breakdown,
                                productCount: calculation.stats.productCount,
                                avoidCount: calculation.stats.avoidCount,
                                recallCount: calculation.stats.recallCount,
                                trustScoreLastCalculated: new Date().toISOString(),
                            },
                        })

                        result.calculations.push(calculation)
                        result.brandsProcessed++
                    }
                } catch (error) {
                    result.errors.push(`Failed to calculate ${brandData.name}: ${error instanceof Error ? error.message : 'unknown'}`)
                }
            }
        } else {
            return Response.json({
                error: 'Either brandId or recalculateAll=true is required',
            }, { status: 400 })
        }

        // Create audit log
        await createAuditLog(req.payload, {
            action: 'freshness_check',
            sourceType: 'system',
            metadata: {
                type: 'brand_trust_calculation',
                brandsProcessed: result.brandsProcessed,
                averageTrustScore: result.calculations.length > 0
                    ? Math.round(result.calculations.reduce((sum, c) => sum + c.trustScore, 0) / result.calculations.length)
                    : 0,
            },
        })

        console.log(`Brand Trust: Processed ${result.brandsProcessed} brands`)
        return Response.json(result)
    } catch (error) {
        console.error('Brand Trust calculation error:', error)
        return Response.json({
            success: false,
            error: error instanceof Error ? error.message : 'Calculation failed',
        }, { status: 500 })
    }
}

/**
 * Sync brands from products
 * Creates brand entries for brands found in products
 */
export const brandSyncHandler: PayloadHandler = async (req: PayloadRequest) => {
    if (!req.user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        // Get all unique brands from products
        const products = await req.payload.find({
            collection: 'products',
            where: {
                brand: { exists: true },
            },
            limit: 1000,
        })

        const uniqueBrands = new Set<string>()
        for (const product of products.docs) {
            const productData = product as { brand?: string }
            if (productData.brand) {
                uniqueBrands.add(productData.brand.trim())
            }
        }

        let created = 0
        let existing = 0

        for (const brandName of uniqueBrands) {
            // Check if brand already exists
            const exists = await (req.payload.find as Function)({
                collection: 'brands',
                where: { name: { equals: brandName } },
                limit: 1,
            })

            if (exists.totalDocs === 0) {
                await (req.payload.create as Function)({
                    collection: 'brands',
                    data: {
                        name: brandName,
                        slug: brandName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                    },
                })
                created++
            } else {
                existing++
            }
        }

        return Response.json({
            success: true,
            uniqueBrandsFound: uniqueBrands.size,
            created,
            existing,
        })
    } catch (error) {
        console.error('Brand sync error:', error)
        return Response.json({
            success: false,
            error: error instanceof Error ? error.message : 'Sync failed',
        }, { status: 500 })
    }
}
