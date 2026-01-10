/**
 * Feature Flags Management API
 *
 * Enhanced endpoints for managing Statsig feature gates and experiments.
 * Provides dashboard API, rollout control, and gate management.
 *
 * Required Environment Variables:
 * - STATSIG_CONSOLE_API_KEY: Console API key (starts with 'console-')
 */

import type { PayloadHandler, PayloadRequest } from 'payload'

interface StatsigGate {
    id: string
    name: string
    description?: string
    isEnabled: boolean
    rules: Array<{
        name: string
        passPercentage: number
        conditions: Array<{
            type: string
            targetValue: string[] | number
            operator: string
            field: string
        }>
    }>
    salt: string
    defaultValue: boolean
    lastModifiedTime: number
    tags?: string[]
    creatorName?: string
    checksPerHour?: number
}

interface StatsigExperiment {
    id: string
    name: string
    description?: string
    status: string
    groups: Array<{
        name: string
        weight: number
        json?: Record<string, unknown>
    }>
    allocation?: number
    tags?: string[]
    lastModifiedTime: string
}

// Cache for dashboard data
let dashboardCache: { data: unknown; timestamp: number } | null = null
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

/**
 * Validate Statsig Console API key
 */
function validateApiKey(apiKey: string | undefined): { valid: boolean; error?: string } {
    if (!apiKey) {
        return { valid: false, error: 'STATSIG_CONSOLE_API_KEY not configured' }
    }
    if (!apiKey.startsWith('console-')) {
        return { valid: false, error: 'Invalid API key format - must be a Console API key' }
    }
    return { valid: true }
}

/**
 * GET /api/feature-flags/dashboard
 *
 * Returns comprehensive dashboard data for all feature flags and experiments
 */
export const featureFlagsDashboardHandler: PayloadHandler = async (req: PayloadRequest) => {
    if (req.method !== 'GET') {
        return Response.json({ error: 'Method not allowed' }, { status: 405 })
    }

    // Admin only
    if (!req.user || (req.user as { role?: string })?.role !== 'admin') {
        return Response.json({ error: 'Admin access required' }, { status: 401 })
    }

    const apiKey = process.env.STATSIG_CONSOLE_API_KEY
    const validation = validateApiKey(apiKey)
    if (!validation.valid) {
        return Response.json({ error: validation.error }, { status: 500 })
    }

    // Check cache
    const now = Date.now()
    if (dashboardCache && now - dashboardCache.timestamp < CACHE_TTL) {
        return Response.json({
            ...(dashboardCache.data as object),
            cached: true,
        })
    }

    try {
        // Fetch gates and experiments in parallel
        const [gatesResponse, experimentsResponse] = await Promise.all([
            fetch('https://statsigapi.net/console/v1/gates', {
                method: 'GET',
                headers: {
                    'STATSIG-API-KEY': apiKey!,
                    'Content-Type': 'application/json',
                },
            }),
            fetch('https://statsigapi.net/console/v1/experiments', {
                method: 'GET',
                headers: {
                    'STATSIG-API-KEY': apiKey!,
                    'Content-Type': 'application/json',
                },
            }),
        ])

        if (!gatesResponse.ok || !experimentsResponse.ok) {
            return Response.json({
                error: 'Failed to fetch from Statsig',
                gatesStatus: gatesResponse.status,
                experimentsStatus: experimentsResponse.status,
            }, { status: 500 })
        }

        const gatesData = await gatesResponse.json()
        const experimentsData = await experimentsResponse.json()

        const gates: StatsigGate[] = gatesData.data || []
        const experiments: StatsigExperiment[] = experimentsData.data || []

        // Calculate summary statistics
        const summary = {
            totalGates: gates.length,
            enabledGates: gates.filter((g) => g.isEnabled).length,
            disabledGates: gates.filter((g) => !g.isEnabled).length,
            totalExperiments: experiments.length,
            activeExperiments: experiments.filter((e) => e.status === 'active').length,
            pausedExperiments: experiments.filter((e) => e.status === 'paused').length,
        }

        // Group gates by tag
        const gatesByTag: Record<string, StatsigGate[]> = {}
        gates.forEach((gate) => {
            const tags = gate.tags || ['Untagged']
            tags.forEach((tag) => {
                if (!gatesByTag[tag]) gatesByTag[tag] = []
                gatesByTag[tag].push(gate)
            })
        })

        // Transform gates for dashboard display
        const formattedGates = gates.map((gate) => ({
            id: gate.id,
            name: gate.name,
            description: gate.description,
            isEnabled: gate.isEnabled,
            defaultValue: gate.defaultValue,
            tags: gate.tags || [],
            ruleCount: gate.rules?.length || 0,
            rolloutPercentage: gate.rules?.[0]?.passPercentage ?? (gate.isEnabled ? 100 : 0),
            lastModified: new Date(gate.lastModifiedTime).toISOString(),
            createdBy: gate.creatorName,
            checksPerHour: gate.checksPerHour,
        }))

        // Transform experiments for dashboard display
        const formattedExperiments = experiments.map((exp) => ({
            id: exp.id,
            name: exp.name,
            description: exp.description,
            status: exp.status,
            tags: exp.tags || [],
            groups: exp.groups?.map((g) => ({
                name: g.name,
                weight: g.weight,
            })) || [],
            allocation: exp.allocation,
            lastModified: exp.lastModifiedTime,
        }))

        const dashboardData = {
            summary,
            gates: formattedGates,
            experiments: formattedExperiments,
            gatesByTag,
            lastUpdated: new Date().toISOString(),
        }

        // Update cache
        dashboardCache = { data: dashboardData, timestamp: now }

        return Response.json({
            success: true,
            ...dashboardData,
            cached: false,
        })
    } catch (error) {
        console.error('[FeatureFlags Dashboard] Error:', error)
        return Response.json({
            error: error instanceof Error ? error.message : 'Failed to fetch dashboard data',
        }, { status: 500 })
    }
}

