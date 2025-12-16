import type { CollectionConfig } from 'payload'

export const Categories: CollectionConfig = {
  slug: 'categories',
  access: {
    read: () => true,
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'icon', 'parent', 'productCount'],
    group: 'Content',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      label: 'Category Name',
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      label: 'URL Slug',
      admin: {
        description: 'Used in URLs (e.g., "smartphones")',
      },
    },
    {
      name: 'description',
      type: 'textarea',
      label: 'Description',
      admin: {
        description: 'Brief description for SEO and category pages',
      },
    },
    {
      name: 'icon',
      type: 'text',
      label: 'Icon (Emoji or Name)',
      admin: {
        description: 'Use emoji (📱) or Ionicons name',
      },
    },
    {
      name: 'parent',
      type: 'relationship',
      relationTo: 'categories',
      label: 'Parent Category',
      admin: {
        description: 'Create sub-categories (e.g., Electronics > Smartphones)',
      },
    },
    {
      name: 'productCount',
      type: 'number',
      defaultValue: 0,
      label: 'Number of Products',
      admin: {
        readOnly: true,
        description: 'Auto-calculated',
      },
    },
    {
      name: 'imageUrl',
      type: 'text',
      label: 'Image URL (External)',
    },
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
      label: 'Category Image',
    },
    {
      name: 'featured',
      type: 'checkbox',
      label: 'Featured Category',
      defaultValue: false,
      admin: {
        description: 'Show on homepage',
        position: 'sidebar',
      },
    },
    {
      name: 'sortOrder',
      type: 'number',
      label: 'Sort Order',
      defaultValue: 0,
      admin: {
        description: 'Lower numbers appear first',
        position: 'sidebar',
      },
    },
  ],
}
