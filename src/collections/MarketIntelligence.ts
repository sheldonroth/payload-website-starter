import type { CollectionConfig } from 'payload'

/**
 * Market Intelligence Collection
 *
 * Tracks trending products from external sources BEFORE users ask for them.
 * This is proactive product discovery - knowing what's hot on Amazon, TikTok,
 * and Google Trends so we can test products before demand peaks.
 *
 * Business Value:
 * - First to test viral products = press coverage
 * - Proactive coverage = users find what they're looking for
 * - SEO opportunity = rank before demand peaks
 * - Competitive differentiation
 */
export const MarketIntelligence: CollectionConfig = {
    slug: 'market-intelligence',
    access: {
        read: ({ req }) => !!req.user, // Admin only
        create: () => true, // Created by cron jobs
        update: ({ req }) => !!req.user,
        delete: ({ req }) => !!req.user,
    },
    admin: {
        useAsTitle: 'productName',
        defaultColumns: ['productName', 'source', 'trendScore', 'status', 'detectedAt'],
        group: 'Intelligence',
        description: 'Trending products detected from external sources (Amazon, TikTok, etc.)',
    },
    fields: [
        // ═══════════════════════════════════════════════════════════════
        // SOURCE IDENTIFICATION
        // ═══════════════════════════════════════════════════════════════
        {
            name: 'source',
            type: 'select',
            required: true,
            index: true,
            options: [
                { label: '🛒 Amazon Bestseller', value: 'amazon_bestseller' },
                { label: '🛒 Amazon New Release', value: 'amazon_new_release' },
                { label: '🛒 Amazon Mover & Shaker', value: 'amazon_mover' },
                { label: '📱 TikTok Trending', value: 'tiktok' },
                { label: '📸 Instagram Trending', value: 'instagram' },
                { label: '📈 Google Trends', value: 'google_trends' },
                { label: '📰 News Mention', value: 'news' },
                { label: '🔬 Competitor Testing', value: 'competitor' },
                { label: '🎯 Manual Entry', value: 'manual' },
            ],
            admin: {
                position: 'sidebar',
            },
        },
        {
            name: 'externalId',
            type: 'text',
            index: true,
            admin: {
                description: 'External identifier (ASIN, TikTok video ID, etc.)',
            },
        },
        {
            name: 'sourceUrl',
            type: 'text',
            admin: {
                description: 'Link to the source (Amazon page, TikTok video, etc.)',
            },
        },

        // ═══════════════════════════════════════════════════════════════
        // PRODUCT INFORMATION
        // ═══════════════════════════════════════════════════════════════
        {
            name: 'productName',
            type: 'text',
            required: true,
            admin: {
                description: 'Product name as found on the source',
            },
        },
        {
            name: 'brand',
            type: 'text',
            admin: {
                description: 'Brand name (if identifiable)',
            },
        },
        {
            name: 'category',
            type: 'text',
            admin: {
                description: 'Product category on the source platform',
            },
        },
        {
            name: 'imageUrl',
            type: 'text',
            admin: {
                description: 'Product image URL',
            },
        },
        {
            name: 'price',
            type: 'number',
            admin: {
                description: 'Product price (if available)',
            },
        },
        {
            name: 'upc',
            type: 'text',
            index: true,
            admin: {
                description: 'UPC/barcode if found',
            },
        },

        // ═══════════════════════════════════════════════════════════════
        // TREND METRICS
        // ═══════════════════════════════════════════════════════════════
        {
            name: 'trendScore',
            type: 'number',
            defaultValue: 0,
            min: 0,
            max: 100,
            index: true,
            admin: {
                description: 'Calculated trend score (0-100)',
            },
        },
        {
            name: 'velocity',
            type: 'number',
            defaultValue: 0,
            admin: {
                description: 'Rate of change in popularity',
            },
        },
        {
            name: 'rankOnSource',
            type: 'number',
            admin: {
                description: 'Rank on the source platform (e.g., #3 bestseller)',
            },
        },
        {
            name: 'reviewCount',
            type: 'number',
            admin: {
                description: 'Number of reviews (Amazon)',
            },
        },
        {
            name: 'rating',
            type: 'number',
            admin: {
                description: 'Average rating (Amazon)',
            },
        },
        {
            name: 'socialMentions',
            type: 'number',
            admin: {
                description: 'Number of social media mentions',
            },
        },
        {
            name: 'searchVolume',
            type: 'number',
            admin: {
                description: 'Google search volume (if from Google Trends)',
            },
        },

        // ═══════════════════════════════════════════════════════════════
        // PROCESSING STATUS
        // ═══════════════════════════════════════════════════════════════
        {
            name: 'status',
            type: 'select',
            required: true,
            defaultValue: 'new',
            index: true,
            options: [
                { label: '🆕 New', value: 'new' },
                { label: '👀 Reviewed', value: 'reviewed' },
                { label: '✅ Matched to Existing', value: 'matched' },
                { label: '📋 Added to Queue', value: 'added_to_queue' },
                { label: '❌ Ignored', value: 'ignored' },
                { label: '🏷️ Out of Scope', value: 'out_of_scope' },
            ],
            admin: {
                position: 'sidebar',
            },
        },
        {
            name: 'ignoreReason',
            type: 'text',
            admin: {
                description: 'Why this was ignored (if applicable)',
                condition: (data) => data?.status === 'ignored' || data?.status === 'out_of_scope',
            },
        },
        {
            name: 'matchedBarcode',
            type: 'text',
            admin: {
                description: 'Barcode of matched existing product',
                condition: (data) => data?.status === 'matched',
            },
        },
        {
            name: 'linkedProductVote',
            type: 'relationship',
            relationTo: 'product-votes',
            admin: {
                description: 'The ProductVote this created or matched',
            },
        },
        {
            name: 'linkedProduct',
            type: 'relationship',
            relationTo: 'products',
            admin: {
                description: 'The tested Product (if already exists)',
            },
        },

        // ═══════════════════════════════════════════════════════════════
        // DETECTION METADATA
        // ═══════════════════════════════════════════════════════════════
        {
            name: 'detectedAt',
            type: 'date',
            required: true,
            defaultValue: () => new Date().toISOString(),
            index: true,
            admin: {
                description: 'When this trend was first detected',
            },
        },
        {
            name: 'lastSeenAt',
            type: 'date',
            admin: {
                description: 'When this was last seen on the source',
            },
        },
        {
            name: 'processedAt',
            type: 'date',
            admin: {
                description: 'When this was processed by the system',
            },
        },
        {
            name: 'processedBy',
            type: 'relationship',
            relationTo: 'users',
            admin: {
                description: 'Admin who processed this',
            },
        },

        // ═══════════════════════════════════════════════════════════════
        // RAW DATA
        // ═══════════════════════════════════════════════════════════════
        {
            name: 'rawData',
            type: 'json',
            admin: {
                description: 'Raw data from the source API/scrape',
                condition: () => false, // Hidden from admin UI
            },
        },
        {
            name: 'notes',
            type: 'textarea',
            admin: {
                description: 'Internal notes',
            },
        },
    ],
    timestamps: true,
}

export default MarketIntelligence
