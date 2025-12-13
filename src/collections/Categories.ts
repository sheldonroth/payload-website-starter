import type { CollectionConfig } from 'payload'

import { anyone } from '../access/anyone'
import { authenticated } from '../access/authenticated'
import { slugField } from 'payload'

export const Categories: CollectionConfig = {
  slug: 'categories',
  access: {
    create: authenticated,
    delete: authenticated,
    read: anyone,
    update: authenticated,
  },
  admin: {
    useAsTitle: 'title',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    slugField({
      position: undefined,
    }),
    {
      name: 'icon',
      type: 'text',
      admin: {
        description: 'Emoji icon for the category (e.g., 📱)',
      },
    },
    {
      name: 'imageUrl',
      type: 'text',
      admin: {
        description: 'URL to the category image',
      },
    },
    {
      name: 'productCount',
      type: 'number',
      defaultValue: 0,
      admin: {
        description: 'Number of products in this category (auto-updated)',
      },
    },
  ],
}
