import type { PayloadHandler, PayloadRequest } from 'payload'

interface SegmentRule {
    field: string
    operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte' | 'neq' | 'contains'
    value: string
}

interface UserSegment {
    id: number
    name: string
    slug: string
    rules: SegmentRule[]
    ruleLogic: 'all' | 'any'
    syncToStatsig: boolean
    statsigGateName?: string
    statsigPropertyName?: string
    syncToRevenueCat: boolean
    revenueCatAttribute?: string
    isActive: boolean
    priority: number
}

interface UserMetrics {
    scan_count?: number
    days_since_install?: number
    subscription_status?: 'free' | 'trial' | 'active' | 'expired' | 'cancelled'
    last_active_days?: number
    streak_days?: number
    badge_count?: number
    referral_count?: number
    platform?: 'ios' | 'android'
    app_version?: string
    products_viewed?: number
    votes_cast?: number
}

interface SyncAction {
    service: 'statsig' | 'revenuecat'
    action: 'set_property' | 'set_attribute'
    name: string
    value: string | boolean
}

/**
 * Evaluate a single rule against user metrics
 */
function evaluateRule(rule: SegmentRule, metrics: UserMetrics): boolean {
    const fieldValue = metrics[rule.field as keyof UserMetrics]
    const ruleValue = rule.value

    // Handle missing metrics
    if (fieldValue === undefined || fieldValue === null) {
        return false
    }

    // Convert values for comparison
    const numericField = typeof fieldValue === 'number' ? fieldValue : parseFloat(String(fieldValue))
    const numericRule = parseFloat(ruleValue)

    switch (rule.operator) {
        case 'gt':
            return !isNaN(numericField) && !isNaN(numericRule) && numericField > numericRule
        case 'lt':
            return !isNaN(numericField) && !isNaN(numericRule) && numericField < numericRule
        case 'gte':
            return !isNaN(numericField) && !isNaN(numericRule) && numericField >= numericRule
        case 'lte':
            return !isNaN(numericField) && !isNaN(numericRule) && numericField <= numericRule
        case 'eq':
            // Support both numeric and string equality
            if (!isNaN(numericField) && !isNaN(numericRule)) {
                return numericField === numericRule
            }
            return String(fieldValue).toLowerCase() === ruleValue.toLowerCase()
        case 'neq':
            if (!isNaN(numericField) && !isNaN(numericRule)) {
                return numericField !== numericRule
            }
            return String(fieldValue).toLowerCase() !== ruleValue.toLowerCase()
        case 'contains':
            return String(fieldValue).toLowerCase().includes(ruleValue.toLowerCase())
        default:
            return false
    }
}

/**
 * Evaluate if a user belongs to a segment
 */
function evaluateSegment(segment: UserSegment, metrics: UserMetrics): boolean {
    if (!segment.rules || segment.rules.length === 0) {
        return false
    }

    if (segment.ruleLogic === 'any') {
        // OR logic - any rule must match
        return segment.rules.some((rule) => evaluateRule(rule, metrics))
    }

    // AND logic (default) - all rules must match
    return segment.rules.every((rule) => evaluateRule(rule, metrics))
}

/**
 * POST /api/segments/evaluate
 *
 * Evaluate a user against all active segments.
 * Returns matched segments and sync actions for external services.
 *
 * Request body:
 * {
 *   fingerprintHash: string,
 *   metrics: {
 *     scan_count: number,
 *     days_since_install: number,
 *     subscription_status: string,
 *     last_active_days: number,
 *     streak_days: number,
 *     badge_count: number,
 *     referral_count: number,
 *     platform: string,
 *     app_version: string,
 *     products_viewed: number,
 *     votes_cast: number
 *   }
 * }
 */
export const segmentsEvaluateHandler: PayloadHandler = async (req: PayloadRequest) => {
    try {
        const body = await req.json?.()
        const { fingerprintHash, metrics } = body || {}

        if (!metrics || typeof metrics !== 'object') {
            return Response.json({
                success: false,
                error: 'metrics object is required',
            }, { status: 400 })
        }

        // Fetch all active segments
        const { docs: segments } = await req.payload.find({
            collection: 'user-segments' as any,
            where: { isActive: { equals: true } },
            sort: '-priority',
            limit: 100,
        })

        const matchedSegments: string[] = []
        const syncActions: SyncAction[] = []

        // Evaluate each segment
        for (const segment of segments as unknown as UserSegment[]) {
            const isMatch = evaluateSegment(segment, metrics as UserMetrics)

            if (isMatch) {
                matchedSegments.push(segment.slug)

                // Add Statsig sync action
                if (segment.syncToStatsig) {
                    syncActions.push({
                        service: 'statsig',
                        action: 'set_property',
                        name: segment.statsigPropertyName || `segment_${segment.slug}`,
                        value: true,
                    })
                }

                // Add RevenueCat sync action
                if (segment.syncToRevenueCat && segment.revenueCatAttribute) {
                    syncActions.push({
                        service: 'revenuecat',
                        action: 'set_attribute',
                        name: segment.revenueCatAttribute,
                        value: 'true',
                    })
                }
            }
        }

        return Response.json({
            success: true,
            fingerprintHash,
            segments: matchedSegments,
            syncActions,
            evaluatedAt: new Date().toISOString(),
        })
    } catch (error) {
        console.error('[Segments Evaluate] Error:', error)
        return Response.json({
            success: false,
            error: error instanceof Error ? error.message : 'Evaluation failed',
        }, { status: 500 })
    }
}

/**
 * GET /api/segments
 *
 * List all active segments (for admin/debugging)
 */
export const segmentsListHandler: PayloadHandler = async (req: PayloadRequest) => {
    try {
        const { docs: segments, totalDocs } = await req.payload.find({
            collection: 'user-segments' as any,
            where: { isActive: { equals: true } },
            sort: '-priority',
            limit: 100,
            depth: 0,
        })

        return Response.json({
            success: true,
            segments: (segments as unknown as UserSegment[]).map((s) => ({
                id: s.id,
                name: s.name,
                slug: s.slug,
                ruleCount: s.rules?.length || 0,
                ruleLogic: s.ruleLogic,
                syncToStatsig: s.syncToStatsig,
                syncToRevenueCat: s.syncToRevenueCat,
                priority: s.priority,
            })),
            total: totalDocs,
        })
    } catch (error) {
        console.error('[Segments List] Error:', error)
        return Response.json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to list segments',
        }, { status: 500 })
    }
}

/**
 * GET /api/segments/:slug
 *
 * Get a single segment by slug with full rules
 */
export const segmentsGetHandler: PayloadHandler = async (req: PayloadRequest) => {
    try {
        const url = new URL(req.url || '', 'http://localhost')
        const slug = url.pathname.split('/').pop()

        if (!slug) {
            return Response.json({
                success: false,
                error: 'Segment slug is required',
            }, { status: 400 })
        }

        const { docs: segments } = await req.payload.find({
            collection: 'user-segments' as any,
            where: { slug: { equals: slug } },
            limit: 1,
        })

        if (segments.length === 0) {
            return Response.json({
                success: false,
                error: 'Segment not found',
            }, { status: 404 })
        }

        return Response.json({
            success: true,
            segment: segments[0],
        })
    } catch (error) {
        console.error('[Segments Get] Error:', error)
        return Response.json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get segment',
        }, { status: 500 })
    }
}
