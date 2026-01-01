import type { PayloadHandler, PayloadRequest } from 'payload'
import { recalculateAllFeaturedProducts, recalculateFeaturedProduct } from '../utilities/featured-product'

/**
 * Featured Products Endpoints
 *
 * Admin endpoints for managing featured product calculations.
 *
 * Endpoints:
 * - POST /api/admin/recalculate-featured - Recalculate all categories
 * - POST /api/admin/recalculate-featured/:categoryId - Recalculate single category
 */

/**
 * Recalculate featured products for all categories
 * POST /api/admin/recalculate-featured
 */
export const recalculateFeaturedHandler: PayloadHandler = async (req: PayloadRequest) => {
    // Authentication check - admin only
    if (!req.user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        // Check for optional categoryId in body
        const body = await req.json?.().catch(() => null)
        const categoryId = body?.categoryId as number | undefined

        if (categoryId) {
            // Recalculate single category
            const result = await recalculateFeaturedProduct(categoryId, req.payload)

            return Response.json({
                success: result.success,
                categoryId,
                featuredProduct: result.productId
                    ? { id: result.productId, name: result.productName }
                    : null,
            })
        }

        // Recalculate all categories
        const result = await recalculateAllFeaturedProducts(req.payload)

        return Response.json({
            success: true,
            updated: result.updated,
            failed: result.failed,
            totalCategories: result.results.length,
            results: result.results.map((r) => ({
                categoryId: r.categoryId,
                categoryName: r.categoryName,
                featuredProduct: r.productId
                    ? { id: r.productId, name: r.productName }
                    : null,
            })),
        })
    } catch (error) {
        console.error('Featured product recalculation error:', error)
        return Response.json(
            { error: error instanceof Error ? error.message : 'Recalculation failed' },
            { status: 500 }
        )
    }
}
