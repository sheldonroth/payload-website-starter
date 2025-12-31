import type { CollectionConfig, FieldAccess } from 'payload'
import { isEditorOrAdmin, isAdmin } from '../access/roleAccess'
import {
    parseAndLinkIngredients,
    evaluateVerdictRules,
    detectConflicts,
    hydrateCategory,
    calculateFreshness,
} from '../utilities/smart-automation'
import { createAuditLog } from './AuditLog'

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
        defaultColumns: ['brand', 'name', 'category', 'verdict', 'freshnessStatus', 'status'],
        listSearchableFields: ['name', 'brand', 'summary', 'upc'],
        group: 'Catalog',
        // Hide AI drafts from main product list - they show in "AI Suggestions" view
        baseListFilter: () => ({
            status: { not_equals: 'ai_draft' },
        }),
    },
    hooks: {
        beforeChange: [
            // ============================================
            // HOOK 1: AUTO-PARSE INGREDIENTS from raw text
            // ============================================
            async ({ data, req, originalDoc }) => {
                // Only parse if ingredientsRaw changed and ingredientsList is empty
                const rawChanged = data?.ingredientsRaw !== originalDoc?.ingredientsRaw;
                const hasNoLinks = !data?.ingredientsList?.length;

                if (rawChanged && data?.ingredientsRaw && hasNoLinks) {
                    try {
                        const parseResult = await parseAndLinkIngredients(
                            data.ingredientsRaw,
                            req.payload
                        );

                        // Auto-populate ingredientsList
                        if (parseResult.linkedIds.length > 0) {
                            data.ingredientsList = parseResult.linkedIds;
                        }

                        // Track unmatched ingredients
                        if (parseResult.unmatched.length > 0) {
                            data.unmatchedIngredients = parseResult.unmatched.map(name => ({ name }));
                        }

                        // Set auto-verdict from parsed ingredients
                        if (parseResult.autoVerdict && !data.verdictOverride) {
                            data.autoVerdict = parseResult.autoVerdict;
                            if (!data.verdict || data.verdict === 'pending') {
                                data.verdict = parseResult.autoVerdict;
                            }
                        }

                        // Create audit log
                        await createAuditLog(req.payload, {
                            action: 'ai_ingredient_parsed',
                            sourceType: 'system',
                            targetCollection: 'products',
                            targetId: originalDoc?.id,
                            targetName: data.name,
                            metadata: {
                                matched: parseResult.linkedIds.length,
                                unmatched: parseResult.unmatched,
                                autoVerdict: parseResult.autoVerdict,
                            },
                            performedBy: (req.user as { id?: number })?.id,
                        });
                    } catch (error) {
                        console.error('Auto-parse ingredients failed:', error);
                    }
                }
                return data;
            },

            // ============================================
            // HOOK 3: INSTANT CATEGORY HYDRATION
            // ============================================
            async ({ data, req }) => {
                // If pendingCategoryName exists and no category set, hydrate immediately
                if (data?.pendingCategoryName && !data?.category) {
                    try {
                        const result = await hydrateCategory(
                            data.pendingCategoryName,
                            req.payload,
                            { aiSuggested: true }
                        );

                        data.category = result.categoryId;
                        data.pendingCategoryName = null; // Clear pending

                        if (result.created) {
                            await createAuditLog(req.payload, {
                                action: 'category_created',
                                sourceType: 'system',
                                targetCollection: 'categories',
                                targetId: result.categoryId,
                                targetName: data.pendingCategoryName,
                                metadata: { parentId: result.parentId },
                                performedBy: (req.user as { id?: number })?.id,
                            });
                        }
                    } catch (error) {
                        console.error('Category hydration failed:', error);
                        // Keep pendingCategoryName for retry
                    }
                }
                return data;
            },

            // ============================================
            // HOOK 4: VERDICT RULES ENGINE
            // ============================================
            async ({ data, req }) => {
                // Evaluate VerdictRules
                if (data?.ingredientsList?.length > 0 || data?.category) {
                    try {
                        const ingredientIds = (data.ingredientsList || []).map(
                            (ing: number | { id: number }) => typeof ing === 'number' ? ing : ing.id
                        );

                        const ruleResult = await evaluateVerdictRules(
                            {
                                ingredientsList: ingredientIds,
                                category: typeof data.category === 'number' ? data.category : data.category?.id,
                                verdict: data.verdict,
                            },
                            req.payload
                        );

                        // Apply suggested verdict from rules (if no override)
                        if (ruleResult.suggestedVerdict && !data.verdictOverride) {
                            data.ruleApplied = ruleResult.evaluations
                                .filter(e => e.matched)
                                .map(e => e.ruleName)
                                .join(', ');

                            if (!data.verdict || data.verdict === 'pending') {
                                data.verdict = ruleResult.suggestedVerdict;
                            }
                            data.autoVerdict = ruleResult.suggestedVerdict;
                        }

                        // Add warnings to conflicts
                        if (ruleResult.warnings.length > 0) {
                            const existingConflicts = (data.conflicts?.detected || []) as string[];
                            data.conflicts = {
                                detected: [...existingConflicts, ...ruleResult.warnings],
                                lastChecked: new Date().toISOString(),
                            };
                        }

                        // Log rule applications
                        for (const evaluation of ruleResult.evaluations.filter(e => e.matched)) {
                            await createAuditLog(req.payload, {
                                action: 'rule_applied',
                                sourceType: 'rule',
                                sourceId: String(evaluation.ruleId),
                                targetCollection: 'products',
                                targetId: data.id,
                                targetName: data.name,
                                metadata: {
                                    ruleName: evaluation.ruleName,
                                    action: evaluation.action,
                                },
                                performedBy: (req.user as { id?: number })?.id,
                            });
                        }
                    } catch (error) {
                        console.error('VerdictRules evaluation failed:', error);
                    }
                }
                return data;
            },

            // ============================================
            // HOOK 5: AUTO-VERDICT from ingredients (existing + enhanced)
            // ============================================
            async ({ data, req }) => {
                // Only calculate if ingredientsList is provided and not overridden
                if (data?.ingredientsList?.length > 0 && !data?.verdictOverride) {
                    try {
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
                                break;
                            } else if (ingVerdict === 'caution') {
                                worstVerdict = 'caution';
                            }
                        }

                        data.autoVerdict = worstVerdict;

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
            // HOOK 6: HARD GUARDRAILS - Block conflicting saves
            // ============================================
            async ({ data, req, originalDoc }) => {
                const ingredientIds = (data?.ingredientsList || []).map(
                    (ing: number | { id: number }) => typeof ing === 'number' ? ing : ing.id
                );

                const conflictResult = await detectConflicts(
                    {
                        verdict: data?.verdict,
                        ingredientsList: ingredientIds,
                        verdictOverride: data?.verdictOverride,
                        category: typeof data?.category === 'number' ? data.category : data?.category?.id,
                    },
                    req.payload
                );

                // Store conflicts
                if (conflictResult.hasConflicts) {
                    data.conflicts = {
                        detected: conflictResult.conflicts.map(c => `${c.severity === 'error' ? '🚫' : '⚠️'} ${c.message}`),
                        lastChecked: new Date().toISOString(),
                    };

                    // Log conflict detection
                    await createAuditLog(req.payload, {
                        action: 'conflict_detected',
                        sourceType: 'system',
                        targetCollection: 'products',
                        targetId: originalDoc?.id,
                        targetName: data.name,
                        metadata: { conflicts: conflictResult.conflicts },
                        performedBy: (req.user as { id?: number })?.id,
                    });

                    // Block save if canSave is false AND trying to publish
                    if (!conflictResult.canSave && data.status === 'published') {
                        const errorConflicts = conflictResult.conflicts
                            .filter(c => c.severity === 'error')
                            .map(c => c.message);

                        throw new Error(
                            `Cannot publish: ${errorConflicts.join('. ')}. Enable "Override Auto-Verdict" to proceed.`
                        );
                    }
                } else {
                    data.conflicts = null;
                }

                // Record override audit trail
                if (data?.verdictOverride && !originalDoc?.verdictOverride) {
                    data.verdictOverriddenBy = (req.user as { id?: number })?.id;
                    data.verdictOverriddenAt = new Date().toISOString();

                    await createAuditLog(req.payload, {
                        action: 'manual_override',
                        sourceType: 'manual',
                        targetCollection: 'products',
                        targetId: originalDoc?.id,
                        targetName: data.name,
                        before: { verdict: originalDoc?.verdict, autoVerdict: originalDoc?.autoVerdict },
                        after: { verdict: data.verdict, verdictOverride: true },
                        metadata: { reason: data.verdictOverrideReason },
                        performedBy: (req.user as { id?: number })?.id,
                    });
                }

                return data;
            },

            // ============================================
            // HOOK 7: FRESHNESS MONITORING
            // ============================================
            ({ data }) => {
                // Calculate freshness status
                const lastTested = data?.testingInfo?.lastTestedDate;
                const freshness = calculateFreshness(lastTested);
                data.freshnessStatus = freshness.status;
                return data;
            },

            // ============================================
            // HOOK 8: AUTO-GENERATE AFFILIATE LINKS
            // ============================================
            async ({ data, req }) => {
                // If amazonAsin exists, ensure there's an Amazon affiliate link
                if (data?.amazonAsin) {
                    try {
                        // Get affiliate tag from SiteSettings
                        const siteSettings = await req.payload.findGlobal({
                            slug: 'site-settings',
                        })
                        const affiliateTag = (siteSettings as { affiliateSettings?: { amazonAffiliateTag?: string } })
                            ?.affiliateSettings?.amazonAffiliateTag

                        // Generate affiliate URL
                        const asin = data.amazonAsin.toUpperCase()
                        const affiliateUrl = affiliateTag
                            ? `https://www.amazon.com/dp/${asin}?tag=${affiliateTag}`
                            : `https://www.amazon.com/dp/${asin}`

                        // Check if Amazon link already exists in purchaseLinks
                        const existingLinks = data.purchaseLinks || []
                        const amazonLinkIndex = existingLinks.findIndex(
                            (link: { retailer?: string }) => link.retailer?.toLowerCase() === 'amazon'
                        )

                        const amazonLink = {
                            retailer: 'Amazon',
                            url: affiliateUrl,
                            price: existingLinks[amazonLinkIndex]?.price || '', // Keep existing price if any
                            isAffiliate: !!affiliateTag,
                        }

                        if (amazonLinkIndex >= 0) {
                            // Update existing Amazon link
                            existingLinks[amazonLinkIndex] = amazonLink
                        } else {
                            // Add new Amazon link
                            existingLinks.unshift(amazonLink) // Add to beginning
                        }

                        data.purchaseLinks = existingLinks
                    } catch (error) {
                        console.error('Failed to generate affiliate link:', error)
                    }
                }
                return data
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
                hidden: true,
            },
            hooks: {
                beforeValidate: [
                    ({ value, data }) => {
                        if (value) return value;
                        const brand = data?.brand || '';
                        const name = data?.name || '';
                        const baseSlug = `${brand}-${name}`
                            .toLowerCase()
                            .replace(/[^a-z0-9]+/g, '-')
                            .replace(/(^-|-$)/g, '');
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
            index: true, // Added for query performance
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
                description: 'Will be auto-created immediately (hierarchical supported)',
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

        // === BINARY VERDICT SYSTEM ===
        {
            name: 'verdict',
            type: 'select',
            required: true,
            defaultValue: 'pending',
            index: true, // Added for query performance
            options: [
                { label: '✅ RECOMMEND', value: 'recommend' },
                { label: '⚠️ CAUTION', value: 'caution' },
                { label: '🚫 AVOID', value: 'avoid' },
                { label: '⏳ PENDING', value: 'pending' },
            ],
            admin: {
                position: 'sidebar',
                description: 'Final verdict on this product',
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
                description: 'System-calculated from ingredients + rules',
            },
        },
        {
            name: 'verdictOverride',
            type: 'checkbox',
            defaultValue: false,
            label: 'Override Auto-Verdict',
            admin: {
                position: 'sidebar',
                description: 'Enable to manually set verdict different from auto-calculated',
            },
        },
        {
            name: 'verdictOverrideReason',
            type: 'textarea',
            label: 'Override Reason',
            admin: {
                description: 'Required: explain why you are overriding the auto-verdict',
                condition: (data) => data?.verdictOverride,
            },
        },
        {
            name: 'verdictOverriddenBy',
            type: 'relationship',
            relationTo: 'users',
            admin: {
                readOnly: true,
                condition: (data) => data?.verdictOverride,
            },
        },
        {
            name: 'verdictOverriddenAt',
            type: 'date',
            admin: {
                readOnly: true,
                condition: (data) => data?.verdictOverride,
            },
        },
        {
            name: 'ruleApplied',
            type: 'text',
            label: 'VerdictRule Applied',
            admin: {
                readOnly: true,
                description: 'Name of VerdictRule(s) that set the verdict',
                condition: (data) => !!data?.ruleApplied,
            },
        },

        // === INGREDIENTS ===
        {
            name: 'ingredientsList',
            type: 'relationship',
            relationTo: 'ingredients',
            hasMany: true,
            label: 'Linked Ingredients',
            admin: {
                description: 'Auto-populated from raw text, or manually link',
            },
        },
        {
            name: 'ingredientsRaw',
            type: 'textarea',
            label: 'Raw Ingredients Text',
            admin: {
                description: 'Paste ingredients list - will auto-parse and link to Ingredients collection',
            },
        },
        {
            name: 'unmatchedIngredients',
            type: 'array',
            label: 'Unmatched Ingredients',
            admin: {
                description: 'Ingredients that could not be auto-matched (need manual research)',
                condition: (data) => data?.unmatchedIngredients?.length > 0,
            },
            fields: [
                {
                    name: 'name',
                    type: 'text',
                    required: true,
                },
            ],
        },

        // === SOURCE TRACKING ===
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
            name: 'amazonAsin',
            type: 'text',
            label: 'Amazon ASIN',
            index: true,
            admin: {
                description: 'Amazon Standard Identification Number (10 characters). Used to auto-generate affiliate links.',
            },
            validate: (value: string | null | undefined) => {
                if (!value) return true
                if (!/^[A-Z0-9]{10}$/i.test(value)) {
                    return 'ASIN must be exactly 10 alphanumeric characters'
                }
                return true
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
        {
            name: 'sourceCount',
            type: 'number',
            defaultValue: 1,
            admin: {
                position: 'sidebar',
                description: 'Number of sources that mentioned this product',
            },
        },

        // === AI EXTRACTION METADATA ===
        {
            name: 'aiConfidence',
            type: 'select',
            options: [
                { label: '🟢 High', value: 'high' },
                { label: '🟡 Medium', value: 'medium' },
                { label: '🔴 Low', value: 'low' },
            ],
            admin: {
                position: 'sidebar',
                description: 'AI confidence in extraction accuracy',
                condition: (data) => data?.status === 'ai_draft',
            },
        },
        {
            name: 'aiSourceType',
            type: 'select',
            options: [
                { label: 'Transcript', value: 'transcript' },
                { label: 'Video Analysis', value: 'video_watching' },
                { label: 'Profile Scrape', value: 'profile' },
                { label: 'Manual Entry', value: 'manual' },
            ],
            admin: {
                position: 'sidebar',
                description: 'How the AI extracted this product',
                condition: (data) => data?.status === 'ai_draft',
            },
        },
        {
            name: 'aiMentions',
            type: 'number',
            admin: {
                position: 'sidebar',
                description: 'Times mentioned in source video',
                condition: (data) => data?.status === 'ai_draft',
            },
        },

        // === CONFLICTS & GUARDRAILS ===
        {
            name: 'conflicts',
            type: 'json',
            admin: {
                readOnly: true,
                description: 'System-detected conflicts (blocks publishing if unresolved)',
            },
        },

        // === FRESHNESS MONITORING ===
        {
            name: 'freshnessStatus',
            type: 'select',
            options: [
                { label: '🟢 Fresh', value: 'fresh' },
                { label: '🟡 Needs Review', value: 'needs_review' },
                { label: '🔴 Stale', value: 'stale' },
            ],
            admin: {
                position: 'sidebar',
                readOnly: true,
                description: 'Auto-calculated from last tested date',
            },
        },

        // === STATUS & WORKFLOW ===
        {
            name: 'status',
            type: 'select',
            label: 'Review Status',
            index: true, // Added for query performance
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

    ],
}
