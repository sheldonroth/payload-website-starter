import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes

/**
 * Market Intelligence Processing Cron Job
 * Runs every 6 hours
 *
 * Processes detected market trends and:
 * 1. Matches them to existing products in the database
 * 2. Creates ProductVotes for high-trending items not in system
 * 3. Flags urgent trends for lab team review
 *
 * Note: The actual data collection (Amazon scraping, TikTok monitoring)
 * would be done by separate services that write to MarketIntelligence.
 * This cron processes what's already been collected.
 */
export async function GET(request: Request) {
    // Verify cron secret
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
        console.error('[Market Intel] Unauthorized request')
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        console.log('[Market Intel] Starting processing...')

        const payload = await getPayload({ config })
        const now = new Date()

        // Find unprocessed market intelligence entries
        const newEntries = await payload.find({
            collection: 'market-intelligence',
            where: {
                status: { equals: 'new' },
            },
            limit: 100,
            sort: '-trendScore',
        })

        if (newEntries.docs.length === 0) {
            console.log('[Market Intel] No new entries to process')
            return NextResponse.json({
                success: true,
                message: 'No new entries to process',
                processed: 0,
            })
        }

        console.log(`[Market Intel] Processing ${newEntries.docs.length} entries`)

        const results = {
            matched: 0,
            addedToQueue: 0,
            ignored: 0,
            errors: 0,
        }

        for (const entry of newEntries.docs) {
            const intel = entry as {
                id: string | number
                productName: string
                brand?: string
                upc?: string
                trendScore: number
                source: string
                category?: string
            }

            try {
                // Step 1: Check if we already have this product tested
                let existingProduct = null
                if (intel.upc) {
                    const products = await payload.find({
                        collection: 'products',
                        where: { upc: { equals: intel.upc } },
                        limit: 1,
                    })
                    if (products.docs.length > 0) {
                        existingProduct = products.docs[0]
                    }
                }

                if (existingProduct) {
                    // Product already tested - mark as matched
                    const productId = (existingProduct as { id: number }).id
                    await payload.update({
                        collection: 'market-intelligence',
                        id: intel.id,
                        data: {
                            status: 'matched',
                            linkedProduct: productId,
                            processedAt: now.toISOString(),
                        },
                    })
                    results.matched++
                    continue
                }

                // Step 2: Check if there's already a ProductVote for this
                let existingVote = null
                if (intel.upc) {
                    const votes = await payload.find({
                        collection: 'product-votes',
                        where: { barcode: { equals: intel.upc } },
                        limit: 1,
                    })
                    if (votes.docs.length > 0) {
                        existingVote = votes.docs[0]
                    }
                }

                if (existingVote) {
                    // Already in queue - link and boost priority
                    const voteId = (existingVote as { id: number }).id
                    await payload.update({
                        collection: 'market-intelligence',
                        id: intel.id,
                        data: {
                            status: 'matched',
                            linkedProductVote: voteId,
                            processedAt: now.toISOString(),
                        },
                    })

                    // Boost the vote's velocity score for market trending
                    const currentVote = existingVote as { id: string | number; velocityScore?: number }
                    await payload.update({
                        collection: 'product-votes',
                        id: currentVote.id,
                        data: {
                            velocityScore: (currentVote.velocityScore || 0) + Math.floor(intel.trendScore / 2),
                        },
                    })
                    results.matched++
                    continue
                }

                // Step 3: Only create new ProductVotes for high-scoring trends with UPC
                if (intel.trendScore >= 50 && intel.upc) {
                    // Create new ProductVote
                    const newVote = await payload.create({
                        collection: 'product-votes',
                        data: {
                            barcode: intel.upc,
                            productName: intel.productName,
                            brand: intel.brand,
                            searchCount: 0,
                            scanCount: 0,
                            totalWeightedVotes: Math.floor(intel.trendScore * 2), // Give initial weight from trend score
                            velocityScore: intel.trendScore,
                            urgencyFlag: intel.trendScore >= 80 ? 'urgent' : 'trending',
                        } as any,
                    })

                    await payload.update({
                        collection: 'market-intelligence',
                        id: intel.id,
                        data: {
                            status: 'added_to_queue',
                            linkedProductVote: newVote.id,
                            processedAt: now.toISOString(),
                        },
                    })
                    results.addedToQueue++
                    console.log(`[Market Intel] Created ProductVote for: ${intel.productName} (score: ${intel.trendScore})`)
                } else {
                    // Mark as reviewed but not actioned (low score or no UPC)
                    await payload.update({
                        collection: 'market-intelligence',
                        id: intel.id,
                        data: {
                            status: 'reviewed',
                            processedAt: now.toISOString(),
                        },
                    })
                    results.ignored++
                }
            } catch (error) {
                console.error(`[Market Intel] Error processing ${intel.productName}:`, error)
                results.errors++
            }
        }

        console.log(`[Market Intel] Complete:`, results)

        return NextResponse.json({
            success: true,
            processed: newEntries.docs.length,
            results,
            timestamp: now.toISOString(),
        })
    } catch (error) {
        console.error('[Market Intel] Error:', error)
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Cron failed',
            timestamp: new Date().toISOString(),
        }, { status: 500 })
    }
}
