import type { GlobalConfig } from 'payload'
import { isAdmin } from '../access/roleAccess'

export const SiteSettings: GlobalConfig = {
    slug: 'site-settings',
    access: {
        read: () => true,
        update: isAdmin,
    },
    admin: {
        group: 'Settings',
    },
    fields: [
        // === FEATURED PRODUCT ===
        {
            name: 'featuredProduct',
            type: 'relationship',
            relationTo: 'products',
            label: 'Featured Product',
            admin: {
                description: 'Select one product to feature prominently in the app',
            },
        },
        {
            name: 'featuredProductHeadline',
            type: 'text',
            label: 'Featured Product Headline',
            defaultValue: 'Featured Finding',
            admin: {
                description: 'Headline shown above the featured product (e.g., "Featured Finding", "Editor\'s Pick")',
            },
        },
        // === AFFILIATE SETTINGS ===
        {
            name: 'affiliateSettings',
            type: 'group',
            label: 'Affiliate Settings',
            fields: [
                {
                    name: 'amazonAffiliateTag',
                    type: 'text',
                    label: 'Amazon Affiliate Tag',
                    admin: {
                        description: 'Your Amazon Associates tag (e.g., "yoursite-20"). Used to generate affiliate links.',
                    },
                },
                {
                    name: 'affiliateDisclosure',
                    type: 'textarea',
                    label: 'Affiliate Disclosure Text',
                    defaultValue: 'As an Amazon Associate we earn from qualifying purchases.',
                    admin: {
                        description: 'Disclosure text shown near affiliate links',
                    },
                },
                {
                    name: 'enableAffiliateLinks',
                    type: 'checkbox',
                    label: 'Enable Affiliate Links',
                    defaultValue: true,
                    admin: {
                        description: 'Show affiliate links on product pages',
                    },
                },
            ],
        },
        // === SITE INFO ===
        {
            name: 'siteInfo',
            type: 'group',
            label: 'Site Information',
            fields: [
                {
                    name: 'siteName',
                    type: 'text',
                    label: 'Site Name',
                    defaultValue: 'The Product Report',
                },
                {
                    name: 'siteDescription',
                    type: 'textarea',
                    label: 'Site Description',
                    defaultValue: 'Ingredient analysis and product reviews you can trust.',
                },
            ],
        },
    ],
}
