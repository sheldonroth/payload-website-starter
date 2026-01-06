/**
 * Email Sends Collection
 * 
 * Tracks all sent emails for analytics and A/B test results.
 */

import { CollectionConfig } from 'payload';

export const EmailSends: CollectionConfig = {
    slug: 'email-sends',
    labels: {
        singular: 'Email Send',
        plural: 'Email Sends',
    },
    admin: {
        useAsTitle: 'subject',
        defaultColumns: ['recipient', 'subject', 'status', 'abVariant', 'sentAt'],
        group: 'Growth',
        description: 'Log of all sent emails with open/click tracking',
    },
    access: {
        read: ({ req: { user } }) => !!user,
        create: () => true, // System creates these
        update: () => true, // Webhooks update these
        delete: ({ req: { user } }) => !!user,
    },
    fields: [
        {
            name: 'template',
            type: 'relationship',
            relationTo: 'email-templates' as any,
            required: true,
        },
        {
            name: 'recipient',
            type: 'email',
            required: true,
            index: true,
        },
        {
            name: 'subject',
            type: 'text',
            required: true,
        },
        {
            name: 'abVariant',
            type: 'select',
            options: [
                { label: 'A (Control)', value: 'A' },
                { label: 'B (Variant)', value: 'B' },
            ],
            defaultValue: 'A',
        },
        {
            name: 'messageId',
            type: 'text',
            admin: {
                description: 'Resend message ID for tracking',
            },
            index: true,
        },
        {
            name: 'sentAt',
            type: 'date',
            required: true,
            admin: {
                date: {
                    pickerAppearance: 'dayAndTime',
                },
            },
        },
        {
            name: 'status',
            type: 'select',
            options: [
                { label: '📤 Sent', value: 'sent' },
                { label: '📬 Delivered', value: 'delivered' },
                { label: '👁️ Opened', value: 'opened' },
                { label: '👆 Clicked', value: 'clicked' },
                { label: '🔄 Bounced', value: 'bounced' },
                { label: '⚠️ Complained', value: 'complained' },
            ],
            defaultValue: 'sent',
        },
        {
            name: 'openedAt',
            type: 'date',
            admin: {
                date: {
                    pickerAppearance: 'dayAndTime',
                },
            },
        },
        {
            name: 'clickedAt',
            type: 'date',
            admin: {
                date: {
                    pickerAppearance: 'dayAndTime',
                },
            },
        },
        {
            name: 'clickedUrl',
            type: 'text',
        },
    ],
    timestamps: true,
};

export default EmailSends;
