import type { CollectionConfig } from 'payload';

export const SponsoredTestRequests: CollectionConfig = {
    slug: 'sponsored-test-requests',
    admin: {
        group: 'Lab Operations',
        useAsTitle: 'productName',
        defaultColumns: ['productName', 'email', 'status', 'createdAt'],
        description: 'User-sponsored product test requests ($149 each)',
    },
    access: {
        read: () => true,
        create: () => true, // Webhook creates records
        update: ({ req: { user } }) => !!user, // Admin only
        delete: ({ req: { user } }) => !!user, // Admin only
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
                { label: 'In Lab Testing', value: 'testing' },
                { label: 'Report Complete', value: 'complete' },
                { label: 'Refunded', value: 'refunded' },
            ],
            admin: {
                description: 'Current status of the test request',
            },
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
};
