import type { PayloadHandler, PayloadRequest } from 'payload'
import { applyRateLimitAsync, RateLimits } from '../utilities/rate-limiter'
import { validationError, internalError } from '../utilities/api-response'

// Maximum length for fingerprint hash
const MAX_FINGERPRINT_HASH_LENGTH = 100

/**
 * Validate and sanitize fingerprint hash
 */
function validateFingerprintHash(hash: unknown): string | null {
    if (typeof hash !== 'string') return null
    const trimmed = hash.trim()
    if (trimmed.length === 0 || trimmed.length > MAX_FINGERPRINT_HASH_LENGTH) return null
    // Only allow alphanumeric, underscores, and hyphens
    if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) return null
    return trimmed
}

/**
 * Validate behavior metrics - ensure all values are safe numbers
 */
function validateBehaviorMetrics(metrics: unknown): Record<string, number> | null {
    if (!metrics || typeof metrics !== 'object') return null

    const rawMetrics = metrics as Record<string, unknown>
    const validated: Record<string, number> = {}

    // List of allowed metric fields
    const allowedFields = [
        'totalScans', 'avoidHits', 'sessionCount', 'searchCount',
        'voteCount', 'paywallsShown', 'paywallsDismissed'
    ]

    for (const field of allowedFields) {
        if (field in rawMetrics) {
            const value = rawMetrics[field]
            // Ensure it's a finite number and not negative
            if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
                // Cap at reasonable maximum to prevent abuse
                validated[field] = Math.min(Math.floor(value), 1000000)
            }
        }
    }

    return Object.keys(validated).length > 0 ? validated : null
}

/**
 * Behavior Metrics Update Endpoint
 *
 * Allows the mobile app to update behavior metrics for a device fingerprint.
 * Used by the Cortex analytics system for adaptive paywalling.
 *
 * POST /api/device-fingerprints/behavior
 * Body: { fingerprintHash: string, behaviorMetrics: Partial<BehaviorMetrics> }
 *
 * SECURITY:
 * - Rate limited to prevent abuse
 * - Input validation and sanitization
 */
export const behaviorUpdateHandler: PayloadHandler = async (req: PayloadRequest) => {
    try {
        const body = await req.json?.() as { fingerprintHash?: unknown; behaviorMetrics?: unknown } | undefined

        // Validate and sanitize fingerprint hash
        const fingerprintHash = validateFingerprintHash(body?.fingerprintHash)
        if (!fingerprintHash) {
            return validationError('fingerprintHash is required and must be a valid alphanumeric string (max 100 characters)')
        }

        // Rate limit by fingerprint hash (60 updates per minute)
        const rateLimitResponse = await applyRateLimitAsync(
            req as unknown as Request,
            RateLimits.FINGERPRINT_BEHAVIOR,
            `fingerprint:behavior:${fingerprintHash}`
        )
        if (rateLimitResponse) {
            return rateLimitResponse
        }

        // Validate behavior metrics
        const behaviorMetrics = validateBehaviorMetrics(body?.behaviorMetrics)
        if (!behaviorMetrics) {
            return validationError('behaviorMetrics must be an object with valid numeric values')
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
        return internalError('Failed to update behavior metrics')
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
