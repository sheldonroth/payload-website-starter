/**
 * Send Results Notification Endpoint
 *
 * Notifies all subscribers when a product's lab testing is complete.
 * This is the Scout Program's "Results Ready" moment.
 *
 * POST /api/send-results-notification
 *
 * Body: {
 *   barcode: string,       // Product barcode
 *   productId?: string,    // Optional: linked product ID
 *   productName: string,   // Product name for notification
 *   score: number,         // Test result score (0-100)
 * }
 *
 * Called when:
 * - Admin marks ProductVote status as 'complete'
 * - Product is linked to a tested Product
 */

import type { PayloadRequest } from 'payload'
import {
    sendPushNotificationBatch,
    createResultsReadyNotification,
    ExpoPushMessage,
} from '../lib/push'
import { trackServer, flushServer } from '../lib/analytics/rudderstack-server'

interface SendResultsRequest {
    barcode: string
    productId?: string
    productName: string
    score: number
}

export const sendResultsNotificationHandler = async (
    req: PayloadRequest
): Promise<Response> => {
    // Admin only endpoint
    if (!req.user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (req.method !== 'POST') {
        return Response.json({ error: 'Method not allowed' }, { status: 405 })
    }

    try {
        const body = (await req.json?.()) as SendResultsRequest

        if (!body?.barcode || !body?.productName || body?.score === undefined) {
            return Response.json(
                { error: 'barcode, productName, and score are required' },
                { status: 400 }
            )
        }

        const { barcode, productId, productName, score } = body

        // Find all push tokens subscribed to this product
        const subscribers = await req.payload.find({
            collection: 'push-tokens',
            where: {
                and: [
                    { isActive: { equals: true } },
                    { 'productSubscriptions.barcode': { equals: barcode } },
                ],
            },
            limit: 1000, // Max 1000 subscribers per product
        })

        if (subscribers.docs.length === 0) {
            return Response.json({
                success: true,
                message: 'No subscribers to notify',
                notified: 0,
            })
        }

        // Build notification messages
        const messages: ExpoPushMessage[] = subscribers.docs.map((doc) => {
            const token = doc as { token: string }
            return createResultsReadyNotification(
                token.token,
                productName,
                score,
                barcode,
                productId
            )
        })

        // Send notifications in batches
        const tickets = await sendPushNotificationBatch(messages)

        // Count successful sends
        const successCount = tickets.filter((t) => t.status === 'ok').length
        const failedCount = tickets.filter((t) => t.status === 'error').length

        // Track push notification batch sent
        trackServer('Push Notification Sent', {
            notification_type: 'results_ready',
            barcode,
            product_id: productId,
            product_name: productName,
            score,
            total_recipients: subscribers.docs.length,
            successful: successCount,
            failed: failedCount,
        }, { anonymousId: `product_${barcode}` })

        // Mark subscribers as notified and handle failures
        const failedTokens: string[] = []

        for (let i = 0; i < tickets.length; i++) {
            const ticket = tickets[i]
            const tokenDoc = subscribers.docs[i] as {
                id: string | number
                token: string
                productSubscriptions?: Array<{ barcode: string; notified: boolean }>
                failureCount?: number
            }

            if (ticket.status === 'error') {
                // Track failed token for potential deactivation
                if (ticket.details?.error === 'DeviceNotRegistered') {
                    failedTokens.push(tokenDoc.id.toString())
                }
                continue
            }

            // Mark this product as notified in subscriptions
            const updatedSubscriptions = (tokenDoc.productSubscriptions || []).map((sub) => {
                if (sub.barcode === barcode) {
                    return { ...sub, notified: true }
                }
                return sub
            })

            await req.payload.update({
                collection: 'push-tokens',
                id: tokenDoc.id,
                data: {
                    productSubscriptions: updatedSubscriptions,
                    lastUsed: new Date().toISOString(),
                    failureCount: 0, // Reset on successful send
                },
            })
        }

        // Deactivate invalid tokens
        for (const tokenId of failedTokens) {
            await req.payload.update({
                collection: 'push-tokens',
                id: tokenId,
                data: { isActive: false },
            })
        }

        // Update ProductVote status to complete if not already
        const voteRecord = await req.payload.find({
            collection: 'product-votes',
            where: { barcode: { equals: barcode } },
            limit: 1,
        })

        if (voteRecord.docs.length > 0) {
            const vote = voteRecord.docs[0] as { id: string | number; status: string }
            if (vote.status !== 'complete') {
                await req.payload.update({
                    collection: 'product-votes',
                    id: vote.id,
                    data: {
                        status: 'complete',
                        ...(productId && { linkedProduct: Number(productId) }),
                    },
                })
            }
        }

        // Flush events before responding
        await flushServer()

        return Response.json({
            success: true,
            message: `Notified ${successCount} subscribers`,
            notified: successCount,
            failed: failedCount,
            deactivated: failedTokens.length,
        })
    } catch (error) {
        console.error('[send-results-notification] Error:', error)
        return Response.json(
            { error: 'Failed to send notifications', details: String(error) },
            { status: 500 }
        )
    }
}

/**
 * Send Testing Started notification
 *
 * POST /api/send-testing-notification
 */
export const sendTestingNotificationHandler = async (
    req: PayloadRequest
): Promise<Response> => {
    // Admin only endpoint
    if (!req.user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (req.method !== 'POST') {
        return Response.json({ error: 'Method not allowed' }, { status: 405 })
    }

    try {
        const body = (await req.json?.()) as { barcode: string; productName: string }

        if (!body?.barcode || !body?.productName) {
            return Response.json(
                { error: 'barcode and productName are required' },
                { status: 400 }
            )
        }

        const { barcode, productName } = body

        // Find all push tokens subscribed to this product
        const subscribers = await req.payload.find({
            collection: 'push-tokens',
            where: {
                and: [
                    { isActive: { equals: true } },
                    { 'productSubscriptions.barcode': { equals: barcode } },
                ],
            },
            limit: 1000,
        })

        if (subscribers.docs.length === 0) {
            return Response.json({
                success: true,
                message: 'No subscribers to notify',
                notified: 0,
            })
        }

        // Import here to avoid circular dependency
        const { createTestingStartedNotification } = await import('../lib/push')

        // Build notification messages
        const messages: ExpoPushMessage[] = subscribers.docs.map((doc) => {
            const token = doc as { token: string }
            return createTestingStartedNotification(token.token, productName, barcode)
        })

        // Send notifications in batches
        const tickets = await sendPushNotificationBatch(messages)

        const successCount = tickets.filter((t) => t.status === 'ok').length
        const failedCount = tickets.filter((t) => t.status === 'error').length

        // Track push notification batch sent
        trackServer('Push Notification Sent', {
            notification_type: 'testing_started',
            barcode,
            product_name: productName,
            total_recipients: subscribers.docs.length,
            successful: successCount,
            failed: failedCount,
        }, { anonymousId: `product_${barcode}` })

        // Update ProductVote status to testing
        const voteRecord = await req.payload.find({
            collection: 'product-votes',
            where: { barcode: { equals: barcode } },
            limit: 1,
        })

        if (voteRecord.docs.length > 0) {
            const vote = voteRecord.docs[0] as { id: string | number }
            await req.payload.update({
                collection: 'product-votes',
                id: vote.id,
                data: { status: 'testing' },
            })
        }

        // Flush events before responding
        await flushServer()

        return Response.json({
            success: true,
            message: `Notified ${successCount} subscribers that testing has started`,
            notified: successCount,
        })
    } catch (error) {
        console.error('[send-testing-notification] Error:', error)
        return Response.json(
            { error: 'Failed to send notifications', details: String(error) },
            { status: 500 }
        )
    }
}
