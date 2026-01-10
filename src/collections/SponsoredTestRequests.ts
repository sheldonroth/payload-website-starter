import type { CollectionConfig } from 'payload'
import { createAuditLogHook, createAuditDeleteHook } from '../hooks/auditLog'

export const SponsoredTestRequests: CollectionConfig = {
    slug: 'sponsored-test-requests',
    admin: {
        group: 'Community',
        useAsTitle: 'productName',
        defaultColumns: ['productName', 'email', 'status', 'queuePosition', 'createdAt'],
        description: 'User-sponsored product test requests ($149 each)',
    },
    access: {
        read: () => true,
        create: () => true, // Webhook creates records
        update: ({ req: { user } }) => !!user, // Admin only
        delete: ({ req: { user } }) => !!user, // Admin only
    },
    hooks: {
        afterChange: [createAuditLogHook('sponsored-test-requests')],
        afterDelete: [createAuditDeleteHook('sponsored-test-requests')],
    },
    fields: [
        {
            name: 'productName',
            type: 'text',
            required: true,
            admin: {
                description: 'The product the customer wants tested',
            },
        },
        {
            name: 'email',
            type: 'email',
            required: true,
            admin: {
                description: 'Customer email from Stripe checkout',
            },
        },
        {
            name: 'stripePaymentId',
            type: 'text',
            admin: {
                description: 'Stripe payment intent ID for this sponsorship',
                readOnly: true,
            },
        },
        {
            name: 'status',
            type: 'select',
            required: true,
            defaultValue: 'pending',
            options: [
                { label: 'Pending Review', value: 'pending' },
                { label: 'Queued', value: 'queued' },
                { label: 'In Lab Testing', value: 'testing' },
                { label: 'Report Complete', value: 'complete' },
                { label: 'Refunded', value: 'refunded' },
            ],
            admin: {
                description: 'Current status of the test request',
            },
        },

        // Queue Management
        {
            name: 'queuePosition',
            type: 'number',
            admin: {
                description: 'Position in the testing queue (1 = next to be tested)',
                position: 'sidebar',
            },
        },
        {
            name: 'estimatedCompletionDate',
            type: 'date',
            admin: {
                description: 'Estimated date when testing will be complete',
                date: {
                    pickerAppearance: 'dayOnly',
                },
            },
        },

        // Status History
        {
            name: 'statusHistory',
            type: 'array',
            admin: {
                description: 'History of status changes',
                initCollapsed: true,
            },
            fields: [
                {
                    name: 'status',
                    type: 'select',
                    required: true,
                    options: [
                        { label: 'Pending Review', value: 'pending' },
                        { label: 'Queued', value: 'queued' },
                        { label: 'In Lab Testing', value: 'testing' },
                        { label: 'Report Complete', value: 'complete' },
                        { label: 'Refunded', value: 'refunded' },
                    ],
                },
                {
                    name: 'changedAt',
                    type: 'date',
                    required: true,
                    admin: {
                        date: {
                            pickerAppearance: 'dayAndTime',
                        },
                    },
                },
                {
                    name: 'notes',
                    type: 'text',
                    admin: {
                        description: 'Notes about this status change',
                    },
                },
                {
                    name: 'changedBy',
                    type: 'text',
                    admin: {
                        description: 'Who made this change (email or system)',
                    },
                },
            ],
        },

        // Result Tracking
        {
            name: 'resultProductId',
            type: 'relationship',
            relationTo: 'products',
            admin: {
                description: 'Link to the created product after testing is complete',
            },
        },

        // Notifications
        {
            name: 'notificationsSent',
            type: 'array',
            admin: {
                description: 'Notifications sent to the customer',
                initCollapsed: true,
            },
            fields: [
                {
                    name: 'type',
                    type: 'select',
                    required: true,
                    options: [
                        { label: 'Confirmation', value: 'confirmation' },
                        { label: 'Queued', value: 'queued' },
                        { label: 'Testing Started', value: 'testing_started' },
                        { label: 'Testing Complete', value: 'testing_complete' },
                        { label: 'Report Ready', value: 'report_ready' },
                    ],
                },
                {
                    name: 'sentAt',
                    type: 'date',
                    required: true,
                },
                {
                    name: 'success',
                    type: 'checkbox',
                    defaultValue: true,
                },
            ],
        },

        {
            name: 'notes',
            type: 'textarea',
            admin: {
                description: 'Internal notes about this request',
            },
        },
        {
            name: 'reportUrl',
            type: 'text',
            admin: {
                description: 'URL to the completed PDF report (once testing is done)',
            },
        },
    ],
    timestamps: true,
}
