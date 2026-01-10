import type { CollectionConfig } from 'payload'

/**
 * Notification Templates Collection
 *
 * Manages push notification content with A/B testing support.
 * Allows non-technical users to configure notification copy, scheduling, and experiment variants.
 *
 * Available Template Variables:
 * - {{userName}}    - User's display name (e.g., "Sarah")
 * - {{streakCount}} - Current streak days (e.g., "7")
 * - {{badgeName}}   - Name of unlocked badge (e.g., "Ingredient Expert")
 * - {{badgeEmoji}}  - Badge emoji (e.g., "🏆")
 * - {{productName}} - Product name (e.g., "CeraVe Moisturizer")
 * - {{scansToday}}  - Scans today (e.g., "3")
 * - {{totalScans}}  - All-time scans (e.g., "47")
 */
export const NotificationTemplates: CollectionConfig = {
    slug: 'notification-templates',
    admin: {
        useAsTitle: 'name',
        defaultColumns: ['name', 'type', 'isActive', 'updatedAt'],
        group: 'Engagement',
        description: 'Push notification templates with A/B testing support',
    },
    access: {
        read: () => true,
        create: ({ req: { user } }) => !!user,
        update: ({ req: { user } }) => !!user,
        delete: ({ req: { user } }) => !!user,
    },
    fields: [
        // Basic Info
        {
            name: 'name',
            type: 'text',
            required: true,
            admin: {
                description: 'Internal name for this template',
            },
        },
        {
            name: 'type',
            type: 'select',
            required: true,
            options: [
                { label: 'Daily Discovery', value: 'daily_discovery' },
                { label: 'Streak Reminder', value: 'streak_reminder' },
                { label: 'Badge Unlock', value: 'badge_unlock' },
                { label: 'Product Ready', value: 'product_ready' },
                { label: 'Weekly Digest', value: 'weekly_digest' },
                { label: 'Milestone', value: 'milestone' },
                { label: 'Promotional', value: 'promotional' },
                { label: 'Re-engagement', value: 're_engagement' },
                { label: 'Feature Announcement', value: 'feature_announcement' },
            ],
            admin: {
                description: 'Type determines when this notification is sent',
            },
        },
        {
            name: 'description',
            type: 'textarea',
            admin: {
                description: 'Notes about this template (internal only)',
            },
        },
        {
            name: 'isActive',
            type: 'checkbox',
            defaultValue: true,
            admin: {
                description: 'Only active templates are used by the app',
            },
        },

        // A/B Test Variants
        {
            name: 'variants',
            type: 'array',
            required: true,
            minRows: 1,
            admin: {
                description: 'Content variants for A/B testing. At least one required.',
            },
            fields: [
                {
                    name: 'variantId',
                    type: 'text',
                    required: true,
                    admin: {
                        description: 'Variant ID (e.g., "control", "variant_a", "emoji_test")',
                    },
                },
                {
                    name: 'title',
                    type: 'text',
                    required: true,
                    admin: {
                        description: 'Notification title. Supports {{variables}} like {{userName}}, {{streakCount}}',
                    },
                },
                {
                    name: 'body',
                    type: 'textarea',
                    required: true,
                    admin: {
                        description: 'Notification body. Supports {{variables}}',
                    },
                },
                {
                    name: 'emoji',
                    type: 'text',
                    admin: {
                        description: 'Emoji to prepend to title (e.g., 🔥, 🏆)',
                    },
                },
                {
                    name: 'weight',
                    type: 'number',
                    defaultValue: 1,
                    min: 0,
                    max: 100,
                    admin: {
                        description: 'Weight for random selection (higher = more likely). Used when no Statsig experiment.',
                    },
                },
                {
                    name: 'action',
                    type: 'text',
                    admin: {
                        description: 'Deep link action (e.g., "open_discovery", "view_badge", "open_product")',
                    },
                },
                {
                    name: 'actionData',
                    type: 'json',
                    admin: {
                        description: 'Additional data for the action (e.g., {"productId": "123"})',
                    },
                },
            ],
        },

        // Statsig Integration
        {
            name: 'experimentName',
            type: 'text',
            admin: {
                description: 'Statsig experiment name (e.g., "notification_daily_discovery_v2"). Leave empty for weighted random selection.',
            },
        },

        // Schedule Configuration
        {
            name: 'schedule',
            type: 'group',
            admin: {
                description: 'When this notification should be sent',
            },
            fields: [
                {
                    name: 'enabled',
                    type: 'checkbox',
                    defaultValue: true,
                    admin: {
                        description: 'Enable scheduled sending',
                    },
                },
                {
                    name: 'hour',
                    type: 'number',
                    min: 0,
                    max: 23,
                    admin: {
                        description: 'Hour to send (0-23, user\'s local time)',
                    },
                },
                {
                    name: 'minute',
                    type: 'number',
                    min: 0,
                    max: 59,
                    defaultValue: 0,
                    admin: {
                        description: 'Minute to send (0-59)',
                    },
                },
                {
                    name: 'daysOfWeek',
                    type: 'select',
                    hasMany: true,
                    options: [
                        { label: 'Sunday', value: '0' },
                        { label: 'Monday', value: '1' },
                        { label: 'Tuesday', value: '2' },
                        { label: 'Wednesday', value: '3' },
                        { label: 'Thursday', value: '4' },
                        { label: 'Friday', value: '5' },
                        { label: 'Saturday', value: '6' },
                    ],
                    admin: {
                        description: 'Days to send on. Leave empty for all days.',
                    },
                },
                {
                    name: 'timezone',
                    type: 'select',
                    defaultValue: 'user_local',
                    options: [
                        { label: 'User\'s Local Time', value: 'user_local' },
                        { label: 'UTC', value: 'UTC' },
                        { label: 'America/New_York (ET)', value: 'America/New_York' },
                        { label: 'America/Los_Angeles (PT)', value: 'America/Los_Angeles' },
                        { label: 'America/Chicago (CT)', value: 'America/Chicago' },
                    ],
                    admin: {
                        description: 'Timezone for scheduled time',
                    },
                },
                {
                    name: 'repeats',
                    type: 'checkbox',
                    defaultValue: true,
                    admin: {
                        description: 'Repeat this notification on schedule',
                    },
                },
                {
                    name: 'cooldownHours',
                    type: 'number',
                    min: 0,
                    defaultValue: 24,
                    admin: {
                        description: 'Minimum hours between sends to same user (prevents spam)',
                    },
                },
            ],
        },

        // Targeting Rules
        {
            name: 'targeting',
            type: 'group',
            admin: {
                description: 'Who should receive this notification',
            },
            fields: [
                {
                    name: 'minDaysSinceInstall',
                    type: 'number',
                    min: 0,
                    admin: {
                        description: 'Minimum days since app install',
                    },
                },
                {
                    name: 'maxDaysSinceInstall',
                    type: 'number',
                    min: 0,
                    admin: {
                        description: 'Maximum days since app install',
                    },
                },
                {
                    name: 'minScans',
                    type: 'number',
                    min: 0,
                    admin: {
                        description: 'Minimum product scans required',
                    },
                },
                {
                    name: 'maxScans',
                    type: 'number',
                    min: 0,
                    admin: {
                        description: 'Maximum product scans (for targeting new users)',
                    },
                },
                {
                    name: 'minStreakDays',
                    type: 'number',
                    min: 0,
                    admin: {
                        description: 'Minimum streak days required',
                    },
                },
                {
                    name: 'requiresStreak',
                    type: 'checkbox',
                    admin: {
                        description: 'User must have an active streak',
                    },
                },
                {
                    name: 'requiresSubscription',
                    type: 'checkbox',
                    admin: {
                        description: 'User must be a subscriber',
                    },
                },
                {
                    name: 'excludeSubscribers',
                    type: 'checkbox',
                    admin: {
                        description: 'Exclude subscribers (for upgrade prompts)',
                    },
                },
                {
                    name: 'segments',
                    type: 'select',
                    hasMany: true,
                    options: [
                        { label: 'New Users (< 7 days)', value: 'new_users' },
                        { label: 'Power Users (10+ scans/week)', value: 'power_users' },
                        { label: 'Churning (inactive 7+ days)', value: 'churning' },
                        { label: 'Subscribers', value: 'subscribers' },
                        { label: 'Free Users', value: 'free_users' },
                        { label: 'Streak Holders', value: 'streak_holders' },
                        { label: 'Badge Collectors', value: 'badge_collectors' },
                    ],
                    admin: {
                        description: 'Target specific user segments',
                    },
                },
                {
                    name: 'platforms',
                    type: 'select',
                    hasMany: true,
                    options: [
                        { label: 'iOS', value: 'ios' },
                        { label: 'Android', value: 'android' },
                    ],
                    admin: {
                        description: 'Target specific platforms. Leave empty for all.',
                    },
                },
            ],
        },

        // Analytics & Tracking
        {
            name: 'analytics',
            type: 'group',
            admin: {
                description: 'Tracking and analytics configuration',
            },
            fields: [
                {
                    name: 'trackingId',
                    type: 'text',
                    admin: {
                        description: 'Analytics tracking ID for this notification',
                    },
                },
                {
                    name: 'category',
                    type: 'text',
                    admin: {
                        description: 'Analytics category (e.g., "engagement", "retention")',
                    },
                },
            ],
        },

        // Version tracking for cache invalidation
        {
            name: 'version',
            type: 'number',
            defaultValue: 1,
            admin: {
                readOnly: true,
                description: 'Auto-incremented on save for cache invalidation',
            },
        },
    ],
    hooks: {
        beforeChange: [
            ({ data, operation }) => {
                if (operation === 'update') {
                    data.version = (data.version || 0) + 1
                }
                return data
            },
        ],
    },
}

export default NotificationTemplates
