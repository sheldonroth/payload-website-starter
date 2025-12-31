import type { CollectionConfig } from 'payload'

/**
 * PriceHistory Collection
 *
 * Tracks price and size changes over time for products.
 * Used by the Skimpflation Detector to identify:
 * - Shrinkflation: Same price, smaller size
 * - Skimpflation: Same price/size, cheaper ingredients
 * - Price increases
 *
 * Data is collected daily via automated scraping.
 */
export const PriceHistory: CollectionConfig = {
    slug: 'price-history',
    access: {
        read: () => true,
        create: ({ req }) => !!req.user,
        update: ({ req }) => !!req.user,
        delete: ({ req }) => !!req.user,
    },
    admin: {
        useAsTitle: 'id',
        defaultColumns: ['product', 'price', 'size', 'retailer', 'capturedAt'],
        group: 'Analytics',
        description: 'Historical price and size data for shrinkflation/skimpflation detection',
    },
    fields: [
        // === PRODUCT REFERENCE ===
        {
            name: 'product',
            type: 'relationship',
            relationTo: 'products',
            required: true,
            index: true,
            admin: {
                description: 'The product this price record is for',
            },
        },

        // === PRICE DATA ===
        {
            name: 'price',
            type: 'number',
            required: true,
            min: 0,
            admin: {
                description: 'Price in USD (e.g., 4.99)',
                step: 0.01,
            },
        },
        {
            name: 'salePrice',
            type: 'number',
            min: 0,
            admin: {
                description: 'Sale price if on sale',
                step: 0.01,
            },
        },
        {
            name: 'pricePerUnit',
            type: 'number',
            min: 0,
            admin: {
                description: 'Price per oz/unit for comparison',
                step: 0.001,
            },
        },

        // === SIZE/QUANTITY DATA ===
        {
            name: 'size',
            type: 'text',
            admin: {
                description: 'Package size as displayed (e.g., "12 oz", "500ml")',
            },
        },
        {
            name: 'sizeNormalized',
            type: 'number',
            admin: {
                description: 'Normalized size in oz for comparison',
                step: 0.01,
            },
        },
        {
            name: 'unitCount',
            type: 'number',
            admin: {
                description: 'Number of units in package (for multipacks)',
            },
        },

        // === SOURCE DATA ===
        {
            name: 'retailer',
            type: 'select',
            required: true,
            options: [
                { label: 'Amazon', value: 'amazon' },
                { label: 'Walmart', value: 'walmart' },
                { label: 'Target', value: 'target' },
                { label: 'Costco', value: 'costco' },
                { label: 'Kroger', value: 'kroger' },
                { label: 'Whole Foods', value: 'whole_foods' },
                { label: 'Instacart', value: 'instacart' },
                { label: 'Manual Entry', value: 'manual' },
            ],
            admin: {
                position: 'sidebar',
            },
        },
        {
            name: 'sourceUrl',
            type: 'text',
            admin: {
                description: 'URL where price was captured',
            },
        },
        {
            name: 'capturedAt',
            type: 'date',
            required: true,
            index: true,
            admin: {
                date: {
                    pickerAppearance: 'dayAndTime',
                },
                position: 'sidebar',
            },
        },

        // === INGREDIENT SNAPSHOT ===
        {
            name: 'ingredientsSnapshot',
            type: 'textarea',
            admin: {
                description: 'Ingredient list at time of capture (for skimpflation detection)',
            },
        },
        {
            name: 'ingredientCount',
            type: 'number',
            admin: {
                description: 'Number of ingredients at capture time',
            },
        },

        // === ANOMALY FLAGS ===
        {
            name: 'anomalyDetected',
            type: 'checkbox',
            defaultValue: false,
            admin: {
                position: 'sidebar',
                description: 'System detected an anomaly in this record',
            },
        },
        {
            name: 'anomalyType',
            type: 'select',
            options: [
                { label: 'Price Increase', value: 'price_increase' },
                { label: 'Shrinkflation', value: 'shrinkflation' },
                { label: 'Skimpflation', value: 'skimpflation' },
                { label: 'Both Shrink+Price', value: 'double_whammy' },
            ],
            admin: {
                condition: (data) => data?.anomalyDetected,
            },
        },
        {
            name: 'anomalyDetails',
            type: 'json',
            admin: {
                description: 'Detailed anomaly analysis data',
                condition: (data) => data?.anomalyDetected,
            },
        },
    ],
    timestamps: true,
}