/**
 * POST /api/feature-flags/gates/:id/toggle
 *
 * Enable or disable a feature gate
 */
export const featureFlagsToggleHandler: PayloadHandler = async (req: PayloadRequest) => {
    if (req.method !== 'POST') {
        return Response.json({ error: 'Method not allowed' }, { status: 405 })
    }

    // Admin only
    if (!req.user || (req.user as { role?: string })?.role !== 'admin') {
        return Response.json({ error: 'Admin access required' }, { status: 401 })
    }

    const apiKey = process.env.STATSIG_CONSOLE_API_KEY
    const validation = validateApiKey(apiKey)
    if (!validation.valid) {
        return Response.json({ error: validation.error }, { status: 500 })
    }

    try {
        const body = await req.json?.()
        const { gateId, enabled } = body || {}

        if (!gateId || typeof enabled !== 'boolean') {
            return Response.json({
                error: 'gateId and enabled (boolean) are required',
            }, { status: 400 })
        }

        // Update gate via Statsig Console API
        const response = await fetch(`https://statsigapi.net/console/v1/gates/${gateId}`, {
            method: 'PATCH',
            headers: {
                'STATSIG-API-KEY': apiKey!,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                isEnabled: enabled,
            }),
        })

        if (!response.ok) {
            const errorText = await response.text()
            console.error('[FeatureFlags Toggle] API error:', response.status, errorText)
            return Response.json({
                error: `Failed to update gate: ${response.status}`,
                details: errorText,
            }, { status: response.status })
        }

        // Invalidate cache
        dashboardCache = null

        const result = await response.json()

        return Response.json({
            success: true,
            gate: {
                id: result.data?.id || gateId,
                name: result.data?.name,
                isEnabled: enabled,
            },
            message: `Gate ${enabled ? 'enabled' : 'disabled'} successfully`,
        })
    } catch (error) {
        console.error('[FeatureFlags Toggle] Error:', error)
        return Response.json({
            error: error instanceof Error ? error.message : 'Failed to toggle gate',
        }, { status: 500 })
    }
}

/**
 * POST /api/feature-flags/gates/:id/rollout
 *
 * Update rollout percentage for a feature gate
 */
