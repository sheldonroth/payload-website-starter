import type { CollectionConfig } from 'payload'

/**
 * Brand Users Collection
 *
 * Authentication and access control for the Brand Intelligence Portal.
 * Brand owners/managers can claim their brand and access analytics.
 *
 * Subscription Tiers:
 * - Free: Basic product scores, 1 brand
 * - Starter ($99/mo): All products, basic analytics
 * - Pro ($299/mo): Competitive benchmarking, demand signals
 * - Enterprise (Custom): Full API access, custom reports, certification
 */
export const BrandUsers: CollectionConfig = {
    slug: 'brand-users',
    auth: {
        tokenExpiration: 60 * 60 * 24 * 30, // 30 days
        cookies: {
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'Lax',
        },
    },
    access: {
        read: ({ req }) => {
            // Admin can read all
            if (req.user?.collection === 'users') return true
            // Brand users can read their own
            if (req.user?.collection === 'brand-users') {
                return {
                    id: { equals: req.user.id },
                }
            }
            return false
        },
        create: ({ req }) => !!req.user, // Admin only for now
        update: ({ req }) => {
            // Admin can update all
            if (req.user?.collection === 'users') return true
            // Brand users can update their own
            if (req.user?.collection === 'brand-users') {
                return {
                    id: { equals: req.user.id },
                }
            }
            return false
        },
        delete: ({ req }) => req.user?.collection === 'users', // Admin only
    },
    admin: {
        useAsTitle: 'email',
        defaultColumns: ['email', 'brand', 'role', 'subscription', 'verifiedAt'],
        group: 'Intelligence',
        description: 'Brand portal users - companies accessing their analytics',
    },
    fields: [
        // ═══════════════════════════════════════════════════════════════
        // IDENTITY
        // ═══════════════════════════════════════════════════════════════
        {
            name: 'name',
            type: 'text',
            required: true,
            admin: {
                description: 'Full name of the brand representative',
            },
        },
        {
            name: 'jobTitle',
            type: 'text',
            admin: {
                description: 'Job title (e.g., Brand Manager, CMO)',
            },
        },
        {
            name: 'phone',
            type: 'text',
            admin: {
                description: 'Contact phone number',
            },
        },

        // ═══════════════════════════════════════════════════════════════
        // BRAND ASSOCIATION
        // ═══════════════════════════════════════════════════════════════
        {
            name: 'brand',
            type: 'relationship',
            relationTo: 'brands',
            required: true,
            admin: {
                description: 'The brand this user represents',
            },
        },
        {
            name: 'additionalBrands',
            type: 'relationship',
            relationTo: 'brands',
            hasMany: true,
            admin: {
                description: 'Additional brands this user can access (for parent companies)',
            },
        },
        {
            name: 'role',
            type: 'select',
            required: true,
            defaultValue: 'analyst',
            options: [
                { label: 'Owner', value: 'owner' },
                { label: 'Admin', value: 'admin' },
                { label: 'Analyst', value: 'analyst' },
                { label: 'Viewer', value: 'viewer' },
            ],
            admin: {
                description: 'Access level within the brand portal',
            },
        },

        // ═══════════════════════════════════════════════════════════════
        // VERIFICATION
        // ═══════════════════════════════════════════════════════════════
        {
            name: 'isVerified',
            type: 'checkbox',
            defaultValue: false,
            admin: {
                description: 'Has this user been verified as a legitimate brand representative?',
                position: 'sidebar',
            },
        },
        {
            name: 'verifiedAt',
            type: 'date',
            admin: {
                description: 'When verification was completed',
                condition: (data) => data?.isVerified,
            },
        },
        {
            name: 'verifiedBy',
            type: 'relationship',
            relationTo: 'users',
            admin: {
                description: 'Admin who verified this user',
                condition: (data) => data?.isVerified,
            },
        },
        {
            name: 'verificationMethod',
            type: 'select',
            options: [
                { label: 'Email Domain', value: 'email_domain' },
                { label: 'LinkedIn Profile', value: 'linkedin' },
                { label: 'Phone Call', value: 'phone' },
                { label: 'Business Documentation', value: 'documentation' },
                { label: 'Manual Override', value: 'manual' },
            ],
            admin: {
                description: 'How this user was verified',
                condition: (data) => data?.isVerified,
            },
        },
        {
            name: 'verificationNotes',
            type: 'textarea',
            admin: {
                description: 'Notes about the verification process',
            },
        },

        // ═══════════════════════════════════════════════════════════════
        // SUBSCRIPTION
        // ═══════════════════════════════════════════════════════════════
        {
            name: 'subscription',
            type: 'select',
            required: true,
            defaultValue: 'free',
            options: [
                { label: 'Free', value: 'free' },
                { label: 'Starter ($99/mo)', value: 'starter' },
                { label: 'Pro ($299/mo)', value: 'pro' },
                { label: 'Enterprise (Custom)', value: 'enterprise' },
            ],
            admin: {
                position: 'sidebar',
            },
        },
        {
            name: 'subscriptionStartDate',
            type: 'date',
            admin: {
                description: 'When the paid subscription started',
            },
        },
        {
            name: 'subscriptionEndDate',
            type: 'date',
            admin: {
                description: 'When the subscription expires (for non-auto-renew)',
            },
        },
        {
            name: 'stripeCustomerId',
            type: 'text',
            admin: {
                description: 'Stripe customer ID for billing',
                condition: (data) => data?.subscription !== 'free',
            },
        },
        {
            name: 'stripeSubscriptionId',
            type: 'text',
            admin: {
                description: 'Stripe subscription ID',
                condition: (data) => data?.subscription !== 'free',
            },
        },

        // ═══════════════════════════════════════════════════════════════
        // FEATURE ACCESS
        // ═══════════════════════════════════════════════════════════════
        {
            name: 'features',
            type: 'group',
            admin: {
                description: 'Feature flags (based on subscription)',
            },
            fields: [
                {
                    name: 'canViewCompetitors',
                    type: 'checkbox',
                    defaultValue: false,
                    admin: { description: 'Can view competitor benchmarking (Pro+)' },
                },
                {
                    name: 'canExportData',
                    type: 'checkbox',
                    defaultValue: false,
                    admin: { description: 'Can export analytics data (Pro+)' },
                },
                {
                    name: 'canAccessApi',
                    type: 'checkbox',
                    defaultValue: false,
                    admin: { description: 'Can use API access (Enterprise)' },
                },
                {
                    name: 'canViewDemandSignals',
                    type: 'checkbox',
                    defaultValue: false,
                    admin: { description: 'Can view consumer demand signals (Pro+)' },
                },
                {
                    name: 'canManageTeam',
                    type: 'checkbox',
                    defaultValue: false,
                    admin: { description: 'Can invite/manage other brand users (Admin+)' },
                },
            ],
        },

        // ═══════════════════════════════════════════════════════════════
        // ACTIVITY TRACKING
        // ═══════════════════════════════════════════════════════════════
        {
            name: 'lastLoginAt',
            type: 'date',
            admin: {
                description: 'Last login timestamp',
                readOnly: true,
            },
        },
        {
            name: 'loginCount',
            type: 'number',
            defaultValue: 0,
            admin: {
                description: 'Total number of logins',
                readOnly: true,
            },
        },

        // ═══════════════════════════════════════════════════════════════
        // NOTIFICATION PREFERENCES
        // ═══════════════════════════════════════════════════════════════
        {
            name: 'notifications',
            type: 'group',
            admin: {
                description: 'Email notification preferences',
            },
            fields: [
                {
                    name: 'weeklyDigest',
                    type: 'checkbox',
                    defaultValue: true,
                    admin: { description: 'Receive weekly performance digest' },
                },
                {
                    name: 'trustScoreAlerts',
                    type: 'checkbox',
                    defaultValue: true,
                    admin: { description: 'Alert when trust score changes significantly' },
                },
                {
                    name: 'newProductAlerts',
                    type: 'checkbox',
                    defaultValue: false,
                    admin: { description: 'Alert when new products are added to your brand' },
                },
                {
                    name: 'competitorAlerts',
                    type: 'checkbox',
                    defaultValue: false,
                    admin: { description: 'Alert on competitor ranking changes (Pro+)' },
                },
            ],
        },
    ],
    hooks: {
        afterLogin: [
            async ({ user, req }) => {
                // Update last login timestamp and count
                const userData = user as { id: number; loginCount?: number }
                await req.payload.update({
                    collection: 'brand-users',
                    id: userData.id,
                    data: {
                        lastLoginAt: new Date().toISOString(),
                        loginCount: (userData.loginCount || 0) + 1,
                    },
                })
            },
        ],
        beforeChange: [
            async ({ data, operation }) => {
                // Set feature flags based on subscription tier
                if (data.subscription) {
                    const tier = data.subscription
                    data.features = {
                        canViewCompetitors: tier === 'pro' || tier === 'enterprise',
                        canExportData: tier === 'pro' || tier === 'enterprise',
                        canAccessApi: tier === 'enterprise',
                        canViewDemandSignals: tier === 'pro' || tier === 'enterprise',
                        canManageTeam: data.role === 'owner' || data.role === 'admin',
                    }
                }
                return data
            },
        ],
    },
    timestamps: true,
}

export default BrandUsers
