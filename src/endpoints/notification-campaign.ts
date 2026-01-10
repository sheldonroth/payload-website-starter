import type { PayloadHandler, PayloadRequest } from 'payload'
import {
    sendPushNotificationBatch,
    ExpoPushMessage,
    ExpoPushTicket,
} from '../lib/push'

interface NotificationTemplate {
    id: number
    type: string
    variants: Array<{
        variantId: string
        title: string
        body: string
        emoji?: string
        weight: number
        action?: string
        actionData?: unknown
    }>
    schedule?: {
        enabled: boolean
        cooldownHours?: number
    }
}

interface NotificationCampaign {
    id: number
    name: string
    status: string
    template: NotificationTemplate | number
    targeting: {
        targetAll: boolean
        segments?: Array<{ id: number; slug: string }> | number[]
        segmentLogic: 'any' | 'all'
        excludeSegments?: Array<{ id: number; slug: string }> | number[]
        platforms?: string[]
    }
    rateLimiting?: {
        maxPerHour?: number
        cooldownHours?: number
        respectQuietHours?: boolean
    }
    abTesting?: {
        enabled?: boolean
        statsigExperiment?: string
        variantWeights?: Record<string, number>
    }
    sentCount: number
    deliveredCount: number
    failedCount: number
    analyticsTag?: string
}

interface PushToken {
    id: number
    token: string
    fingerprintHash: string
    platform: 'ios' | 'android'
    isActive: boolean
    lastUsed?: string
}

interface SegmentRule {
    field: string
    operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte' | 'neq' | 'contains'
    value: string
}

interface UserSegment {
    id: number
    slug: string
    rules: SegmentRule[]
    ruleLogic: 'all' | 'any'
    isActive: boolean
}

interface UserMetrics {
    scan_count?: number
    days_since_install?: number
    subscription_status?: string
    last_active_days?: number
    streak_days?: number
    badge_count?: number
    referral_count?: number
    platform?: string
    app_version?: string
    products_viewed?: number
    votes_cast?: number
}

/**
 * Select a variant using weighted random selection
 */
function selectWeightedVariant(
    variants: NotificationTemplate['variants'],
    overrideWeights?: Record<string, number>
): NotificationTemplate['variants'][0] | null {
    if (!variants || variants.length === 0) return null
    if (variants.length === 1) return variants[0]

    // Apply override weights if provided
    const weights = variants.map((v) => ({
        variant: v,
        weight: overrideWeights?.[v.variantId] ?? v.weight ?? 1,
    }))

    const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0)
    if (totalWeight === 0) return variants[0]

    let random = Math.random() * totalWeight
    for (const w of weights) {
        random -= w.weight
        if (random <= 0) return w.variant
    }

    return variants[0]
}

/**
 * Evaluate if user metrics match a segment's rules
 */
function evaluateSegmentRules(rules: SegmentRule[], metrics: UserMetrics, logic: 'all' | 'any'): boolean {
    if (!rules || rules.length === 0) return false

    const evaluateRule = (rule: SegmentRule): boolean => {
        const fieldValue = metrics[rule.field as keyof UserMetrics]
        if (fieldValue === undefined || fieldValue === null) return false

        const numericField = typeof fieldValue === 'number' ? fieldValue : parseFloat(String(fieldValue))
        const numericRule = parseFloat(rule.value)

        switch (rule.operator) {
            case 'gt': return !isNaN(numericField) && !isNaN(numericRule) && numericField > numericRule
            case 'lt': return !isNaN(numericField) && !isNaN(numericRule) && numericField < numericRule
            case 'gte': return !isNaN(numericField) && !isNaN(numericRule) && numericField >= numericRule
            case 'lte': return !isNaN(numericField) && !isNaN(numericRule) && numericField <= numericRule
            case 'eq':
                if (!isNaN(numericField) && !isNaN(numericRule)) return numericField === numericRule
                return String(fieldValue).toLowerCase() === rule.value.toLowerCase()
            case 'neq':
                if (!isNaN(numericField) && !isNaN(numericRule)) return numericField !== numericRule
                return String(fieldValue).toLowerCase() !== rule.value.toLowerCase()
            case 'contains':
                return String(fieldValue).toLowerCase().includes(rule.value.toLowerCase())
            default:
                return false
        }
    }

    if (logic === 'any') {
        return rules.some(evaluateRule)
    }
    return rules.every(evaluateRule)
}

/**
 * POST /api/campaigns/send
 *
 * Send a notification campaign to targeted users.
 * Admin only endpoint.
 *
 * Body: {
 *   campaignId: number,
 *   testMode?: boolean,  // If true, only sends to first 10 users
 *   dryRun?: boolean,    // If true, returns target count without sending
 * }
 */
