/**
 * Daily Discovery Collection
 * 
 * One shocking product reveal per day - same for all users.
 * Content rotates: exposed brands, hidden champions, ingredient deep dives.
 */

import { CollectionConfig } from 'payload';

export const DailyDiscoveries: CollectionConfig = {
    slug: 'daily-discoveries',
    labels: {
        singular: 'Daily Discovery',
        plural: 'Daily Discoveries',
    },
    admin: {
        useAsTitle: 'title',
        defaultColumns: ['title', 'publishDate', 'discoveryType', 'status'],
        group: 'Engagement',
        description: 'One product reveal per day for all users',
    },
    access: {
        read: () => true,
        create: ({ req: { user } }) => !!user,
        update: ({ req: { user } }) => !!user,
        delete: ({ req: { user } }) => !!user,
    },
    fields: [
        {
            name: 'title',
            type: 'text',
            required: true,
            admin: {
                description: 'Catchy title for the discovery',
                placeholder: 'A "clean" brand exposed',
            },
        },
        {
            name: 'discoveryType',
            type: 'select',
            required: true,
            options: [
                { label: '🔍 Brand Exposed', value: 'brand_exposed' },
                { label: '🌟 Hidden Champion', value: 'hidden_champion' },
                { label: '🧪 Ingredient Spotlight', value: 'ingredient_spotlight' },
                { label: '🏷️ Label Detective', value: 'label_detective' },
                { label: '🔄 Swap of the Day', value: 'swap' },
            ],
            defaultValue: 'brand_exposed',
        },
        {
            name: 'product',
            type: 'relationship',
            relationTo: 'products',
            required: true,
            admin: {
                description: 'The featured product',
            },
        },
        {
            name: 'headline',
            type: 'text',
            required: true,
            admin: {
                description: 'The shocking headline',
                placeholder: 'We found 23 hidden ingredients in their "simple" formula',
            },
        },
        {
            name: 'insight',
            type: 'textarea',
            required: true,
            admin: {
                description: 'The key insight or revelation (2-3 sentences)',
            },
        },
        {
            name: 'alternativeProduct',
            type: 'relationship',
            relationTo: 'products',
            admin: {
                description: 'A cleaner alternative (for swaps)',
                condition: (data) => data.discoveryType === 'swap',
            },
        },
        {
            name: 'publishDate',
            type: 'date',
            required: true,
            admin: {
                description: 'When this discovery goes live (9 AM on this date)',
                date: {
                    displayFormat: 'MMM d, yyyy',
                },
            },
        },
        {
            name: 'expiresAt',
            type: 'date',
            admin: {
                description: 'Auto-calculated: 24 hours after publish',
                readOnly: true,
            },
            hooks: {
                beforeChange: [
                    ({ siblingData }) => {
                        if (siblingData.publishDate) {
                            const expiry = new Date(siblingData.publishDate);
                            expiry.setHours(expiry.getHours() + 24);
                            return expiry.toISOString();
                        }
                        return undefined;
                    },
                ],
            },
        },
        {
            name: 'status',
            type: 'select',
            options: [
                { label: 'Draft', value: 'draft' },
                { label: 'Scheduled', value: 'scheduled' },
                { label: 'Live', value: 'live' },
                { label: 'Expired', value: 'expired' },
            ],
            defaultValue: 'draft',
            admin: {
                position: 'sidebar',
            },
        },
        {
            name: 'shareCard',
            type: 'group',
            admin: {
                description: 'Shareable card customization',
            },
            fields: [
                {
                    name: 'backgroundColor',
                    type: 'text',
                    defaultValue: '#D64942',
                    admin: {
                        description: 'Hex color for share card',
                    },
                },
                {
                    name: 'emoji',
                    type: 'text',
                    defaultValue: '🔍',
                },
            ],
        },
        {
            name: 'stats',
            type: 'group',
            admin: {
                description: 'Engagement metrics (auto-updated)',
                readOnly: true,
            },
            fields: [
                {
                    name: 'views',
                    type: 'number',
                    defaultValue: 0,
                },
                {
                    name: 'shares',
                    type: 'number',
                    defaultValue: 0,
                },
                {
                    name: 'productDetailClicks',
                    type: 'number',
                    defaultValue: 0,
                },
            ],
        },
    ],
    timestamps: true,
};

export default DailyDiscoveries;
