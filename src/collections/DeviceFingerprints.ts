import type { CollectionConfig } from 'payload'

/**
 * DeviceFingerprints Collection
 *
 * Tracks device fingerprints for the One-Shot Engine.
 * Used to enforce one free unlock per device+email combination.
 *
 * FingerprintJS Pro provides 99.5% accuracy for device identification.
 */
export const DeviceFingerprints: CollectionConfig = {
    slug: 'device-fingerprints',
    access: {
        // Only admins can read fingerprint data (privacy)
        read: ({ req }) => {
            if (!req.user) return false
            const role = (req.user as { role?: string }).role
            return role === 'admin'
        },
        // Allow system creates (from fingerprint endpoint)
        create: () => true,
        // Only system/admin can update
        update: ({ req }) => {
            if (!req.user) return true // System calls
            const role = (req.user as { role?: string }).role
            return role === 'admin'
        },
        // Only admins can delete
        delete: ({ req }) => {
            const role = (req.user as { role?: string })?.role
            return role === 'admin'
        },
    },
    admin: {
        useAsTitle: 'fingerprintHash',
        defaultColumns: ['fingerprintHash', 'user', 'deviceType', 'unlockCreditsUsed', 'isBanned', 'firstSeenAt'],
        group: 'System',
        description: 'Device fingerprints for One-Shot unlock tracking',
    },
    fields: [
        // === FINGERPRINT IDENTITY ===
        {
            name: 'fingerprintHash',
            type: 'text',
            required: true,
            unique: true,
            index: true,
            admin: {
                description: 'FingerprintJS visitor ID hash',
            },
        },

        // === USER ASSOCIATION ===
        {
            name: 'user',
            type: 'relationship',
            relationTo: 'users',
            index: true,
            admin: {
                description: 'Associated user account (if any)',
            },
        },

        // === DEVICE METADATA ===
        {
            name: 'browser',
            type: 'text',
            admin: {
                description: 'Browser name and version',
            },
        },
        {
            name: 'os',
            type: 'text',
            admin: {
                description: 'Operating system',
            },
        },
        {
            name: 'deviceType',
            type: 'select',
            options: [
                { label: 'Desktop', value: 'desktop' },
                { label: 'Mobile', value: 'mobile' },
                { label: 'Tablet', value: 'tablet' },
            ],
            admin: {
                position: 'sidebar',
            },
        },

        // === TRACKING ===
        {
            name: 'firstSeenAt',
            type: 'date',
            required: true,
            admin: {
                date: {
                    pickerAppearance: 'dayAndTime',
                },
            },
        },
        {
            name: 'lastSeenAt',
            type: 'date',
            admin: {
                date: {
                    pickerAppearance: 'dayAndTime',
                },
            },
        },

        // === UNLOCK TRACKING ===
        {
            name: 'unlockCreditsUsed',
            type: 'number',
            defaultValue: 0,
            admin: {
                position: 'sidebar',
                description: 'Number of free unlocks used on this device',
            },
        },

        // === FRAUD PREVENTION ===
        {
            name: 'ipCountry',
            type: 'text',
            admin: {
                description: 'Country from IP (for fraud detection)',
            },
        },
        {
            name: 'isBanned',
            type: 'checkbox',
            defaultValue: false,
            admin: {
                position: 'sidebar',
                description: 'Block this device from unlocking',
            },
        },
        {
            name: 'banReason',
            type: 'text',
            admin: {
                condition: (data) => data?.isBanned,
                description: 'Why this device was banned',
            },
        },

        // === FRAUD FLAGS ===
        {
            name: 'suspiciousActivity',
            type: 'checkbox',
            defaultValue: false,
            admin: {
                position: 'sidebar',
                description: 'Flagged for review (multiple emails, VPN, etc.)',
            },
        },
        {
            name: 'emailsUsed',
            type: 'json',
            admin: {
                description: 'List of email addresses used with this fingerprint',
            },
        },
    ],
    timestamps: true,
}