export const campaignSendHandler: PayloadHandler = async (req: PayloadRequest) => {
    if (!req.user || (req.user as { role?: string })?.role !== 'admin') {
        return Response.json({ error: 'Admin access required' }, { status: 401 })
    }

    try {
        const body = await req.json?.()
        const { campaignId, testMode, dryRun } = body || {}

        if (!campaignId) {
            return Response.json({ error: 'campaignId is required' }, { status: 400 })
        }

        // Fetch campaign with template
        const campaign = await req.payload.findByID({
            collection: 'notification-campaigns' as any,
            id: campaignId,
            depth: 2,
        }) as unknown as NotificationCampaign

        if (!campaign) {
            return Response.json({ error: 'Campaign not found' }, { status: 404 })
        }

        if (campaign.status !== 'draft' && campaign.status !== 'scheduled') {
            return Response.json({
                error: `Campaign cannot be sent (status: ${campaign.status})`,
            }, { status: 400 })
        }

        const template = campaign.template as NotificationTemplate
        if (!template || typeof template === 'number') {
            return Response.json({ error: 'Template not found or not populated' }, { status: 400 })
        }

        // Build query for push tokens
        const tokenQuery: any = { isActive: { equals: true } }

        // Filter by platform if specified
        if (campaign.targeting.platforms && campaign.targeting.platforms.length > 0) {
            tokenQuery.platform = { in: campaign.targeting.platforms }
        }

        // Fetch all active push tokens
        const { docs: allTokens } = await req.payload.find({
            collection: 'push-tokens' as any,
            where: tokenQuery,
            limit: testMode ? 10 : 10000, // Limit to 10 in test mode
            depth: 0,
        })

        let targetTokens: PushToken[] = allTokens as unknown as PushToken[]

        // Apply segment targeting (if not targeting all)
        if (!campaign.targeting.targetAll && campaign.targeting.segments) {
            const segmentIds = (campaign.targeting.segments as Array<{ id: number } | number>).map(
                (s) => (typeof s === 'number' ? s : s.id)
            )

            if (segmentIds.length > 0) {
                // Fetch segments
                const { docs: segments } = await req.payload.find({
                    collection: 'user-segments' as any,
                    where: { id: { in: segmentIds } },
                    depth: 0,
                })

                // For each token, check if user matches segments
                // This is a simplified version - in production, you'd cache user metrics
                const matchedTokens: PushToken[] = []

                for (const token of targetTokens) {
                    // Fetch user metrics from fingerprint
                    const { docs: fingerprints } = await req.payload.find({
                        collection: 'device-fingerprints',
                        where: { fingerprintHash: { equals: token.fingerprintHash } },
                        limit: 1,
                        depth: 0,
                    })

                    if (fingerprints.length === 0) continue

                    const fp = fingerprints[0] as unknown as {
                        behaviorMetrics?: UserMetrics
                    }
                    const metrics: UserMetrics = {
                        ...fp.behaviorMetrics,
                        platform: token.platform,
                    }

                    // Check if user matches any/all targeted segments
                    const segmentMatches = (segments as unknown as UserSegment[]).map((seg) =>
                        evaluateSegmentRules(seg.rules, metrics, seg.ruleLogic)
                    )

                    const matches = campaign.targeting.segmentLogic === 'any'
                        ? segmentMatches.some(Boolean)
                        : segmentMatches.every(Boolean)

                    if (matches) {
                        matchedTokens.push(token)
                    }
                }

                targetTokens = matchedTokens
            }
        }

        // Apply exclusion segments
        if (campaign.targeting.excludeSegments && campaign.targeting.excludeSegments.length > 0) {
            const excludeIds = (campaign.targeting.excludeSegments as Array<{ id: number } | number>).map(
                (s) => (typeof s === 'number' ? s : s.id)
            )

            const { docs: excludeSegments } = await req.payload.find({
                collection: 'user-segments' as any,
                where: { id: { in: excludeIds } },
                depth: 0,
            })

            // Filter out users matching exclusion segments
            const filteredTokens: PushToken[] = []

            for (const token of targetTokens) {
                const { docs: fingerprints } = await req.payload.find({
                    collection: 'device-fingerprints',
                    where: { fingerprintHash: { equals: token.fingerprintHash } },
                    limit: 1,
                    depth: 0,
                })

                if (fingerprints.length === 0) {
                    filteredTokens.push(token)
                    continue
                }

                const fp = fingerprints[0] as unknown as { behaviorMetrics?: UserMetrics }
                const metrics: UserMetrics = {
                    ...fp.behaviorMetrics,
                    platform: token.platform,
                }

                // Check if user matches any exclusion segment
                const excludeMatch = (excludeSegments as unknown as UserSegment[]).some((seg) =>
                    evaluateSegmentRules(seg.rules, metrics, seg.ruleLogic)
                )

                if (!excludeMatch) {
                    filteredTokens.push(token)
                }
            }

            targetTokens = filteredTokens
        }

        // Dry run - just return target count
        if (dryRun) {
            return Response.json({
                success: true,
                dryRun: true,
                targetCount: targetTokens.length,
                campaign: {
                    id: campaign.id,
                    name: campaign.name,
                },
            })
        }

        if (targetTokens.length === 0) {
            return Response.json({
                success: true,
                message: 'No users matched targeting criteria',
                sentCount: 0,
            })
        }

        // Update campaign status to sending
        await req.payload.update({
            collection: 'notification-campaigns' as any,
            id: campaign.id,
            data: { status: 'sending' } as any,
        })

        // Build and send notifications
        const messages: ExpoPushMessage[] = []
        const sendRecords: Array<{
            token: PushToken
            variant: NotificationTemplate['variants'][0]
            message: ExpoPushMessage
        }> = []

        for (const token of targetTokens) {
            // Select variant
            const variant = selectWeightedVariant(
                template.variants,
                campaign.abTesting?.enabled ? campaign.abTesting.variantWeights : undefined
            )

            if (!variant) continue

            // Build message
            const title = variant.emoji ? `${variant.emoji} ${variant.title}` : variant.title
            const message: ExpoPushMessage = {
                to: token.token,
                title,
                body: variant.body,
                sound: 'default',
                priority: 'high',
                data: {
                    campaignId: campaign.id,
                    variantId: variant.variantId,
                    action: variant.action,
                    ...(variant.actionData as Record<string, unknown> || {}),
                },
            }

            messages.push(message)
            sendRecords.push({ token, variant, message })
        }

        // Send in batches
        const tickets = await sendPushNotificationBatch(messages)

        // Track results
        let successCount = 0
        let failedCount = 0

        // Create send records and update token status
        for (let i = 0; i < tickets.length; i++) {
            const ticket = tickets[i]
            const record = sendRecords[i]

            const status = ticket.status === 'ok' ? 'sent' : 'failed'
            if (ticket.status === 'ok') successCount++
            else failedCount++

            // Create notification send record
            await req.payload.create({
                collection: 'notification-sends' as any,
                data: {
                    campaign: campaign.id,
                    template: template.id,
                    pushToken: record.token.id,
                    fingerprintHash: record.token.fingerprintHash,
                    variant: record.variant.variantId,
                    title: record.message.title,
                    body: record.message.body,
                    data: record.message.data,
                    status,
                    expoTicketId: ticket.id,
                    errorMessage: ticket.message,
                    errorCode: ticket.details?.error,
                    sentAt: new Date().toISOString(),
                    platform: record.token.platform,
                    analyticsTag: campaign.analyticsTag,
                    statsigExperiment: campaign.abTesting?.statsigExperiment,
                } as any,
            })

            // Handle invalid tokens
            if (ticket.details?.error === 'DeviceNotRegistered') {
                await req.payload.update({
                    collection: 'push-tokens',
                    id: record.token.id,
                    data: { isActive: false },
                })
            }
        }

        // Update campaign status and counts
        await req.payload.update({
            collection: 'notification-campaigns' as any,
            id: campaign.id,
            data: {
                status: 'sent',
                sentCount: (campaign.sentCount || 0) + successCount,
                failedCount: (campaign.failedCount || 0) + failedCount,
                lastSentAt: new Date().toISOString(),
            } as any,
        })

        return Response.json({
            success: true,
            message: `Campaign sent to ${successCount} users`,
            sentCount: successCount,
            failedCount,
            testMode: testMode || false,
        })
    } catch (error) {
        console.error('[Campaign Send] Error:', error)
        return Response.json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to send campaign',
        }, { status: 500 })
    }
}

