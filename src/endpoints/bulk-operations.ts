import type { PayloadHandler } from 'payload'
import { checkRateLimit, rateLimitResponse, getRateLimitKey, RateLimits } from '../utilities/rate-limiter'

/**
 * Process items in parallel batches to improve performance
 * @param items - Array of items to process
 * @param batchSize - Number of items to process in parallel at a time
 * @param fn - Async function to apply to each item
 */
async function batchProcess<T>(
    items: T[],
    batchSize: number,
    fn: (item: T) => Promise<void>
): Promise<void> {
    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize)
        await Promise.all(batch.map(fn))
    }
}

/**
 * Bulk Operations Endpoint
 * Supports batch operations on products
 *
 * Operations:
 * - approve: Change status from ai_draft to draft
 * - reject: Delete ai_draft products
 * - assign_category: Assign category to multiple products
 * - re_evaluate_verdicts: Re-run verdict evaluation on products
 * - fetch_images: Batch fetch images for products
 */
export const bulkOperationsHandler: PayloadHandler = async (req) => {
    if (!req.user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // SECURITY: Verify admin or editor role - bulk operations require elevated privileges
    const userRole = (req.user as { role?: string }).role
    const isAdminFlag = (req.user as { isAdmin?: boolean }).isAdmin
    if (userRole !== 'admin' && userRole !== 'product_editor' && !isAdminFlag) {
        return Response.json({ error: 'Forbidden: Admin or Editor access required' }, { status: 403 })
    }

    // Rate limiting
    const rateLimitKey = getRateLimitKey(req as unknown as Request, req.user?.id)
    const rateLimit = checkRateLimit(rateLimitKey, RateLimits.BATCH_OPERATIONS)
    if (!rateLimit.allowed) {
        return rateLimitResponse(rateLimit.resetAt)
    }

    try {
        const body = await req.json?.() || {}
        const { operation, productIds, options = {} } = body

        if (!operation) {
            return Response.json({ error: 'Operation required' }, { status: 400 })
        }

        const payload = req.payload

        const results = {
            operation,
            processed: 0,
            successCount: 0,
            failed: 0,
            errors: [] as string[],
        }

        // Get products to operate on
        let products: any[] = []

        if (productIds && productIds.length > 0) {
            // Specific products
            const query = await payload.find({
                collection: 'products',
                where: { id: { in: productIds } },
                limit: productIds.length,
            })
            products = query.docs
        } else if (options.filter) {
            // Filter-based selection
            const query = await payload.find({
                collection: 'products',
                where: options.filter,
                limit: options.limit || 100,
            })
            products = query.docs
        } else {
            return Response.json({ error: 'Either productIds or filter required' }, { status: 400 })
        }

        results.processed = products.length

        switch (operation) {
            case 'approve': {
                // Approve AI drafts → move to draft status
                await batchProcess(products, 10, async (product) => {
                    try {
                        if ((product as any).status !== 'ai_draft') {
                            results.errors.push(`${product.id}: Not an AI draft`)
                            results.failed++
                            return
                        }
                        await payload.update({
                            collection: 'products',
                            id: product.id,
                            data: { status: 'draft' },
                        })
                        results.successCount++
                    } catch (error) {
                        results.failed++
                        results.errors.push(`${product.id}: ${error}`)
                    }
                })
                break
            }

            case 'publish': {
                // Publish drafts
                await batchProcess(products, 10, async (product) => {
                    try {
                        if ((product as any).status === 'published') {
                            results.errors.push(`${product.id}: Already published`)
                            results.failed++
                            return
                        }
                        await payload.update({
                            collection: 'products',
                            id: product.id,
                            data: { status: 'published' },
                        })
                        results.successCount++
                    } catch (error) {
                        results.failed++
                        results.errors.push(`${product.id}: ${error}`)
                    }
                })
                break
            }

            case 'reject': {
                // Delete AI drafts
                await batchProcess(products, 10, async (product) => {
                    try {
                        if ((product as any).status !== 'ai_draft') {
                            results.errors.push(`${product.id}: Not an AI draft, skipping delete`)
                            results.failed++
                            return
                        }
                        await payload.delete({
                            collection: 'products',
                            id: product.id,
                        })
                        results.successCount++
                    } catch (error) {
                        results.failed++
                        results.errors.push(`${product.id}: ${error}`)
                    }
                })
                break
            }

            case 'assign_category': {
                const { categoryId } = options
                if (!categoryId) {
                    return Response.json({ error: 'categoryId required for assign_category' }, { status: 400 })
                }
                await batchProcess(products, 10, async (product) => {
                    try {
                        await payload.update({
                            collection: 'products',
                            id: product.id,
                            data: { category: categoryId },
                        })
                        results.successCount++
                    } catch (error) {
                        results.failed++
                        results.errors.push(`${product.id}: ${error}`)
                    }
                })
                break
            }

            case 'set_verdict': {
                const { verdict, reason } = options
                if (!verdict) {
                    return Response.json({ error: 'verdict required for set_verdict' }, { status: 400 })
                }
                await batchProcess(products, 10, async (product) => {
                    try {
                        await payload.update({
                            collection: 'products',
                            id: product.id,
                            data: {
                                verdictOverride: verdict,
                                verdictReason: reason || `Bulk verdict set: ${verdict}`,
                            },
                        })
                        results.successCount++
                    } catch (error) {
                        results.failed++
                        results.errors.push(`${product.id}: ${error}`)
                    }
                })
                break
            }

            default:
                return Response.json({ error: `Unknown operation: ${operation}` }, { status: 400 })
        }

        return Response.json({
            success: true,
            ...results,
        })
    } catch (error) {
        console.error('Bulk operation error:', error)
        return Response.json(
            { error: error instanceof Error ? error.message : 'Operation failed' },
            { status: 500 }
        )
    }
}
