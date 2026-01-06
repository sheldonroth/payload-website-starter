/**
 * Generated Content Collection
 * 
 * CMS collection for AI-generated content that needs approval:
 * - Listicles
 * - TikTok/Shorts scripts
 * - Comparison snippets
 * - Controversy articles
 * - Quizzes
 * 
 * All content goes through approval workflow before publishing.
 */

import { CollectionConfig } from 'payload';

export const GeneratedContent: CollectionConfig = {
    slug: 'generated-content',
    labels: {
        singular: 'Generated Content',
        plural: 'Generated Content',
    },
    admin: {
        useAsTitle: 'title',
        defaultColumns: ['title', 'contentType', 'status', 'legalReviewed', 'createdAt'],
        group: 'Catalog',
        description: 'AI-generated content awaiting your approval',
        listSearchableFields: ['title', 'contentType', 'status'],
    },
    access: {
        read: () => true,
        create: ({ req: { user } }) => !!user,
        update: ({ req: { user } }) => !!user,
        delete: ({ req: { user } }) => !!user,
    },
    fields: [
        // Core fields
        {
            name: 'title',
            type: 'text',
            required: true,
            admin: {
                description: 'Content title/headline',
            },
        },
        {
            name: 'contentType',
            type: 'select',
            required: true,
            options: [
                { label: '📝 Listicle', value: 'listicle' },
                { label: '🎬 TikTok/Shorts Script', value: 'tiktok_script' },
                { label: '⚖️ Comparison', value: 'comparison' },
                { label: '⚠️ Controversy Article', value: 'controversy' },
                { label: '❓ Quiz', value: 'quiz' },
                { label: '📄 Product Review Page', value: 'product_review' },
            ],
            admin: {
                position: 'sidebar',
            },
        },
        {
            name: 'status',
            type: 'select',
            required: true,
            defaultValue: 'draft',
            options: [
                { label: '📋 Draft', value: 'draft' },
                { label: '⏳ Pending Review', value: 'pending_review' },
                { label: '✅ Approved', value: 'approved' },
                { label: '📅 Scheduled', value: 'scheduled' },
                { label: '🚀 Published', value: 'published' },
                { label: '❌ Rejected', value: 'rejected' },
            ],
            admin: {
                position: 'sidebar',
            },
        },

        // Content body
        {
            name: 'content',
            type: 'richText',
            required: true,
            admin: {
                description: 'The generated content (editable before approval)',
            },
        },

        // For TikTok scripts
        {
            name: 'script',
            type: 'group',
            admin: {
                condition: (data) => data.contentType === 'tiktok_script',
            },
            fields: [
                {
                    name: 'hook',
                    type: 'textarea',
                    admin: {
                        description: 'First 0-3 seconds - the attention grabber',
                    },
                },
                {
                    name: 'build',
                    type: 'textarea',
                    admin: {
                        description: 'Build tension/context',
                    },
                },
                {
                    name: 'reveal',
                    type: 'textarea',
                    admin: {
                        description: 'The payoff/reveal',
                    },
                },
                {
                    name: 'cta',
                    type: 'textarea',
                    admin: {
                        description: 'Call to action',
                    },
                },
                {
                    name: 'estimatedDuration',
                    type: 'select',
                    options: [
                        { label: '15 seconds', value: '15' },
                        { label: '30 seconds', value: '30' },
                        { label: '45 seconds', value: '45' },
                        { label: '60 seconds', value: '60' },
                    ],
                },
                {
                    name: 'platform',
                    type: 'select',
                    hasMany: true,
                    options: [
                        { label: 'TikTok', value: 'tiktok' },
                        { label: 'Instagram Reels', value: 'reels' },
                        { label: 'YouTube Shorts', value: 'shorts' },
                    ],
                },
            ],
        },

        // For listicles
        {
            name: 'listicleItems',
            type: 'array',
            admin: {
                condition: (data) => data.contentType === 'listicle',
            },
            fields: [
                {
                    name: 'rank',
                    type: 'number',
                },
                {
                    name: 'product',
                    type: 'relationship',
                    relationTo: 'products',
                },
                {
                    name: 'heading',
                    type: 'text',
                },
                {
                    name: 'description',
                    type: 'textarea',
                },
                {
                    name: 'verdict',
                    type: 'select',
                    options: [
                        { label: '✅ Recommended', value: 'recommended' },
                        { label: '❌ Avoid', value: 'avoid' },
                    ],
                },
            ],
        },

        // For comparisons
        {
            name: 'comparison',
            type: 'group',
            admin: {
                condition: (data) => data.contentType === 'comparison',
            },
            fields: [
                {
                    name: 'productA',
                    type: 'relationship',
                    relationTo: 'products',
                },
                {
                    name: 'productB',
                    type: 'relationship',
                    relationTo: 'products',
                },
                {
                    name: 'verdict',
                    type: 'select',
                    options: [
                        { label: 'Product A Recommended', value: 'a_recommended' },
                        { label: 'Product B Recommended', value: 'b_recommended' },
                        { label: 'Both Recommended', value: 'both_recommended' },
                        { label: 'Neither Recommended', value: 'neither_recommended' },
                    ],
                },
                {
                    name: 'keyDifferences',
                    type: 'array',
                    fields: [
                        { name: 'factor', type: 'text' },
                        { name: 'productAValue', type: 'text' },
                        { name: 'productBValue', type: 'text' },
                    ],
                },
            ],
        },

        // Related products
        {
            name: 'relatedProducts',
            type: 'relationship',
            relationTo: 'products',
            hasMany: true,
            admin: {
                description: 'Products featured in this content',
            },
        },

        // Category
        {
            name: 'category',
            type: 'relationship',
            relationTo: 'categories',
            admin: {
                description: 'Category this content belongs to',
            },
        },

        // SEO
        {
            name: 'seo',
            type: 'group',
            fields: [
                {
                    name: 'metaTitle',
                    type: 'text',
                },
                {
                    name: 'metaDescription',
                    type: 'textarea',
                },
                {
                    name: 'targetKeywords',
                    type: 'array',
                    fields: [
                        { name: 'keyword', type: 'text' },
                    ],
                },
            ],
        },

        // Legal review section
        {
            type: 'collapsible',
            label: '⚖️ Legal Review',
            admin: {
                initCollapsed: false,
            },
            fields: [
                {
                    name: 'legalReviewed',
                    type: 'checkbox',
                    defaultValue: false,
                    admin: {
                        description: 'Check this after reviewing for legal compliance',
                    },
                },
                {
                    name: 'legalNotes',
                    type: 'textarea',
                    admin: {
                        description: 'Notes about legal considerations',
                    },
                },
                {
                    name: 'legalFlags',
                    type: 'select',
                    hasMany: true,
                    options: [
                        { label: '⚠️ Health Claims', value: 'health_claims' },
                        { label: '⚠️ Brand Controversy', value: 'brand_controversy' },
                        { label: '⚠️ Comparative Claims', value: 'comparative_claims' },
                        { label: '⚠️ Needs Citation', value: 'needs_citation' },
                        { label: '✅ Cleared', value: 'cleared' },
                    ],
                    admin: {
                        description: 'Flag any legal concerns',
                    },
                },
                {
                    name: 'brandNotified',
                    type: 'checkbox',
                    admin: {
                        description: 'Has the brand been notified (for controversy content)?',
                        condition: (data) => data.contentType === 'controversy',
                    },
                },
                {
                    name: 'brandResponseDeadline',
                    type: 'date',
                    admin: {
                        description: 'Deadline for brand response',
                        condition: (data) => data.contentType === 'controversy',
                    },
                },
            ],
        },

        // Publishing
        {
            name: 'scheduledPublishDate',
            type: 'date',
            admin: {
                description: 'When to publish (leave blank for manual)',
                date: {
                    pickerAppearance: 'dayAndTime',
                },
            },
        },
        {
            name: 'publishedUrl',
            type: 'text',
            admin: {
                description: 'URL after publishing',
                readOnly: true,
            },
        },

        // AI generation metadata
        {
            name: 'generationMetadata',
            type: 'group',
            admin: {
                description: 'How this content was generated',
                readOnly: true,
            },
            fields: [
                {
                    name: 'generatedAt',
                    type: 'date',
                },
                {
                    name: 'generatedBy',
                    type: 'text', // AI model name
                },
                {
                    name: 'trigger',
                    type: 'text', // What triggered generation
                },
                {
                    name: 'originalPrompt',
                    type: 'textarea',
                },
            ],
        },
    ],
    timestamps: true,
    hooks: {
        beforeChange: [
            ({ data, operation }) => {
                // Auto-set generation metadata on create
                if (operation === 'create' && !data.generationMetadata?.generatedAt) {
                    data.generationMetadata = {
                        ...data.generationMetadata,
                        generatedAt: new Date().toISOString(),
                    };
                }
                return data;
            },
        ],
    },
};

export default GeneratedContent;
