import type { CollectionConfig } from 'payload'

/**
 * Notification Sends Collection
 *
 * Tracks individual notification sends for analytics and debugging.
 * Records each notification sent, its delivery status, and user engagement.
 */
export const NotificationSends: CollectionConfig = {
    slug: 'notification-sends',
    labels: {
        singular: 'Notification Send',
        plural: 'Notification Sends',
    },
    admin: {
        useAsTitle: 'id',
        defaultColumns: ['campaign', 'pushToken', 'status', 'sentAt', 'deliveredAt'],
        group: 'Engagement',
        description: 'Push notification send history and delivery tracking',
    },
    access: {
        read: ({ req: { user } }) => !!user,
        create: () => true, // API creates these
        update: () => true, // Webhooks update delivery status
        delete: ({ req: { user } }) => (user as { role?: string })?.role === 'admin',
    },
    fields: [
        // Campaign Reference
        {
            name: 'campaign',
            type: 'relationship',
            relationTo: 'notification-campaigns' as any,
            admin: {
                description: 'Campaign this notification was sent from (if any)',
            },
        },
        {
            name: 'template',
            type: 'relationship',
            relationTo: 'notification-templates' as any,
            admin: {
                description: 'Template used for this notification',
            },
        },

        // Recipient Info
        {
            name: 'pushToken',
            type: 'relationship',
            relationTo: 'push-tokens' as any,
            required: true,
            admin: {
                description: 'Push token that received this notification',
            },
        },
        {
            name: 'fingerprintHash',
            type: 'text',
            index: true,
            admin: {
                description: 'Device fingerprint hash (for querying user history)',
            },
        },

        // Content Sent
        {
            name: 'variant',
            type: 'text',
            admin: {
                description: 'Variant ID used (for A/B testing)',
            },
        },
        {
            name: 'title',
            type: 'text',
            admin: {
                description: 'Actual title sent (after variable substitution)',
            },
        },
        {
            name: 'body',
            type: 'textarea',
            admin: {
                description: 'Actual body sent (after variable substitution)',
            },
        },
        {
            name: 'data',
            type: 'json',
            admin: {
                description: 'Data payload sent with notification',
            },
        },

        // Delivery Status
        {
            name: 'status',
            type: 'select',
            required: true,
            defaultValue: 'pending',
            options: [
                { label: 'Pending', value: 'pending' },
                { label: 'Sent', value: 'sent' },
                { label: 'Delivered', value: 'delivered' },
                { label: 'Opened', value: 'opened' },
                { label: 'Failed', value: 'failed' },
                { label: 'Invalid Token', value: 'invalid_token' },
            ],
            index: true,
            admin: {
                description: 'Current delivery status',
            },
        },
        {
            name: 'expoTicketId',
            type: 'text',
            admin: {
                description: 'Expo push ticket ID (for receipt checking)',
            },
        },
        {
            name: 'expoReceiptStatus',
            type: 'text',
            admin: {
                description: 'Expo receipt status (ok/error)',
            },
        },
        {
            name: 'errorMessage',
            type: 'text',
            admin: {
                description: 'Error message if failed',
            },
        },
        {
            name: 'errorCode',
            type: 'text',
            admin: {
                description: 'Error code (e.g., DeviceNotRegistered)',
            },
        },

        // Timestamps
        {
            name: 'sentAt',
            type: 'date',
            admin: {
                description: 'When notification was sent to Expo',
            },
        },
        {
            name: 'deliveredAt',
            type: 'date',
            admin: {
                description: 'When delivery was confirmed',
            },
        },
        {
            name: 'openedAt',
            type: 'date',
            admin: {
                description: 'When user opened the notification',
            },
        },

        // Targeting & Segments
        {
            name: 'matchedSegments',
            type: 'text',
            hasMany: true,
            admin: {
                description: 'Segments the user matched at send time',
            },
        },
        {
            name: 'platform',
            type: 'select',
            options: [
                { label: 'iOS', value: 'ios' },
                { label: 'Android', value: 'android' },
            ],
            admin: {
                description: 'Platform notification was sent to',
            },
        },

        // Analytics
        {
            name: 'analyticsTag',
            type: 'text',
            admin: {
                description: 'Analytics tag for tracking',
            },
        },
        {
            name: 'statsigExperiment',
            type: 'text',
            admin: {
                description: 'Statsig experiment (if using Statsig for variant selection)',
            },
        },
    ],
    timestamps: true,
    indexes: [
        {
            fields: ['fingerprintHash', 'sentAt'],
        },
        {
            fields: ['campaign', 'status'],
        },
        {
            fields: ['sentAt'],
        },
    ],
}

export default NotificationSends
