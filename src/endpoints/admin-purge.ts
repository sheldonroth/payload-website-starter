import type { PayloadHandler, PayloadRequest } from 'payload'

/* ============================================================================
 * ⚠️⚠️⚠️ WARNING: ADMIN PURGE ENDPOINT ⚠️⚠️⚠️
 * ============================================================================
 * This endpoint can DELETE data. Use with caution.
 * 
 * ACTIONS:
 * - purge_ai_drafts: Deletes ALL products with status 'ai_draft'
 * - purge_duplicates: Keeps only the newest ai_draft for each name+brand combo
 * 
 * Added: December 2024
 * ============================================================================ */

interface PurgeResult {
    success: boolean
    action: string
    deleted: number
    kept?: number
    error?: string
}

export const adminPurgeHandler: PayloadHandler = async (req: PayloadRequest) => {
    if (!req.user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Security: Verify admin role - only admins can purge data
    const userRole = (req.user as { role?: string }).role
    const isAdminFlag = (req.user as { isAdmin?: boolean }).isAdmin
    if (userRole !== 'admin' && !isAdminFlag) {
        return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
    }

    try {
        const body = await req.json?.()
        const { action } = body || {}

        if (!action) {
            return Response.json({ error: 'action is required (purge_ai_drafts, purge_duplicates)' }, { status: 400 })
        }

        const { payload } = req

        // ============================================================
        // ACTION: Delete ALL ai_draft products
        // ============================================================
        if (action === 'purge_ai_drafts') {
            const aiDrafts = await payload.find({
                collection: 'products',
                where: {
                    status: { equals: 'ai_draft' },
                },
                limit: 1000,
            })

            let deleted = 0
            for (const product of aiDrafts.docs) {
                await payload.delete({
                    collection: 'products',
                    id: product.id,
                })
                deleted++
            }

            return Response.json({
                success: true,
                action: 'purge_ai_drafts',
                deleted,
                message: `Deleted ${deleted} AI draft products`,
            })
        }

        // ============================================================
        // ACTION: Delete ALL ai_draft AND draft products
        // ============================================================
        if (action === 'purge_all_drafts') {
            const allDrafts = await payload.find({
                collection: 'products',
                where: {
                    or: [
                        { status: { equals: 'ai_draft' } },
                        { status: { equals: 'draft' } },
                    ],
                },
                limit: 1000,
            })

            let deleted = 0
            for (const product of allDrafts.docs) {
                await payload.delete({
                    collection: 'products',
                    id: product.id,
                })
                deleted++
            }

            return Response.json({
                success: true,
                action: 'purge_all_drafts',
                deleted,
                message: `Deleted ${deleted} products (ai_draft + draft)`,
            })
        }

        // ============================================================
        // ACTION: Delete only regular draft products (not ai_draft)
        // ============================================================
        if (action === 'purge_drafts') {
            const drafts = await payload.find({
                collection: 'products',
                where: {
                    status: { equals: 'draft' },
                },
                limit: 1000,
            })

            let deleted = 0
            for (const product of drafts.docs) {
                await payload.delete({
                    collection: 'products',
                    id: product.id,
                })
                deleted++
            }

            return Response.json({
                success: true,
                action: 'purge_drafts',
                deleted,
                message: `Deleted ${deleted} regular draft products`,
            })
        }

        // ============================================================
        // ACTION: Remove duplicate ai_drafts (keep newest of each name+brand)
        // ============================================================
        if (action === 'purge_duplicates') {
            const aiDrafts = await payload.find({
                collection: 'products',
                where: {
                    status: { equals: 'ai_draft' },
                },
                limit: 1000,
                sort: '-createdAt', // Newest first
            })

            // Group by name+brand
            const groups: Record<string, typeof aiDrafts.docs> = {}
            for (const product of aiDrafts.docs) {
                const productData = product as unknown as Record<string, unknown>
                const key = `${productData.name || ''}__${productData.brand || ''}`
                if (!groups[key]) {
                    groups[key] = []
                }
                groups[key].push(product)
            }

            let deleted = 0
            let kept = 0

            for (const [, products] of Object.entries(groups)) {
                // Keep the first (newest), delete the rest
                kept++
                for (let i = 1; i < products.length; i++) {
                    await payload.delete({
                        collection: 'products',
                        id: products[i].id,
                    })
                    deleted++
                }
            }

            return Response.json({
                success: true,
                action: 'purge_duplicates',
                deleted,
                kept,
                message: `Kept ${kept} unique products, deleted ${deleted} duplicates`,
            })
        }

        return Response.json({ error: `Unknown action: ${action}` }, { status: 400 })
    } catch (error) {
        console.error('Purge error:', error)
        return Response.json(
            { error: error instanceof Error ? error.message : 'Purge failed' },
            { status: 500 }
        )
    }
}
