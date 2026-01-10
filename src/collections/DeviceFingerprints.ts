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
        // Allow system creates (from fingerprint endpoint) - require API key
        create: ({ req }) => {
            const apiKey = req.headers.get('x-api-key')
            const expectedKey = process.env.PAYLOAD_API_SECRET
            if (apiKey && expectedKey && apiKey === expectedKey) return true
            if ((req.user as { role?: string })?.role === 'admin') return true
            return false
        },
        // Only system (via API key) or admin can update
        update: ({ req }) => {
            // API key for system/backend calls
            const apiKey = req.headers.get('x-api-key')
            const expectedKey = process.env.PAYLOAD_API_SECRET
            if (apiKey && expectedKey && apiKey === expectedKey) return true
            // Admin users
            if ((req.user as { role?: string })?.role === 'admin') return true
            return false
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
            name: 'suspiciousScore',
            type: 'number',
            defaultValue: 0,
            min: 0,
            max: 100,
            admin: {
                position: 'sidebar',
                description: 'Abuse likelihood score (0-100). Auto-calculated by cron.',
            },
        },
        {
            name: 'emailsUsed',
            type: 'json',
            admin: {
                description: 'List of email addresses used with this fingerprint',
            },
        },
        {
            name: 'totalUnlocks',
            type: 'number',
            defaultValue: 0,
            admin: {
                position: 'sidebar',
                description: 'Total unlocks across all time (for abuse detection)',
            },
        },

        // === REFERRAL SYSTEM ===
        {
            name: 'referralCode',
            type: 'text',
            unique: true,
            index: true,
            admin: {
                description: 'Unique 6-character referral code for this device/user',
            },
        },
        {
            name: 'referredBy',
            type: 'text',
            admin: {
                description: 'Referral code of the person who referred this user',
            },
        },
        {
            name: 'totalReferrals',
            type: 'number',
            defaultValue: 0,
            admin: {
                position: 'sidebar',
                description: 'Total people referred by this user',
            },
        },
        {
            name: 'activeReferrals',
            type: 'number',
            defaultValue: 0,
            admin: {
                position: 'sidebar',
                description: 'Currently subscribed referrals (earning commission)',
            },
        },
        {
            name: 'pendingReferrals',
            type: 'number',
            defaultValue: 0,
            admin: {
                position: 'sidebar',
                description: 'Referrals not yet subscribed',
            },
        },
        {
            name: 'totalCommissionEarned',
            type: 'number',
            defaultValue: 0,
            admin: {
                position: 'sidebar',
                description: 'Total commission earned ($)',
            },
        },
        {
            name: 'payoutEmail',
            type: 'email',
            admin: {
                description: 'PayPal/Venmo email for commission payouts',
            },
        },

        // === BEHAVIOR METRICS (Cortex Analytics) ===
        {
            name: 'behaviorMetrics',
            type: 'group',
            admin: {
                description: 'Behavioral data for adaptive paywalling',
            },
            fields: [
                {
                    name: 'totalScans',
                    type: 'number',
                    defaultValue: 0,
                    admin: {
                        description: 'Total barcode scans',
                    },
                },
                {
                    name: 'avoidHits',
                    type: 'number',
                    defaultValue: 0,
                    admin: {
                        description: 'Number of AVOID verdicts seen',
                    },
                },
                {
                    name: 'sessionCount',
                    type: 'number',
                    defaultValue: 0,
                    admin: {
                        description: 'Total app sessions',
                    },
                },
                {
                    name: 'searchCount',
                    type: 'number',
                    defaultValue: 0,
                    admin: {
                        description: 'Total product searches',
                    },
                },
                {
                    name: 'voteCount',
                    type: 'number',
                    defaultValue: 0,
                    admin: {
                        description: 'Total votes cast',
                    },
                },
                {
                    name: 'cohort',
                    type: 'select',
                    defaultValue: 'experiment',
                    options: [
                        { label: 'Experiment', value: 'experiment' },
                        { label: 'Control', value: 'control' },
                        { label: 'Holdout', value: 'holdout' },
                    ],
                    admin: {
                        description: 'A/B test cohort assignment',
                    },
                },
                {
                    name: 'paywallsShown',
                    type: 'number',
                    defaultValue: 0,
                    admin: {
                        description: 'Number of times paywall was displayed',
                    },
                },
                {
                    name: 'paywallsDismissed',
                    type: 'number',
                    defaultValue: 0,
                    admin: {
                        description: 'Number of times paywall was dismissed',
                    },
                },
            ],
        },
    ],
    timestamps: true,
}
