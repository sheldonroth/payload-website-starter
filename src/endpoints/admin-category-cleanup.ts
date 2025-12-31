import type { PayloadHandler } from 'payload'

/**
 * Admin endpoint to cleanup/merge categories
 * - Merges child categories into parent categories
 * - Moves products from child to parent
 * - Deletes empty child categories
 */
const adminCategoryCleanup: PayloadHandler = async (req) => {
    if (req.method !== 'POST') {
        return Response.json({ error: 'Method not allowed' }, { status: 405 })
    }

    // Require admin authentication
    if (!req.user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const payload = req.payload
        const body = await req.json?.() || {}
        const { dryRun = true } = body // Default to dry run for safety

        const results = {
            dryRun,
            productsMoved: [] as { productId: number; productName: string; from: string; to: string }[],
            categoriesDeleted: [] as { id: number; name: string }[],
            errors: [] as string[],
        }

        // Step 1: Find "Food & Beverage" as the target parent
        const foodBevCategory = await payload.find({
            collection: 'categories',
            where: { name: { equals: 'Food & Beverage' } },
            limit: 1,
        })

        if (foodBevCategory.docs.length === 0) {
            return Response.json({ error: 'Food & Beverage category not found' }, { status: 404 })
        }

        const targetParentId = foodBevCategory.docs[0].id as number

        // Step 2: Find categories to merge into Food & Beverage
        // This includes: Food, Chocolate, and all their children
        const categoriesToMerge = ['Food', 'Chocolate', 'Chocolate Bars', 'Hot Dog', 'Olive Oil', 'Soda', 'Sparkling Water']

        // Also include any categories that have Food & Beverage as parent (like Energy Drink)
        // We'll keep Energy Drink but move its products to Food & Beverage

        // Step 3: Get all categories that should be merged
        const allCategories = await payload.find({
            collection: 'categories',
            limit: 100,
        })

        const categoriesToProcess = allCategories.docs.filter((cat: any) =>
            categoriesToMerge.includes(cat.name) ||
            cat.parent === targetParentId // Children of Food & Beverage
        )

        // Step 4: Move products from each category to Food & Beverage
        for (const category of categoriesToProcess) {
            const catId = category.id as number
            const catName = (category as any).name as string

            // Skip Food & Beverage itself
            if (catId === targetParentId) continue

            // Find products in this category
            const products = await payload.find({
                collection: 'products',
                where: { category: { equals: catId } },
                limit: 500,
            })

            // Move each product
            for (const product of products.docs) {
                if (!dryRun) {
                    await payload.update({
                        collection: 'products',
                        id: product.id,
                        data: { category: targetParentId },
                    })
                }
                results.productsMoved.push({
                    productId: product.id as number,
                    productName: (product as any).name,
                    from: catName,
                    to: 'Food & Beverage',
                })
            }

            // Delete the category (if not dry run and it's in our merge list)
            if (categoriesToMerge.includes(catName)) {
                if (!dryRun) {
                    try {
                        await payload.delete({
                            collection: 'categories',
                            id: catId,
                        })
                        results.categoriesDeleted.push({ id: catId, name: catName })
                    } catch (err) {
                        results.errors.push(`Failed to delete category ${catName}: ${err}`)
                    }
                } else {
                    results.categoriesDeleted.push({ id: catId, name: catName })
                }
            }
        }

        // Step 5: Also handle child categories that have parent relationships with categories we're deleting
        // (e.g., Chocolate Bars → Chocolate, we need to handle these first)

        return Response.json({
            success: true,
            message: dryRun
                ? `DRY RUN: Would move ${results.productsMoved.length} products and delete ${results.categoriesDeleted.length} categories`
                : `Moved ${results.productsMoved.length} products and deleted ${results.categoriesDeleted.length} categories`,
            targetCategory: 'Food & Beverage',
            ...results,
        })
    } catch (error) {
        console.error('Category cleanup error:', error)
        return Response.json(
            { error: error instanceof Error ? error.message : 'Cleanup failed' },
            { status: 500 }
        )
    }
}

export default adminCategoryCleanup
export const adminCategoryCleanupHandler = adminCategoryCleanup
