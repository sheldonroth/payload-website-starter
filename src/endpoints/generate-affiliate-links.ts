import type { PayloadRequest } from 'payload'
import { successResponse, internalError, unauthorizedError } from '../utilities/api-response'

/**
 * Bulk Generate Affiliate Links
 *
 * POST /api/generate-affiliate-links
 *
 * Triggers a re-save of all products to generate affiliate links.
 * Requires admin authentication.
 *
 * Query params:
 * - limit: Max products to process (default: 100, max: 1000)
 * - offset: Skip first N products (for pagination)
 */
export const generateAffiliateLinksHandler = async (req: PayloadRequest): Promise<Response> => {
    // Require admin authentication
    if (!req.user) {
        return unauthorizedError('Admin authentication required')
    }

    try {
        const url = new URL(req.url || '', 'http://localhost')
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '100', 10), 1000)
        const offset = parseInt(url.searchParams.get('offset') || '0', 10)

        console.log(`[generate-affiliate-links] Starting bulk update: limit=${limit}, offset=${offset}`)

        // Fetch products that need affiliate links
        const products = await req.payload.find({
            collection: 'products',
            limit,
            page: Math.floor(offset / limit) + 1,
            depth: 1, // Include brand relation for search queries
            select: {
                id: true,
                name: true,
                brand: true,
                amazonAsin: true,
                purchaseLinks: true,
            },
        })

        let updated = 0
        let skipped = 0
        const errors: string[] = []

        for (const product of products.docs) {
            try {
                // Re-save the product to trigger the affiliate link hook
                await req.payload.update({
                    collection: 'products',
                    id: product.id,
                    data: {
                        // Touch the product to trigger hooks
                        // The hook will generate/update affiliate links
                        name: product.name,
                    },
                })
                updated++
            } catch (error) {
                const errorMsg = `Failed to update product ${product.id}: ${error}`
                console.error(`[generate-affiliate-links] ${errorMsg}`)
                errors.push(errorMsg)
                skipped++
            }
        }

        console.log(`[generate-affiliate-links] Complete: ${updated} updated, ${skipped} skipped`)

        return successResponse({
            message: `Processed ${products.docs.length} products`,
            updated,
            skipped,
            totalProducts: products.totalDocs,
            hasMore: products.hasNextPage,
            nextOffset: products.hasNextPage ? offset + limit : null,
            errors: errors.length > 0 ? errors : undefined,
        })
    } catch (error) {
        console.error('[generate-affiliate-links] Error:', error)
        return internalError('Failed to generate affiliate links')
    }
}
