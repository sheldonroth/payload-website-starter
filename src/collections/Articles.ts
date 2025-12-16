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
        defaultColumns: ['title', 'category', 'status', 'publishedAt'],
        group: 'Content',
    },
    fields: [
        {
            name: 'title',
            type: 'text',
            required: true,
        },
        {
            name: 'slug',
            type: 'text',
            required: true,
            unique: true,
            admin: {
                description: 'URL-friendly slug (e.g., "best-headphones-2024")',
            },
        },
        {
            name: 'excerpt',
            type: 'textarea',
            required: true,
            admin: {
                description: 'Short summary shown in article cards (150-200 chars)',
            },
        },
        {
            name: 'content',
            type: 'richText',
            required: true,
        },

        // === IMAGES ===
        {
            name: 'imageUrl',
            type: 'text',
            admin: {
                description: 'URL to external cover image',
            },
        },
        {
            name: 'image',
            type: 'upload',
            relationTo: 'media',
            label: 'Cover Image',
        },

        // === CATEGORIZATION ===
        {
            name: 'category',
            type: 'select',
            required: true,
            options: [
                { label: '📚 Buying Guide', value: 'buying-guide' },
                { label: '🔍 Investigation', value: 'investigation' },
                { label: '💰 Deals', value: 'deals' },
                { label: '🎬 Behind the Scenes', value: 'behind-the-scenes' },
                { label: '🏥 Health', value: 'health' },
                { label: '📰 News', value: 'news' },
                { label: '⚖️ Comparison', value: 'comparison' },
            ],
            admin: {
                position: 'sidebar',
            },
        },
        {
            name: 'tags',
            type: 'array',
            label: 'Tags',
            fields: [
                {
                    name: 'tag',
                    type: 'text',
                    required: true,
                },
            ],
        },

        // === RELATED PRODUCTS ===
        {
            name: 'relatedProducts',
            type: 'relationship',
            relationTo: 'products',
            hasMany: true,
            label: 'Featured Products',
            admin: {
                description: 'Products mentioned in this article',
            },
        },

        // === AUTHOR & DATES ===
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
                position: 'sidebar',
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
                position: 'sidebar',
            },
        },

        // === STATUS ===
        {
            name: 'status',
            type: 'select',
            options: [
                { label: '📝 Draft', value: 'draft' },
                { label: '👀 In Review', value: 'review' },
                { label: '✅ Published', value: 'published' },
            ],
            defaultValue: 'draft',
            admin: {
                position: 'sidebar',
            },
        },
        {
            name: 'featured',
            type: 'checkbox',
            label: 'Featured Article',
            defaultValue: false,
            admin: {
                description: 'Show on homepage',
                position: 'sidebar',
            },
        },
    ],
}
