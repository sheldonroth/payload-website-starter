import type { CollectionConfig } from 'payload'
import { createAuditLogHook, createAuditDeleteHook } from '../hooks/auditLog'

/**
 * User Segments Collection
 *
 * Defines user segments based on behavioral rules.
 * Used for targeting notifications, experiments, and analytics.
 * Supports integration with Statsig gates and RevenueCat attributes.
 */
export const UserSegments: CollectionConfig = {
    slug: 'user-segments',
    labels: {
        singular: 'User Segment',
        plural: 'User Segments',
    },
    hooks: {
        afterChange: [createAuditLogHook('user-segments')],
        afterDelete: [createAuditDeleteHook('user-segments')],
    },
    admin: {
        useAsTitle: 'name',
        defaultColumns: ['name', 'slug', 'isActive', 'syncToStatsig', 'syncToRevenueCat', 'updatedAt'],
        group: 'Users',
        description: 'Define user segments for targeting and analytics',
    },
    access: {
        // Public read for mobile app evaluation
        read: () => true,
        create: ({ req: { user } }) => (user as { role?: string })?.role === 'admin',
        update: ({ req: { user } }) => (user as { role?: string })?.role === 'admin',
        delete: ({ req: { user } }) => (user as { role?: string })?.role === 'admin',
    },
    fields: [
        // Identification
        {
            name: 'name',
            type: 'text',
            required: true,
            admin: {
                description: 'Display name for this segment (e.g., "Power Users")',
            },
        },
        {
            name: 'slug',
            type: 'text',
            required: true,
            unique: true,
            admin: {
                description: 'Unique identifier (e.g., "power_users")',
            },
        },
        {
            name: 'description',
            type: 'textarea',
            admin: {
                description: 'Description of who belongs in this segment',
            },
        },

        // Segment Rules
        {
            name: 'rules',
            type: 'array',
            required: true,
            minRows: 1,
            admin: {
                description: 'Rules that define segment membership. All rules must match (AND logic).',
            },
            fields: [
                {
                    name: 'field',
                    type: 'select',
                    required: true,
                    options: [
                        { label: 'Scan Count', value: 'scan_count' },
                        { label: 'Days Since Install', value: 'days_since_install' },
                        { label: 'Subscription Status', value: 'subscription_status' },
                        { label: 'Days Since Last Active', value: 'last_active_days' },
                        { label: 'Streak Days', value: 'streak_days' },
                        { label: 'Badge Count', value: 'badge_count' },
                        { label: 'Referral Count', value: 'referral_count' },
                        { label: 'Platform', value: 'platform' },
                        { label: 'App Version', value: 'app_version' },
                        { label: 'Total Products Viewed', value: 'products_viewed' },
                        { label: 'Total Votes Cast', value: 'votes_cast' },
                    ],
                    admin: {
                        description: 'User attribute to evaluate',
                    },
                },
                {
                    name: 'operator',
                    type: 'select',
                    required: true,
                    options: [
                        { label: 'Greater than', value: 'gt' },
                        { label: 'Less than', value: 'lt' },
                        { label: 'Equals', value: 'eq' },
                        { label: 'Greater than or equal', value: 'gte' },
                        { label: 'Less than or equal', value: 'lte' },
                        { label: 'Not equals', value: 'neq' },
                        { label: 'Contains', value: 'contains' },
                    ],
                    admin: {
                        description: 'Comparison operator',
                    },
                },
                {
                    name: 'value',
                    type: 'text',
                    required: true,
                    admin: {
                        description: 'Value to compare against (number or string)',
                    },
                },
            ],
        },

        // Rule Logic
        {
            name: 'ruleLogic',
            type: 'select',
            defaultValue: 'all',
            options: [
                { label: 'All rules must match (AND)', value: 'all' },
                { label: 'Any rule must match (OR)', value: 'any' },
            ],
            admin: {
                description: 'How to combine multiple rules',
            },
        },

        // Statsig Integration
        {
            name: 'syncToStatsig',
            type: 'checkbox',
            defaultValue: false,
            admin: {
                description: 'Sync this segment to Statsig as a user property',
            },
        },
        {
            name: 'statsigGateName',
            type: 'text',
            admin: {
                description: 'Statsig feature gate name to associate (optional)',
                condition: (data) => data?.syncToStatsig,
            },
        },
        {
            name: 'statsigPropertyName',
            type: 'text',
            admin: {
                description: 'Custom Statsig user property name (defaults to segment slug)',
                condition: (data) => data?.syncToStatsig,
            },
        },

        // RevenueCat Integration
        {
            name: 'syncToRevenueCat',
            type: 'checkbox',
            defaultValue: false,
            admin: {
                description: 'Sync this segment to RevenueCat as a subscriber attribute',
            },
        },
        {
            name: 'revenueCatAttribute',
            type: 'text',
            admin: {
                description: 'RevenueCat attribute name (e.g., "$segment_power_user")',
                condition: (data) => data?.syncToRevenueCat,
            },
        },

        // Status
        {
            name: 'isActive',
            type: 'checkbox',
            defaultValue: true,
            admin: {
                description: 'Only active segments are evaluated',
                position: 'sidebar',
            },
        },

        // Analytics
        {
            name: 'priority',
            type: 'number',
            defaultValue: 0,
            admin: {
                description: 'Higher priority segments are evaluated first',
                position: 'sidebar',
            },
        },
        {
            name: 'estimatedSize',
            type: 'number',
            admin: {
                description: 'Estimated number of users in this segment (auto-updated)',
                readOnly: true,
                position: 'sidebar',
            },
        },
        {
            name: 'lastSyncedAt',
            type: 'date',
            admin: {
                description: 'Last time this segment was synced to external services',
                readOnly: true,
                position: 'sidebar',
            },
        },
    ],
    timestamps: true,
}

export default UserSegments
