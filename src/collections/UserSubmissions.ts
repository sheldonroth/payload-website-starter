import type { CollectionConfig } from 'payload'
import { createAuditLog } from './AuditLog'

/**
 * UserSubmissions Collection
 *
 * Crowdsource Intelligence Engine - User-submitted content.
 * Handles:
 * - Product scan submissions
 * - Tip submissions
 * - Reaction/experience reports
 * - Photo submissions
 *
 * Includes gamification with points and badges.
 */
export const UserSubmissions: CollectionConfig = {
    slug: 'user-submissions',
    access: {
        read: () => true,
        create: () => true, // Anyone can submit
        update: ({ req }) => !!req.user, // Only admins can update
        delete: ({ req }) => !!req.user,
    },
    admin: {
        useAsTitle: 'id',
        defaultColumns: ['type', 'status', 'product', 'submitterEmail', 'createdAt'],
        group: 'Community',
        description: 'User-submitted product scans, tips, and reports',
    },
    hooks: {
        afterChange: [
            async ({ doc, operation, req }) => {
                // Award points when submission is verified
                if (doc.status === 'verified' && doc.submitterEmail) {
                    const pointsAwarded = doc.type === 'product_scan' ? 10 :
                                          doc.type === 'tip' ? 25 :
                                          doc.type === 'reaction_report' ? 15 : 5

                    // Log the points award
                    await createAuditLog(req.payload, {
                        action: 'points_awarded',
                        sourceType: 'system',
                        targetCollection: 'user-submissions',
                        targetId: doc.id,
                        metadata: {
                            submitterEmail: doc.submitterEmail,
                            type: doc.type,
                            pointsAwarded,
                        },
                    })
                }

                // Create product draft from verified scan
                if (operation === 'update' && doc.status === 'verified' && doc.type === 'product_scan') {
                    if (doc.extractedData?.productName && !doc.createdProduct) {
                        try {
                            const newProduct = await req.payload.create({
                                collection: 'products',
                                draft: true,
                                data: {
                                    name: doc.extractedData.productName,
                                    brand: doc.extractedData.brand,
                                    upc: doc.extractedData.upc,
                                    ingredientsRaw: doc.extractedData.ingredients,
                                    status: 'ai_draft',
                                    source: 'user_submission',
                                    sourceUrl: `user-submission:${doc.id}`,
                                } as Record<string, unknown>,
                            })

                            console.log(`Created product ${(newProduct as { id: number }).id} from submission ${doc.id}`)
                        } catch (error) {
                            console.error('Failed to create product from submission:', error)
                        }
                    }
                }

                return doc
            },
        ],
    },
    fields: [
        // === SUBMISSION TYPE ===
        {
            name: 'type',
            type: 'select',
            required: true,
            options: [
                { label: '📷 Product Scan', value: 'product_scan' },
                { label: '💡 Tip/Information', value: 'tip' },
                { label: '😷 Reaction Report', value: 'reaction_report' },
                { label: '📝 Correction', value: 'correction' },
                { label: '🆕 New Product Request', value: 'product_request' },
            ],
            admin: {
                position: 'sidebar',
            },
        },

        // === SUBMITTER INFO ===
        {
            name: 'submitterEmail',
            type: 'email',
            admin: {
                description: 'Email for follow-up and points tracking',
            },
        },
        {
            name: 'submitterName',
            type: 'text',
            admin: {
                description: 'Display name (optional)',
            },
        },
        {
            name: 'submitterIp',
            type: 'text',
            admin: {
                position: 'sidebar',
                readOnly: true,
                description: 'For spam prevention',
            },
        },

        // === PRODUCT REFERENCE ===
        {
            name: 'product',
            type: 'relationship',
            relationTo: 'products',
            admin: {
                description: 'Existing product this submission relates to',
            },
        },

        // === UPLOADED CONTENT ===
        {
            name: 'images',
            type: 'array',
            label: 'Uploaded Images',
            fields: [
                {
                    name: 'image',
                    type: 'upload',
                    relationTo: 'media',
                    required: true,
                },
                {
                    name: 'imageType',
                    type: 'select',
                    options: [
                        { label: 'Front Label', value: 'front' },
                        { label: 'Back Label', value: 'back' },
                        { label: 'Ingredients List', value: 'ingredients' },
                        { label: 'Nutrition Facts', value: 'nutrition' },
                        { label: 'Barcode', value: 'barcode' },
                        { label: 'Other', value: 'other' },
                    ],
                },
            ],
        },

        // === SUBMISSION CONTENT ===
        {
            name: 'content',
            type: 'textarea',
            label: 'Message/Details',
            admin: {
                description: 'User-provided description or details',
            },
        },
        {
            name: 'barcode',
            type: 'text',
            admin: {
                description: 'UPC/EAN barcode if scanned',
            },
        },

        // === REACTION REPORT FIELDS ===
        {
            name: 'reactionDetails',
            type: 'group',
            label: 'Reaction Details',
            admin: {
                condition: (data) => data?.type === 'reaction_report',
            },
            fields: [
                {
                    name: 'symptoms',
                    type: 'select',
                    hasMany: true,
                    options: [
                        { label: 'Skin Reaction', value: 'skin' },
                        { label: 'Digestive Issues', value: 'digestive' },
                        { label: 'Headache', value: 'headache' },
                        { label: 'Allergic Reaction', value: 'allergic' },
                        { label: 'Behavioral Changes', value: 'behavioral' },
                        { label: 'Other', value: 'other' },
                    ],
                },
                {
                    name: 'severity',
                    type: 'select',
                    options: [
                        { label: 'Mild', value: 'mild' },
                        { label: 'Moderate', value: 'moderate' },
                        { label: 'Severe', value: 'severe' },
                        { label: 'Required Medical Attention', value: 'medical' },
                    ],
                },
                {
                    name: 'suspectedIngredient',
                    type: 'text',
                },
            ],
        },

        // === AI PROCESSING ===
        {
            name: 'extractedData',
            type: 'json',
            label: 'Extracted Data',
            admin: {
                description: 'AI-extracted data from images',
                readOnly: true,
            },
        },
        {
            name: 'aiConfidence',
            type: 'number',
            min: 0,
            max: 100,
            admin: {
                position: 'sidebar',
                readOnly: true,
                description: 'AI confidence in extraction (0-100)',
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
                { label: '🔍 Under Review', value: 'reviewing' },
                { label: '✅ Verified', value: 'verified' },
                { label: '❌ Rejected', value: 'rejected' },
                { label: '🔄 Duplicate', value: 'duplicate' },
                { label: '🚫 Spam', value: 'spam' },
            ],
            admin: {
                position: 'sidebar',
            },
        },
        {
            name: 'moderatorNotes',
            type: 'textarea',
            admin: {
                description: 'Internal notes from review',
            },
        },

        // === GAMIFICATION ===
        {
            name: 'pointsAwarded',
            type: 'number',
            defaultValue: 0,
            admin: {
                position: 'sidebar',
                readOnly: true,
            },
        },
        {
            name: 'featured',
            type: 'checkbox',
            defaultValue: false,
            admin: {
                position: 'sidebar',
                description: 'Feature this submission (bonus points)',
            },
        },
    ],
    timestamps: true,
}
