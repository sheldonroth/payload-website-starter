/**
 * Email Templates Collection
 * 
 * Manage all email templates for automated sequences:
 * - Week 1 Value Discovery
 * - Weekly Digest
 * - Win-Back
 * - FOMO Triggers (event-based)
 */

import { CollectionConfig } from 'payload';

export const EmailTemplates: CollectionConfig = {
    slug: 'email-templates',
    labels: {
        singular: 'Email Template',
        plural: 'Email Templates',
    },
    admin: {
        useAsTitle: 'subject',
        defaultColumns: ['subject', 'sequence', 'dayInSequence', 'status', 'updatedAt'],
        group: 'Email Marketing',
        description: 'Email templates for automated sequences',
        listSearchableFields: ['subject', 'sequence'],
    },
    access: {
        read: () => true,
        create: ({ req: { user } }) => !!user,
        update: ({ req: { user } }) => !!user,
        delete: ({ req: { user } }) => !!user,
    },
    fields: [
        // Sequence info
        {
            name: 'sequence',
            type: 'select',
            required: true,
            options: [
                { label: '📅 Week 1: Value Discovery', value: 'week1_value' },
                { label: '📬 Weekly Digest', value: 'weekly_digest' },
                { label: '💔 Win-Back', value: 'winback' },
                { label: '🔔 FOMO Trigger', value: 'fomo_trigger' },
                { label: '🎁 Year in Clean', value: 'year_in_clean' },
                { label: '🏅 Badge Unlock', value: 'badge_unlock' },
                { label: '📰 Product Update', value: 'product_update' },
            ],
            admin: {
                position: 'sidebar',
            },
        },
        {
            name: 'dayInSequence',
            type: 'number',
            admin: {
                description: 'For sequences: which day (0, 1, 3, 5, 7, etc.)',
                condition: (data) => ['week1_value', 'winback'].includes(data.sequence),
            },
        },
        {
            name: 'triggerEvent',
            type: 'select',
            options: [
                { label: 'Product Re-tested', value: 'product_retested' },
                { label: 'Brand Makes News', value: 'brand_news' },
                { label: 'New Category Tests', value: 'new_category_tests' },
                { label: 'Badge Unlocked', value: 'badge_unlocked' },
                { label: 'Year in Clean Ready', value: 'year_in_clean_ready' },
            ],
            admin: {
                description: 'What event triggers this email',
                condition: (data) => data.sequence === 'fomo_trigger',
            },
        },

        // Email content
        {
            name: 'subject',
            type: 'text',
            required: true,
            admin: {
                description: 'Email subject line (supports {{variables}})',
            },
        },
        {
            name: 'preheader',
            type: 'text',
            admin: {
                description: 'Preview text shown in inbox (optional)',
            },
        },
        {
            name: 'headline',
            type: 'text',
            admin: {
                description: 'Main headline in email body',
            },
        },
        {
            name: 'body',
            type: 'richText',
            required: true,
            admin: {
                description: 'Email body content',
            },
        },
        {
            name: 'ctaText',
            type: 'text',
            admin: {
                description: 'Call-to-action button text',
            },
        },
        {
            name: 'ctaUrl',
            type: 'text',
            admin: {
                description: 'CTA button destination URL',
            },
        },

        // Personalization
        {
            name: 'personalization',
            type: 'group',
            admin: {
                description: 'Available personalization variables',
            },
            fields: [
                {
                    name: 'availableVariables',
                    type: 'array',
                    admin: {
                        description: 'Variables you can use: {{variable_name}}',
                        readOnly: true,
                    },
                    fields: [
                        { name: 'variable', type: 'text' },
                        { name: 'description', type: 'text' },
                    ],
                },
            ],
        },

        // Status
        {
            name: 'status',
            type: 'select',
            defaultValue: 'draft',
            options: [
                { label: '📝 Draft', value: 'draft' },
                { label: '✅ Active', value: 'active' },
                { label: '⏸️ Paused', value: 'paused' },
            ],
            admin: {
                position: 'sidebar',
            },
        },

        // Stats (read-only, populated by email service)
        {
            name: 'stats',
            type: 'group',
            admin: {
                readOnly: true,
                description: 'Performance metrics',
            },
            fields: [
                { name: 'sent', type: 'number', defaultValue: 0 },
                { name: 'opened', type: 'number', defaultValue: 0 },
                { name: 'clicked', type: 'number', defaultValue: 0 },
                { name: 'openRate', type: 'text' },
                { name: 'clickRate', type: 'text' },
            ],
        },

        // Notes
        {
            name: 'internalNotes',
            type: 'textarea',
            admin: {
                description: 'Notes for yourself about this email',
            },
        },
    ],
    timestamps: true,
};

export default EmailTemplates;
