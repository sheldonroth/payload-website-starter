import type { CollectionConfig } from 'payload'
import { isAdmin } from '../access/roleAccess'

/**
 * Brands Collection
 *
 * Central brand database with trust scoring.
 * Aggregates data from all products under a brand to calculate:
 * - Trust Score (0-100)
 * - Recall history
 * - Ingredient quality patterns
 * - Transparency score
 *
 * Used by Brand Trust Index engine for parent company accountability.
 */
export const Brands: CollectionConfig = {
    slug: 'brands',
    access: {
        read: () => true,
        create: isAdmin,
        update: isAdmin,
        delete: isAdmin,
    },
    admin: {
        useAsTitle: 'name',
        defaultColumns: ['name', 'parentCompany', 'trustScore', 'productCount', 'updatedAt'],
        group: 'Research',
        description: 'Brand database with trust scoring and parent company tracking',
    },
    hooks: {
        // Recalculate trust score when brand is updated
        beforeChange: [
            async ({ data, req, operation }) => {
                if (operation === 'update' && data) {
                    // Trust score calculation will be triggered by the recalculate endpoint
                    // This hook just ensures lastCalculated is updated
                    if (data.trustScore !== undefined) {
                        data.trustScoreLastCalculated = new Date().toISOString()
                    }
                }
                return data
            },
        ],
    },
    fields: [
        // === IDENTIFICATION ===
        {
            name: 'name',
            type: 'text',
            required: true,
            unique: true,
            label: 'Brand Name',
            admin: {
                description: 'Primary brand name (e.g., "Cheerios", "Tide")',
            },
        },
        {
            name: 'aliases',
            type: 'array',
            label: 'Alternative Names',
            admin: {
                description: 'Other names or spellings for this brand',
            },
            fields: [
                {
                    name: 'alias',
                    type: 'text',
                    required: true,
                },
            ],
        },
        {
            name: 'slug',
            type: 'text',
            unique: true,
            admin: {
                description: 'URL-friendly slug',
            },
        },

        // === PARENT COMPANY ===
        {
            name: 'parentCompany',
            type: 'text',
            admin: {
                description: 'Parent corporation (e.g., "General Mills", "Procter & Gamble")',
            },
        },

        // === TRUST SCORE ===
        {
            name: 'trustScore',
            type: 'number',
            min: 0,
            max: 100,
            admin: {
                position: 'sidebar',
                description: 'Calculated trust score (0-100)',
                readOnly: true,
            },
        },
        {
            name: 'trustGrade',
            type: 'select',
            options: [
                { label: 'A - Excellent', value: 'A' },
                { label: 'B - Good', value: 'B' },
                { label: 'C - Average', value: 'C' },
                { label: 'D - Poor', value: 'D' },
                { label: 'F - Failing', value: 'F' },
            ],
            admin: {
                position: 'sidebar',
                readOnly: true,
            },
        },
        {
            name: 'trustScoreLastCalculated',
            type: 'date',
            admin: {
                position: 'sidebar',
                readOnly: true,
            },
        },

        // === TRUST SCORE COMPONENTS ===
        {
            name: 'scoreBreakdown',
            type: 'group',
            label: 'Score Components',
            admin: {
                description: 'Individual factors contributing to trust score',
            },
            fields: [
                {
                    name: 'ingredientQuality',
                    type: 'number',
                    min: 0,
                    max: 100,
                    admin: {
                        description: 'Score based on ingredient safety across products',
                        readOnly: true,
                    },
                },
                {
                    name: 'recallHistory',
                    type: 'number',
                    min: 0,
                    max: 100,
                    admin: {
                        description: 'Score based on recall frequency and severity',
                        readOnly: true,
                    },
                },
                {
                    name: 'transparency',
                    type: 'number',
                    min: 0,
                    max: 100,
                    admin: {
                        description: 'Score based on ingredient disclosure practices',
                        readOnly: true,
                    },
                },
                {
                    name: 'consistency',
                    type: 'number',
                    min: 0,
                    max: 100,
                    admin: {
                        description: 'Score based on formulation consistency (no skimpflation)',
                        readOnly: true,
                    },
                },
                {
                    name: 'responsiveness',
                    type: 'number',
                    min: 0,
                    max: 100,
                    admin: {
                        description: 'Score based on response to issues/complaints',
                        readOnly: true,
                    },
                },
            ],
        },

        // === STATISTICS ===
        {
            name: 'productCount',
            type: 'number',
            defaultValue: 0,
            admin: {
                position: 'sidebar',
                readOnly: true,
                description: 'Total products from this brand in database',
            },
        },
        {
            name: 'avoidCount',
            type: 'number',
            defaultValue: 0,
            admin: {
                position: 'sidebar',
                readOnly: true,
                description: 'Products with AVOID verdict',
            },
        },
        {
            name: 'recallCount',
            type: 'number',
            defaultValue: 0,
            admin: {
                position: 'sidebar',
                readOnly: true,
                description: 'Total recalls associated with this brand',
            },
        },

        // === RECALL HISTORY ===
        {
            name: 'recalls',
            type: 'array',
            label: 'Recall History',
            admin: {
                description: 'Historical recalls associated with this brand',
            },
            fields: [
                {
                    name: 'recallNumber',
                    type: 'text',
                    required: true,
                },
                {
                    name: 'date',
                    type: 'date',
                },
                {
                    name: 'reason',
                    type: 'text',
                },
                {
                    name: 'severity',
                    type: 'select',
                    options: [
                        { label: 'Class I - Serious', value: 'class_i' },
                        { label: 'Class II - Moderate', value: 'class_ii' },
                        { label: 'Class III - Minor', value: 'class_iii' },
                    ],
                },
                {
                    name: 'source',
                    type: 'select',
                    options: [
                        { label: 'FDA', value: 'fda' },
                        { label: 'CPSC', value: 'cpsc' },
                        { label: 'USDA', value: 'usda' },
                        { label: 'Voluntary', value: 'voluntary' },
                    ],
                },
            ],
        },

        // === METADATA ===
        {
            name: 'website',
            type: 'text',
            admin: {
                description: 'Official brand website',
            },
        },
        {
            name: 'logo',
            type: 'upload',
            relationTo: 'media',
        },
        {
            name: 'description',
            type: 'textarea',
            admin: {
                description: 'Brief description of the brand',
            },
        },
        {
            name: 'categories',
            type: 'relationship',
            relationTo: 'categories',
            hasMany: true,
            admin: {
                description: 'Product categories this brand operates in',
            },
        },

        // === NOTES ===
        {
            name: 'notes',
            type: 'textarea',
            admin: {
                description: 'Internal notes about this brand',
            },
        },

        // === TRENDING STATUS ===
        {
            name: 'trending',
            type: 'group',
            label: 'Trending Status',
            admin: {
                description: 'Auto-calculated from daily news scan',
            },
            fields: [
                {
                    name: 'isTrending',
                    type: 'checkbox',
                    defaultValue: false,
                    admin: { readOnly: true },
                },
                {
                    name: 'trendingScore',
                    type: 'number',
                    min: 0,
                    max: 100,
                    admin: {
                        readOnly: true,
                        description: '0-100 based on news mentions',
                    },
                },
                {
                    name: 'trendingSentiment',
                    type: 'select',
                    options: [
                        { label: 'Positive', value: 'positive' },
                        { label: 'Negative', value: 'negative' },
                        { label: 'Neutral', value: 'neutral' },
                        { label: 'Mixed', value: 'mixed' },
                    ],
                    admin: { readOnly: true },
                },
                {
                    name: 'trendingReason',
                    type: 'textarea',
                    admin: {
                        readOnly: true,
                        description: 'AI-generated summary of why this brand is trending',
                    },
                },
                {
                    name: 'recentNewsCount',
                    type: 'number',
                    admin: {
                        readOnly: true,
                        description: 'News mentions in past 7 days',
                    },
                },
                {
                    name: 'lastTrendingCheck',
                    type: 'date',
                    admin: { readOnly: true },
                },
            ],
        },
    ],
    timestamps: true,
}
