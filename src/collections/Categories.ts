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
      unique: true,
      index: true,
      admin: {
        hidden: true, // Auto-generated, no need to show
      },
      hooks: {
        beforeValidate: [
          ({ value, data }) => {
            if (value) return value;
            // Auto-generate from name
            const name = data?.name || '';
            return name
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/(^-|-$)/g, '') || `category-${Date.now()}`;
          },
        ],
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
      type: 'select',
      label: 'Category Icon',
      defaultValue: 'search',
      options: [
        { label: '💊 Pill (Supplements)', value: 'pill' },
        { label: '🍎 Apple (Food)', value: 'apple' },
        { label: '👶 Baby (Baby & Kids)', value: 'baby' },
        { label: '💧 Droplets (Water)', value: 'droplets' },
        { label: '✨ Sparkles (Cosmetics)', value: 'sparkles' },
        { label: '🐾 Paw Print (Pet Food)', value: 'pawprint' },
        { label: '🏠 Home (Household)', value: 'home' },
        { label: '🧴 Spray Can (Personal Care)', value: 'spraycan' },
        { label: '🔬 Microscope (Lab/Science)', value: 'microscope' },
        { label: '❤️ Heart (Health)', value: 'heart' },
        { label: '🌿 Leaf (Organic/Natural)', value: 'leaf' },
        { label: '☀️ Sun (Skincare/SPF)', value: 'sun' },
        { label: '💪 Dumbbell (Fitness)', value: 'dumbbell' },
        { label: '🧠 Brain (Mental Health)', value: 'brain' },
        { label: '🔍 Search (Default)', value: 'search' },
      ],
      admin: {
        description: 'Auto-selected based on category name. You can override if needed.',
      },
      hooks: {
        beforeValidate: [
          ({ value, data }) => {
            // If icon already set and not default, keep it
            if (value && value !== 'search') return value;

            // Auto-select icon based on category name
            const name = (data?.name || '').toLowerCase();

            // Keyword to icon mapping
            const iconKeywords: Record<string, string[]> = {
              'pill': ['supplement', 'vitamin', 'mineral', 'probiotic', 'capsule', 'tablet'],
              'apple': ['food', 'grocery', 'snack', 'meal', 'nutrition', 'diet', 'eating'],
              'baby': ['baby', 'kid', 'child', 'infant', 'toddler', 'children', 'nursery'],
              'droplets': ['water', 'beverage', 'drink', 'hydration', 'liquid', 'juice'],
              'sparkles': ['cosmetic', 'beauty', 'makeup', 'lipstick', 'foundation', 'mascara'],
              'pawprint': ['pet', 'dog', 'cat', 'animal', 'veterinary'],
              'home': ['home', 'house', 'cleaning', 'household', 'laundry', 'kitchen'],
              'spraycan': ['personal care', 'hygiene', 'deodorant', 'soap', 'shampoo', 'body'],
              'heart': ['health', 'wellness', 'medical', 'cardio', 'heart'],
              'leaf': ['organic', 'natural', 'vegan', 'plant', 'herbal', 'eco', 'green'],
              'sun': ['skin', 'sunscreen', 'spf', 'uv', 'tanning', 'sun'],
              'dumbbell': ['fitness', 'workout', 'protein', 'gym', 'sport', 'exercise', 'muscle'],
              'brain': ['mental', 'brain', 'cognitive', 'nootropic', 'focus', 'memory', 'sleep'],
              'microscope': ['lab', 'test', 'science', 'research'],
            };

            // Find best matching icon
            for (const [icon, keywords] of Object.entries(iconKeywords)) {
              if (keywords.some(keyword => name.includes(keyword))) {
                return icon;
              }
            }

            return 'search'; // Default fallback
          },
        ],
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
