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
        // TEMPORARILY DISABLED - Run scripts/add-automation-thresholds.sql first
        // Then uncomment this block and redeploy
        /*
        {
            name: 'automationThresholds',
            type: 'group',
            label: 'Automation Thresholds',
            admin: {
                description: 'Configure automation behavior for Zero-Input CMS features',
            },
            fields: [
                {
                    name: 'freshnessThresholdDays',
                    type: 'number',
                    label: 'Freshness Threshold (Days)',
                    defaultValue: 180,
                    min: 30,
                    max: 365,
                    admin: {
                        description: 'Products older than this are marked as stale (default: 180 days)',
                    },
                },
                {
                    name: 'fuzzyMatchThreshold',
                    type: 'number',
                    label: 'Fuzzy Match Threshold (Levenshtein Distance)',
                    defaultValue: 2,
                    min: 1,
                    max: 5,
                    admin: {
                        description: 'Max character difference for fuzzy ingredient matching (default: 2)',
                    },
                },
                {
                    name: 'autoAlternativesLimit',
                    type: 'number',
                    label: 'Auto-Suggest Alternatives Limit',
                    defaultValue: 3,
                    min: 1,
                    max: 10,
                    admin: {
                        description: 'Max safe alternatives to suggest for AVOID products (default: 3)',
                    },
                },
                {
                    name: 'aiCategoryConfidence',
                    type: 'number',
                    label: 'AI Category Classification Confidence',
                    defaultValue: 70,
                    min: 50,
                    max: 100,
                    admin: {
                        description: 'Minimum confidence (%) for auto-assigning AI-suggested categories (default: 70%)',
                    },
                },
                {
                    name: 'enableFuzzyMatching',
                    type: 'checkbox',
                    label: 'Enable Fuzzy Ingredient Matching',
                    defaultValue: true,
                    admin: {
                        description: 'Use Levenshtein distance to match similar ingredient names',
                    },
                },
                {
                    name: 'enableAICategories',
                    type: 'checkbox',
                    label: 'Enable AI Category Classification',
                    defaultValue: true,
                    admin: {
                        description: 'Use AI to suggest categories for new products',
                    },
                },
                {
                    name: 'enableAutoAlternatives',
                    type: 'checkbox',
                    label: 'Enable Auto-Suggest Alternatives',
                    defaultValue: true,
                    admin: {
                        description: 'Automatically suggest safe alternatives for AVOID products',
                    },
                },
            ],
        },
        */
    ],
}