/**
 * GET /api/campaigns/stats
 *
 * Get campaign performance statistics
 */
export const campaignStatsHandler: PayloadHandler = async (req: PayloadRequest) => {
    if (!req.user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const url = new URL(req.url || '', 'http://localhost')
        const campaignId = url.searchParams.get('campaignId')

        if (!campaignId) {
            return Response.json({ error: 'campaignId is required' }, { status: 400 })
        }

        // Fetch campaign
        const campaign = await req.payload.findByID({
            collection: 'notification-campaigns' as any,
            id: Number(campaignId),
            depth: 1,
        }) as unknown as NotificationCampaign

        if (!campaign) {
            return Response.json({ error: 'Campaign not found' }, { status: 404 })
        }

        // Fetch send statistics
        const statusCounts: Record<string, number> = {}
        const statuses = ['pending', 'sent', 'delivered', 'opened', 'failed', 'invalid_token']

        for (const status of statuses) {
            const { totalDocs } = await req.payload.find({
                collection: 'notification-sends' as any,
                where: {
                    campaign: { equals: campaign.id },
                    status: { equals: status },
                },
                limit: 0,
            })
            statusCounts[status] = totalDocs
        }

        // Variant performance
        const variantStats: Record<string, { sent: number; opened: number }> = {}

        const { docs: sends } = await req.payload.find({
            collection: 'notification-sends' as any,
            where: { campaign: { equals: campaign.id } },
            limit: 10000,
            depth: 0,
        })

        for (const send of sends as unknown as Array<{ variant: string; status: string }>) {
            if (!send.variant) continue
            if (!variantStats[send.variant]) {
                variantStats[send.variant] = { sent: 0, opened: 0 }
            }
            variantStats[send.variant].sent++
            if (send.status === 'opened') {
                variantStats[send.variant].opened++
            }
        }

        // Calculate rates
        const totalSent = statusCounts.sent + statusCounts.delivered + statusCounts.opened
        const deliveryRate = totalSent > 0
            ? ((statusCounts.delivered + statusCounts.opened) / totalSent * 100).toFixed(2)
            : '0'
        const openRate = totalSent > 0
            ? (statusCounts.opened / totalSent * 100).toFixed(2)
            : '0'

        return Response.json({
            success: true,
            campaign: {
                id: campaign.id,
                name: campaign.name,
                status: campaign.status,
            },
            stats: {
                total: Object.values(statusCounts).reduce((a, b) => a + b, 0),
                byStatus: statusCounts,
                deliveryRate: `${deliveryRate}%`,
                openRate: `${openRate}%`,
            },
            variantPerformance: Object.entries(variantStats).map(([variant, stats]) => ({
                variant,
                sent: stats.sent,
                opened: stats.opened,
                openRate: stats.sent > 0 ? `${(stats.opened / stats.sent * 100).toFixed(2)}%` : '0%',
            })),
        })
    } catch (error) {
        console.error('[Campaign Stats] Error:', error)
        return Response.json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get stats',
        }, { status: 500 })
    }
}

