import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import {
    sendPushNotificationBatch,
    createWinbackNotification,
    ExpoPushMessage,
} from '@/lib/push'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes

// Win-back configuration
const INACTIVITY_DAYS = 3 // Days of inactivity before win-back
const COOLDOWN_DAYS = 7 // Days between win-back notifications
const MAX_NOTIFICATIONS_PER_RUN = 500 // Limit per cron run

/**
 * Win-back Push Notifications Cron Job
 * Runs daily at 6 PM (same as email win-back)
 *
 * Targets users who:
 * - Have been inactive for 3+ days
 * - Haven't received a win-back notification in the last 7 days
 * - Have an active push token
 */
export async function GET(request: Request) {
    // Verify cron secret
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
        console.error('[Win-back Push] Unauthorized request')
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        console.log('[Win-back Push] Starting...')

        const payload = await getPayload({ config })
        const now = new Date()

        // Calculate thresholds
        const inactivityThreshold = new Date(
            now.getTime() - INACTIVITY_DAYS * 24 * 60 * 60 * 1000
        )
        const cooldownThreshold = new Date(
            now.getTime() - COOLDOWN_DAYS * 24 * 60 * 60 * 1000
        )

        // Find inactive users with active push tokens
        // - lastActiveAt is more than INACTIVITY_DAYS ago
        // - lastWinbackNotification is either null or more than COOLDOWN_DAYS ago
        // - isActive is true
        const { docs: targetTokens } = await payload.find({
            collection: 'push-tokens',
            where: {
                and: [
                    { isActive: { equals: true } },
                    {
                        or: [
                            // Has lastActiveAt and it's before the threshold
                            { lastActiveAt: { less_than: inactivityThreshold.toISOString() } },
                            // No lastActiveAt but token was created before threshold
                            {
                                and: [
                                    { lastActiveAt: { exists: false } },
                                    { createdAt: { less_than: inactivityThreshold.toISOString() } },
                                ],
                            },
                        ],
                    },
                    {
                        or: [
                            { lastWinbackNotification: { exists: false } },
                            { lastWinbackNotification: { less_than: cooldownThreshold.toISOString() } },
                        ],
                    },
                ],
            },
            limit: MAX_NOTIFICATIONS_PER_RUN,
            depth: 0,
        })

        if (targetTokens.length === 0) {
            console.log('[Win-back Push] No inactive users to target')
            return NextResponse.json({
                success: true,
                message: 'No inactive users to target',
                processed: 0,
            })
        }

        console.log(`[Win-back Push] Found ${targetTokens.length} inactive users`)

        // Build notification messages
        const messages: ExpoPushMessage[] = []
        const tokenMap: Map<string, { id: string | number }> = new Map()

        for (const doc of targetTokens) {
            const token = doc as { id: string | number; token: string }
            const message = createWinbackNotification(token.token)
            messages.push(message)
            tokenMap.set(token.token, { id: token.id })
        }

        // Send notifications in batches
        const tickets = await sendPushNotificationBatch(messages)

        // Track results
        let successCount = 0
        let failedCount = 0
        let invalidTokens = 0

        // Update tokens based on results
        for (let i = 0; i < tickets.length; i++) {
            const ticket = tickets[i]
            const pushToken = messages[i].to
            const tokenData = tokenMap.get(pushToken)

            if (!tokenData) continue

            if (ticket.status === 'ok') {
                successCount++
                // Update last win-back notification time
                await payload.update({
                    collection: 'push-tokens',
                    id: tokenData.id,
                    data: {
                        lastWinbackNotification: now.toISOString(),
                        lastUsed: now.toISOString(),
                    } as any,
                })
            } else {
                failedCount++

                // Handle invalid tokens
                if (ticket.details?.error === 'DeviceNotRegistered') {
                    invalidTokens++
                    await payload.update({
                        collection: 'push-tokens',
                        id: tokenData.id,
                        data: {
                            isActive: false,
                            failureCount: 999, // Mark as permanently failed
                        },
                    })
                } else {
                    // Increment failure count for other errors
                    const currentToken = targetTokens.find(
                        (t) => (t as { id: string | number }).id === tokenData.id
                    ) as { failureCount?: number } | undefined

                    const newFailureCount = ((currentToken?.failureCount || 0) + 1)

                    await payload.update({
                        collection: 'push-tokens',
                        id: tokenData.id,
                        data: {
                            failureCount: newFailureCount,
                            // Deactivate after 5 consecutive failures
                            isActive: newFailureCount < 5,
                        },
                    })
                }
            }
        }

        // Log results
        console.log(`[Win-back Push] Complete:`)
        console.log(`  - Sent: ${successCount}`)
        console.log(`  - Failed: ${failedCount}`)
        console.log(`  - Invalid tokens deactivated: ${invalidTokens}`)

        return NextResponse.json({
            success: true,
            processed: targetTokens.length,
            sent: successCount,
            failed: failedCount,
            invalidTokens,
            timestamp: now.toISOString(),
        })
    } catch (error) {
        console.error('[Win-back Push] Error:', error)
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Cron failed',
            timestamp: new Date().toISOString(),
        }, { status: 500 })
    }
}
