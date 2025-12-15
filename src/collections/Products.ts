import type { CollectionConfig } from 'payload'

export const Products: CollectionConfig = {
    slug: 'products',
    access: {
        read: () => true,
    },
    admin: {
        useAsTitle: 'name',
        defaultColumns: ['name', 'brand', 'overallScore', 'category'],
    },
    fields: [
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
            name: 'category',
            type: 'text',
            required: true,
            label: 'Category Name',
        },
        {
            name: 'imageUrl',
            type: 'text',
            label: 'Image URL',
        },
        {
            name: 'image',
            type: 'upload',
            relationTo: 'media',
            label: 'Product Image',
        },
        {
            name: 'overallScore',
            type: 'number',
            required: true,
            min: 0,
            max: 100,
            label: 'Overall Score',
        },
        {
            name: 'priceRange',
            type: 'text',
            defaultValue: '$-$$',
            label: 'Price Range',
        },
        {
            name: 'ratings',
            type: 'group',
            label: 'Ratings',
            fields: [
                {
                    name: 'performance',
                    type: 'number',
                    min: 0,
                    max: 100,
                },
                {
                    name: 'reliability',
                    type: 'number',
                    min: 0,
                    max: 100,
                },
                {
                    name: 'valueForMoney',
                    type: 'number',
                    min: 0,
                    max: 100,
                },
                {
                    name: 'features',
                    type: 'number',
                    min: 0,
                    max: 100,
                },
            ],
        },
        {
            name: 'pros',
            type: 'array',
            label: 'Pros',
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
            label: 'Cons',
            fields: [
                {
                    name: 'text',
                    type: 'text',
                    required: true,
                },
            ],
        },
        {
            name: 'summary',
            type: 'textarea',
            label: 'Product Summary',
        },
        {
            name: 'reviewDate',
            type: 'date',
            label: 'Review Date',
            admin: {
                date: {
                    pickerAppearance: 'dayOnly',
                },
            },
        },
        {
            name: 'isBestBuy',
            type: 'checkbox',
            defaultValue: false,
            label: 'Is Best Buy',
        },
        {
            name: 'isRecommended',
            type: 'checkbox',
            defaultValue: false,
            label: 'Is Recommended',
        },
    ],
}
