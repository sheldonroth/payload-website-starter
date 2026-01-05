import type { PayloadHandler, PayloadRequest } from 'payload'

/**
 * Behavior Metrics Update Endpoint
 *
 * Allows the mobile app to update behavior metrics for a device fingerprint.
 * Used by the Cortex analytics system for adaptive paywalling.
 *
 * POST /api/device-fingerprints/behavior
 * Body: { fingerprintHash: string, behaviorMetrics: Partial<BehaviorMetrics> }
 */
export const behaviorUpdateHandler: PayloadHandler = async (req: PayloadRequest) => {
    try {
        const body = await req.json?.() as { fingerprintHash?: string; behaviorMetrics?: Record<string, unknown> } | undefined

        const fingerprintHash = body?.fingerprintHash
        const behaviorMetrics = body?.behaviorMetrics

        if (!fingerprintHash) {
            return Response.json({ error: 'Missing fingerprintHash' }, { status: 400 })
        }

        if (!behaviorMetrics || typeof behaviorMetrics !== 'object') {
            return Response.json({ error: 'Missing or invalid behaviorMetrics' }, { status: 400 })
        }

        // Find existing fingerprint
        const existing = await req.payload.find({
            collection: 'device-fingerprints',
            where: {
                fingerprintHash: { equals: fingerprintHash },
            },
            limit: 1,
        })

        if (existing.docs.length === 0) {
            // Create new fingerprint with behavior data
            const cohort = assignCohort(fingerprintHash)

            await req.payload.create({
                collection: 'device-fingerprints',
                data: {
                    fingerprintHash,
                    firstSeenAt: new Date().toISOString(),
                    lastSeenAt: new Date().toISOString(),
                    behaviorMetrics: {
                        totalScans: (behaviorMetrics.totalScans as number) || 0,
                        avoidHits: (behaviorMetrics.avoidHits as number) || 0,
                        sessionCount: (behaviorMetrics.sessionCount as number) || 0,
                        searchCount: (behaviorMetrics.searchCount as number) || 0,
                        voteCount: (behaviorMetrics.voteCount as number) || 0,
                        cohort,
                        paywallsShown: (behaviorMetrics.paywallsShown as number) || 0,
                        paywallsDismissed: (behaviorMetrics.paywallsDismissed as number) || 0,
                    },
                },
            })

            return Response.json({ success: true, created: true, cohort }, { status: 201 })
        }

        // Update existing fingerprint
        const doc = existing.docs[0]
        const currentMetrics = (doc as unknown as Record<string, unknown>).behaviorMetrics as Record<string, unknown> | undefined

        // Merge incoming metrics with existing (incremental updates)
        const updatedMetrics = {
            totalScans: Number(behaviorMetrics.totalScans ?? currentMetrics?.totalScans ?? 0),
            avoidHits: Number(behaviorMetrics.avoidHits ?? currentMetrics?.avoidHits ?? 0),
            sessionCount: Number(behaviorMetrics.sessionCount ?? currentMetrics?.sessionCount ?? 0),
            searchCount: Number(behaviorMetrics.searchCount ?? currentMetrics?.searchCount ?? 0),
            voteCount: Number(behaviorMetrics.voteCount ?? currentMetrics?.voteCount ?? 0),
            cohort: (currentMetrics?.cohort as 'experiment' | 'control' | 'holdout') || assignCohort(fingerprintHash),
            paywallsShown: Number(behaviorMetrics.paywallsShown ?? currentMetrics?.paywallsShown ?? 0),
            paywallsDismissed: Number(behaviorMetrics.paywallsDismissed ?? currentMetrics?.paywallsDismissed ?? 0),
        }

        await req.payload.update({
            collection: 'device-fingerprints',
            id: doc.id,
            data: {
                lastSeenAt: new Date().toISOString(),
                behaviorMetrics: updatedMetrics,
            },
        })

        return Response.json({ success: true, metrics: updatedMetrics }, { status: 200 })
    } catch (error) {
        console.error('[BehaviorUpdate] Failed:', error)
        return Response.json({ error: 'Internal server error' }, { status: 500 })
    }
}

/**
 * Assign cohort based on fingerprint hash
 * - 90% experiment
 * - 5% control
 * - 5% holdout
 */
function assignCohort(fingerprint: string): 'experiment' | 'control' | 'holdout' {
    const hash = fingerprint.slice(-2)
    const value = parseInt(hash, 16) % 100

    if (value < 5) return 'holdout'
    if (value < 10) return 'control'
    return 'experiment'
}
