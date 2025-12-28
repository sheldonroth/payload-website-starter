import type { CollectionConfig, FieldAccess } from 'payload'
import { isEditorOrAdmin, isAdmin } from '../access/roleAccess'

/**
 * Field-level access control for premium content.
 * - Authenticated users (admin panel) can see everything
 * - Requests with valid x-api-key header (frontend server) can see everything
 * - Unauthenticated API requests get this field omitted
 */
const premiumFieldAccess: FieldAccess = ({ req }) => {
    // If user is logged in (admin or authenticated request), allow read
    if (req.user) return true

    // Check for API key from trusted frontend
    const apiKey = req.headers.get('x-api-key')
    const expectedKey = process.env.PAYLOAD_API_SECRET
    if (apiKey && expectedKey && apiKey === expectedKey) {
        return true
    }

    // Public API requests cannot read premium fields
    return false
}

export const Products: CollectionConfig = {
    slug: 'products',
    access: {
        read: () => true, // Basic product info is public
        create: isEditorOrAdmin, // Admins and product_editors can create
        update: isEditorOrAdmin, // Admins and product_editors can update
        delete: isAdmin, // Only admins can delete (product_editors cannot)
    },
    admin: {
        useAsTitle: 'name',
        defaultColumns: ['brand', 'name', 'category', 'verdict', 'status'],
        listSearchableFields: ['name', 'brand', 'summary'],
        group: 'Catalog',
        // Hide AI drafts from main product list - they show in "AI Suggestions" view
        baseListFilter: () => ({
            status: { not_equals: 'ai_draft' },
        }),
    },
    hooks: {
        beforeChange: [
            // Auto-calculate overall score from sub-ratings
            ({ data }) => {
                if (data?.ratings) {
                    const weights = {
                        performance: 0.30,
                        reliability: 0.25,
                        valueForMoney: 0.25,
                        features: 0.20,
                    };

                    const performance = data.ratings.performance || 0;
                    const reliability = data.ratings.reliability || 0;
                    const valueForMoney = data.ratings.valueForMoney || 0;
                    const features = data.ratings.features || 0;

                    data.overallScore = Math.round(
                        (performance * weights.performance) +
                        (reliability * weights.reliability) +
                        (valueForMoney * weights.valueForMoney) +
                        (features * weights.features)
                    );
                }
                return data;
            },
            // Auto-create category when publishing with pending category
            async ({ data, req, originalDoc }) => {
                // Check if status is changing to published and there's a pending category
                if (
                    data?.status === 'published' &&
                    data?.pendingCategoryName &&
                    !data?.category
                ) {
                    try {
                        // Check if category already exists
                        const existing = await req.payload.find({
                            collection: 'categories',
                            where: {
                                name: { equals: data.pendingCategoryName },
                            },
                            limit: 1,
                        });

                        let categoryId: number;

                        if (existing.docs.length > 0) {
                            categoryId = existing.docs[0].id as number;
                        } else {
                            // Create new category
                            const newCategory = await req.payload.create({
                                collection: 'categories',
                                data: {
                                    name: data.pendingCategoryName,
                                    slug: data.pendingCategoryName
                                        .toLowerCase()
                                        .replace(/[^a-z0-9]+/g, '-')
                                        .replace(/(^-|-$)/g, ''),
                                },
                            });
                            categoryId = newCategory.id as number;
                        }

                        // Link product to category and clear pending
                        data.category = categoryId;
                        data.pendingCategoryName = null;
                    } catch (error) {
                        console.error('Failed to auto-create category:', error);
                    }
                }
                return data;
            },
            // ============================================
            // AUTO-VERDICT: Calculate verdict from ingredients
            // ============================================
            async ({ data, req }) => {
                // Only calculate if ingredientsList is provided and not overridden
                if (data?.ingredientsList?.length > 0 && !data?.verdictOverride) {
                    try {
                        // Fetch the linked ingredients to check their verdicts
                        const ingredientIds = data.ingredientsList.map((ing: number | { id: number }) =>
                            typeof ing === 'number' ? ing : ing.id
                        );

                        const ingredients = await req.payload.find({
                            collection: 'ingredients',
                            where: { id: { in: ingredientIds } },
                            limit: 100,
                        });

                        // Determine auto-verdict based on worst ingredient
                        let worstVerdict = 'recommend' as 'recommend' | 'caution' | 'avoid';
                        for (const ing of ingredients.docs) {
                            const ingVerdict = (ing as { verdict?: string }).verdict;
                            if (ingVerdict === 'avoid') {
                                worstVerdict = 'avoid';
                                break; // Can't get worse
                            } else if (ingVerdict === 'caution') {
                                worstVerdict = 'caution';
                                // Continue checking for worse
                            }
                        }

                        // Set auto-verdict
                        data.autoVerdict = worstVerdict;

                        // If no manual verdict set, use auto-verdict
                        if (!data.verdict || data.verdict === 'pending') {
                            data.verdict = worstVerdict;
                        }
                    } catch (error) {
                        console.error('Auto-verdict calculation failed:', error);
                    }
                }
                return data;
            },
            // ============================================
            // CONFLICT DETECTION: Warn on mismatched verdict
            // ============================================
            async ({ data, req }) => {
                // Check for conflicts between verdict and ingredientsList
                const conflicts: string[] = [];

                if (data?.verdict === 'recommend' && data?.ingredientsList?.length > 0) {
                    try {
                        const ingredientIds = data.ingredientsList.map((ing: number | { id: number }) =>
                            typeof ing === 'number' ? ing : ing.id
                        );

                        const ingredients = await req.payload.find({
                            collection: 'ingredients',
                            where: { id: { in: ingredientIds } },
                            limit: 100,
                        });

                        // Check for AVOID ingredients in a RECOMMEND product
                        const avoidIngredients = ingredients.docs
                            .filter((ing: { verdict?: string }) => ing.verdict === 'avoid')
                            .map((ing: { name: string }) => ing.name);

                        if (avoidIngredients.length > 0) {
                            conflicts.push(`⚠️ Product marked RECOMMEND but contains AVOID ingredients: ${avoidIngredients.join(', ')}`);
                        }

                        // Check for CAUTION ingredients
                        const cautionIngredients = ingredients.docs
                            .filter((ing: { verdict?: string }) => ing.verdict === 'caution')
                            .map((ing: { name: string }) => ing.name);

                        if (cautionIngredients.length > 0) {
                            conflicts.push(`⚠️ Product contains CAUTION ingredients: ${cautionIngredients.join(', ')}`);
                        }
                    } catch (error) {
                        console.error('Conflict detection failed:', error);
                    }
                }

                // Store conflicts (don't block save, just log)
                if (conflicts.length > 0) {
                    data.conflicts = { detected: conflicts, lastChecked: new Date().toISOString() };
                } else {
                    data.conflicts = null;
                }

                return data;
            },
        ],
    },
    fields: [
        // === MAIN INFO ===
        {
            name: 'name',
            type: 'text',
            required: true,
            label: 'Product Name',
        },
        {
            name: 'brand',
            type: 'text',
            required: true,
            label: 'Brand Name',
        },
        {
            name: 'slug',
            type: 'text',
            label: 'URL Slug',
            index: true,
            admin: {
                hidden: true, // Auto-generated from brand + name
            },
            hooks: {
                beforeValidate: [
                    ({ value, data }) => {
                        if (value) return value;
                        // Auto-generate slug from brand + name
                        const brand = data?.brand || '';
                        const name = data?.name || '';
                        const baseSlug = `${brand}-${name}`
                            .toLowerCase()
                            .replace(/[^a-z0-9]+/g, '-')
                            .replace(/(^-|-$)/g, '');
                        // Add timestamp suffix to avoid duplicates
                        return baseSlug || `product-${Date.now()}`;
                    },
                ],
            },
        },
        {
            name: 'category',
            type: 'relationship',
            relationTo: 'categories',
            required: false,
            hasMany: false,
            admin: {
                position: 'sidebar',
            },
        },
        {
            name: 'pendingCategoryName',
            type: 'text',
            label: 'Pending Category (AI Suggested)',
            admin: {
                position: 'sidebar',
                description: 'New category will be auto-created when published',
                condition: (data) => !!data?.pendingCategoryName,
            },
        },

        // === IMAGES ===
        {
            name: 'imageUrl',
            type: 'text',
            label: 'Image URL (External)',
            admin: {
                description: 'Use this OR upload an image below',
            },
        },
        {
            name: 'image',
            type: 'upload',
            relationTo: 'media',
            label: 'Product Image',
        },

        // === BINARY VERDICT SYSTEM (First Principles) ===
        {
            name: 'verdict',
            type: 'select',
            required: true,
            defaultValue: 'pending',
            options: [
                { label: '✅ RECOMMEND', value: 'recommend' },
                { label: '⚠️ CAUTION', value: 'caution' },
                { label: '🚫 AVOID', value: 'avoid' },
                { label: '⏳ PENDING', value: 'pending' },
            ],
            admin: {
                position: 'sidebar',
                description: 'Binary verdict: do we recommend this product?',
            },
        },
        {
            name: 'verdictReason',
            type: 'textarea',
            label: 'Verdict Explanation',
            admin: {
                description: 'Brief explanation of why this verdict was given',
            },
        },
        {
            name: 'autoVerdict',
            type: 'select',
            options: [
                { label: '✅ RECOMMEND', value: 'recommend' },
                { label: '⚠️ CAUTION', value: 'caution' },
                { label: '🚫 AVOID', value: 'avoid' },
            ],
            admin: {
                position: 'sidebar',
                readOnly: true,
                description: 'System-calculated verdict based on ingredients',
            },
        },
        {
            name: 'verdictOverride',
            type: 'checkbox',
            defaultValue: false,
            admin: {
                position: 'sidebar',
                description: 'Manual override of auto-verdict',
                condition: (data) => data?.autoVerdict && data?.verdict !== data?.autoVerdict,
            },
        },

        // === INGREDIENTS (First Principles - Structured) ===
        {
            name: 'ingredientsList',
            type: 'relationship',
            relationTo: 'ingredients',
            hasMany: true,
            label: 'Linked Ingredients',
            admin: {
                description: 'Structured ingredient links (enables cascade verdicts)',
            },
        },
        {
            name: 'ingredientsRaw',
            type: 'textarea',
            label: 'Raw Ingredients Text',
            admin: {
                description: 'Original ingredients text (for reference/parsing)',
            },
        },

        // === SOURCE TRACKING (First Principles - Provenance) ===
        {
            name: 'upc',
            type: 'text',
            unique: true,
            index: true,
            label: 'UPC/Barcode',
            admin: {
                description: 'Universal Product Code for barcode scanning',
            },
        },
        {
            name: 'sourceUrl',
            type: 'text',
            label: 'Source URL',
            admin: {
                description: 'Amazon/product page URL where data was extracted',
            },
        },
        {
            name: 'sourceVideo',
            type: 'relationship',
            relationTo: 'videos',
            label: 'Source Video',
            admin: {
                description: 'Video that this product was extracted from',
            },
        },

        // === CONFLICTS (First Principles - Guardrails) ===
        {
            name: 'conflicts',
            type: 'json',
            admin: {
                readOnly: true,
                description: 'System-detected conflicts (e.g., AVOID ingredient in RECOMMEND product)',
            },
        },

        // === LEGACY BADGES (kept for backward compatibility, hidden) ===
        {
            name: 'badges',
            type: 'group',
            label: 'Legacy Badges',
            admin: {
                condition: () => false, // Hide from UI
            },
            fields: [
                { name: 'isBestInCategory', type: 'checkbox' },
                { name: 'isRecommended', type: 'checkbox' },
                { name: 'isBestValue', type: 'checkbox' },
                { name: 'isEditorsChoice', type: 'checkbox' },
            ],
        },

        // === LEGACY SCORES (kept for migration, hidden) ===
        {
            name: 'overallScore',
            type: 'number',
            admin: { hidden: true },
        },
        {
            name: 'rankInCategory',
            type: 'number',
            admin: { hidden: true },
        },
        {
            name: 'ratings',
            type: 'group',
            admin: { condition: () => false },
            fields: [
                { name: 'performance', type: 'number' },
                { name: 'reliability', type: 'number' },
                { name: 'valueForMoney', type: 'number' },
                { name: 'features', type: 'number' },
            ],
        },

        // === STATUS & WORKFLOW ===
        {
            name: 'status',
            type: 'select',
            label: 'Review Status',
            options: [
                { label: '🤖 AI Draft', value: 'ai_draft' },
                { label: '📝 Draft', value: 'draft' },
                { label: '🔬 Under Testing', value: 'testing' },
                { label: '✍️ Writing Review', value: 'writing' },
                { label: '👀 Ready for Review', value: 'review' },
                { label: '✅ Published', value: 'published' },
            ],
            defaultValue: 'draft',
            admin: {
                position: 'sidebar',
            },
        },

        // === PRICING ===
        {
            name: 'priceRange',
            type: 'select',
            label: 'Price Range',
            options: [
                { label: '$ (Budget)', value: '$' },
                { label: '$$ (Mid-Range)', value: '$$' },
                { label: '$$$ (Premium)', value: '$$$' },
                { label: '$$$$ (Luxury)', value: '$$$$' },
            ],
            defaultValue: '$$',
        },

        // === PROS & CONS ===
        {
            type: 'row',
            fields: [
                {
                    name: 'pros',
                    type: 'array',
                    label: '✅ Pros',
                    access: {
                        read: premiumFieldAccess,
                    },
                    admin: { width: '50%' },
                    fields: [
                        {
                            name: 'text',
                            type: 'text',
                            required: true,
                        },
                    ],
                },
                {
                    name: 'cons',
                    type: 'array',
                    label: '❌ Cons',
                    access: {
                        read: premiumFieldAccess,
                    },
                    admin: { width: '50%' },
                    fields: [
                        {
                            name: 'text',
                            type: 'text',
                            required: true,
                        },
                    ],
                },
            ],
        },

        // === SUMMARY & CONTENT ===
        {
            name: 'summary',
            type: 'textarea',
            label: 'Product Summary',
            admin: {
                description: 'Brief overview for cards and previews',
            },
        },
        {
            name: 'fullReview',
            type: 'richText',
            label: 'Full Review',
            access: {
                read: premiumFieldAccess,
            },
        },

        // === PURCHASE LINKS ===
        {
            name: 'purchaseLinks',
            type: 'array',
            label: '🛒 Where to Buy',
            access: {
                read: premiumFieldAccess,
            },
            fields: [
                {
                    type: 'row',
                    fields: [
                        {
                            name: 'retailer',
                            type: 'text',
                            required: true,
                            label: 'Retailer',
                            admin: { width: '30%' },
                        },
                        {
                            name: 'url',
                            type: 'text',
                            required: true,
                            label: 'URL',
                            admin: { width: '40%' },
                        },
                        {
                            name: 'price',
                            type: 'text',
                            label: 'Price',
                            admin: { width: '15%' },
                        },
                        {
                            name: 'isAffiliate',
                            type: 'checkbox',
                            label: 'Affiliate?',
                            defaultValue: true,
                            admin: { width: '15%' },
                        },
                    ],
                },
            ],
        },

        // === COMPARISON ===
        {
            name: 'comparedWith',
            type: 'relationship',
            relationTo: 'products',
            hasMany: true,
            label: 'Compare With',
            admin: {
                description: 'Link related products for comparison',
            },
        },

        // === TESTING INFO ===
        {
            name: 'testingInfo',
            type: 'group',
            label: 'Testing Information',
            access: {
                read: premiumFieldAccess,
            },
            fields: [
                {
                    type: 'row',
                    fields: [
                        {
                            name: 'reviewDate',
                            type: 'date',
                            label: 'Review Date',
                            admin: {
                                width: '33%',
                                date: { pickerAppearance: 'dayOnly' },
                            },
                        },
                        {
                            name: 'lastTestedDate',
                            type: 'date',
                            label: 'Last Tested',
                            admin: {
                                width: '33%',
                                date: { pickerAppearance: 'dayOnly' },
                            },
                        },
                        {
                            name: 'versionTested',
                            type: 'text',
                            label: 'Version/Model',
                            admin: { width: '33%' },
                        },
                    ],
                },
                {
                    name: 'updateNotes',
                    type: 'textarea',
                    label: 'Update Notes',
                    admin: {
                        description: 'Notes about changes since last review',
                    },
                },
            ],
        },

        // === LEGACY FIELDS (for backward compatibility) ===
        {
            name: 'isBestBuy',
            type: 'checkbox',
            admin: { hidden: true },
        },
        {
            name: 'isRecommended',
            type: 'checkbox',
            admin: { hidden: true },
        },
    ],
}
