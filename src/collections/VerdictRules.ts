import type { CollectionConfig } from 'payload'
import { isAdmin } from '../access/roleAccess'

/**
 * Verdict Rules Collection
 *
 * Defines automated rules for product verdicts based on ingredients.
 * When a rule matches, it can:
 * - Set autoVerdict on a product
 * - Flag products for review
 * - Block publishing
 */
export const VerdictRules: CollectionConfig = {
    slug: 'verdict-rules',
    access: {
        read: () => true,
        create: isAdmin,
        update: isAdmin,
        delete: isAdmin,
    },
    admin: {
        useAsTitle: 'name',
        defaultColumns: ['name', 'action', 'isActive', 'updatedAt'],
        group: 'Research',
        description: 'Automated rules for product verdicts',
    },
    fields: [
        {
            name: 'name',
            type: 'text',
            required: true,
            label: 'Rule Name',
            admin: {
                description: 'e.g., "Flag products with Red Dye 40"',
            },
        },
        {
            name: 'description',
            type: 'textarea',
            admin: {
                description: 'What this rule does and why',
            },
        },

        // === CONDITION ===
        {
            name: 'conditionType',
            type: 'select',
            required: true,
            options: [
                { label: 'Contains Ingredient', value: 'contains_ingredient' },
                { label: 'Missing Ingredient', value: 'missing_ingredient' },
                { label: 'Ingredient Verdict', value: 'ingredient_verdict' },
                { label: 'Category Match', value: 'category_match' },
            ],
            admin: {
                description: 'What triggers this rule',
            },
        },
        // NOTE: ingredientCondition field removed - Ingredients collection archived
        {
            name: 'ingredientVerdictCondition',
            type: 'select',
            options: [
                { label: 'Any FLAGGED ingredient', value: 'flagged' },
                { label: 'Any CAUTION ingredient', value: 'caution' },
                { label: 'Only SAFE ingredients', value: 'safe_only' },
            ],
            admin: {
                description: 'Match based on ingredient verdicts',
                condition: (data) => data?.conditionType === 'ingredient_verdict',
            },
        },
        {
            name: 'categoryCondition',
            type: 'relationship',
            relationTo: 'categories',
            hasMany: true,
            admin: {
                description: 'Apply only to these categories',
                condition: (data) => data?.conditionType === 'category_match',
            },
        },

        // === ACTION ===
        {
            name: 'action',
            type: 'select',
            required: true,
            options: [
                { label: '⚠️ Set FLAGGED Verdict', value: 'set_flagged' },
                { label: '⚠️ Set CAUTION Verdict', value: 'set_caution' },
                { label: '✅ Set RECOMMEND Verdict', value: 'set_recommend' },
                { label: '🛑 Block Publishing', value: 'block_publish' },
                { label: '⚠️ Add Warning (don\'t block)', value: 'warn_only' },
            ],
            admin: {
                position: 'sidebar',
                description: 'What happens when rule matches',
            },
        },
        {
            name: 'warningMessage',
            type: 'text',
            label: 'Warning/Conflict Message',
            admin: {
                description: 'Message shown when rule triggers',
            },
        },

        // === SETTINGS ===
        {
            name: 'isActive',
            type: 'checkbox',
            defaultValue: true,
            admin: {
                position: 'sidebar',
            },
        },
        {
            name: 'priority',
            type: 'number',
            defaultValue: 0,
            admin: {
                position: 'sidebar',
                description: 'Higher priority rules run first',
            },
        },
        {
            name: 'appliedCount',
            type: 'number',
            defaultValue: 0,
            admin: {
                position: 'sidebar',
                readOnly: true,
                description: 'How many times this rule has been applied',
            },
        },
    ],
    timestamps: true,
}