export const featureFlagsRolloutHandler: PayloadHandler = async (req: PayloadRequest) => {
    if (req.method !== 'POST') {
        return Response.json({ error: 'Method not allowed' }, { status: 405 })
    }

    // Admin only
    if (!req.user || (req.user as { role?: string })?.role !== 'admin') {
        return Response.json({ error: 'Admin access required' }, { status: 401 })
    }

    const apiKey = process.env.STATSIG_CONSOLE_API_KEY
    const validation = validateApiKey(apiKey)
    if (!validation.valid) {
        return Response.json({ error: validation.error }, { status: 500 })
    }

    try {
        const body = await req.json?.()
        const { gateId, percentage } = body || {}

        if (!gateId || typeof percentage !== 'number') {
            return Response.json({
                error: 'gateId and percentage (number 0-100) are required',
            }, { status: 400 })
        }

        if (percentage < 0 || percentage > 100) {
            return Response.json({
                error: 'percentage must be between 0 and 100',
            }, { status: 400 })
        }

        // First fetch current gate to get existing rules
        const getResponse = await fetch(`https://statsigapi.net/console/v1/gates/${gateId}`, {
            method: 'GET',
            headers: {
                'STATSIG-API-KEY': apiKey!,
                'Content-Type': 'application/json',
            },
        })

        if (!getResponse.ok) {
            return Response.json({
                error: `Gate not found: ${gateId}`,
            }, { status: 404 })
        }

        const gateData = await getResponse.json()
        const gate = gateData.data as StatsigGate

        // Update first rule's passPercentage or create a percentage-based rule
        const updatedRules = gate.rules && gate.rules.length > 0
            ? gate.rules.map((rule, index) => index === 0
                ? { ...rule, passPercentage: percentage }
                : rule)
            : [{
                name: 'Percentage Rollout',
                passPercentage: percentage,
                conditions: [],
            }]

        // Update gate
        const response = await fetch(`https://statsigapi.net/console/v1/gates/${gateId}`, {
            method: 'PATCH',
            headers: {
                'STATSIG-API-KEY': apiKey!,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                isEnabled: percentage > 0,
                rules: updatedRules,
            }),
        })

        if (!response.ok) {
            const errorText = await response.text()
            console.error('[FeatureFlags Rollout] API error:', response.status, errorText)
            return Response.json({
                error: `Failed to update rollout: ${response.status}`,
                details: errorText,
            }, { status: response.status })
        }

        // Invalidate cache
        dashboardCache = null

        return Response.json({
            success: true,
            gate: {
                id: gateId,
                name: gate.name,
                rolloutPercentage: percentage,
            },
            message: `Rollout updated to ${percentage}%`,
        })
    } catch (error) {
        console.error('[FeatureFlags Rollout] Error:', error)
        return Response.json({
            error: error instanceof Error ? error.message : 'Failed to update rollout',
        }, { status: 500 })
    }
}

/**
 * GET /api/feature-flags/gates/:id
 *
 * Get detailed information about a specific gate
 */
export const featureFlagsGetGateHandler: PayloadHandler = async (req: PayloadRequest) => {
    if (req.method !== 'GET') {
        return Response.json({ error: 'Method not allowed' }, { status: 405 })
    }

    // Admin only
    if (!req.user || (req.user as { role?: string })?.role !== 'admin') {
        return Response.json({ error: 'Admin access required' }, { status: 401 })
    }

    const apiKey = process.env.STATSIG_CONSOLE_API_KEY
    const validation = validateApiKey(apiKey)
    if (!validation.valid) {
        return Response.json({ error: validation.error }, { status: 500 })
    }

    try {
        const url = new URL(req.url || '', 'http://localhost')
        const gateId = url.searchParams.get('gateId')

        if (!gateId) {
            return Response.json({ error: 'gateId is required' }, { status: 400 })
        }

        const response = await fetch(`https://statsigapi.net/console/v1/gates/${gateId}`, {
            method: 'GET',
            headers: {
                'STATSIG-API-KEY': apiKey!,
                'Content-Type': 'application/json',
            },
        })

        if (!response.ok) {
            return Response.json({
                error: `Gate not found: ${gateId}`,
            }, { status: 404 })
        }

        const result = await response.json()
        const gate = result.data as StatsigGate

        return Response.json({
            success: true,
            gate: {
                id: gate.id,
                name: gate.name,
                description: gate.description,
                isEnabled: gate.isEnabled,
                defaultValue: gate.defaultValue,
                rules: gate.rules,
                tags: gate.tags,
                lastModified: new Date(gate.lastModifiedTime).toISOString(),
                createdBy: gate.creatorName,
                checksPerHour: gate.checksPerHour,
            },
        })
    } catch (error) {
        console.error('[FeatureFlags GetGate] Error:', error)
        return Response.json({
            error: error instanceof Error ? error.message : 'Failed to get gate',
        }, { status: 500 })
    }
}

/**
 * POST /api/feature-flags/cache/clear
 *
 * Clear the dashboard cache (force refresh)
 */
export const featureFlagsClearCacheHandler: PayloadHandler = async (req: PayloadRequest) => {
    if (req.method !== 'POST') {
        return Response.json({ error: 'Method not allowed' }, { status: 405 })
    }

    // Admin only
    if (!req.user || (req.user as { role?: string })?.role !== 'admin') {
        return Response.json({ error: 'Admin access required' }, { status: 401 })
    }

    dashboardCache = null

    return Response.json({
        success: true,
        message: 'Cache cleared',
    })
}

/**
 * POST /api/feature-flags/sync
 *
 * Sync all feature flags from Statsig to the feature-flag-cache collection.
 * Called by cron job every 5 minutes and can be triggered manually.
 */
