import type { CollectionConfig } from 'payload'

/**
 * Check if a YouTube video is a Short by testing the /shorts/ URL
 * Returns true if the video is a Short, false otherwise
 */
async function isYouTubeShort(videoId: string): Promise<boolean> {
    try {
        const response = await fetch(`https://www.youtube.com/shorts/${videoId}`, {
            method: 'HEAD',
            redirect: 'manual',
        })
        return response.status === 200
    } catch {
        return false
    }
}

export const Videos: CollectionConfig = {
    slug: 'videos',
    access: {
        read: () => true,
    },
    hooks: {
        beforeChange: [
            async ({ data, operation }) => {
                // Auto-detect videoType from YouTube if we have a video ID and it's not set
                if (data.youtubeVideoId && (!data.videoType || operation === 'create')) {
                    const isShort = await isYouTubeShort(data.youtubeVideoId)
                    data.videoType = isShort ? 'short' : 'longform'
                }
                // Default to longform for direct video URLs without YouTube ID
                if (!data.youtubeVideoId && data.videoUrl && !data.videoType) {
                    data.videoType = 'longform'
                }
                return data
            },
        ],
    },
    admin: {
        useAsTitle: 'title',
        defaultColumns: ['title', 'youtubeVideoId', 'videoUrl', 'videoType', 'category', 'status', 'sortOrder'],
        group: 'Catalog',
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
            label: 'YouTube Video ID',
            admin: {
                description: 'The ID from the YouTube URL (e.g., "dQw4w9WgXcQ" from youtube.com/watch?v=dQw4w9WgXcQ)',
            },
        },
        {
            name: 'videoUrl',
            type: 'text',
            label: 'Direct Video URL',
            admin: {
                description: 'Direct URL to a video file (MP4, WebM, etc.) hosted on a CDN or your own server',
            },
            validate: (value: string | null | undefined, { siblingData }: { siblingData: Record<string, unknown> }) => {
                // Require at least one of youtubeVideoId or videoUrl
                if (!value && !siblingData?.youtubeVideoId) {
                    return 'Either YouTube Video ID or Direct Video URL is required'
                }
                // Validate URL format if provided
                if (value) {
                    try {
                        new URL(value)
                    } catch {
                        return 'Please enter a valid URL'
                    }
                }
                return true
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
            name: 'videoType',
            type: 'select',
            label: 'Video Type',
            options: [
                { label: 'Short (Vertical, <60s)', value: 'short' },
                { label: 'Longform (Horizontal)', value: 'longform' },
            ],
            defaultValue: 'longform',
            admin: {
                position: 'sidebar',
                description: 'Shorts will appear in the mobile Browse tab',
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
        // ============================================
        // Transcript & Analysis (First Principles)
        // ============================================
        {
            name: 'transcript',
            type: 'textarea',
            label: 'Video Transcript',
            admin: {
                description: 'Stored transcript from YouTube captions (auto-populated on analysis)',
            },
        },
        {
            name: 'transcriptUpdatedAt',
            type: 'date',
            admin: {
                position: 'sidebar',
                readOnly: true,
                description: 'When transcript was last fetched',
            },
        },
        {
            name: 'analyzedAt',
            type: 'date',
            admin: {
                position: 'sidebar',
                readOnly: true,
                description: 'When AI last analyzed this video',
            },
        },
        {
            name: 'extractedProducts',
            type: 'relationship',
            relationTo: 'products',
            hasMany: true,
            label: 'Products Extracted',
            admin: {
                description: 'Products that were created from analyzing this video',
            },
        },
        {
            name: 'extractedIngredients',
            type: 'relationship',
            relationTo: 'ingredients',
            hasMany: true,
            label: 'Ingredients Mentioned',
            admin: {
                description: 'Ingredients discussed in this video',
            },
        },
    ],
}
