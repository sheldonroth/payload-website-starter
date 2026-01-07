import type { PayloadHandler, PayloadRequest } from 'payload'
import { applyLiabilityShield, isPremiumUser } from '../access/liabilityShield'

/**
 * Find Safe Alternative Endpoint
 *
 * GET /api/products/alternatives?productId=xxx&archetypes=true
 *
 * Returns products in the same category with better safety profiles.
 * Scoring algorithm considers:
 * - Verdict improvement (50%)
 * - Ingredient safety score (30%)
 * - Price similarity (20%)
 *
 * When archetypes=true, returns classified alternatives:
 * - Best Value: Cheapest recommended product
 * - Premium Pick: Most expensive recommended product
 * - Hidden Gem: Least popular (lowest sourceCount) - FREE UNLOCK
 *
 * @openapi
 * /products/alternatives:
 *   get:
 *     summary: Find safer product alternatives
 *     description: |
 *       Returns products in the same category with better safety profiles.
 *       Scoring considers verdict improvement (50%), ingredient safety (30%),
 *       and price similarity (20%).
 *
 *       With archetypes=true, returns classified alternatives:
 *       - Best Value: Cheapest recommended product (locked for free users)
 *       - Premium Pick: Most expensive recommended (locked for free users)
 *       - Hidden Gem: Least popular product (FREE for all users)
 *     tags: [Products, Mobile]
 *     parameters:
 *       - in: query
 *         name: productId
 *         required: true
 *         schema:
 *           type: string
 *         description: Source product ID to find alternatives for
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 5
 *           maximum: 10
 *         description: Maximum alternatives to return
 *       - in: query
 *         name: archetypes
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Return classified archetypes (bestValue, premiumPick, hiddenGem)
 *       - in: query
 *         name: fingerprintHash
 *         schema:
 *           type: string
 *         description: Device fingerprint for unlock status checking
 *     responses:
 *       200:
 *         description: Alternatives found
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - type: object
 *                   description: Standard response
 *                   properties:
 *                     alternatives:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           name:
 *                             type: string
 *                           slug:
 *                             type: string
 *                           verdict:
 *                             type: string
 *                           overallScore:
 *                             type: number
 *                           priceRange:
 *                             type: string
 *                           brand:
 *                             type: string
 *                           image:
 *                             type: object
 *                             properties:
 *                               url:
 *                                 type: string
 *                               alt:
 *                                 type: string
 *                           score:
 *                             type: number
 *                             description: Match score (0-100)
 *                           improvements:
 *                             type: array
 *                             items:
 *                               type: string
 *                     sourceProduct:
 *                       type: object
 *                     totalCandidates:
 *                       type: integer
 *                 - type: object
 *                   description: Archetypes response
 *                   properties:
 *                     archetypes:
 *                       type: object
 *                       properties:
 *                         bestValue:
 *                           type: object
 *                           nullable: true
 *                         premiumPick:
 *                           type: object
 *                           nullable: true
 *                         hiddenGem:
 *                           type: object
 *                           nullable: true
 *                     sourceProduct:
 *                       type: object
 *                     isPremium:
 *                       type: boolean
 *                     totalCandidates:
 *                       type: integer
 *       400:
 *         description: Missing productId
 *       404:
 *         description: Product not found
 *       500:
 *         description: Failed to find alternatives
 */

interface ProductAlternative {
    id: string
    name: string
    slug: string
    verdict?: string
    overallScore?: number
    priceRange?: string
    brand?: string
    image?: {
        url?: string
        alt?: string
    }
    score: number
    improvements: string[]
    archetype?: 'best_value' | 'premium_pick' | 'hidden_gem'
    isLocked?: boolean
}

type Archetype = 'best_value' | 'premium_pick' | 'hidden_gem'

interface ArchetypeAlternatives {
    bestValue: ProductAlternative | null
    premiumPick: ProductAlternative | null
    hiddenGem: ProductAlternative | null
}

