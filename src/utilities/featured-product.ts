import type { Payload } from 'payload'

/**
 * Featured Product Selection Utility
 *
 * Automatically calculates and stores the best product to feature on each category card.
 * Uses a scoring algorithm based on badges, verdict, image quality, and recency.
 */

interface ProductForScoring {
    id: number
    name?: string
    verdict?: string
    overallScore?: number
    image?: {
        url?: string
        width?: number
        height?: number
    } | number | null
    imageUrl?: string | null
    badges?: {
        isBestOverall?: boolean
        isBestInCategory?: boolean
        isEditorsChoice?: boolean
        isRecommended?: boolean
        isBestValue?: boolean
    }
    testingInfo?: {
        lastTestedDate?: string | Date | null
    }
    status?: string
}

/**
 * Calculate days since a date
 */
function getDaysSince(date: string | Date | null | undefined): number {
    if (!date) return 999 // No date = very old
    const testDate = new Date(date)
    const now = new Date()
    const diffMs = now.getTime() - testDate.getTime()
    return Math.floor(diffMs / (1000 * 60 * 60 * 24))
}

/**
 * Calculate image quality score
 * Higher scores for internal images with good dimensions
 */
function calculateImageQualityScore(product: ProductForScoring): number {
    let score = 0

    // Get image URL
    let imageUrl: string | undefined
    let width = 0
    let height = 0

    if (product.image && typeof product.image === 'object') {
        imageUrl = product.image.url
        width = product.image.width || 0
        height = product.image.height || 0
    } else if (product.imageUrl) {
        imageUrl = product.imageUrl
    }

    // No image = no feature potential
    if (!imageUrl) return 0

    // Base score for having an image
    score += 100

    // Internal image (from our CMS) - more reliable
    if (imageUrl.startsWith('/') || imageUrl.includes('vercel') || imageUrl.includes('blob')) {
        score += 100
    }

    // Prefer larger, high-quality images
    if (width >= 800 && height >= 600) {
        score += 100
    } else if (width >= 400 && height >= 300) {
        score += 50
    }

    // Prefer square-ish or landscape (better for cards)
    if (width > 0 && height > 0) {
        const ratio = width / height
        if (ratio >= 0.8 && ratio <= 1.5) {
            score += 50 // Good aspect ratio for cards
        }
    }

    return score
}

/**
 * Calculate overall score for a product to determine featured status
 * Higher score = better candidate for featuring
 */
export function calculateFeaturedProductScore(product: ProductForScoring): number {
    let score = 0

    // 1. BADGES (highest weight - editorial picks)
    if (product.badges?.isBestOverall) score += 1000
    if (product.badges?.isBestInCategory) score += 500
    if (product.badges?.isEditorsChoice) score += 300
    if (product.badges?.isRecommended) score += 200
    if (product.badges?.isBestValue) score += 100

    // 2. VERDICT (must be recommended or caution, never avoid)
    if (product.verdict === 'avoid') return -1 // Disqualify
    if (product.verdict === 'pending') return -1 // Disqualify pending products
    if (product.verdict === 'recommend') score += 150
    if (product.verdict === 'caution') score += 50

    // 3. OVERALL SCORE (0-100 scale, if available)
    if (product.overallScore) {
        score += (product.overallScore || 0) * 2 // Max +200
    }

    // 4. IMAGE QUALITY (critical for visual appeal)
    const imageScore = calculateImageQualityScore(product)
    if (imageScore === 0) return -1 // No image = disqualify
    score += imageScore // Max +350

    // 5. RECENCY (prefer recently tested products)
    const daysSinceTested = getDaysSince(product.testingInfo?.lastTestedDate)
    if (daysSinceTested < 30) score += 50
    else if (daysSinceTested < 90) score += 25
    else if (daysSinceTested > 365) score -= 50 // Penalize stale

    return score
}

/**
 * Get the image URL from a product (handles both internal and external images)
 */
function getProductImageUrl(product: ProductForScoring): string | null {
    if (product.image && typeof product.image === 'object' && product.image.url) {
        return product.image.url
    }
    if (product.imageUrl) {
        return product.imageUrl
    }
    return null
}

/**
 * Recalculate the featured product for a specific category
 */
export async function recalculateFeaturedProduct(
    categoryId: number,
    payload: Payload
): Promise<{ success: boolean; productId: number | null; productName: string | null }> {
    try {
        // Fetch all published products in this category
        const products = await payload.find({
            collection: 'products',
            where: {
                category: { equals: categoryId },
                status: { equals: 'published' },
            },
            limit: 100,
            depth: 1, // Include image data
        })

        // Score and sort products
        const scored = products.docs
            .map((p) => ({
                product: p as unknown as ProductForScoring,
                score: calculateFeaturedProductScore(p as unknown as ProductForScoring),
            }))
            .filter((s) => s.score > 0) // Exclude disqualified
            .sort((a, b) => b.score - a.score)

        const featured = scored[0]?.product
        const featuredImageUrl = featured ? getProductImageUrl(featured) : null

        // Update category with featured product
        // Note: Using 'as any' because these fields are new and types haven't been regenerated
        await payload.update({
            collection: 'categories',
            id: categoryId,
            data: {
                featuredProduct: featured?.id || null,
                featuredProductImage: featuredImageUrl,
                featuredProductUpdatedAt: new Date().toISOString(),
            } as any,
        })

        console.log(
            `[Featured Product] Category ${categoryId}: ${featured ? `Selected product #${featured.id} (${featured.name}) with score ${scored[0].score}` : 'No eligible products'}`
        )

        return {
            success: true,
            productId: featured?.id || null,
            productName: featured?.name || null,
        }
    } catch (error) {
        console.error(`[Featured Product] Failed to recalculate for category ${categoryId}:`, error)
        return { success: false, productId: null, productName: null }
    }
}

/**
 * Recalculate featured products for all categories
 * Useful for scheduled jobs or admin bulk operations
 */
export async function recalculateAllFeaturedProducts(
    payload: Payload
): Promise<{ success: boolean; updated: number; failed: number; results: Array<{ categoryId: number; categoryName: string; productId: number | null; productName: string | null }> }> {
    const categories = await payload.find({
        collection: 'categories',
        limit: 500,
    })

    const results: Array<{
        categoryId: number
        categoryName: string
        productId: number | null
        productName: string | null
    }> = []

    let updated = 0
    let failed = 0

    for (const category of categories.docs) {
        const result = await recalculateFeaturedProduct(category.id as number, payload)

        results.push({
            categoryId: category.id as number,
            categoryName: (category as { name?: string }).name || 'Unknown',
            productId: result.productId,
            productName: result.productName,
        })

        if (result.success) {
            updated++
        } else {
            failed++
        }

        // Small delay to avoid overwhelming the database
        await new Promise((r) => setTimeout(r, 50))
    }

    console.log(`[Featured Product] Bulk recalculation complete: ${updated} updated, ${failed} failed`)

    return { success: true, updated, failed, results }
}
