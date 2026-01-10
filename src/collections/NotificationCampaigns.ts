import type { CollectionConfig } from 'payload'

/**
 * Notification Campaigns Collection
 *
 * Manages push notification campaigns with scheduling, segment targeting,
 * and A/B testing capabilities. Integrates with UserSegments for behavioral targeting.
 *
 * Campaign Types:
 * - scheduled: One-time campaigns sent at a specific time
 * - triggered: Campaigns triggered by events or API calls
 * - recurring: Campaigns that repeat on a schedule
 */
export const NotificationCampaigns: CollectionConfig = {
    slug: 'notification-campaigns',
    labels: {
        singular: 'Notification Campaign',
        plural: 'Notification Campaigns',
    },
    admin: {
        useAsTitle: 'name',
        defaultColumns: ['name', 'status', 'template', 'scheduledFor', 'sentCount', 'updatedAt'],
        group: 'Engagement',
        description: 'Push notification campaigns with scheduling and targeting',
    },
    access: {
        read: ({ req: { user } }) => !!user,
        create: ({ req: { user } }) => (user as { role?: string })?.role === 'admin',
        update: ({ req: { user } }) => (user as { role?: string })?.role === 'admin',
        delete: ({ req: { user } }) => (user as { role?: string })?.role === 'admin',
    },
    fields: [
        // Campaign Info
        {
            name: 'name',
            type: 'text',
            required: true,
            admin: {
                description: 'Internal name for this campaign',
            },
        },
        {
            name: 'description',
            type: 'textarea',
            admin: {
                description: 'Notes about this campaign',
            },
        },
        {
            name: 'template',
            type: 'relationship',
            relationTo: 'notification-templates' as any,
            required: true,
            admin: {
                description: 'Notification template to use for this campaign',
            },
        },

        // Campaign Type & Status
        {
            name: 'type',
            type: 'select',
            required: true,
            defaultValue: 'scheduled',
            options: [
                { label: 'Scheduled (One-time)', value: 'scheduled' },
                { label: 'Triggered (Event-based)', value: 'triggered' },
                { label: 'Recurring', value: 'recurring' },
            ],
            admin: {
                description: 'How this campaign is triggered',
            },
        },
        {
            name: 'status',
            type: 'select',
            required: true,
            defaultValue: 'draft',
            options: [
                { label: 'Draft', value: 'draft' },
                { label: 'Scheduled', value: 'scheduled' },
                { label: 'Sending', value: 'sending' },
                { label: 'Sent', value: 'sent' },
                { label: 'Paused', value: 'paused' },
                { label: 'Cancelled', value: 'cancelled' },
            ],
            admin: {
                description: 'Current status of this campaign',
                position: 'sidebar',
            },
        },

        // Scheduling
        {
            name: 'scheduledFor',
            type: 'date',
            admin: {
                description: 'When to send this campaign (for scheduled campaigns)',
                date: {
                    pickerAppearance: 'dayAndTime',
                },
                condition: (data) => data?.type === 'scheduled' || data?.type === 'recurring',
            },
        },
        {
            name: 'recurringSchedule',
            type: 'group',
            admin: {
                description: 'Recurring schedule settings',
                condition: (data) => data?.type === 'recurring',
            },
            fields: [
                {
                    name: 'frequency',
                    type: 'select',
                    options: [
                        { label: 'Daily', value: 'daily' },
                        { label: 'Weekly', value: 'weekly' },
                        { label: 'Bi-weekly', value: 'biweekly' },
                        { label: 'Monthly', value: 'monthly' },
                    ],
                    admin: {
                        description: 'How often to send',
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
                        description: 'Days to send on (for weekly)',
                        condition: (data, siblingData) => siblingData?.frequency === 'weekly',
                    },
                },
                {
                    name: 'hour',
                    type: 'number',
                    min: 0,
                    max: 23,
                    defaultValue: 9,
                    admin: {
                        description: 'Hour to send (0-23)',
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
                    name: 'timezone',
                    type: 'select',
                    defaultValue: 'America/New_York',
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
                    name: 'endDate',
                    type: 'date',
                    admin: {
                        description: 'When to stop recurring sends (optional)',
                    },
                },
            ],
        },

        // Trigger Configuration (for triggered campaigns)
        {
            name: 'triggerConfig',
            type: 'group',
            admin: {
                description: 'Event trigger settings',
                condition: (data) => data?.type === 'triggered',
            },
            fields: [
                {
                    name: 'triggerEvent',
                    type: 'select',
                    options: [
                        { label: 'Product Tested', value: 'product_tested' },
                        { label: 'Badge Unlocked', value: 'badge_unlocked' },
                        { label: 'Streak Milestone', value: 'streak_milestone' },
                        { label: 'New User (after X days)', value: 'new_user' },
                        { label: 'Churning User', value: 'churning_user' },
                        { label: 'API Triggered', value: 'api' },
                    ],
                    admin: {
                        description: 'Event that triggers this campaign',
                    },
                },
                {
                    name: 'triggerDelay',
                    type: 'number',
                    min: 0,
                    defaultValue: 0,
                    admin: {
                        description: 'Minutes to wait after trigger before sending',
                    },
                },
            ],
        },

        // Segment Targeting
        {
            name: 'targeting',
            type: 'group',
            admin: {
                description: 'Who should receive this campaign',
            },
            fields: [
                {
                    name: 'targetAll',
                    type: 'checkbox',
                    defaultValue: false,
                    admin: {
                        description: 'Send to all users (ignores segments)',
                    },
                },
                {
                    name: 'segments',
                    type: 'relationship',
                    relationTo: 'user-segments' as any,
                    hasMany: true,
                    admin: {
                        description: 'Target specific user segments',
                        condition: (data, siblingData) => !siblingData?.targetAll,
                    },
                },
                {
                    name: 'segmentLogic',
                    type: 'select',
                    defaultValue: 'any',
                    options: [
                        { label: 'Any segment (OR)', value: 'any' },
                        { label: 'All segments (AND)', value: 'all' },
                    ],
                    admin: {
                        description: 'How to combine multiple segments',
                        condition: (data, siblingData) => !siblingData?.targetAll,
                    },
                },
                {
                    name: 'excludeSegments',
                    type: 'relationship',
                    relationTo: 'user-segments' as any,
                    hasMany: true,
                    admin: {
                        description: 'Exclude users in these segments',
                        condition: (data, siblingData) => !siblingData?.targetAll,
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
                        description: 'Target specific platforms (empty = all)',
                    },
                },
            ],
        },

        // Rate Limiting
        {
            name: 'rateLimiting',
            type: 'group',
            admin: {
                description: 'Control send rate and frequency caps',
            },
            fields: [
                {
                    name: 'maxPerHour',
                    type: 'number',
                    min: 0,
                    admin: {
                        description: 'Maximum sends per hour (0 = no limit)',
                    },
                },
                {
                    name: 'cooldownHours',
                    type: 'number',
                    min: 0,
                    defaultValue: 24,
                    admin: {
                        description: 'Minimum hours between sends to same user',
                    },
                },
                {
                    name: 'respectQuietHours',
                    type: 'checkbox',
                    defaultValue: true,
                    admin: {
                        description: 'Don\'t send during quiet hours (10pm-8am user time)',
                    },
                },
            ],
        },

        // A/B Testing Override
        {
            name: 'abTesting',
            type: 'group',
            admin: {
                description: 'A/B testing configuration (overrides template settings)',
            },
            fields: [
                {
                    name: 'enabled',
                    type: 'checkbox',
                    defaultValue: false,
                    admin: {
                        description: 'Enable A/B testing for this campaign',
                    },
                },
                {
                    name: 'statsigExperiment',
                    type: 'text',
                    admin: {
                        description: 'Statsig experiment name for variant selection',
                        condition: (data, siblingData) => siblingData?.enabled,
                    },
                },
                {
                    name: 'variantWeights',
                    type: 'json',
                    admin: {
                        description: 'Override variant weights: {"variant_a": 50, "variant_b": 50}',
                        condition: (data, siblingData) => siblingData?.enabled,
                    },
                },
            ],
        },

        // Analytics & Results
        {
            name: 'sentCount',
            type: 'number',
            defaultValue: 0,
            admin: {
                readOnly: true,
                position: 'sidebar',
                description: 'Total notifications sent',
            },
        },
        {
            name: 'deliveredCount',
            type: 'number',
            defaultValue: 0,
            admin: {
                readOnly: true,
                position: 'sidebar',
                description: 'Confirmed deliveries',
            },
        },
        {
            name: 'openedCount',
            type: 'number',
            defaultValue: 0,
            admin: {
                readOnly: true,
                position: 'sidebar',
                description: 'Notification opens',
            },
        },
        {
            name: 'failedCount',
            type: 'number',
            defaultValue: 0,
            admin: {
                readOnly: true,
                position: 'sidebar',
                description: 'Failed deliveries',
            },
        },
        {
            name: 'lastSentAt',
            type: 'date',
            admin: {
                readOnly: true,
                position: 'sidebar',
                description: 'Last send time',
            },
        },
        {
            name: 'nextScheduledAt',
            type: 'date',
            admin: {
                readOnly: true,
                position: 'sidebar',
                description: 'Next scheduled send time (for recurring)',
            },
        },

        // Tracking
        {
            name: 'analyticsTag',
            type: 'text',
            admin: {
                description: 'Analytics tag for tracking (e.g., "retention_Q1_2025")',
            },
        },
    ],
    timestamps: true,
}

export default NotificationCampaigns