const VERDICT_SCORES: Record<string, number> = {
    recommend: 100,
    consider: 80,
    caution: 60,
    limit: 40,
    avoid: 0,
}

const PRICE_RANGE_ORDER = ['budget', 'mid-range', 'premium', 'luxury']

// Price range to numeric value for comparison
const PRICE_TO_NUMBER: Record<string, number> = {
    '$': 1,
    '$$': 2,
    '$$$': 3,
    '$$$$': 4,
    'budget': 1,
    'mid-range': 2,
    'premium': 3,
    'luxury': 4,
}

/**
 * Convert price range string to a numeric value for comparison.
 */
function priceToNumber(priceRange?: string): number {
    if (!priceRange) return 2 // Default to mid-range
    return PRICE_TO_NUMBER[priceRange.toLowerCase()] || 2
}

/**
 * Classify alternatives into archetypes.
 *
 * - Best Value: Cheapest recommended product ($ or $$)
 * - Premium Pick: Most expensive recommended product ($$$ or $$$$)
 * - Hidden Gem: Least popular/known (lowest sourceCount)
 */
function classifyArchetypes(alternatives: ProductAlternative[]): ArchetypeAlternatives {
    // Only consider recommend verdict products
    const recommended = alternatives.filter(
        (alt) => alt.verdict?.toLowerCase() === 'recommend'
    )

    if (recommended.length === 0) {
        return { bestValue: null, premiumPick: null, hiddenGem: null }
    }

    // Best Value: Cheapest
    const byPrice = [...recommended].sort(
        (a, b) => priceToNumber(a.priceRange) - priceToNumber(b.priceRange)
    )
    const bestValue = byPrice[0] || null

    // Premium Pick: Most expensive (different from best value)
    const premiumPick = byPrice.length > 1
        ? byPrice[byPrice.length - 1]
        : null

    // Hidden Gem: Least popular (lowest sourceCount, excluding best value and premium)
    const usedIds = new Set([bestValue?.id, premiumPick?.id].filter(Boolean))
    const remaining = recommended.filter((alt) => !usedIds.has(alt.id))

    // Sort by sourceCount (ascending) to get least popular
    const byPopularity = [...remaining].sort((a, b) => {
        const aCount = (a as unknown as { sourceCount?: number }).sourceCount || 0
        const bCount = (b as unknown as { sourceCount?: number }).sourceCount || 0
        return aCount - bCount
    })
    const hiddenGem = byPopularity[0] || null

    // Assign archetypes
    if (bestValue) bestValue.archetype = 'best_value'
    if (premiumPick && premiumPick.id !== bestValue?.id) premiumPick.archetype = 'premium_pick'
    if (hiddenGem) hiddenGem.archetype = 'hidden_gem'

    return { bestValue, premiumPick, hiddenGem }
}

