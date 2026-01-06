/**
 * BountyCategories Collection
 *
 * Admin-managed category boosts for the Scout Program.
 * When we want to focus testing on specific product categories,
 * we can boost their priority with multipliers.
 *
 * "This Month's Focus: We're testing shampoos."
 */

import type { CollectionConfig } from 'payload'

export const BountyCategories: CollectionConfig = {
    slug: 'bounty-categories',
    labels: {
        singular: 'Bounty Category',
        plural: 'Bounty Categories',
    },
    admin: {
        group: 'Scout Program',
        useAsTitle: 'category',
        description: 'Category boosts - products in these categories get priority in the testing queue',
        defaultColumns: ['category', 'multiplier', 'isActive', 'startsAt', 'endsAt'],
    },
    access: {
        read: () => true, // Mobile app can read active bounties
        create: ({ req }) => !!req.user,
        update: ({ req }) => !!req.user,
        delete: ({ req }) => !!req.user,
    },
    fields: [
        {
            name: 'category',
            type: 'text',
            required: true,
            admin: {
                description: 'Category name (e.g., "Shampoo", "Protein Powder", "Baby Food")',
            },
        },
        {
            name: 'headline',
            type: 'text',
            admin: {
                description: 'Headline for the bounty board (e.g., "We\'re testing shampoos this month")',
            },
        },
        {
            name: 'description',
            type: 'textarea',
            admin: {
                description: 'Optional longer description for the bounty',
            },
        },
        {
            name: 'keywords',
            type: 'array',
            admin: {
                description: 'Keywords that trigger this bounty (matched against product name/category)',
            },
            fields: [
                {
                    name: 'keyword',
                    type: 'text',
                    required: true,
                },
            ],
        },
        {
            name: 'multiplier',
            type: 'number',
            required: true,
            defaultValue: 2,
            min: 1,
            max: 10,
            admin: {
                description: 'Priority multiplier (1-10x). Products matching this category get votes multiplied by this amount.',
            },
        },
        {
            name: 'icon',
            type: 'text',
            admin: {
                description: 'Emoji icon for the category (e.g., 🧴, 💊, 🍼)',
            },
        },
        {
            name: 'isActive',
            type: 'checkbox',
            defaultValue: true,
            admin: {
                description: 'Whether this bounty is currently active',
                position: 'sidebar',
            },
        },
        {
            name: 'startsAt',
            type: 'date',
            admin: {
                description: 'When this bounty starts (optional, defaults to immediately)',
                position: 'sidebar',
            },
        },
        {
            name: 'endsAt',
            type: 'date',
            admin: {
                description: 'When this bounty ends (optional, runs indefinitely if not set)',
                position: 'sidebar',
            },
        },
        // Stats
        {
            name: 'totalScansThisWeek',
            type: 'number',
            defaultValue: 0,
            admin: {
                description: 'Number of scans in this category this week',
                readOnly: true,
                position: 'sidebar',
            },
        },
        {
            name: 'totalContributors',
            type: 'number',
            defaultValue: 0,
            admin: {
                description: 'Number of unique scouts who contributed to this category',
                readOnly: true,
                position: 'sidebar',
            },
        },
    ],
    timestamps: true,
}
