import type { CollectionConfig } from 'payload'
import { isEditorOrAdmin, isAdmin } from '../access/roleAccess'

export const Categories: CollectionConfig = {
  slug: 'categories',
  access: {
    read: () => true,
    create: isEditorOrAdmin, // Admins and product_editors can create
    update: isEditorOrAdmin, // Admins and product_editors can update
    delete: isAdmin, // Only admins can delete (product_editors cannot)
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'icon', 'parent', 'productCount', 'inheritedFromParent'],
    group: 'Catalog',
  },
  hooks: {
    beforeChange: [
      // ============================================
      // INHERIT HARMFUL INGREDIENTS FROM PARENT
      // Child categories automatically inherit parent's harmful ingredients
      // ============================================
      async ({ data, req, operation }) => {
        // Only inherit on create or when parent changes
        if ((operation === 'create' || data?.parent) && data?.parent) {
          try {
            const parentId = typeof data.parent === 'number' ? data.parent : data.parent?.id;
            if (!parentId) return data;

            const parent = await req.payload.findByID({
              collection: 'categories',
              id: parentId,
            });

            if (parent) {
              const parentData = parent as {
                harmfulIngredients?: Array<{ ingredient: string; reason?: string }>;
                qualityIndicators?: Array<{ indicator: string; description?: string }>;
              };

              // Inherit harmful ingredients if child has none
              if (parentData.harmfulIngredients?.length && !data.harmfulIngredients?.length) {
                data.harmfulIngredients = parentData.harmfulIngredients;
                data.inheritedFromParent = true;
              }

              // Inherit quality indicators if child has none
              if (parentData.qualityIndicators?.length && !data.qualityIndicators?.length) {
                data.qualityIndicators = parentData.qualityIndicators;
              }
            }
          } catch (error) {
            console.error('Failed to inherit from parent category:', error);
          }
        }
        return data;
      },
    ],
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
        description: 'Auto-generated from name. Leave empty to auto-create.',
      },
      hooks: {
        beforeChange: [
          ({ value, data }) => {
            // If slug is already set, use it (allows manual override)
            if (value && value.trim()) return value;
            // Auto-generate from name
            const name = data?.name || '';
            if (!name) return `category-${Date.now()}`;
            return name
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/(^-|-$)/g, '');
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
      type: 'text',
      label: 'Category Icon',
      defaultValue: 'search',
      admin: {
        description: 'Auto-selected based on category name. Override with any Lucide icon name',
        components: {
          Field: '@/components/IconPreviewField',
        },
      },
      hooks: {
        beforeValidate: [
          ({ value, data }) => {
            // If icon already set and not default, keep it
            if (value && value !== 'search') return value;

            // Auto-select icon based on category name
            const name = (data?.name || '').toLowerCase();

            // Keyword to icon mapping (using Lucide icon names)
            const iconKeywords: Record<string, string[]> = {
              'pill': ['supplement', 'vitamin', 'mineral', 'probiotic', 'capsule', 'tablet'],
              'apple': ['food', 'grocery', 'meal', 'nutrition', 'diet', 'eating', 'produce'],
              'baby': ['baby', 'kid', 'child', 'infant', 'toddler', 'children', 'nursery'],
              'droplets': ['water', 'hydration', 'liquid'],
              'sparkles': ['cosmetic', 'beauty', 'makeup', 'lipstick', 'foundation', 'mascara'],
              'paw-print': ['pet', 'dog', 'cat', 'animal', 'veterinary'],
              'home': ['home', 'house', 'cleaning', 'household', 'laundry', 'kitchen'],
              'spray-can': ['personal care', 'hygiene', 'deodorant', 'soap', 'shampoo', 'body'],
              'heart': ['health', 'wellness', 'medical', 'cardio', 'heart'],
              'leaf': ['organic', 'natural', 'vegan', 'plant', 'herbal', 'eco', 'green'],
              'sun': ['skin', 'sunscreen', 'spf', 'uv', 'tanning', 'sun'],
              'dumbbell': ['fitness', 'workout', 'protein', 'gym', 'sport', 'exercise', 'muscle'],
              'brain': ['mental', 'brain', 'cognitive', 'nootropic', 'focus', 'memory', 'sleep'],
              'microscope': ['lab', 'test', 'science', 'research'],
              'candy': ['chocolate', 'candy', 'sweet', 'confection', 'cocoa', 'dessert', 'sugar', 'bar', 'treat'],
              'cookie': ['snack', 'cookie', 'biscuit', 'cracker', 'baked', 'pastry', 'chip'],
              'coffee': ['coffee', 'tea', 'drink', 'juice', 'soda', 'energy drink'],
              'beef': ['meat', 'beef', 'steak', 'burger'],
              'milk': ['dairy', 'milk', 'cheese', 'yogurt'],
              'wine': ['alcohol', 'wine', 'beer', 'spirits', 'liquor'],
              'salad': ['salad', 'vegetable', 'greens'],
              'pizza': ['pizza', 'fast food'],
              'sandwich': ['sandwich', 'bread', 'deli'],
              'fish': ['fish', 'seafood', 'salmon', 'tuna'],
              'egg': ['egg', 'breakfast'],
              'ice-cream-cone': ['ice cream', 'frozen', 'gelato'],
              'popcorn': ['popcorn', 'movie snack'],
              'cherry': ['fruit', 'berry', 'berries'],
              'carrot': ['vegetable', 'veggie'],
              'wheat': ['grain', 'wheat', 'bread', 'flour', 'cereal'],
              'cup-soda': ['soda', 'soft drink', 'cola', 'sparkling'],
              'glass-water': ['water', 'beverage'],
              'beer': ['beer', 'ale', 'lager'],
              'martini': ['cocktail', 'martini', 'mixed drink'],
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
      index: true, // Added for query performance
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
    {
      name: 'inheritedFromParent',
      type: 'checkbox',
      label: 'Inherited from Parent',
      defaultValue: false,
      admin: {
        readOnly: true,
        position: 'sidebar',
        description: 'Harmful ingredients inherited from parent category',
      },
    },
    // ============================================
    // AI Suggestion Fields
    // ============================================
    {
      name: 'aiSuggested',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        position: 'sidebar',
        description: 'Created by AI from video analysis',
      },
    },
    {
      name: 'aiSource',
      type: 'text',
      admin: {
        position: 'sidebar',
        description: 'Video ID or source that suggested this category',
        condition: (data) => data?.aiSuggested,
      },
    },
    // ============================================
    // Category Enricher Research Fields
    // ============================================
    {
      name: 'harmfulIngredients',
      type: 'array',
      label: 'Harmful Ingredients to Avoid',
      admin: {
        description: 'Ingredients flagged in research videos',
      },
      fields: [
        {
          name: 'ingredient',
          type: 'text',
          required: true,
        },
        {
          name: 'reason',
          type: 'text',
          admin: {
            description: 'Why it should be avoided',
          },
        },
      ],
    },
    {
      name: 'qualityIndicators',
      type: 'array',
      label: 'Quality Indicators',
      admin: {
        description: 'What to look for in good products',
      },
      fields: [
        {
          name: 'indicator',
          type: 'text',
          required: true,
        },
        {
          name: 'description',
          type: 'text',
        },
      ],
    },
    {
      name: 'researchNotes',
      type: 'textarea',
      label: 'Research Notes',
      admin: {
        description: 'AI-extracted research findings from video transcripts',
      },
    },
    {
      name: 'lastEnrichedAt',
      type: 'date',
      admin: {
        position: 'sidebar',
        readOnly: true,
        description: 'When category was last enriched with research',
      },
    },
    // ============================================
    // Featured Product (Auto-Calculated)
    // ============================================
    {
      name: 'featuredProduct',
      type: 'relationship',
      relationTo: 'products',
      label: 'Featured Product',
      admin: {
        position: 'sidebar',
        description: 'Auto-calculated: Best product to showcase for this category',
        readOnly: true,
      },
    },
    {
      name: 'featuredProductImage',
      type: 'text',
      label: 'Featured Product Image URL',
      admin: {
        position: 'sidebar',
        description: 'Cached image URL of the featured product',
        readOnly: true,
      },
    },
    {
      name: 'featuredProductUpdatedAt',
      type: 'date',
      admin: {
        position: 'sidebar',
        readOnly: true,
        description: 'When featured product was last recalculated',
      },
    },
  ],
}
