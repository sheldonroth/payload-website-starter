import type { CollectionConfig } from 'payload'
import { createAuditLog } from './AuditLog'

/**
 * RegulatoryChanges Collection
 *
 * Tracks regulatory updates from FDA, EU EFSA, California Prop 65, etc.
 * Automatically links changes to affected ingredients and products.
 *
 * Sources monitored:
 * - FDA Federal Register
 * - EU EFSA Journal
 * - California Prop 65 List
 * - Health Canada
 * - WHO/IARC
 */
export const RegulatoryChanges: CollectionConfig = {
    slug: 'regulatory-changes',
    access: {
        read: () => true,
        create: ({ req }) => !!req.user,
        update: ({ req }) => !!req.user,
        delete: ({ req }) => !!req.user,
    },
    admin: {
        useAsTitle: 'title',
        defaultColumns: ['title', 'source', 'changeType', 'effectiveDate', 'status'],
        group: 'Research',
        description: 'Regulatory updates that affect ingredients or products',
    },
    hooks: {
        afterChange: [
            async ({ doc, operation, req }) => {
                // When a new regulatory change is published, notify affected products
                if (operation === 'create' && doc.status === 'published') {
                    try {
                        const affectedIngredientIds = doc.affectedIngredients || []

                        if (affectedIngredientIds.length > 0) {
                            // Find all products using these ingredients
                            const affectedProducts = await req.payload.find({
                                collection: 'products',
                                where: {
                                    ingredientsList: { in: affectedIngredientIds },
                                },
                                limit: 500,
                            })

                            // Mark products for review
                            for (const product of affectedProducts.docs) {
                                const productData = product as { id: number; name: string }
                                await req.payload.update({
                                    collection: 'products',
                                    id: productData.id,
                                    data: {
                                        freshnessStatus: 'needs_review',
                                    } as Record<string, unknown>,
                                })
                            }

                            // Create audit log
                            await createAuditLog(req.payload, {
                                action: 'regulatory_alert',
                                sourceType: 'system',
                                sourceId: doc.referenceId,
                                sourceUrl: doc.sourceUrl,
                                metadata: {
                                    regulatorySource: doc.source,
                                    changeType: doc.changeType,
                                    affectedIngredientsCount: affectedIngredientIds.length,
                                    affectedProductsCount: affectedProducts.totalDocs,
                                    effectiveDate: doc.effectiveDate,
                                },
                            })

                            console.log(`Regulatory alert: ${affectedProducts.totalDocs} products affected by ${doc.title}`)
                        }
                    } catch (error) {
                        console.error('Failed to process regulatory change cascade:', error)
                    }
                }
                return doc
            },
        ],
    },
    fields: [
        // === IDENTIFICATION ===
        {
            name: 'title',
            type: 'text',
            required: true,
            label: 'Regulation Title',
            admin: {
                description: 'Short descriptive title for this regulatory change',
            },
        },
        {
            name: 'referenceId',
            type: 'text',
            label: 'Reference ID',
            admin: {
                description: 'Official reference number (e.g., FDA-2024-N-1234)',
            },
        },

        // === SOURCE ===
        {
            name: 'source',
            type: 'select',
            required: true,
            options: [
                { label: '🇺🇸 FDA', value: 'fda' },
                { label: '🇺🇸 USDA', value: 'usda' },
                { label: '🇺🇸 EPA', value: 'epa' },
                { label: '🇺🇸 California Prop 65', value: 'prop65' },
                { label: '🇪🇺 EU EFSA', value: 'efsa' },
                { label: '🇪🇺 EU Commission', value: 'eu_commission' },
                { label: '🇨🇦 Health Canada', value: 'health_canada' },
                { label: '🌍 WHO/IARC', value: 'who_iarc' },
                { label: '🌍 Codex Alimentarius', value: 'codex' },
                { label: 'Other', value: 'other' },
            ],
            admin: {
                position: 'sidebar',
            },
        },
        {
            name: 'sourceUrl',
            type: 'text',
            label: 'Source URL',
            admin: {
                description: 'Link to official regulatory document',
            },
        },

        // === CHANGE TYPE ===
        {
            name: 'changeType',
            type: 'select',
            required: true,
            options: [
                { label: '🚫 Ban/Prohibition', value: 'ban' },
                { label: '⚠️ New Restriction', value: 'restriction' },
                { label: '📊 New Limit Set', value: 'limit' },
                { label: '🏷️ Labeling Requirement', value: 'labeling' },
                { label: '⚠️ Warning Required', value: 'warning' },
                { label: '✅ Approval/Authorization', value: 'approval' },
                { label: '🔬 Safety Review Initiated', value: 'review' },
                { label: '📋 Guideline Update', value: 'guideline' },
            ],
            admin: {
                position: 'sidebar',
            },
        },
        {
            name: 'severity',
            type: 'select',
            options: [
                { label: '🔴 Critical - Immediate Action', value: 'critical' },
                { label: '🟠 High - Action Required', value: 'high' },
                { label: '🟡 Medium - Monitor', value: 'medium' },
                { label: '🟢 Low - Informational', value: 'low' },
            ],
            defaultValue: 'medium',
            admin: {
                position: 'sidebar',
            },
        },

        // === DATES ===
        {
            name: 'announcedDate',
            type: 'date',
            label: 'Announced Date',
            admin: {
                description: 'When the change was announced',
            },
        },
        {
            name: 'effectiveDate',
            type: 'date',
            label: 'Effective Date',
            admin: {
                description: 'When the change takes effect',
            },
        },
        {
            name: 'complianceDeadline',
            type: 'date',
            label: 'Compliance Deadline',
            admin: {
                description: 'Deadline for industry compliance',
            },
        },

        // === AFFECTED ITEMS ===
        {
            name: 'affectedIngredients',
            type: 'relationship',
            relationTo: 'ingredients',
            hasMany: true,
            label: 'Affected Ingredients',
            admin: {
                description: 'Ingredients directly affected by this regulation',
            },
        },
        {
            name: 'affectedCategories',
            type: 'relationship',
            relationTo: 'categories',
            hasMany: true,
            label: 'Affected Product Categories',
            admin: {
                description: 'Product categories this regulation applies to',
            },
        },
        {
            name: 'affectedSubstances',
            type: 'array',
            label: 'Substances (Not Yet in DB)',
            admin: {
                description: 'Substances mentioned that may not be in our ingredient database yet',
            },
            fields: [
                {
                    name: 'name',
                    type: 'text',
                    required: true,
                },
                {
                    name: 'casNumber',
                    type: 'text',
                    label: 'CAS Number',
                },
            ],
        },

        // === DETAILS ===
        {
            name: 'summary',
            type: 'textarea',
            label: 'Summary',
            admin: {
                description: 'Plain-language summary of the regulatory change',
            },
        },
        {
            name: 'impact',
            type: 'textarea',
            label: 'Impact Analysis',
            admin: {
                description: 'How this affects products in our database',
            },
        },
        {
            name: 'recommendedAction',
            type: 'select',
            options: [
                { label: 'Update Verdicts to AVOID', value: 'update_avoid' },
                { label: 'Add Warning Label', value: 'add_warning' },
                { label: 'Review Affected Products', value: 'review' },
                { label: 'Monitor for Updates', value: 'monitor' },
                { label: 'No Action Needed', value: 'none' },
            ],
            admin: {
                position: 'sidebar',
            },
        },

        // === STATUS ===
        {
            name: 'status',
            type: 'select',
            required: true,
            defaultValue: 'pending',
            options: [
                { label: '⏳ Pending Review', value: 'pending' },
                { label: '📋 Under Analysis', value: 'analyzing' },
                { label: '✅ Published', value: 'published' },
                { label: '✔️ Action Taken', value: 'actioned' },
                { label: '🔇 Dismissed', value: 'dismissed' },
            ],
            admin: {
                position: 'sidebar',
            },
        },

        // === GENERATED CONTENT ===
        {
            name: 'generatedArticle',
            type: 'relationship',
            relationTo: 'articles',
            admin: {
                description: 'Article generated from this regulatory change',
            },
        },

        // === METADATA ===
        {
            name: 'rawData',
            type: 'json',
            admin: {
                description: 'Raw data from source API/scrape',
            },
        },
    ],
    timestamps: true,
}
