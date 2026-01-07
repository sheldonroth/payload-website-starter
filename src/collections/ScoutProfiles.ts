import type { CollectionConfig } from 'payload'

/**
 * Scout Profiles Collection
 *
 * Public-facing profiles for scouts (users who document products).
 * This is the heart of the Scout Program - making scouts feel like
 * founding members of a movement, not data entry clerks.
 *
 * Seth Godin Philosophy:
 * - Status, not features: "Pioneer" not "Level 4"
 * - Recognition: "First documented by Scout #47"
 * - Impact: "Your discoveries have helped 2,847 people"
 */
export const ScoutProfiles: CollectionConfig = {
    slug: 'scout-profiles',
    access: {
        read: () => true, // Public profiles
        create: () => true, // Created on first submission
        update: ({ req }) => !!req.user, // Admin or self-update via API
        delete: ({ req }) => !!req.user, // Admin only
    },
    admin: {
        useAsTitle: 'displayName',
        defaultColumns: ['displayName', 'scoutLevel', 'documentsSubmitted', 'peopleHelped', 'createdAt'],
        group: 'Community',
        description: 'Scout profiles - the heroes who document products for testing',
    },
    fields: [
        // ═══════════════════════════════════════════════════════════════
        // IDENTITY
        // ═══════════════════════════════════════════════════════════════
        {
            name: 'displayName',
            type: 'text',
            required: true,
            defaultValue: 'Anonymous Scout',
            admin: {
                description: 'Public display name (can be changed by user)',
            },
        },
        {
            name: 'fingerprintHash',
            type: 'text',
            unique: true,
            index: true,
            admin: {
                description: 'Device fingerprint for anonymous scouts',
                readOnly: true,
            },
        },
        {
            name: 'user',
            type: 'relationship',
            relationTo: 'users',
            admin: {
                description: 'Linked authenticated user account (optional)',
            },
        },
        {
            name: 'avatar',
            type: 'text',
            defaultValue: '🔍',
            admin: {
                description: 'Emoji avatar or image URL',
            },
        },
        {
            name: 'bio',
            type: 'textarea',
            maxLength: 280,
            admin: {
                description: 'Short bio (Twitter-length)',
            },
        },

        // ═══════════════════════════════════════════════════════════════
        // SCOUT STATS (Server-side source of truth)
        // ═══════════════════════════════════════════════════════════════
        {
            name: 'scoutNumber',
            type: 'number',
            unique: true,
            index: true,
            admin: {
                description: 'Sequential scout number (e.g., Scout #47)',
                readOnly: true,
            },
        },
        {
            name: 'documentsSubmitted',
            type: 'number',
            defaultValue: 0,
            admin: {
                description: 'Total products this scout has documented',
                readOnly: true,
            },
        },
        {
            name: 'productsTestedFromSubmissions',
            type: 'number',
            defaultValue: 0,
            admin: {
                description: 'How many of their submissions became tested products',
                readOnly: true,
            },
        },
        {
            name: 'peopleHelped',
            type: 'number',
            defaultValue: 0,
            admin: {
                description: 'Total scans of products they helped get tested',
                readOnly: true,
            },
        },
        {
            name: 'firstDiscoveries',
            type: 'number',
            defaultValue: 0,
            admin: {
                description: 'Products where they were the FIRST scout',
                readOnly: true,
            },
        },
        {
            name: 'scoutLevel',
            type: 'select',
            defaultValue: 'new',
            options: [
                { label: '🔍 New Scout', value: 'new' },
                { label: '🧭 Explorer', value: 'explorer' },
                { label: '🗺️ Pathfinder', value: 'pathfinder' },
                { label: '⭐ Pioneer', value: 'pioneer' },
            ],
            admin: {
                description: 'Scout level based on documentsSubmitted',
                readOnly: true,
            },
        },

        // ═══════════════════════════════════════════════════════════════
        // PUBLIC PROFILE SETTINGS
        // ═══════════════════════════════════════════════════════════════
        {
            name: 'isPublic',
            type: 'checkbox',
            defaultValue: true,
            admin: {
                description: 'Allow profile to be viewed publicly',
            },
        },
        {
            name: 'shareableSlug',
            type: 'text',
            unique: true,
            index: true,
            admin: {
                description: 'URL-friendly slug (e.g., "scout-47" or custom)',
            },
        },

        // ═══════════════════════════════════════════════════════════════
        // ACHIEVEMENTS & HISTORY
        // ═══════════════════════════════════════════════════════════════
        {
            name: 'badges',
            type: 'json',
            defaultValue: [],
            admin: {
                description: 'Array of badge IDs earned',
            },
        },
        {
            name: 'featuredDiscoveries',
            type: 'json',
            defaultValue: [],
            admin: {
                description: 'Array of barcode strings for their top discoveries',
            },
        },

        // ═══════════════════════════════════════════════════════════════
        // NOTIFICATION PREFERENCES
        // ═══════════════════════════════════════════════════════════════
        {
            name: 'notifyOnResults',
            type: 'checkbox',
            defaultValue: true,
            admin: {
                description: 'Notify when a product they documented gets tested',
            },
        },
        {
            name: 'notifyOnMilestones',
            type: 'checkbox',
            defaultValue: true,
            admin: {
                description: 'Notify on level-ups and achievements',
            },
        },
    ],
    hooks: {
        beforeChange: [
            async ({ data, operation, req }) => {
                // Auto-calculate scout level based on documents submitted
                if (data.documentsSubmitted !== undefined) {
                    const docs = data.documentsSubmitted
                    if (docs >= 50) {
                        data.scoutLevel = 'pioneer'
                    } else if (docs >= 15) {
                        data.scoutLevel = 'pathfinder'
                    } else if (docs >= 5) {
                        data.scoutLevel = 'explorer'
                    } else {
                        data.scoutLevel = 'new'
                    }
                }

                // Generate scout number on create
                if (operation === 'create' && !data.scoutNumber) {
                    const lastScout = await req.payload.find({
                        collection: 'scout-profiles',
                        sort: '-scoutNumber',
                        limit: 1,
                    })
                    data.scoutNumber = (lastScout.docs[0]?.scoutNumber || 0) + 1
                }

                // Generate shareable slug on create
                if (operation === 'create' && !data.shareableSlug) {
                    data.shareableSlug = `scout-${data.scoutNumber}`
                }

                return data
            },
        ],
    },
    timestamps: true,
}

export default ScoutProfiles
