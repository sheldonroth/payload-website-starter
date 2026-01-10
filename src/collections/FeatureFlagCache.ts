/**
 * Feature Flag Cache Collection
 *
 * Persistent cache for Statsig feature gates and experiments.
 * Synced every 5 minutes via cron job to ensure consistency
 * and provide fallback when Statsig API is unavailable.
 */

import type { CollectionConfig } from 'payload'

export const FeatureFlagCache: CollectionConfig = {
    slug: 'feature-flag-cache',
    labels: {
        singular: 'Feature Flag',
        plural: 'Feature Flags',
    },
    admin: {
        group: 'System',
        useAsTitle: 'name',
        defaultColumns: ['name', 'type', 'isEnabled', 'lastSyncedAt'],
        description: 'Cached feature flags from Statsig (auto-synced every 5 minutes)',
    },
    access: {
        read: () => true, // Readable by all (for client apps)
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

        // State
        {
            name: 'isEnabled',
            type: 'checkbox',
            defaultValue: false,
            index: true,
            admin: {
                description: 'Whether this flag is currently enabled',
                position: 'sidebar',
            },
        },
        {
            name: 'rolloutPercentage',
            type: 'number',
            min: 0,
            max: 100,
            admin: {
                description: 'Percentage of users who see this flag enabled (0-100)',
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
