import type { CollectionConfig } from 'payload'

/**
 * TrendingNews Collection
 *
 * Stores news articles matched to brands by the Trending Engine.
 * Used to show why a brand is trending and provide context.
 */
export const TrendingNews: CollectionConfig = {
    slug: 'trending-news',
    access: {
        read: () => true,
        create: ({ req }) => !!req.user,
        update: ({ req }) => !!req.user,
        delete: ({ req }) => !!req.user,
    },
    admin: {
        useAsTitle: 'title',
        defaultColumns: ['title', 'brand', 'sentiment', 'publishedAt', 'createdAt'],
        group: 'Research',
        description: 'News articles matched to brands by the Trending Engine',
    },
    fields: [
        {
            name: 'brand',
            type: 'relationship',
            relationTo: 'brands',
            required: true,
            index: true,
        },
        {
            name: 'title',
            type: 'text',
            required: true,
        },
        {
            name: 'source',
            type: 'text',
            admin: {
                description: 'News source (e.g., CNN, Reuters)',
            },
        },
        {
            name: 'url',
            type: 'text',
            admin: {
                description: 'Link to original article',
            },
        },
        {
            name: 'publishedAt',
            type: 'date',
            admin: {
                date: {
                    displayFormat: 'MMM d, yyyy',
                },
            },
        },
        {
            name: 'sentiment',
            type: 'select',
            options: [
                { label: 'Positive', value: 'positive' },
                { label: 'Negative', value: 'negative' },
                { label: 'Neutral', value: 'neutral' },
            ],
        },
        {
            name: 'relevanceScore',
            type: 'number',
            min: 0,
            max: 1,
            admin: {
                description: '0-1 score of how relevant this article is to the brand',
            },
        },
        {
            name: 'matchedTerms',
            type: 'text',
            admin: {
                description: 'Which brand name/alias matched',
            },
        },
    ],
    timestamps: true,
}
