import type { CollectionConfig } from 'payload'
import { createAuditLogHook, createAuditDeleteHook } from '../hooks/auditLog'

/**
 * Contributor Profiles Collection
 *
 * Public-facing profiles for contributors (users who document products).
 * This is the heart of the My Cases Program - making contributors feel like
 * founding members of a movement, not data entry clerks.
 *
 * Seth Godin Philosophy:
 * - Status, not features: "Champion" not "Level 4"
 * - Recognition: "Case opened by Contributor #47"
 * - Impact: "Your cases have helped 2,847 people"
 */
export const ContributorProfiles: CollectionConfig = {
    slug: 'contributor-profiles',
    access: {
        read: () => true, // Public profiles
        create: () => true, // Created on first submission
        update: ({ req }) => !!req.user, // Admin or self-update via API
        delete: ({ req }) => !!req.user, // Admin only
    },
    admin: {
        useAsTitle: 'displayName',
        defaultColumns: ['displayName', 'contributorLevel', 'documentsSubmitted', 'peopleHelped', 'createdAt'],
        group: 'Community',
        description: 'Contributor profiles - the heroes who document products for testing',
    },
    fields: [
        // ═══════════════════════════════════════════════════════════════
        // IDENTITY
        // ═══════════════════════════════════════════════════════════════
        {
            name: 'displayName',
            type: 'text',
            required: true,
            defaultValue: 'Anonymous Contributor',
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
                description: 'Device fingerprint for anonymous contributors',
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
            defaultValue: '🔬',
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
        // CONTRIBUTOR STATS (Server-side source of truth)
        // ═══════════════════════════════════════════════════════════════
        {
            name: 'contributorNumber',
            type: 'number',
            unique: true,
            index: true,
            admin: {
                description: 'Sequential contributor number (e.g., Contributor #47)',
                readOnly: true,
            },
        },
        {
            name: 'documentsSubmitted',
            type: 'number',
            defaultValue: 0,
            admin: {
                description: 'Total products this contributor has documented',
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
            name: 'firstCases',
            type: 'number',
            defaultValue: 0,
            admin: {
                description: 'Products where they were the FIRST to open a case',
                readOnly: true,
            },
        },
        {
            name: 'contributorLevel',
            type: 'select',
            defaultValue: 'new',
            options: [
                { label: '🔬 New', value: 'new' },
                { label: '🧭 Builder', value: 'builder' },
                { label: '🗺️ Veteran', value: 'veteran' },
                { label: '⭐ Champion', value: 'champion' },
            ],
            admin: {
                description: 'Contributor level based on documentsSubmitted',
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
                description: 'URL-friendly slug (e.g., "contributor-47" or custom)',
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
            name: 'featuredCases',
            type: 'json',
            defaultValue: [],
            admin: {
                description: 'Array of barcode strings for their top cases',
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
                // Auto-calculate contributor level based on documents submitted
                if (data.documentsSubmitted !== undefined) {
                    const docs = data.documentsSubmitted
                    if (docs >= 50) {
                        data.contributorLevel = 'champion'
                    } else if (docs >= 15) {
                        data.contributorLevel = 'veteran'
                    } else if (docs >= 5) {
                        data.contributorLevel = 'builder'
                    } else {
                        data.contributorLevel = 'new'
                    }
                }

                // Generate contributor number on create
                if (operation === 'create' && !data.contributorNumber) {
                    const lastContributor = await req.payload.find({
                        collection: 'contributor-profiles',
                        sort: '-contributorNumber',
                        limit: 1,
                    })
                    data.contributorNumber = (lastContributor.docs[0]?.contributorNumber || 0) + 1
                }

                // Generate shareable slug on create
                if (operation === 'create' && !data.shareableSlug) {
                    data.shareableSlug = `contributor-${data.contributorNumber}`
                }

                return data
            },
        ],
        afterChange: [createAuditLogHook('contributor-profiles')],
        afterDelete: [createAuditDeleteHook('contributor-profiles')],
    },
    timestamps: true,
}

export default ContributorProfiles
