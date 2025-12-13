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
            type: 'relationship',
            relationTo: 'categories',
            required: true,
        },
        {
            name: 'imageUrl',
            type: 'text',
            required: true,
            admin: {
                description: 'URL to the product image',
            },
        },
        {
            name: 'overallScore',
            type: 'number',
            required: true,
            min: 0,
            max: 100,
            admin: {
                description: 'Overall score from 0-100',
            },
        },
        {
            name: 'priceRange',
            type: 'text',
            required: true,
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
                    defaultValue: 0,
                },
                {
                    name: 'reliability',
                    type: 'number',
                    min: 0,
                    max: 100,
                    defaultValue: 0,
                },
                {
                    name: 'valueForMoney',
                    type: 'number',
                    min: 0,
                    max: 100,
                    defaultValue: 0,
                },
                {
                    name: 'features',
                    type: 'number',
                    min: 0,
                    max: 100,
                    defaultValue: 0,
                },
            ],
        },
        {
            name: 'pros',
            type: 'array',
            fields: [
                {
                    name: 'item',
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
                    name: 'item',
                    type: 'text',
                    required: true,
                },
            ],
        },
        {
            name: 'summary',
            type: 'textarea',
            required: true,
        },
        {
            name: 'reviewDate',
            type: 'date',
            required: true,
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
