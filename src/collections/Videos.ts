import type { CollectionConfig } from 'payload'

export const Videos: CollectionConfig = {
    slug: 'videos',
    access: {
        read: () => true,
    },
    admin: {
        useAsTitle: 'title',
        defaultColumns: ['title', 'youtubeVideoId', 'category', 'status', 'sortOrder'],
        group: 'Content',
    },
    fields: [
        {
            name: 'title',
            type: 'text',
            required: true,
            label: 'Video Title',
        },
        {
            name: 'youtubeVideoId',
            type: 'text',
            required: true,
            label: 'YouTube Video ID',
            admin: {
                description: 'The ID from the YouTube URL (e.g., "dQw4w9WgXcQ" from youtube.com/watch?v=dQw4w9WgXcQ)',
            },
        },
        {
            name: 'thumbnailUrl',
            type: 'text',
            label: 'Custom Thumbnail URL',
            admin: {
                description: 'Leave empty to auto-fetch from YouTube',
            },
        },
        {
            name: 'description',
            type: 'textarea',
            label: 'Description',
        },
        {
            name: 'duration',
            type: 'number',
            label: 'Duration (seconds)',
            admin: {
                description: 'Video duration in seconds',
            },
        },
        {
            name: 'category',
            type: 'relationship',
            relationTo: 'categories',
            hasMany: false,
            admin: {
                position: 'sidebar',
            },
        },
        {
            name: 'relatedProduct',
            type: 'relationship',
            relationTo: 'products',
            hasMany: false,
            label: 'Featured Product',
            admin: {
                description: 'Link to the product being reviewed in this video',
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
                },
            ],
        },
        {
            name: 'status',
            type: 'select',
            options: [
                { label: 'Draft', value: 'draft' },
                { label: 'Published', value: 'published' },
            ],
            defaultValue: 'draft',
            admin: {
                position: 'sidebar',
            },
        },
        {
            name: 'sortOrder',
            type: 'number',
            defaultValue: 0,
            admin: {
                position: 'sidebar',
                description: 'Lower numbers appear first',
            },
        },
        {
            name: 'viewCount',
            type: 'number',
            defaultValue: 0,
            admin: {
                position: 'sidebar',
                readOnly: true,
            },
        },
        {
            name: 'isFeatured',
            type: 'checkbox',
            label: 'Featured Video',
            defaultValue: false,
            admin: {
                position: 'sidebar',
            },
        },
        {
            name: 'isAutoImported',
            type: 'checkbox',
            label: 'Auto-Imported',
            defaultValue: false,
            admin: {
                position: 'sidebar',
                readOnly: true,
                description: 'Was this video imported from YouTube automatically?',
            },
        },
        {
            name: 'youtubeImportedAt',
            type: 'date',
            label: 'Last Imported',
            admin: {
                position: 'sidebar',
                readOnly: true,
                description: 'When this video was last synced from YouTube',
            },
        },
    ],
}
