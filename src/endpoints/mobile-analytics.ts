/**
 * Mobile Analytics Batch Endpoint
 *
 * Allows mobile apps to batch analytics events for efficient transmission.
 * Reduces battery usage and network calls compared to individual event tracking.
 *
 * POST /api/mobile/analytics
 *
 * Body:
 * {
 *   fingerprint: string,
 *   events: [
 *     { name: string, properties: object, timestamp: number }
 *   ]
 * }
 */

import type { PayloadHandler } from 'payload'

interface AnalyticsEvent {
    name: string
    properties?: Record<string, unknown>
    timestamp?: number
}

interface AnalyticsPayload {
    fingerprint: string
    sessionId?: string
    appVersion?: string
    platform?: 'ios' | 'android'
    events: AnalyticsEvent[]
}

// Event types we track server-side
const TRACKED_EVENTS = new Set([
    'scan_completed',
    'product_viewed',
    'product_shared',
    'subscription_started',
    'subscription_cancelled',
    'paywall_shown',
    'paywall_converted',
    'referral_shared',
    'search_performed',
    'error_occurred',
    'app_opened',
    'app_backgrounded',
])

export const mobileAnalyticsHandler: PayloadHandler = async (req) => {
    if (req.method !== 'POST') {
        return Response.json({ error: 'Method not allowed' }, { status: 405 })
    }

    let body: AnalyticsPayload
    try {
        body = await req.json?.()
    } catch {
        return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    if (!body.fingerprint || !Array.isArray(body.events)) {
        return Response.json(
            { error: 'fingerprint and events array required' },
            { status: 400 }
        )
    }

    // Filter to tracked events only
    const validEvents = body.events.filter((e) => TRACKED_EVENTS.has(e.name))

    if (validEvents.length === 0) {
        return Response.json({ received: 0, message: 'No tracked events' })
    }

    // Update device fingerprint behavior metrics
    try {
        const device = await req.payload.find({
            collection: 'device-fingerprints',
            where: {
                fingerprintHash: { equals: body.fingerprint },
            },
            limit: 1,
        })

        if (device.docs[0]) {
            const doc = device.docs[0] as {
                id: number
                behaviorMetrics?: {
                    totalScans?: number
                    sessionCount?: number
                    searchCount?: number
                }
            }

            // Aggregate behavior updates
            let scanDelta = 0
            let searchDelta = 0
            let sessionDelta = 0
            let paywallShown = 0
            let paywallConverted = 0

            for (const event of validEvents) {
                switch (event.name) {
                    case 'scan_completed':
                        scanDelta++
                        break
                    case 'search_performed':
                        searchDelta++
                        break
                    case 'app_opened':
                        sessionDelta++
                        break
                    case 'paywall_shown':
                        paywallShown++
                        break
                    case 'paywall_converted':
                        paywallConverted++
                        break
                }
            }

            // Update metrics if any changes
            if (scanDelta || searchDelta || sessionDelta || paywallShown || paywallConverted) {
                await req.payload.update({
                    collection: 'device-fingerprints',
                    id: doc.id,
                    data: {
                        behaviorMetrics: {
                            ...doc.behaviorMetrics,
                            totalScans: (doc.behaviorMetrics?.totalScans || 0) + scanDelta,
                            sessionCount: (doc.behaviorMetrics?.sessionCount || 0) + sessionDelta,
                            searchCount: (doc.behaviorMetrics?.searchCount || 0) + searchDelta,
                        },
                    },
                })
            }
        }
    } catch (err) {
        console.error('[MobileAnalytics] Failed to update device metrics:', err)
        // Continue - don't fail the request
    }

    // Log events for future processing (e.g., forwarding to RudderStack)
    console.log(`[MobileAnalytics] Received ${validEvents.length} events from ${body.fingerprint}`)

    return Response.json({
        received: validEvents.length,
        timestamp: Date.now(),
    })
}
