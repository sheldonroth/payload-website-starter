import type { CollectionConfig } from 'payload'

export const Categories: CollectionConfig = {
  slug: 'categories',
  access: {
    read: () => true,
  },
  admin: {
    useAsTitle: 'name',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      label: 'Category Name',
    },
    {
      name: 'icon',
      type: 'text',
      label: 'Icon Name',
      admin: {
        description: 'Ionicons icon name (e.g., "water-outline")',
      },
    },
    {
      name: 'productCount',
      type: 'number',
      defaultValue: 0,
      label: 'Number of Products',
    },
    {
      name: 'imageUrl',
      type: 'text',
      label: 'Image URL',
    },
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
      label: 'Category Image',
    },
  ],
}
