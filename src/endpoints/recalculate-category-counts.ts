/**
 * Recalculate Category Product Counts
 *
 * One-time utility endpoint to fix existing category productCount values.
 * Can also be run periodically to ensure accuracy.
 *
 * Usage: POST /api/recalculate-category-counts
 */

import { Endpoint } from 'payload'

export const recalculateCategoryCountsEndpoint: Endpoint = {
    path: '/recalculate-category-counts',
    method: 'post',
    handler: async (req) => {
        const { payload, user } = req

        // Require admin authentication
        if (!user || (user as { role?: string }).role !== 'admin') {
            return Response.json(
                { error: 'Admin authentication required' },
                { status: 401 }
            )
        }

        try {
            // Get all categories
            const { docs: categories } = await payload.find({
                collection: 'categories',
                limit: 1000,
                depth: 0,
            })

            const updates: { id: number; name: string; oldCount: number; newCount: number }[] = []

            // Calculate and update each category
            for (const category of categories) {
                const { totalDocs } = await payload.count({
                    collection: 'products',
                    where: {
                        category: { equals: category.id },
                        status: { equals: 'published' },
                    },
                })

                const oldCount = (category.productCount as number) || 0
                const categoryId = category.id as number

                if (oldCount !== totalDocs) {
                    await payload.update({
                        collection: 'categories',
                        id: categoryId,
                        data: { productCount: totalDocs },
                    })

                    updates.push({
                        id: categoryId,
                        name: category.name as string,
                        oldCount,
                        newCount: totalDocs,
                    })
                }
            }

            console.log(`[Recalculate Counts] Updated ${updates.length} categories`)

            return Response.json({
                success: true,
                message: `Updated ${updates.length} category counts`,
                totalCategories: categories.length,
                updates,
            })
        } catch (error) {
            console.error('[Recalculate Counts] Error:', error)
            return Response.json(
                { error: 'Failed to recalculate counts', details: String(error) },
                { status: 500 }
            )
        }
    },
}