export const featureFlagsSyncHandler: PayloadHandler = async (req: PayloadRequest) => {
    if (req.method !== 'POST') {
        return Response.json({ error: 'Method not allowed' }, { status: 405 })
    }

    // Allow cron secret OR admin user
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    const isAdmin = req.user && (req.user as { role?: string })?.role === 'admin'
    const isCron = cronSecret && authHeader === `Bearer ${cronSecret}`

    if (!isAdmin && !isCron) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const apiKey = process.env.STATSIG_CONSOLE_API_KEY
    const validation = validateApiKey(apiKey)
    if (!validation.valid) {
        return Response.json({ error: validation.error }, { status: 500 })
    }

    try {
        const now = new Date()
        let gatesSync = { created: 0, updated: 0, errors: 0 }
        let experimentsSync = { created: 0, updated: 0, errors: 0 }

        // Fetch gates from Statsig
        const gatesResponse = await fetch('https://statsigapi.net/console/v1/gates', {
            method: 'GET',
            headers: {
                'STATSIG-API-KEY': apiKey!,
                'Content-Type': 'application/json',
            },
        })

        if (gatesResponse.ok) {
            const gatesData = await gatesResponse.json()
            const gates: StatsigGate[] = gatesData.data || []

            for (const gate of gates) {
                try {
                    // Check if exists
                    const { docs: existing } = await req.payload.find({
                        collection: 'feature-flag-cache' as any,
                        where: { statsigId: { equals: gate.id } },
                        limit: 1,
                    })

                    const flagData = {
                        statsigId: gate.id,
                        type: 'gate',
                        name: gate.name,
                        description: gate.description || '',
                        isEnabled: gate.isEnabled,
                        rolloutPercentage: gate.rules?.[0]?.passPercentage ?? (gate.isEnabled ? 100 : 0),
                        rules: gate.rules || [],
                        defaultValue: gate.defaultValue,
                        tags: gate.tags || [],
                        lastSyncedAt: now.toISOString(),
                        statsigLastModified: new Date(gate.lastModifiedTime).toISOString(),
                        checksPerHour: gate.checksPerHour || 0,
                        syncError: null,
                    }

                    if (existing.length > 0) {
                        await req.payload.update({
                            collection: 'feature-flag-cache' as any,
                            id: existing[0].id,
                            data: flagData as any,
                        })
                        gatesSync.updated++
                    } else {
                        await req.payload.create({
                            collection: 'feature-flag-cache' as any,
                            data: flagData as any,
                        })
                        gatesSync.created++
                    }
                } catch (err) {
                    console.error(`[FeatureFlags Sync] Error syncing gate ${gate.id}:`, err)
                    gatesSync.errors++
                }
            }
        }

        // Fetch experiments from Statsig
        const experimentsResponse = await fetch('https://statsigapi.net/console/v1/experiments', {
            method: 'GET',
            headers: {
                'STATSIG-API-KEY': apiKey!,
                'Content-Type': 'application/json',
            },
        })

        if (experimentsResponse.ok) {
            const experimentsData = await experimentsResponse.json()
            const experiments: StatsigExperiment[] = experimentsData.data || []

            for (const exp of experiments) {
                try {
                    // Check if exists
                    const { docs: existing } = await req.payload.find({
                        collection: 'feature-flag-cache' as any,
                        where: { statsigId: { equals: exp.id } },
                        limit: 1,
                    })

                    const flagData = {
                        statsigId: exp.id,
                        type: 'experiment',
                        name: exp.name,
                        description: exp.description || '',
                        isEnabled: exp.status === 'active',
                        experimentStatus: exp.status,
                        variants: exp.groups?.map((g) => ({
                            name: g.name,
                            weight: g.weight,
                            parameters: g.json,
                        })) || [],
                        tags: exp.tags || [],
                        lastSyncedAt: now.toISOString(),
                        statsigLastModified: exp.lastModifiedTime,
                        syncError: null,
                    }

                    if (existing.length > 0) {
                        await req.payload.update({
                            collection: 'feature-flag-cache' as any,
                            id: existing[0].id,
                            data: flagData as any,
                        })
                        experimentsSync.updated++
                    } else {
                        await req.payload.create({
                            collection: 'feature-flag-cache' as any,
                            data: flagData as any,
                        })
                        experimentsSync.created++
                    }
                } catch (err) {
                    console.error(`[FeatureFlags Sync] Error syncing experiment ${exp.id}:`, err)
                    experimentsSync.errors++
                }
            }
        }

        // Invalidate in-memory cache
        dashboardCache = null

        return Response.json({
            success: true,
            syncedAt: now.toISOString(),
            gates: gatesSync,
            experiments: experimentsSync,
            message: `Synced ${gatesSync.created + gatesSync.updated} gates and ${experimentsSync.created + experimentsSync.updated} experiments`,
        })
    } catch (error) {
        console.error('[FeatureFlags Sync] Error:', error)
        return Response.json({
            success: false,
            error: error instanceof Error ? error.message : 'Sync failed',
        }, { status: 500 })
    }
}
