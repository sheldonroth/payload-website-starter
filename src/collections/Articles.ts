import type { CollectionConfig } from 'payload'

import { anyone } from '../access/anyone'
import { authenticated } from '../access/authenticated'

export const Articles: CollectionConfig = {
    slug: 'articles',
    access: {
        create: authenticated,
        delete: authenticated,
        read: anyone,
        update: authenticated,
    },
    admin: {
        useAsTitle: 'title',
        defaultColumns: ['title', 'category', 'author', 'publishedAt'],
    },
    fields: [
        {
            name: 'title',
            type: 'text',
            required: true,
        },
        {
            name: 'excerpt',
            type: 'textarea',
            required: true,
            admin: {
                description: 'Short summary shown in article cards',
            },
        },
        {
            name: 'content',
            type: 'richText',
            required: true,
        },
        {
            name: 'imageUrl',
            type: 'text',
            required: true,
            admin: {
                description: 'URL to the article cover image',
            },
        },
        {
            name: 'category',
            type: 'select',
            required: true,
            options: [
                { label: 'Buying Guide', value: 'Buying Guide' },
                { label: 'Investigation', value: 'Investigation' },
                { label: 'Deals', value: 'Deals' },
                { label: 'Behind the Scenes', value: 'Behind the Scenes' },
                { label: 'Health', value: 'Health' },
                { label: 'News', value: 'News' },
            ],
        },
        {
            name: 'author',
            type: 'text',
            required: true,
        },
        {
            name: 'publishedAt',
            type: 'date',
            required: true,
            admin: {
                date: {
                    pickerAppearance: 'dayAndTime',
                },
            },
        },
        {
            name: 'readTime',
            type: 'number',
            required: true,
            min: 1,
            admin: {
                description: 'Estimated reading time in minutes',
            },
        },
        {
            name: 'tags',
            type: 'array',
            fields: [
                {
                    name: 'tag',
                    type: 'text',
                    required: true,
                },
            ],
        },
    ],
}