/**
 * POST /api/campaigns/trigger
 *
 * Trigger a campaign programmatically (for event-based campaigns)
 */
export const campaignTriggerHandler: PayloadHandler = async (req: PayloadRequest) => {
    try {
        const body = await req.json?.()
        const { campaignId, triggerEvent, userId, metrics } = body || {}

        if (!campaignId || !triggerEvent) {
            return Response.json({
                error: 'campaignId and triggerEvent are required',
            }, { status: 400 })
        }

        // Fetch campaign
        const campaign = await req.payload.findByID({
            collection: 'notification-campaigns' as any,
            id: campaignId,
            depth: 2,
        }) as unknown as NotificationCampaign & {
            type: string
            triggerConfig?: { triggerEvent: string; triggerDelay: number }
        }

        if (!campaign) {
            return Response.json({ error: 'Campaign not found' }, { status: 404 })
        }

        // Verify campaign is triggered type and matches event
        if (campaign.type !== 'triggered') {
            return Response.json({
                error: 'Campaign is not a triggered campaign',
            }, { status: 400 })
        }

        if (campaign.triggerConfig?.triggerEvent !== triggerEvent) {
            return Response.json({
                error: `Campaign trigger event mismatch (expected: ${campaign.triggerConfig?.triggerEvent})`,
            }, { status: 400 })
        }

        // If there's a delay, schedule it (simplified - in production use a job queue)
        const delay = campaign.triggerConfig?.triggerDelay || 0
        if (delay > 0) {
            console.log(`[Campaign Trigger] Delaying ${delay} minutes for campaign ${campaignId}`)
            // In production, you'd queue this for later execution
        }

        // For now, send immediately (or after delay if we had job queue)
        // This would typically be handled by a background job
        return Response.json({
            success: true,
            message: `Campaign ${campaignId} triggered for event ${triggerEvent}`,
            delay: delay,
        })
    } catch (error) {
        console.error('[Campaign Trigger] Error:', error)
        return Response.json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to trigger campaign',
        }, { status: 500 })
    }
}
