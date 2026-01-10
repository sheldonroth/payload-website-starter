import type { CollectionConfig } from 'payload'
import { createAuditLogHook, createAuditDeleteHook } from '../hooks/auditLog'

/**
 * Paywall Variants Collection
 *
 * Manages different paywall copy and configuration variants for A/B testing.
 * Mobile app fetches active variants and displays based on mode setting.
 */
export const PaywallVariants: CollectionConfig = {
    slug: 'paywall-variants',
    labels: {
        singular: 'Paywall Variant',
        plural: 'Paywall Variants',
    },
    admin: {
        useAsTitle: 'name',
        defaultColumns: ['name', 'variantId', 'isActive', 'weight', 'updatedAt'],
        group: 'Monetization',
        description: 'Paywall copy variants for A/B testing subscription screens',
    },
    access: {
        // Public read for mobile app
        read: () => true,
        create: ({ req: { user } }) => (user as { role?: string })?.role === 'admin',
        update: ({ req: { user } }) => (user as { role?: string })?.role === 'admin',
        delete: ({ req: { user } }) => (user as { role?: string })?.role === 'admin',
    },
    hooks: {
        afterChange: [createAuditLogHook('paywall-variants')],
        afterDelete: [createAuditDeleteHook('paywall-variants')],
    },
    fields: [
        // Identification
        {
            name: 'variantId',
            type: 'text',
            required: true,
            unique: true,
            admin: {
                description: 'Unique identifier for this variant (e.g., "control", "urgency_v1", "social_proof")',
            },
        },
        {
            name: 'name',
            type: 'text',
            required: true,
            admin: {
                description: 'Internal name for this variant',
            },
        },
        {
            name: 'description',
            type: 'textarea',
            admin: {
                description: 'Notes about this variant (internal only)',
            },
        },

        // Main Copy
        {
            name: 'headline',
            type: 'text',
            required: true,
            admin: {
                description: 'Main headline (e.g., "Unlock Premium Features")',
            },
        },
        {
            name: 'subheadline',
            type: 'textarea',
            admin: {
                description: 'Supporting text below headline',
            },
        },

        // CTA Configuration
        {
            name: 'ctaText',
            type: 'text',
            required: true,
            defaultValue: 'Start Free Trial',
            admin: {
                description: 'Primary button text',
            },
        },
        {
            name: 'ctaSubtext',
            type: 'text',
            admin: {
                description: 'Text below CTA button (e.g., "Cancel anytime")',
            },
        },

        // Value Props
        {
            name: 'valueProps',
            type: 'array',
            admin: {
                description: 'List of value propositions shown on paywall',
            },
            fields: [
                {
                    name: 'text',
                    type: 'text',
                    required: true,
                    admin: {
                        description: 'Value prop text (e.g., "Unlimited product scans")',
                    },
                },
                {
                    name: 'icon',
                    type: 'text',
                    admin: {
                        description: 'Icon name from your icon set (e.g., "check", "star", "shield")',
                    },
                },
                {
                    name: 'emoji',
                    type: 'text',
                    admin: {
                        description: 'Emoji to display (e.g., "✓", "⭐", "🔒")',
                    },
                },
                {
                    name: 'lottieKey',
                    type: 'text',
                    admin: {
                        description: 'Lottie animation key if using animations',
                    },
                },
            ],
        },

        // Trial Emphasis
        {
            name: 'trialEmphasis',
            type: 'select',
            defaultValue: 'prominent',
            options: [
                { label: 'Prominent (large banner)', value: 'prominent' },
                { label: 'Subtle (small text)', value: 'subtle' },
                { label: 'In CTA (part of button)', value: 'in_cta' },
                { label: 'Hidden', value: 'hidden' },
            ],
            admin: {
                description: 'How prominently to display trial information',
            },
        },

        // Social Proof
        {
            name: 'showSocialProof',
            type: 'checkbox',
            defaultValue: true,
            admin: {
                description: 'Show social proof section',
            },
        },
        {
            name: 'socialProofText',
            type: 'text',
            admin: {
                description: 'Social proof text (e.g., "Join 50,000+ members")',
                condition: (data) => data?.showSocialProof,
            },
        },
        {
            name: 'socialProofRating',
            type: 'text',
            admin: {
                description: 'Rating display (e.g., "4.9★ App Store")',
                condition: (data) => data?.showSocialProof,
            },
        },

        // Visual Config
        {
            name: 'backgroundColor',
            type: 'text',
            admin: {
                description: 'Background color override (hex, e.g., "#1a1a2e")',
            },
        },
        {
            name: 'accentColor',
            type: 'text',
            admin: {
                description: 'Accent/CTA button color (hex)',
            },
        },
        {
            name: 'heroImage',
            type: 'upload',
            relationTo: 'media',
            admin: {
                description: 'Optional hero image for this variant',
            },
        },

        // A/B Testing
        {
            name: 'isActive',
            type: 'checkbox',
            defaultValue: true,
            admin: {
                description: 'Only active variants are used',
                position: 'sidebar',
            },
        },
        {
            name: 'weight',
            type: 'number',
            defaultValue: 1,
            min: 0,
            max: 100,
            admin: {
                description: 'Weight for random selection (higher = more likely). Only used in CMS A/B mode.',
                position: 'sidebar',
            },
        },

        // Analytics
        {
            name: 'analyticsTag',
            type: 'text',
            admin: {
                description: 'Tag for analytics tracking',
                position: 'sidebar',
            },
        },
    ],
    timestamps: true,
}

export default PaywallVariants
