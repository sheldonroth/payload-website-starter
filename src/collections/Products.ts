import type { CollectionConfig } from 'payload'

export const Products: CollectionConfig = {
    slug: 'products',
    access: {
        read: () => true,
    },
    admin: {
        useAsTitle: 'name',
        defaultColumns: ['name', 'category', 'overallScore', 'rankInCategory', 'status'],
        listSearchableFields: ['name', 'brand', 'summary'],
        group: 'Content',
    },
    hooks: {
        beforeChange: [
            // Auto-calculate overall score from sub-ratings
            ({ data }) => {
                if (data?.ratings) {
                    const weights = {
                        performance: 0.30,
                        reliability: 0.25,
                        valueForMoney: 0.25,
                        features: 0.20,
                    };

                    const performance = data.ratings.performance || 0;
                    const reliability = data.ratings.reliability || 0;
                    const valueForMoney = data.ratings.valueForMoney || 0;
                    const features = data.ratings.features || 0;

                    data.overallScore = Math.round(
                        (performance * weights.performance) +
                        (reliability * weights.reliability) +
                        (valueForMoney * weights.valueForMoney) +
                        (features * weights.features)
                    );
                }
                return data;
            },
        ],
    },
    fields: [
        // === MAIN INFO ===
        {
            name: 'name',
            type: 'text',
            required: true,
            label: 'Product Name',
        },
        {
            name: 'brand',
            type: 'text',
            required: true,
            label: 'Brand Name',
        },
        {
            name: 'slug',
            type: 'text',
            unique: true,
            label: 'URL Slug',
            admin: {
                description: 'Used in URLs (auto-generated from brand + name if empty)',
            },
            hooks: {
                beforeValidate: [
                    ({ value, data }) => {
                        if (value) return value;
                        // Auto-generate slug from brand + name
                        const brand = data?.brand || '';
                        const name = data?.name || '';
                        return `${brand}-${name}`
                            .toLowerCase()
                            .replace(/[^a-z0-9]+/g, '-')
                            .replace(/(^-|-$)/g, '');
                    },
                ],
            },
        },
        {
            name: 'category',
            type: 'relationship',
            relationTo: 'categories',
            required: false,
            hasMany: false,
            admin: {
                position: 'sidebar',
            },
        },

        // === IMAGES ===
        {
            name: 'imageUrl',
            type: 'text',
            label: 'Image URL (External)',
            admin: {
                description: 'Use this OR upload an image below',
            },
        },
        {
            name: 'image',
            type: 'upload',
            relationTo: 'media',
            label: 'Product Image',
        },

        // === SCORES & RANKINGS ===
        {
            name: 'overallScore',
            type: 'number',
            min: 0,
            max: 100,
            label: 'Overall Score',
            admin: {
                readOnly: true,
                description: 'Auto-calculated from ratings below',
                position: 'sidebar',
            },
        },
        {
            name: 'rankInCategory',
            type: 'number',
            admin: {
                readOnly: true,
                description: 'Auto-calculated rank within category',
                position: 'sidebar',
            },
        },
        {
            name: 'ratings',
            type: 'group',
            label: 'Ratings (0-100)',
            admin: {
                description: 'Overall score is auto-calculated: Performance 30%, Reliability 25%, Value 25%, Features 20%',
            },
            fields: [
                {
                    type: 'row',
                    fields: [
                        {
                            name: 'performance',
                            type: 'number',
                            min: 0,
                            max: 100,
                            admin: { width: '25%' },
                        },
                        {
                            name: 'reliability',
                            type: 'number',
                            min: 0,
                            max: 100,
                            admin: { width: '25%' },
                        },
                        {
                            name: 'valueForMoney',
                            type: 'number',
                            min: 0,
                            max: 100,
                            label: 'Value for Money',
                            admin: { width: '25%' },
                        },
                        {
                            name: 'features',
                            type: 'number',
                            min: 0,
                            max: 100,
                            admin: { width: '25%' },
                        },
                    ],
                },
            ],
        },

        // === BADGES (Sidebar) ===
        {
            name: 'badges',
            type: 'group',
            label: 'Product Badges',
            admin: {
                position: 'sidebar',
            },
            fields: [
                {
                    name: 'isBestInCategory',
                    type: 'checkbox',
                    label: '🏆 Best in Category',
                    admin: {
                        description: 'Top product in this category',
                    },
                },
                {
                    name: 'isRecommended',
                    type: 'checkbox',
                    label: '✅ Recommended',
                    admin: {
                        description: 'Editor-approved quality product',
                    },
                },
                {
                    name: 'isBestValue',
                    type: 'checkbox',
                    label: '💰 Best Value',
                    admin: {
                        description: 'Best price-to-performance ratio',
                    },
                },
                {
                    name: 'isEditorsChoice',
                    type: 'checkbox',
                    label: '⭐ Editor\'s Choice',
                    admin: {
                        description: 'Exceptional product (rare)',
                    },
                },
            ],
        },

        // === STATUS & WORKFLOW ===
        {
            name: 'status',
            type: 'select',
            label: 'Review Status',
            options: [
                { label: '📝 Draft', value: 'draft' },
                { label: '🔬 Under Testing', value: 'testing' },
                { label: '✍️ Writing Review', value: 'writing' },
                { label: '👀 Ready for Review', value: 'review' },
                { label: '✅ Published', value: 'published' },
            ],
            defaultValue: 'draft',
            admin: {
                position: 'sidebar',
            },
        },

        // === PRICING ===
        {
            name: 'priceRange',
            type: 'select',
            label: 'Price Range',
            options: [
                { label: '$ (Budget)', value: '$' },
                { label: '$$ (Mid-Range)', value: '$$' },
                { label: '$$$ (Premium)', value: '$$$' },
                { label: '$$$$ (Luxury)', value: '$$$$' },
            ],
            defaultValue: '$$',
        },

        // === PROS & CONS ===
        {
            type: 'row',
            fields: [
                {
                    name: 'pros',
                    type: 'array',
                    label: '✅ Pros',
                    admin: { width: '50%' },
                    fields: [
                        {
                            name: 'text',
                            type: 'text',
                            required: true,
                        },
                    ],
                },
                {
                    name: 'cons',
                    type: 'array',
                    label: '❌ Cons',
                    admin: { width: '50%' },
                    fields: [
                        {
                            name: 'text',
                            type: 'text',
                            required: true,
                        },
                    ],
                },
            ],
        },

        // === SUMMARY & CONTENT ===
        {
            name: 'summary',
            type: 'textarea',
            label: 'Product Summary',
            admin: {
                description: 'Brief overview for cards and previews',
            },
        },
        {
            name: 'fullReview',
            type: 'richText',
            label: 'Full Review',
        },

        // === PURCHASE LINKS ===
        {
            name: 'purchaseLinks',
            type: 'array',
            label: '🛒 Where to Buy',
            fields: [
                {
                    type: 'row',
                    fields: [
                        {
                            name: 'retailer',
                            type: 'text',
                            required: true,
                            label: 'Retailer',
                            admin: { width: '30%' },
                        },
                        {
                            name: 'url',
                            type: 'text',
                            required: true,
                            label: 'URL',
                            admin: { width: '40%' },
                        },
                        {
                            name: 'price',
                            type: 'text',
                            label: 'Price',
                            admin: { width: '15%' },
                        },
                        {
                            name: 'isAffiliate',
                            type: 'checkbox',
                            label: 'Affiliate?',
                            defaultValue: true,
                            admin: { width: '15%' },
                        },
                    ],
                },
            ],
        },

        // === COMPARISON ===
        {
            name: 'comparedWith',
            type: 'relationship',
            relationTo: 'products',
            hasMany: true,
            label: 'Compare With',
            admin: {
                description: 'Link related products for comparison',
            },
        },

        // === TESTING INFO ===
        {
            name: 'testingInfo',
            type: 'group',
            label: 'Testing Information',
            fields: [
                {
                    type: 'row',
                    fields: [
                        {
                            name: 'reviewDate',
                            type: 'date',
                            label: 'Review Date',
                            admin: {
                                width: '33%',
                                date: { pickerAppearance: 'dayOnly' },
                            },
                        },
                        {
                            name: 'lastTestedDate',
                            type: 'date',
                            label: 'Last Tested',
                            admin: {
                                width: '33%',
                                date: { pickerAppearance: 'dayOnly' },
                            },
                        },
                        {
                            name: 'versionTested',
                            type: 'text',
                            label: 'Version/Model',
                            admin: { width: '33%' },
                        },
                    ],
                },
                {
                    name: 'updateNotes',
                    type: 'textarea',
                    label: 'Update Notes',
                    admin: {
                        description: 'Notes about changes since last review',
                    },
                },
            ],
        },

        // === LEGACY FIELDS (for backward compatibility) ===
        {
            name: 'isBestBuy',
            type: 'checkbox',
            admin: { hidden: true },
        },
        {
            name: 'isRecommended',
            type: 'checkbox',
            admin: { hidden: true },
        },
    ],
}
