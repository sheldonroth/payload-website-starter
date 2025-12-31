import type { CollectionConfig } from 'payload'
import { createAuditLog } from './AuditLog'

/**
 * Ingredients Collection
 *
 * Central database of ingredients with verdicts.
 * When an ingredient is marked AVOID, all products containing it
 * can be auto-flagged via cascade hooks.
 *
 * ENHANCED NETWORK EFFECT CASCADE:
 * - Updates all affected products' freshnessStatus to 'needs_review'
 * - Generates "Ingredient Alert" article for major changes
 * - Fires webhook for user notifications
 * - Creates detailed audit logs
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
        // ENHANCED NETWORK EFFECT CASCADE
        // Re-evaluate products when verdict changes
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
                            limit: 1000,
                        });

                        const totalAffected = productsWithIngredient.totalDocs;
                        let updatedCount = 0;
                        let flaggedCount = 0;
                        const affectedProductIds: number[] = [];
                        const affectedProductNames: string[] = [];

                        // Update each affected product
                        for (const product of productsWithIngredient.docs) {
                            const productData = product as {
                                id: number;
                                name: string;
                                verdictOverride?: boolean;
                                status?: string;
                            };

                            affectedProductIds.push(productData.id);
                            affectedProductNames.push(productData.name);

                            // Update product - mark for review and recalculate verdict
                            try {
                                const updateData: Record<string, unknown> = {
                                    freshnessStatus: 'needs_review',
                                };

                                // For non-overridden products, update verdict too
                                if (!productData.verdictOverride) {
                                    if (newVerdict === 'avoid') {
                                        updateData.autoVerdict = 'avoid';
                                        // Only change verdict if not manually set
                                        if (productData.status !== 'published') {
                                            updateData.verdict = 'avoid';
                                        }
                                        flaggedCount++;
                                    } else if (newVerdict === 'caution') {
                                        updateData.autoVerdict = 'caution';
                                    }
                                }

                                await req.payload.update({
                                    collection: 'products',
                                    id: productData.id,
                                    data: updateData,
                                });
                                updatedCount++;
                            } catch (err) {
                                console.error(`Failed to update product ${productData.id}:`, err);
                            }
                        }

                        // Update flagged count on this ingredient
                        await req.payload.update({
                            collection: 'ingredients',
                            id: doc.id,
                            data: { flaggedProductCount: newVerdict === 'avoid' ? flaggedCount : 0 },
                        });

                        // ============================================
                        // GENERATE ALERT ARTICLE for significant changes
                        // ============================================
                        if (totalAffected >= 5 && newVerdict === 'avoid') {
                            try {
                                await req.payload.create({
                                    collection: 'articles',
                                    draft: true,
                                    data: {
                                        title: `Safety Alert: ${doc.name} Now Flagged as AVOID`,
                                        slug: `ingredient-alert-${doc.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`,
                                        category: 'news',
                                        status: 'draft',
                                        excerpt: `${totalAffected} products in our database are affected by new findings about ${doc.name}. Our research team has updated the safety verdict.`,
                                        content: {
                                            root: {
                                                type: 'root',
                                                children: [
                                                    {
                                                        type: 'heading',
                                                        tag: 'h2',
                                                        children: [{ type: 'text', text: 'What Changed' }],
                                                    },
                                                    {
                                                        type: 'paragraph',
                                                        children: [
                                                            { type: 'text', text: `Our research team has updated the safety verdict for ` },
                                                            { type: 'text', text: doc.name, format: ['bold'] },
                                                            { type: 'text', text: ` from ${previousVerdict?.toUpperCase() || 'UNKNOWN'} to ${newVerdict.toUpperCase()}.` },
                                                        ],
                                                    },
                                                    {
                                                        type: 'heading',
                                                        tag: 'h2',
                                                        children: [{ type: 'text', text: 'Why It Matters' }],
                                                    },
                                                    {
                                                        type: 'paragraph',
                                                        children: [
                                                            { type: 'text', text: doc.reason || 'New evidence has emerged regarding the safety of this ingredient.' },
                                                        ],
                                                    },
                                                    {
                                                        type: 'heading',
                                                        tag: 'h2',
                                                        children: [{ type: 'text', text: 'Products Affected' }],
                                                    },
                                                    {
                                                        type: 'paragraph',
                                                        children: [
                                                            { type: 'text', text: `${totalAffected} products in our database contain this ingredient. We are reviewing each product and updating verdicts accordingly.` },
                                                        ],
                                                    },
                                                ],
                                                direction: 'ltr',
                                                format: '',
                                                indent: 0,
                                                version: 1,
                                            },
                                        },
                                    } as Record<string, unknown>,
                                });
                                console.log(`Created alert article for ingredient "${doc.name}"`);
                            } catch (articleError) {
                                console.error('Failed to create alert article:', articleError);
                            }
                        }

                        // ============================================
                        // FIRE WEBHOOK for user notifications
                        // ============================================
                        const notificationWebhook = process.env.NOTIFICATION_WEBHOOK_URL;
                        if (notificationWebhook && totalAffected > 0) {
                            try {
                                await fetch(notificationWebhook, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        type: 'ingredient_verdict_changed',
                                        ingredientId: doc.id,
                                        ingredientName: doc.name,
                                        previousVerdict,
                                        newVerdict,
                                        affectedProductCount: totalAffected,
                                        affectedProductIds,
                                        reason: doc.reason,
                                        timestamp: new Date().toISOString(),
                                    }),
                                });
                                console.log(`Sent notification webhook for ingredient "${doc.name}"`);
                            } catch (webhookError) {
                                console.error('Failed to send notification webhook:', webhookError);
                            }
                        }

                        // ============================================
                        // CREATE AUDIT LOG
                        // ============================================
                        await createAuditLog(req.payload, {
                            action: 'ingredient_cascade',
                            sourceType: 'system',
                            targetCollection: 'ingredients',
                            targetId: doc.id,
                            targetName: doc.name,
                            before: { verdict: previousVerdict },
                            after: { verdict: newVerdict },
                            metadata: {
                                totalAffected,
                                updatedCount,
                                flaggedCount,
                                affectedProductIds: affectedProductIds.slice(0, 50), // Limit to 50 for storage
                                articleCreated: totalAffected >= 5 && newVerdict === 'avoid',
                            },
                            performedBy: (req.user as { id?: number })?.id,
                        });

                        console.log(`Network Effect Cascade: Updated ${updatedCount}/${totalAffected} products after ingredient "${doc.name}" changed from ${previousVerdict} to ${newVerdict}`);
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