export const productAlternativesHandler: PayloadHandler = async (req: PayloadRequest) => {
    try {
        const url = new URL(req.url || '', 'http://localhost')
        const productId = url.searchParams.get('productId')
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '5', 10), 10)
        const useArchetypes = url.searchParams.get('archetypes') === 'true'
        const fingerprintHash = url.searchParams.get('fingerprintHash')

        // Check if user is premium
        const isPremium = isPremiumUser(req.user as { memberState?: string; subscriptionStatus?: string; role?: string } | null)

        if (!productId) {
            return Response.json(
                { error: 'productId is required' },
                { status: 400 }
            )
        }

        const payload = req.payload

        // Get the source product
        const sourceProduct = await payload.findByID({
            collection: 'products',
            id: productId,
            depth: 2,
        })

        if (!sourceProduct) {
            return Response.json(
                { error: 'Product not found' },
                { status: 404 }
            )
        }

        const sourceVerdict = (sourceProduct as any).verdict?.toLowerCase() || 'unknown'
        const sourceVerdictScore = VERDICT_SCORES[sourceVerdict] ?? 50
        const sourcePriceRange = (sourceProduct as any).priceRange?.toLowerCase()
        const sourceCategories = ((sourceProduct as any).categories || []).map((c: any) =>
            typeof c === 'string' ? c : c?.id
        ).filter(Boolean)

        if (sourceCategories.length === 0) {
            return Response.json({
                alternatives: [],
                message: 'Product has no categories to find alternatives in',
            })
        }

        // Count harmful ingredients in source
        const sourceIngredients = (sourceProduct as any).parsedIngredients || []
        const sourceHarmfulCount = sourceIngredients.filter((pi: any) => {
            const safety = typeof pi.ingredient === 'object'
                ? pi.ingredient?.safetyCategory?.toLowerCase()
                : null
            return safety === 'avoid' || safety === 'caution'
        }).length

        // Find products in same categories with better or equal verdict
        const alternativeCandidates = await payload.find({
            collection: 'products',
            where: {
                and: [
                    { id: { not_equals: productId } },
                    { status: { equals: 'published' } },
                    {
                        or: sourceCategories.map((catId: string) => ({
                            categories: { contains: catId },
                        })),
                    },
                    // Only get products with same or better verdict
                    {
                        or: [
                            { verdict: { equals: 'recommend' } },
                            { verdict: { equals: 'consider' } },
                            ...(sourceVerdictScore < 60 ? [{ verdict: { equals: 'caution' } }] : []),
                        ],
                    },
                ],
            },
            limit: 50, // Get more candidates than we need for scoring
            depth: 2,
        })

        if (alternativeCandidates.docs.length === 0) {
            return Response.json({
                alternatives: [],
                message: 'No better alternatives found in the same category',
            })
        }

        // Score each alternative
        const scoredAlternatives: ProductAlternative[] = alternativeCandidates.docs.map((alt: any) => {
            const altVerdict = alt.verdict?.toLowerCase() || 'unknown'
            const altVerdictScore = VERDICT_SCORES[altVerdict] ?? 50
            const altPriceRange = alt.priceRange?.toLowerCase()

            // Calculate verdict score (50% weight)
            const verdictImprovement = altVerdictScore - sourceVerdictScore
            const verdictComponent = Math.min(50, Math.max(0, 25 + verdictImprovement / 2))

            // Calculate ingredient safety score (30% weight)
            const altIngredients = alt.parsedIngredients || []
            const altHarmfulCount = altIngredients.filter((pi: any) => {
                const safety = typeof pi.ingredient === 'object'
                    ? pi.ingredient?.safetyCategory?.toLowerCase()
                    : null
                return safety === 'avoid' || safety === 'caution'
            }).length
            const harmfulReduction = sourceHarmfulCount - altHarmfulCount
            const ingredientComponent = Math.min(30, Math.max(0, 15 + harmfulReduction * 3))

            // Calculate price similarity score (20% weight)
            let priceComponent = 10 // Default middle value
            if (sourcePriceRange && altPriceRange) {
                const sourceIdx = PRICE_RANGE_ORDER.indexOf(sourcePriceRange)
                const altIdx = PRICE_RANGE_ORDER.indexOf(altPriceRange)
                if (sourceIdx !== -1 && altIdx !== -1) {
                    const priceDiff = Math.abs(sourceIdx - altIdx)
                    priceComponent = priceDiff === 0 ? 20 : priceDiff === 1 ? 16 : priceDiff === 2 ? 10 : 5
                }
            }

            const totalScore = verdictComponent + ingredientComponent + priceComponent

            // Build improvements list
            const improvements: string[] = []
            if (verdictImprovement > 0) {
                improvements.push(`Better verdict: ${altVerdict}`)
            }
            if (harmfulReduction > 0) {
                improvements.push(`${harmfulReduction} fewer concerning ingredient${harmfulReduction !== 1 ? 's' : ''}`)
            }
            if (alt.overallScore && (sourceProduct as any).overallScore) {
                const scoreDiff = alt.overallScore - (sourceProduct as any).overallScore
                if (scoreDiff > 0) {
                    improvements.push(`+${scoreDiff.toFixed(1)} overall score`)
                }
            }

            // Get image
            const image = alt.featuredImage || (alt.images && alt.images[0])
            const imageData = typeof image === 'object' ? {
                url: image?.url || image?.sizes?.thumbnail?.url,
                alt: image?.alt || alt.name,
            } : undefined

            return {
                id: alt.id,
                name: alt.name,
                slug: alt.slug,
                verdict: altVerdict,
                overallScore: alt.overallScore,
                priceRange: alt.priceRange,
                brand: typeof alt.brand === 'object' ? alt.brand?.name : undefined,
                image: imageData,
                score: totalScore,
                improvements,
            }
        })

        // Sort by score and take top N
        const topAlternatives = scoredAlternatives
            .filter(alt => alt.improvements.length > 0) // Only show if there are actual improvements
            .sort((a, b) => b.score - a.score)
            .slice(0, limit)

        // If archetypes mode is enabled, classify and return structured response
        if (useArchetypes) {
            const archetypes = classifyArchetypes(topAlternatives)

            // Check unlocked products for the user/device
            let unlockedProductIds: Set<string> = new Set()

            if (req.user) {
                const userData = req.user as { unlockedProducts?: number[] }
                unlockedProductIds = new Set((userData.unlockedProducts || []).map(String))
            }

            // Also check device fingerprint unlocks
            if (fingerprintHash) {
                const fpResult = await req.payload.find({
                    collection: 'device-fingerprints' as 'users',
                    where: { fingerprintHash: { equals: fingerprintHash } },
                    limit: 1,
                })

                if (fpResult.docs.length > 0) {
                    const fpId = (fpResult.docs[0] as { id: number }).id
                    const unlockResult = await req.payload.find({
                        collection: 'product-unlocks' as 'users',
                        where: { deviceFingerprint: { equals: fpId } },
                        limit: 100,
                    })

                    for (const unlock of unlockResult.docs) {
                        const productRef = (unlock as { product?: { id: number } | number }).product
                        const productId = typeof productRef === 'object' ? productRef?.id : productRef
                        if (productId) unlockedProductIds.add(String(productId))
                    }
                }
            }

            // Mark locked status for each archetype
            // Premium users: nothing is locked
            // Free users: Best Value and Premium Pick are locked, Hidden Gem is FREE
            const markLocked = (alt: ProductAlternative | null): ProductAlternative | null => {
                if (!alt) return null

                if (isPremium || unlockedProductIds.has(alt.id)) {
                    return { ...alt, isLocked: false }
                }

                // Hidden Gem is the FREE unlock (never locked for first-time users)
                if (alt.archetype === 'hidden_gem') {
                    return { ...alt, isLocked: false }
                }

                // Best Value and Premium Pick are locked for non-premium
                return { ...alt, isLocked: true }
            }

            return Response.json({
                archetypes: {
                    bestValue: markLocked(archetypes.bestValue),
                    premiumPick: markLocked(archetypes.premiumPick),
                    hiddenGem: markLocked(archetypes.hiddenGem),
                },
                sourceProduct: {
                    id: sourceProduct.id,
                    name: (sourceProduct as { name: string }).name,
                    verdict: sourceVerdict,
                    harmfulIngredientCount: sourceHarmfulCount,
                    isShielded: sourceVerdict === 'avoid' && !isPremium,
                },
                isPremium,
                totalCandidates: alternativeCandidates.totalDocs,
            })
        }

        return Response.json({
            alternatives: topAlternatives,
            sourceProduct: {
                id: sourceProduct.id,
                name: (sourceProduct as { name: string }).name,
                verdict: sourceVerdict,
                harmfulIngredientCount: sourceHarmfulCount,
            },
            totalCandidates: alternativeCandidates.totalDocs,
        })
    } catch (error) {
        console.error('Product alternatives error:', error)
        return Response.json(
            { error: 'Failed to find alternatives' },
            { status: 500 }
        )
    }
}
