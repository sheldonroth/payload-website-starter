import type { CollectionConfig } from 'payload'

import { anyone } from '../access/anyone'
import { authenticated } from '../access/authenticated'

export const Categories: CollectionConfig = {
  slug: 'categories',
  access: {
    create: authenticated,
    delete: authenticated,
    read: anyone,
    update: authenticated,
  },
  admin: {
    useAsTitle: 'name',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'icon',
      type: 'text',
      admin: {
        description: 'Icon name for the category',
      },
    },
    {
      name: 'productCount',
      type: 'number',
      defaultValue: 0,
    },
    {
      name: 'imageUrl',
      type: 'text',
      admin: {
        description: 'URL to the category image',
      },
    },
  ],
}
