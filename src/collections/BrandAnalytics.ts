import type { CollectionConfig } from 'payload'

/**
 * Brand Analytics Collection
 *
 * Daily snapshots of brand performance metrics.
 * Pre-aggregated data for fast dashboard queries.
 *
 * This powers the Brand Intelligence Portal with:
 * - Scan volume trends
 * - Trust score history
 * - Category ranking changes
 * - Consumer demand signals
 */
export const BrandAnalytics: CollectionConfig = {
    slug: 'brand-analytics',
    access: {
        read: ({ req }) => !!req.user, // Admin and brand users
        create: () => true, // Created by cron jobs
        update: ({ req }) => !!req.user,
        delete: ({ req }) => !!req.user,
    },
    admin: {
        useAsTitle: 'brand',
        defaultColumns: ['brand', 'date', 'scanCount', 'trustScore', 'categoryRank'],
        group: 'Intelligence',
        description: 'Daily brand performance snapshots for analytics',
    },
    indexes: [
        {
            fields: ['brand', 'date'],
            unique: true,
        },
    ],
    fields: [
        // ═══════════════════════════════════════════════════════════════
        // IDENTITY
        // ═══════════════════════════════════════════════════════════════
        {
            name: 'brand',
            type: 'relationship',
            relationTo: 'brands',
            required: true,
            index: true,
            admin: {
                description: 'The brand this snapshot is for',
            },
        },
        {
            name: 'brandName',
            type: 'text',
            admin: {
                description: 'Brand name (denormalized for fast queries)',
                readOnly: true,
            },
        },
        {
            name: 'date',
            type: 'date',
            required: true,
            index: true,
            admin: {
                description: 'The date of this snapshot (YYYY-MM-DD)',
            },
        },

        // ═══════════════════════════════════════════════════════════════
        // ENGAGEMENT METRICS
        // ═══════════════════════════════════════════════════════════════
        {
            name: 'scanCount',
            type: 'number',
            defaultValue: 0,
            admin: {
                description: 'Total barcode scans of this brand\'s products today',
            },
        },
        {
            name: 'searchCount',
            type: 'number',
            defaultValue: 0,
            admin: {
                description: 'Text searches mentioning this brand today',
            },
        },
        {
            name: 'productViewCount',
            type: 'number',
            defaultValue: 0,
            admin: {
                description: 'Product page views today',
            },
        },
        {
            name: 'uniqueUsers',
            type: 'number',
            defaultValue: 0,
            admin: {
                description: 'Unique users who interacted with this brand today',
            },
        },

        // ═══════════════════════════════════════════════════════════════
        // VERDICT DISTRIBUTION
        // ═══════════════════════════════════════════════════════════════
        {
            name: 'verdictBreakdown',
            type: 'group',
            admin: {
                description: 'Product verdict distribution',
            },
            fields: [
                {
                    name: 'recommendCount',
                    type: 'number',
                    defaultValue: 0,
                    admin: { description: 'Products with RECOMMEND verdict' },
                },
                {
                    name: 'cautionCount',
                    type: 'number',
                    defaultValue: 0,
                    admin: { description: 'Products with CAUTION verdict' },
                },
                {
                    name: 'avoidCount',
                    type: 'number',
                    defaultValue: 0,
                    admin: { description: 'Products with AVOID verdict' },
                },
                {
                    name: 'avoidHitCount',
                    type: 'number',
                    defaultValue: 0,
                    admin: { description: 'Scans that resulted in AVOID verdict shown' },
                },
            ],
        },

        // ═══════════════════════════════════════════════════════════════
        // TRUST & RANKING
        // ═══════════════════════════════════════════════════════════════
        {
            name: 'trustScore',
            type: 'number',
            min: 0,
            max: 100,
            admin: {
                description: 'Brand trust score (0-100) on this date',
            },
        },
        {
            name: 'trustGrade',
            type: 'select',
            options: [
                { label: 'A', value: 'A' },
                { label: 'B', value: 'B' },
                { label: 'C', value: 'C' },
                { label: 'D', value: 'D' },
                { label: 'F', value: 'F' },
            ],
            admin: {
                description: 'Trust grade on this date',
            },
        },
        {
            name: 'categoryRank',
            type: 'number',
            admin: {
                description: 'Rank within primary category (1 = best)',
            },
        },
        {
            name: 'overallRank',
            type: 'number',
            admin: {
                description: 'Rank among all brands',
            },
        },

        // ═══════════════════════════════════════════════════════════════
        // COMPARISON METRICS (vs previous periods)
        // ═══════════════════════════════════════════════════════════════
        {
            name: 'changes',
            type: 'group',
            admin: {
                description: 'Changes vs previous period',
            },
            fields: [
                {
                    name: 'scanCountChange',
                    type: 'number',
                    admin: { description: 'Scan count change vs yesterday (%)' },
                },
                {
                    name: 'trustScoreChange',
                    type: 'number',
                    admin: { description: 'Trust score change vs yesterday' },
                },
                {
                    name: 'categoryRankChange',
                    type: 'number',
                    admin: { description: 'Category rank change (positive = improved)' },
                },
                {
                    name: 'weekOverWeekGrowth',
                    type: 'number',
                    admin: { description: 'Scan count change vs 7 days ago (%)' },
                },
            ],
        },

        // ═══════════════════════════════════════════════════════════════
        // PRODUCT METRICS
        // ═══════════════════════════════════════════════════════════════
        {
            name: 'productCount',
            type: 'number',
            defaultValue: 0,
            admin: {
                description: 'Total products under this brand',
            },
        },
        {
            name: 'testedProductCount',
            type: 'number',
            defaultValue: 0,
            admin: {
                description: 'Products that have been tested',
            },
        },
        {
            name: 'pendingTestCount',
            type: 'number',
            defaultValue: 0,
            admin: {
                description: 'Products in the testing queue',
            },
        },
        {
            name: 'averageProductScore',
            type: 'number',
            admin: {
                description: 'Average score across all tested products',
            },
        },

        // ═══════════════════════════════════════════════════════════════
        // TOP PRODUCTS
        // ═══════════════════════════════════════════════════════════════
        {
            name: 'topScannedProducts',
            type: 'json',
            defaultValue: [],
            admin: {
                description: 'Top 5 most scanned products today. Structure: [{ productId, name, scanCount }]',
            },
        },
    ],
    timestamps: true,
}

export default BrandAnalytics
