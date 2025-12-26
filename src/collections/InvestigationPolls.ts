import type { CollectionConfig } from 'payload'

export const InvestigationPolls: CollectionConfig = {
    slug: 'investigation-polls',
    access: {
        read: () => true,
        create: ({ req }) => !!req.user?.isAdmin,
        update: ({ req }) => !!req.user?.isAdmin,
        delete: ({ req }) => !!req.user?.isAdmin,
    },
    admin: {
        useAsTitle: 'title',
        defaultColumns: ['title', 'status', 'endDate', 'totalVotes'],
        group: 'Community',
    },
    fields: [
        {
            name: 'title',
            type: 'text',
            required: true,
            label: 'Poll Question',
            admin: {
                description: 'e.g., "What should we investigate next?"',
            },
        },
        {
            name: 'description',
            type: 'textarea',
            label: 'Description',
            admin: {
                description: 'Additional context for the poll',
            },
        },
        {
            name: 'status',
            type: 'select',
            required: true,
            defaultValue: 'active',
            options: [
                { label: 'Active', value: 'active' },
                { label: 'Closed', value: 'closed' },
            ],
            admin: {
                position: 'sidebar',
            },
        },
        {
            name: 'endDate',
            type: 'date',
            label: 'Voting Ends',
            admin: {
                position: 'sidebar',
                description: 'Leave empty for no end date',
            },
        },
        {
            name: 'options',
            type: 'array',
            required: true,
            minRows: 2,
            maxRows: 10,
            label: 'Vote Options',
            fields: [
                {
                    name: 'name',
                    type: 'text',
                    required: true,
                    label: 'Option Name',
                },
                {
                    name: 'description',
                    type: 'text',
                    label: 'Description',
                },
                {
                    name: 'votes',
                    type: 'number',
                    defaultValue: 0,
                    admin: {
                        readOnly: true,
                    },
                },
            ],
        },
        {
            name: 'voters',
            type: 'json',
            defaultValue: {},
            admin: {
                description: 'Map of userId -> optionIndex tracking who voted',
                readOnly: true,
            },
        },
        {
            name: 'totalVotes',
            type: 'number',
            defaultValue: 0,
            admin: {
                readOnly: true,
                position: 'sidebar',
            },
        },
    ],
}
