import type { CollectionConfig } from 'payload'

/**
 * ProductUnlocks Collection
 *
 * Tracks every product unlock event for analytics and fraud detection.
 * Links users, devices, and products for the One-Shot Engine.
 */
export const ProductUnlocks: CollectionConfig = {
    slug: 'product-unlocks',
    access: {
        // Only admins can read unlock history
        read: ({ req }) => {
            if (!req.user) return false
            const role = (req.user as { role?: string }).role
            return role === 'admin'
        },
        // Allow system creates (from unlock endpoint) - require API key
        create: ({ req }) => {
            const apiKey = req.headers.get('x-api-key')
            const expectedKey = process.env.PAYLOAD_API_SECRET
            if (apiKey && expectedKey && apiKey === expectedKey) return true
            if ((req.user as { role?: string })?.role === 'admin') return true
            return false
        },
        // No updates - unlocks are immutable
        update: () => false,
        // Only admins can delete
        delete: ({ req }) => {
            const role = (req.user as { role?: string })?.role
            return role === 'admin'
        },
    },
    admin: {
        useAsTitle: 'id',
        defaultColumns: ['user', 'product', 'unlockType', 'archetypeShown', 'unlockedAt'],
        group: 'System',
        description: 'Immutable record of all product unlocks',
    },
    fields: [
        // === USER & DEVICE ===
        {
            name: 'user',
            type: 'relationship',
            relationTo: 'users',
            index: true,
            admin: {
                description: 'User who unlocked the product',
            },
        },
        {
            name: 'deviceFingerprint',
            type: 'relationship',
            relationTo: 'device-fingerprints' as 'users', // Type will be correct after build regenerates types
            index: true,
            admin: {
                description: 'Device used for unlock',
            },
        },
        {
            name: 'email',
            type: 'email',
            admin: {
                description: 'Email provided at unlock time (for guests)',
            },
        },

        // === PRODUCT ===
        {
            name: 'product',
            type: 'relationship',
            relationTo: 'products',
            required: true,
            index: true,
            admin: {
                description: 'Product that was unlocked',
            },
        },

        // === UNLOCK DETAILS ===
        {
            name: 'unlockType',
            type: 'select',
            required: true,
            options: [
                { label: 'Free Credit', value: 'free_credit' },
                { label: 'Subscription', value: 'subscription' },
                { label: 'Admin Grant', value: 'admin_grant' },
            ],
            admin: {
                position: 'sidebar',
            },
        },
        {
            name: 'archetypeShown',
            type: 'select',
            options: [
                { label: 'Best Value', value: 'best_value' },
                { label: 'Premium Pick', value: 'premium_pick' },
                { label: 'Hidden Gem', value: 'hidden_gem' },
            ],
            admin: {
                position: 'sidebar',
                description: 'Which archetype card was unlocked',
            },
        },
        {
            name: 'unlockedAt',
            type: 'date',
            required: true,
            admin: {
                date: {
                    pickerAppearance: 'dayAndTime',
                },
            },
        },

        // === CONTEXT (for analytics) ===
        {
            name: 'sourceProductId',
            type: 'number',
            admin: {
                description: 'The AVOID product that triggered alternatives view',
            },
        },
        {
            name: 'sessionId',
            type: 'text',
            admin: {
                description: 'Browser session ID for funnel tracking',
            },
        },
        {
            name: 'referralSource',
            type: 'text',
            admin: {
                description: 'UTM source or referrer URL',
            },
        },

        // === CONVERSION TRACKING ===
        {
            name: 'convertedToSubscription',
            type: 'checkbox',
            defaultValue: false,
            admin: {
                position: 'sidebar',
                description: 'Did this user later subscribe?',
            },
        },
        {
            name: 'conversionDate',
            type: 'date',
            admin: {
                condition: (data) => data?.convertedToSubscription,
            },
        },
    ],
    timestamps: true,
}
