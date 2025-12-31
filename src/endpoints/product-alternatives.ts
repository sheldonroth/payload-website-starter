import type { PayloadHandler, PayloadRequest } from 'payload'

/**
 * Find Safe Alternative Endpoint
 *
 * GET /api/products/alternatives?productId=xxx
 *
 * Returns products in the same category with better safety profiles.
 * Scoring algorithm considers:
 * - Verdict improvement (50%)
 * - Ingredient safety score (30%)
 * - Price similarity (20%)
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
}

const VERDICT_SCORES: Record<string, number> = {
    recommend: 100,
    consider: 80,
    caution: 60,
    limit: 40,
    avoid: 0,
}

const PRICE_RANGE_ORDER = ['budget', 'mid-range', 'premium', 'luxury']

export const productAlternativesHandler: PayloadHandler = async (req: PayloadRequest) => {
    try {
        const url = new URL(req.url || '', 'http://localhost')
        const productId = url.searchParams.get('productId')
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '5', 10), 10)

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

        return Response.json({
            alternatives: topAlternatives,
            sourceProduct: {
                id: sourceProduct.id,
                name: (sourceProduct as any).name,
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
