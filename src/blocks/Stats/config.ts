import type { Block } from 'payload'

export const Stats: Block = {
    slug: 'stats',
    interfaceName: 'StatsBlock',
    labels: {
        singular: 'Stats',
        plural: 'Stats Blocks',
    },
    fields: [
        {
            name: 'heading',
            type: 'text',
            label: 'Section Heading',
            defaultValue: 'Our Impact',
        },
        {
            name: 'stats',
            type: 'array',
            label: 'Statistics',
            minRows: 1,
            maxRows: 6,
            fields: [
                {
                    name: 'label',
                    type: 'text',
                    required: true,
                    label: 'Stat Label',
                },
                {
                    name: 'valueType',
                    type: 'select',
                    defaultValue: 'manual',
                    options: [
                        { label: 'Manual Value', value: 'manual' },
                        { label: 'Products Count', value: 'products' },
                        { label: 'Users Count', value: 'users' },
                        { label: 'Categories Count', value: 'categories' },
                        { label: 'Videos Count', value: 'videos' },
                        { label: 'Brands Count', value: 'brands' },
                    ],
                },
                {
                    name: 'manualValue',
                    type: 'text',
                    label: 'Manual Value',
                    admin: {
                        condition: (_, siblingData) => siblingData?.valueType === 'manual',
                    },
                },
                {
                    name: 'suffix',
                    type: 'text',
                    label: 'Suffix',
                },
                {
                    name: 'icon',
                    type: 'select',
                    label: 'Icon',
                    options: [
                        { label: 'Flask (Lab)', value: 'flask' },
                        { label: 'Users', value: 'users' },
                        { label: 'Shield', value: 'shield' },
                        { label: 'Check', value: 'check' },
                        { label: 'Star', value: 'star' },
                        { label: 'Chart', value: 'chart' },
                    ],
                },
            ],
        },
        {
            name: 'backgroundColor',
            type: 'select',
            defaultValue: 'default',
            options: [
                { label: 'Default', value: 'default' },
                { label: 'Dark', value: 'dark' },
                { label: 'Primary', value: 'primary' },
            ],
        },
    ],
}
