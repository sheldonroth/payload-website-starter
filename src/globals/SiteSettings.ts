import type { GlobalConfig } from 'payload'
import { isAdmin } from '../access/roleAccess'

export const SiteSettings: GlobalConfig = {
    slug: 'site-settings',
    access: {
        read: () => true,
        update: isAdmin,
    },
    admin: {
        group: 'Settings',
    },
    fields: [
        // === FEATURED PRODUCT ===
        {
            name: 'featuredProduct',
            type: 'relationship',
            relationTo: 'products',
            label: 'Featured Product',
            admin: {
                description: 'Select one product to feature prominently in the app',
            },
        },
        {
            name: 'featuredProductHeadline',
            type: 'text',
            label: 'Featured Product Headline',
            defaultValue: 'Featured Finding',
            admin: {
                description: 'Headline shown above the featured product (e.g., "Featured Finding", "Editor\'s Pick")',
            },
        },
        // === AFFILIATE SETTINGS ===
        {
            name: 'affiliateSettings',
            type: 'group',
            label: 'Affiliate Settings',
            fields: [
                {
                    name: 'amazonAffiliateTag',
                    type: 'text',
                    label: 'Amazon Affiliate Tag',
                    admin: {
                        description: 'Your Amazon Associates tag (e.g., "yoursite-20"). Used to generate affiliate links.',
                    },
                },
                {
                    name: 'affiliateDisclosure',
                    type: 'textarea',
                    label: 'Affiliate Disclosure Text',
                    defaultValue: 'As an Amazon Associate we earn from qualifying purchases.',
                    admin: {
                        description: 'Disclosure text shown near affiliate links',
                    },
                },
                {
                    name: 'enableAffiliateLinks',
                    type: 'checkbox',
                    label: 'Enable Affiliate Links',
                    defaultValue: true,
                    admin: {
                        description: 'Show affiliate links on product pages',
                    },
                },
            ],
        },
        // === SITE INFO ===
        {
            name: 'siteInfo',
            type: 'group',
            label: 'Site Information',
            fields: [
                {
                    name: 'siteName',
                    type: 'text',
                    label: 'Site Name',
                    defaultValue: 'The Product Report',
                },
                {
                    name: 'siteDescription',
                    type: 'textarea',
                    label: 'Site Description',
                    defaultValue: 'Ingredient analysis and product reviews you can trust.',
                },
            ],
        },
        // === AUTOMATION THRESHOLDS ===
        {
            name: 'automationThresholds',
            type: 'group',
            label: 'Automation Thresholds',
            admin: {
                description: 'Configure thresholds for automated features',
            },
            fields: [
                {
                    name: 'freshnessThresholdDays',
                    type: 'number',
                    label: 'Freshness Threshold (Days)',
                    defaultValue: 180,
                    admin: {
                        description: 'Products older than this are considered stale for re-enrichment',
                    },
                },
                {
                    name: 'fuzzyMatchThreshold',
                    type: 'number',
                    label: 'Fuzzy Match Threshold',
                    defaultValue: 2,
                    admin: {
                        description: 'Maximum Levenshtein distance for fuzzy ingredient matching (1-3 recommended)',
                    },
                },
                {
                    name: 'autoAlternativesLimit',
                    type: 'number',
                    label: 'Auto Alternatives Limit',
                    defaultValue: 3,
                    admin: {
                        description: 'Maximum number of safe alternatives to auto-suggest',
                    },
                },
                {
                    name: 'aiCategoryConfidence',
                    type: 'number',
                    label: 'AI Category Confidence (%)',
                    defaultValue: 70,
                    admin: {
                        description: 'Minimum confidence for auto-assigning AI-suggested categories (0-100)',
                    },
                },
                {
                    name: 'enableFuzzyMatching',
                    type: 'checkbox',
                    label: 'Enable Fuzzy Matching',
                    defaultValue: true,
                    admin: {
                        description: 'Use fuzzy matching for ingredient linking',
                    },
                },
                {
                    name: 'enableAiCategories',
                    type: 'checkbox',
                    label: 'Enable AI Categories',
                    defaultValue: true,
                    admin: {
                        description: 'Auto-suggest categories using AI',
                    },
                },
                {
                    name: 'enableAutoAlternatives',
                    type: 'checkbox',
                    label: 'Enable Auto Alternatives',
                    defaultValue: true,
                    admin: {
                        description: 'Auto-suggest safe alternatives for avoided products',
                    },
                },
            ],
        },
    ],
}
