import type { CollectionConfig } from 'payload'

/**
 * Ingredients Collection
 * 
 * Central database of ingredients with verdicts.
 * When an ingredient is marked AVOID, all products containing it
 * can be auto-flagged via cascade hooks.
 */
export const Ingredients: CollectionConfig = {
    slug: 'ingredients',
    access: {
        read: () => true,
    },
    admin: {
        useAsTitle: 'name',
        defaultColumns: ['name', 'verdict', 'category', 'updatedAt'],
        group: 'Research',
        description: 'Ingredient database with verdicts that cascade to products',
    },
    hooks: {
        // ============================================
        // CASCADE: Re-evaluate products when verdict changes
        // ============================================
        afterChange: [
            async ({ doc, previousDoc, req }) => {
                // Only cascade if verdict actually changed
                const previousVerdict = previousDoc?.verdict;
                const newVerdict = doc?.verdict;

                if (previousVerdict !== newVerdict && doc?.autoFlagProducts) {
                    try {
                        // Find all products that use this ingredient
                        const productsWithIngredient = await req.payload.find({
                            collection: 'products',
                            where: {
                                ingredientsList: { contains: doc.id },
                            },
                            limit: 500,
                        });

                        let flaggedCount = 0;

                        // Re-trigger save on each product to recalculate auto-verdict
                        for (const product of productsWithIngredient.docs) {
                            const productData = product as { id: number; verdictOverride?: boolean };

                            // Only update products that don't have manual override
                            if (!productData.verdictOverride) {
                                try {
                                    await req.payload.update({
                                        collection: 'products',
                                        id: productData.id,
                                        data: {
                                            // Trigger the beforeChange hook to recalculate verdict
                                            // by updating a timestamp or triggering a save
                                        },
                                    });
                                    flaggedCount++;
                                } catch (err) {
                                    console.error(`Failed to update product ${productData.id}:`, err);
                                }
                            }
                        }

                        // Update flagged count on this ingredient
                        if (newVerdict === 'avoid') {
                            await req.payload.update({
                                collection: 'ingredients',
                                id: doc.id,
                                data: { flaggedProductCount: flaggedCount },
                            });
                        }

                        console.log(`Cascade: Updated ${flaggedCount} products after ingredient "${doc.name}" changed to ${newVerdict}`);
                    } catch (error) {
                        console.error('Ingredient cascade failed:', error);
                    }
                }
                return doc;
            },
        ],
    },
    fields: [
        // === IDENTIFICATION ===
        {
            name: 'name',
            type: 'text',
            required: true,
            unique: true,
            label: 'Ingredient Name',
            admin: {
                description: 'Primary name (e.g., "Red Dye 40")',
            },
        },
        {
            name: 'aliases',
            type: 'array',
            label: 'Alternative Names',
            admin: {
                description: 'Other names this ingredient goes by',
            },
            fields: [
                {
                    name: 'alias',
                    type: 'text',
                    required: true,
                },
            ],
        },

        // === VERDICT (Binary System) ===
        {
            name: 'verdict',
            type: 'select',
            required: true,
            defaultValue: 'unknown',
            options: [
                { label: '✅ SAFE', value: 'safe' },
                { label: '⚠️ CAUTION', value: 'caution' },
                { label: '🚫 AVOID', value: 'avoid' },
                { label: '❓ UNKNOWN', value: 'unknown' },
            ],
            admin: {
                position: 'sidebar',
                description: 'Final verdict on this ingredient',
            },
        },
        {
            name: 'reason',
            type: 'textarea',
            label: 'Why?',
            admin: {
                description: 'Brief explanation of the verdict',
            },
        },

        // === CATEGORIZATION ===
        {
            name: 'category',
            type: 'select',
            options: [
                { label: 'Artificial Colors', value: 'artificial_colors' },
                { label: 'Artificial Sweeteners', value: 'artificial_sweeteners' },
                { label: 'Preservatives', value: 'preservatives' },
                { label: 'Emulsifiers', value: 'emulsifiers' },
                { label: 'Heavy Metals', value: 'heavy_metals' },
                { label: 'Pesticides', value: 'pesticides' },
                { label: 'Vitamins & Minerals', value: 'vitamins_minerals' },
                { label: 'Proteins', value: 'proteins' },
                { label: 'Fats & Oils', value: 'fats_oils' },
                { label: 'Sugars', value: 'sugars' },
                { label: 'Fibers', value: 'fibers' },
                { label: 'Other', value: 'other' },
            ],
            admin: {
                position: 'sidebar',
            },
        },
        {
            name: 'productCategories',
            type: 'relationship',
            relationTo: 'categories',
            hasMany: true,
            label: 'Relevant Product Categories',
            admin: {
                description: 'Which product categories is this ingredient relevant to?',
            },
        },

        // === SOURCES ===
        {
            name: 'sources',
            type: 'array',
            label: 'Evidence Sources',
            admin: {
                description: 'Videos, studies, or reports that informed this verdict',
            },
            fields: [
                {
                    type: 'row',
                    fields: [
                        {
                            name: 'type',
                            type: 'select',
                            options: [
                                { label: '📹 Video', value: 'video' },
                                { label: '📄 Study', value: 'study' },
                                { label: '🔬 Lab Report', value: 'lab_report' },
                                { label: '🏛️ FDA/Gov', value: 'government' },
                            ],
                            admin: { width: '30%' },
                        },
                        {
                            name: 'reference',
                            type: 'text',
                            label: 'URL or ID',
                            admin: { width: '70%' },
                        },
                    ],
                },
                {
                    name: 'notes',
                    type: 'text',
                    admin: {
                        description: 'Brief note about this source',
                    },
                },
            ],
        },
        {
            name: 'sourceVideo',
            type: 'relationship',
            relationTo: 'videos',
            label: 'Primary Source Video',
            admin: {
                description: 'Main video where this ingredient was discussed',
            },
        },

        // === CASCADE SETTINGS ===
        {
            name: 'autoFlagProducts',
            type: 'checkbox',
            defaultValue: true,
            label: 'Auto-flag products',
            admin: {
                position: 'sidebar',
                description: 'When AVOID, automatically flag products containing this',
            },
        },
        {
            name: 'flaggedProductCount',
            type: 'number',
            defaultValue: 0,
            admin: {
                position: 'sidebar',
                readOnly: true,
                description: 'Products currently flagged due to this ingredient',
            },
        },
    ],
    timestamps: true,
}
