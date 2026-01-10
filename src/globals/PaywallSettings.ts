import type { GlobalConfig } from 'payload'

/**
 * Paywall Settings Global
 *
 * Controls how paywall variants are selected and displayed.
 * Supports Statsig experiments, CMS A/B testing, or fixed variant.
 */
export const PaywallSettings: GlobalConfig = {
    slug: 'paywall-settings',
    label: 'Paywall Settings',
    admin: {
        group: 'Monetization',
        description: 'Configure how paywall variants are served to users',
    },
    access: {
        read: () => true, // Public for mobile app
        update: ({ req: { user } }) => (user as { role?: string })?.role === 'admin',
    },
    fields: [
        {
            name: 'mode',
            type: 'select',
            required: true,
            defaultValue: 'fixed',
            options: [
                {
                    label: 'Statsig Controlled',
                    value: 'statsig',
                },
                {
                    label: 'CMS A/B Test (Weighted Random)',
                    value: 'cms_ab_test',
                },
                {
                    label: 'Fixed Variant',
                    value: 'fixed',
                },
            ],
            admin: {
                description: 'How variant selection is determined',
            },
        },

        // Fixed variant selection
        {
            name: 'fixedVariant',
            type: 'relationship',
            relationTo: 'paywall-variants' as any,
            admin: {
                description: 'Variant to show all users (when mode is "fixed")',
                condition: (data) => data?.mode === 'fixed',
            },
        },

        // Statsig configuration
        {
            name: 'statsigExperimentName',
            type: 'text',
            admin: {
                description: 'Statsig experiment name for variant bucketing (e.g., "paywall_copy_test_v1")',
                condition: (data) => data?.mode === 'statsig',
            },
        },
        {
            name: 'statsigParameterName',
            type: 'text',
            defaultValue: 'variantId',
            admin: {
                description: 'Statsig parameter that returns the variant ID',
                condition: (data) => data?.mode === 'statsig',
            },
        },

        // CMS A/B Test settings
        {
            name: 'abTestDescription',
            type: 'textarea',
            admin: {
                description: 'Notes about the current A/B test (internal)',
                condition: (data) => data?.mode === 'cms_ab_test',
            },
        },

        // Fallback behavior
        {
            name: 'fallbackVariant',
            type: 'relationship',
            relationTo: 'paywall-variants' as any,
            admin: {
                description: 'Fallback variant if primary selection fails',
            },
        },

        // Feature toggles
        {
            name: 'showPaywall',
            type: 'checkbox',
            defaultValue: true,
            admin: {
                description: 'Master toggle to enable/disable paywall globally',
            },
        },
        {
            name: 'forcePaywallForAll',
            type: 'checkbox',
            defaultValue: false,
            admin: {
                description: 'Show paywall even to subscribers (for testing)',
            },
        },

        // Timing configuration
        {
            name: 'delayBeforeShow',
            type: 'number',
            defaultValue: 0,
            min: 0,
            admin: {
                description: 'Delay in milliseconds before showing paywall',
            },
        },
        {
            name: 'minSessionsBeforePaywall',
            type: 'number',
            defaultValue: 0,
            min: 0,
            admin: {
                description: 'Minimum app sessions before showing paywall (0 = show immediately)',
            },
        },

        // Trial configuration
        {
            name: 'defaultTrialDays',
            type: 'number',
            defaultValue: 7,
            admin: {
                description: 'Default trial length to display in copy',
            },
        },

        // Pricing display
        {
            name: 'showPricing',
            type: 'checkbox',
            defaultValue: true,
            admin: {
                description: 'Display pricing information on paywall',
            },
        },
        {
            name: 'priceDisplayFormat',
            type: 'select',
            defaultValue: 'monthly',
            options: [
                { label: 'Monthly price', value: 'monthly' },
                { label: 'Weekly price', value: 'weekly' },
                { label: 'Annual (per month)', value: 'annual_monthly' },
                { label: 'Annual total', value: 'annual_total' },
            ],
            admin: {
                description: 'How to display the subscription price',
            },
        },
    ],
}

export default PaywallSettings
