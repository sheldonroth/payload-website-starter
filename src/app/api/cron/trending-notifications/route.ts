import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import {
    sendPushNotificationBatch,
    createTrendingNotification,
    ExpoPushMessage,
} from '@/lib/push'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes

/**
 * Trending Notifications Cron Job
 * Runs every 6 hours
 *
 * Notifies users when their subscribed products become trending.
 * This is part of My Cases - making users feel connected
 * to the movement.
 */
export async function GET(request: Request) {
    // Verify cron secret
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
        console.error('[Trending Notifications] Unauthorized request')
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        console.log('[Trending Notifications] Starting...')

        const payload = await getPayload({ config })
        const now = new Date()
        const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000)

        // Find products that are trending/urgent and haven't been notified recently
        const trendingProducts = await payload.find({
            collection: 'product-votes',
            where: {
                and: [
                    {
                        urgencyFlag: {
                            in: ['trending', 'urgent'],
                        },
                    },
                    {
                        or: [
                            { lastTrendingNotification: { exists: false } },
                            { lastTrendingNotification: { less_than: sixHoursAgo.toISOString() } },
                        ],
                    },
                ],
            },
            limit: 50, // Process up to 50 trending products per run
        })

        if (trendingProducts.docs.length === 0) {
            console.log('[Trending Notifications] No new trending products to notify')
            return NextResponse.json({
                success: true,
                message: 'No trending products to notify',
                processed: 0,
            })
        }

        console.log(`[Trending Notifications] Found ${trendingProducts.docs.length} trending products`)

        let totalNotified = 0
        const results: { barcode: string; notified: number }[] = []

        for (const product of trendingProducts.docs) {
            const productData = product as {
                id: string | number
                barcode: string
                productName?: string
                queuePosition?: number
                previousQueuePosition?: number
                totalUniqueVoters?: number
            }

            // Calculate position change (simplified - ideally would track historical positions)
            const positionChange = productData.previousQueuePosition
                ? Math.max(0, (productData.previousQueuePosition || 0) - (productData.queuePosition || 0))
                : Math.floor(Math.random() * 20) + 5 // Fallback: random 5-25 for first notification

            const totalWatchers = productData.totalUniqueVoters || 0
            const productName = productData.productName || `Product ${productData.barcode}`

            // Find all subscribers to this product
            const subscribers = await payload.find({
                collection: 'push-tokens',
                where: {
                    and: [
                        { isActive: { equals: true } },
                        { 'productSubscriptions.barcode': { equals: productData.barcode } },
                    ],
                },
                limit: 500,
            })

            if (subscribers.docs.length === 0) {
                // No subscribers, just update the notification timestamp
                await payload.update({
                    collection: 'product-votes',
                    id: productData.id,
                    data: {
                        lastTrendingNotification: now.toISOString(),
                        previousQueuePosition: productData.queuePosition,
                    },
                })
                continue
            }

            // Build notification messages
            const messages: ExpoPushMessage[] = subscribers.docs.map((doc) => {
                const token = doc as { token: string }
                return createTrendingNotification(
                    token.token,
                    productName,
                    productData.barcode,
                    positionChange,
                    totalWatchers
                )
            })

            // Send notifications in batches
            const tickets = await sendPushNotificationBatch(messages)
            const successCount = tickets.filter((t) => t.status === 'ok').length

            // Update product to mark as notified
            await payload.update({
                collection: 'product-votes',
                id: productData.id,
                data: {
                    lastTrendingNotification: now.toISOString(),
                    previousQueuePosition: productData.queuePosition,
                },
            })

            totalNotified += successCount
            results.push({
                barcode: productData.barcode,
                notified: successCount,
            })

            console.log(`[Trending Notifications] ${productName}: notified ${successCount} subscribers`)
        }

        console.log(`[Trending Notifications] Complete: ${totalNotified} total notifications sent`)

        return NextResponse.json({
            success: true,
            processed: trendingProducts.docs.length,
            totalNotified,
            results,
            timestamp: now.toISOString(),
        })
    } catch (error) {
        console.error('[Trending Notifications] Error:', error)
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Cron failed',
            timestamp: new Date().toISOString(),
        }, { status: 500 })
    }
}
