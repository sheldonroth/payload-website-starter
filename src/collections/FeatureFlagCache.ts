/**
 * Feature Flag Cache Collection
 *
 * Persistent cache for Statsig feature gates and experiments.
 * Synced every 5 minutes via cron job to ensure consistency
 * and provide fallback when Statsig API is unavailable.
 *
 * IMPORTANT: When isEnabled or rolloutPercentage is changed in Payload admin,
 * the changes are automatically pushed to Statsig via the afterChange hook.
 */

import type { CollectionConfig, CollectionAfterChangeHook } from 'payload'

/**
 * After Change Hook - Syncs changes back to Statsig
 *
 * When an admin changes isEnabled or rolloutPercentage, this hook
 * calls the Statsig Console API to update the actual feature gate.
 */
const syncToStatsig: CollectionAfterChangeHook = async ({
    doc,
    previousDoc,
    req,
    operation,
}) => {
    // Only sync on updates, not creates (creates come from sync job)
    if (operation !== 'update' || !previousDoc) {
        return doc
    }

    // Only sync gates (not experiments - they're more complex)
    if (doc.type !== 'gate') {
        return doc
    }

    // Check if relevant fields changed
    const enabledChanged = doc.isEnabled !== previousDoc.isEnabled
    const rolloutChanged = doc.rolloutPercentage !== previousDoc.rolloutPercentage

    if (!enabledChanged && !rolloutChanged) {
        return doc
    }

    const apiKey = process.env.STATSIG_CONSOLE_API_KEY
    if (!apiKey || !apiKey.startsWith('console-')) {
        console.warn('[FeatureFlagCache] Cannot sync to Statsig - STATSIG_CONSOLE_API_KEY not configured')
        return doc
    }

    const gateId = doc.statsigId
    if (!gateId) {
        console.warn('[FeatureFlagCache] Cannot sync - no statsigId')
        return doc
    }

    try {
        console.log(`[FeatureFlagCache] Syncing ${gateId} to Statsig:`, {
            isEnabled: doc.isEnabled,
            rolloutPercentage: doc.rolloutPercentage,
        })

        // Build update payload
        const updatePayload: Record<string, unknown> = {}

        if (enabledChanged) {
            updatePayload.isEnabled = doc.isEnabled
        }

        // For rollout percentage changes, update the first rule
        if (rolloutChanged && doc.rolloutPercentage !== undefined) {
            // Fetch current gate to get rules
            const getResponse = await fetch(`https://statsigapi.net/console/v1/gates/${gateId}`, {
                method: 'GET',
                headers: {
                    'STATSIG-API-KEY': apiKey,
                    'Content-Type': 'application/json',
                },
            })

            if (getResponse.ok) {
                const gateData = await getResponse.json()
                const rules = gateData.data?.rules || []

                // Update first rule's passPercentage or create one
                const updatedRules = rules.length > 0
                    ? rules.map((rule: { passPercentage?: number }, index: number) =>
                        index === 0 ? { ...rule, passPercentage: doc.rolloutPercentage } : rule
                    )
                    : [{
                        name: 'Percentage Rollout',
                        passPercentage: doc.rolloutPercentage,
                        conditions: [],
                    }]

                updatePayload.rules = updatedRules

                // Auto-enable if rollout > 0, auto-disable if rollout = 0
                if (!enabledChanged) {
                    updatePayload.isEnabled = doc.rolloutPercentage > 0
                }
            }
        }

        // Update gate in Statsig
        const response = await fetch(`https://statsigapi.net/console/v1/gates/${gateId}`, {
            method: 'PATCH',
            headers: {
                'STATSIG-API-KEY': apiKey,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(updatePayload),
        })

        if (response.ok) {
            console.log(`[FeatureFlagCache] Successfully synced ${gateId} to Statsig`)

            // Update sync timestamp and clear error
            await req.payload.update({
                collection: 'feature-flag-cache' as any,
                id: doc.id,
                data: {
                    lastSyncedAt: new Date().toISOString(),
                    syncError: null,
                } as any,
            })
        } else {
            const errorText = await response.text()
            console.error(`[FeatureFlagCache] Statsig API error for ${gateId}:`, response.status, errorText)

            // Store error for visibility
            await req.payload.update({
                collection: 'feature-flag-cache' as any,
                id: doc.id,
                data: {
                    syncError: `Statsig API error: ${response.status} - ${errorText.substring(0, 200)}`,
                } as any,
            })
        }
    } catch (error) {
        console.error(`[FeatureFlagCache] Error syncing ${gateId} to Statsig:`, error)

        // Store error for visibility
        try {
            await req.payload.update({
                collection: 'feature-flag-cache' as any,
                id: doc.id,
                data: {
                    syncError: `Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                } as any,
            })
        } catch {
            // Ignore update error
        }
    }

    return doc
}

export const FeatureFlagCache: CollectionConfig = {
    slug: 'feature-flag-cache',
    labels: {
        singular: 'Feature Flag',
        plural: 'Feature Flags',
    },
    admin: {
        group: 'System',
        useAsTitle: 'name',
        defaultColumns: ['name', 'type', 'isEnabled', 'rolloutPercentage', 'lastSyncedAt'],
        description: 'Feature flags from Statsig. Toggle isEnabled or change rollout % to update in Statsig.',
    },
    hooks: {
        afterChange: [syncToStatsig],
    },
    access: {
        // Readable by API key (for client apps) or admin
        read: ({ req }) => {
            const apiKey = req.headers.get('x-api-key')
            const expectedKey = process.env.PAYLOAD_API_SECRET
            if (apiKey && expectedKey && apiKey === expectedKey) return true
            if ((req.user as { role?: string })?.role === 'admin') return true
            return false
        },
        create: ({ req: { user } }) => (user as { role?: string })?.role === 'admin',
        update: ({ req: { user } }) => (user as { role?: string })?.role === 'admin',
        delete: ({ req: { user } }) => (user as { role?: string })?.role === 'admin',
    },
    fields: [
        // Identity
        {
            name: 'statsigId',
            type: 'text',
            required: true,
            unique: true,
            index: true,
            admin: {
                description: 'Statsig gate/experiment ID',
            },
        },
        {
            name: 'type',
            type: 'select',
            required: true,
            options: [
                { label: 'Gate (Feature Flag)', value: 'gate' },
                { label: 'Experiment', value: 'experiment' },
                { label: 'Dynamic Config', value: 'config' },
            ],
            index: true,
            admin: {
                description: 'Type of Statsig entity',
            },
        },
        {
            name: 'name',
            type: 'text',
            required: true,
            admin: {
                description: 'Human-readable name',
            },
        },
        {
            name: 'description',
            type: 'textarea',
            admin: {
                description: 'Description from Statsig',
            },
        },

        // State - Changes sync to Statsig automatically
        {
            name: 'isEnabled',
            type: 'checkbox',
            defaultValue: false,
            index: true,
            admin: {
                description: 'Toggle to enable/disable this flag (syncs to Statsig)',
                position: 'sidebar',
            },
        },
        {
            name: 'rolloutPercentage',
            type: 'number',
            min: 0,
            max: 100,
            admin: {
                description: 'Percentage of users who see this flag enabled (0-100). Changes sync to Statsig.',
            },
        },

        // Experiment-specific
        {
            name: 'variants',
            type: 'json',
            admin: {
                description: 'Experiment variants/groups with weights (for experiments)',
                condition: (data) => data?.type === 'experiment',
            },
        },
        {
            name: 'experimentStatus',
            type: 'select',
            options: [
                { label: 'Active', value: 'active' },
                { label: 'Paused', value: 'paused' },
                { label: 'Completed', value: 'completed' },
                { label: 'Not Started', value: 'not_started' },
            ],
            admin: {
                description: 'Experiment status (for experiments)',
                condition: (data) => data?.type === 'experiment',
            },
        },

        // Rules (cached for reference)
        {
            name: 'rules',
            type: 'json',
            admin: {
                description: 'Targeting rules from Statsig',
            },
        },
        {
            name: 'defaultValue',
            type: 'checkbox',
            defaultValue: false,
            admin: {
                description: 'Default value when rules don\'t match',
            },
        },

        // Metadata
        {
            name: 'tags',
            type: 'text',
            hasMany: true,
            admin: {
                description: 'Tags from Statsig for categorization',
            },
        },

        // Sync Status
        {
            name: 'lastSyncedAt',
            type: 'date',
            index: true,
            admin: {
                description: 'Last time this flag was synced from Statsig',
                position: 'sidebar',
                date: {
                    pickerAppearance: 'dayAndTime',
                },
            },
        },
        {
            name: 'syncError',
            type: 'text',
            admin: {
                description: 'Error message if last sync failed',
                condition: (data) => !!data?.syncError,
            },
        },

        // Statsig metadata
        {
            name: 'statsigLastModified',
            type: 'date',
            admin: {
                description: 'Last modified time in Statsig',
            },
        },
        {
            name: 'checksPerHour',
            type: 'number',
            admin: {
                description: 'Usage metric: checks per hour from Statsig',
                readOnly: true,
            },
        },
    ],
    timestamps: true,
    indexes: [
        {
            fields: ['statsigId'],
            unique: true,
        },
        {
            fields: ['type', 'isEnabled'],
        },
        {
            fields: ['lastSyncedAt'],
        },
    ],
}

export default FeatureFlagCache
