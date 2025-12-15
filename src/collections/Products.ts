import type { CollectionConfig } from 'payload'

import { anyone } from '../access/anyone'
import { authenticated } from '../access/authenticated'

export const Products: CollectionConfig = {
    slug: 'products',
    access: {
        create: authenticated,
        delete: authenticated,
        read: anyone,
        update: authenticated,
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
        },
        {
            name: 'brand',
            type: 'text',
            required: true,
        },
        {
            name: 'category',
            type: 'text',
            required: true,
            admin: {
                description: 'Category slug (e.g., "smartphones", "laptops")',
            },
        },
        {
            name: 'imageUrl',
            type: 'text',
            admin: {
                description: 'URL to the product image',
            },
        },
        {
            name: 'overallScore',
            type: 'number',
            min: 0,
            max: 100,
            admin: {
                description: 'Overall score from 0-100',
            },
        },
        {
            name: 'priceRange',
            type: 'text',
            admin: {
                description: 'e.g., "$999 - $1,299"',
            },
        },
        {
            name: 'ratings',
            type: 'group',
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
        },
        {
            name: 'reviewDate',
            type: 'date',
        },
        {
            name: 'isBestBuy',
            type: 'checkbox',
            defaultValue: false,
        },
        {
            name: 'isRecommended',
            type: 'checkbox',
            defaultValue: false,
        },
    ],
}
