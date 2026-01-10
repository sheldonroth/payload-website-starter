/**
 * Products Collection
 *
 * ⚠️ IMPORTANT FOR AI AGENTS:
 * When adding new fields that store data (text, number, json, relationship, etc.),
 * you MUST create a database migration. Use 'ui' type for display-only components.
 *
 * To create a migration:
 * 1. Add the field to this collection
 * 2. Create a migration file in src/migrations/ (see existing files for examples)
 * 3. Register it in src/migrations/index.ts
 *
 * Fields that DON'T need migrations: 'ui' type (display-only)
 * Fields that DO need migrations: text, number, date, checkbox, select, json, relationship, etc.
 */
import type { CollectionConfig, FieldAccess } from 'payload'
import { isEditorOrAdmin, isAdmin } from '../access/roleAccess'
import {
    detectConflicts,
    hydrateCategory,
    calculateFreshness,
} from '../utilities/smart-automation'
import { debouncedRecalculateFeaturedProduct } from '../utilities/featured-product'
import { createAuditLog } from './AuditLog'
import { classifyCategory } from '../utilities/ai-category'
import { populateSafeAlternatives } from '../utilities/safe-alternatives'
import { extractAndPopulateProduct } from '../utilities/image-extraction'
import { getThresholds } from '../utilities/get-thresholds'

/**
 * Check if a user has premium access (admin, member, or premium subscriber)
 */
function isPremiumUser(user: unknown): boolean {
    if (!user) return false
    const u = user as {
        role?: string
        memberState?: string
        subscriptionStatus?: string
        isAdmin?: boolean
    }
    if (u.role === 'admin' || u.isAdmin) return true
    if (u.memberState === 'member') return true
    if (u.subscriptionStatus === 'premium') return true
    return false
}

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

/**
 * Verdict-based field access control (Liability Shield).
 * For AVOID products, sensitive lab data is restricted to:
 * - CMS users (admin/editor)
 * - Premium users (member, premium subscriber)
 * - Requests with valid API key from trusted frontend
 *
 * This protects the company from liability by not exposing
 * detailed ingredient/testing data for products marked as AVOID.
 */
const verdictBasedFieldAccess: FieldAccess = ({ doc, req }) => {
    // CMS users (admin/editor) always see everything
    if (req.user) {
        const role = (req.user as { role?: string }).role
        if (role === 'admin' || role === 'product_editor') return true
    }

    // Check for API key from trusted frontend
    const apiKey = req.headers.get('x-api-key')
    const expectedKey = process.env.PAYLOAD_API_SECRET
    if (apiKey && expectedKey && apiKey === expectedKey) {
        return true
    }

    // Non-AVOID products are visible to all
    if (doc?.verdict !== 'avoid') return true

    // For AVOID products, only premium users can see sensitive fields
    return isPremiumUser(req.user)
}

export const Products: CollectionConfig = {
    slug: 'products',
    access: {
        // Only published products are visible to public API
        // CMS users (admin/editor) can see all products
        read: ({ req }) => {
            const role = (req.user as { role?: string })?.role
            if (role === 'admin' || role === 'product_editor') return true
            // Public users only see published products
            return { status: { equals: 'published' } }
        },
        create: isEditorOrAdmin, // Admins and product_editors can create
        update: isEditorOrAdmin, // Admins and product_editors can update
        delete: isAdmin, // Only admins can delete (product_editors cannot)
    },
    admin: {
        useAsTitle: 'displayTitle',
        defaultColumns: ['brand', 'name', 'category', 'verdict', 'freshnessStatus', 'status'],
        listSearchableFields: ['name', 'brand', 'summary', 'upc'],
        group: 'Catalog',
        // Smart filter: Hide AI drafts from main list, BUT allow them when explicitly filtered
        // This way the "View all AI drafts" link works while keeping the main list clean
        baseListFilter: ({ req }) => {
            // Check if the request is explicitly filtering for ai_draft status
            const url = req.url || ''
            const isFilteringForAIDrafts = url.includes('where[status][equals]=ai_draft') ||
                url.includes('where%5Bstatus%5D%5Bequals%5D=ai_draft')

            // If explicitly requesting AI drafts, show them (return null = no base filter)
            if (isFilteringForAIDrafts) {
                return null
            }

            // Otherwise, hide AI drafts from the normal product list
            return {
                status: { not_equals: 'ai_draft' }
            }
        },
    },
    hooks: {
        beforeChange: [
            // NOTE: HOOK 1 (Ingredient parsing) REMOVED - Liability Shield

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

            // NOTE: HOOK 4 (Verdict Rules with Ingredients) REMOVED - Liability Shield
            // NOTE: HOOK 5 (Auto-verdict from Ingredients) REMOVED - Liability Shield

            // ============================================
            // HOOK 6: HARD GUARDRAILS - Block conflicting saves
            // ============================================
            async ({ data, req, originalDoc }) => {
                const conflictResult = await detectConflicts(
                    {
                        verdict: data?.verdict,
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
            // HOOK 6.5: AUTO-FLAG RESTRICTED LAB DATA
            // When verdict becomes AVOID, auto-set the restricted flag
            // ============================================
            async ({ data, req, originalDoc }) => {
                const justBecameAvoid = data?.verdict === 'avoid' && originalDoc?.verdict !== 'avoid'

                if (justBecameAvoid) {
                    data.hasRestrictedLabData = true

                    // Log the auto-flagging
                    await createAuditLog(req.payload, {
                        action: 'ai_verdict_set',
                        sourceType: 'system',
                        targetCollection: 'products',
                        targetId: originalDoc?.id,
                        targetName: data.name,
                        metadata: {
                            previousVerdict: originalDoc?.verdict,
                            newVerdict: 'avoid',
                            autoFlaggedRestrictedLabData: true,
                            shieldedFields: ['fullReview', 'testingInfo'],
                        },
                        performedBy: (req.user as { id?: number })?.id,
                    })
                }

                // Clear flag if verdict is no longer AVOID
                if (data?.verdict !== 'avoid' && originalDoc?.hasRestrictedLabData) {
                    data.hasRestrictedLabData = false
                }

                return data
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
            // Generates Amazon links for ALL products:
            // - Direct product link if ASIN is available
            // - Search link using product name/brand otherwise
            // ============================================
            async ({ data, req }) => {
                try {
                    // Get site settings to check if affiliate links are enabled
                    const siteSettings = await req.payload.findGlobal({
                        slug: 'site-settings' as any,
                    })
                    const affiliateSettings = (siteSettings as { affiliateSettings?: { amazonAffiliateTag?: string; enableAffiliateLinks?: boolean } })
                        ?.affiliateSettings
                    const affiliateTag = affiliateSettings?.amazonAffiliateTag
                    const enableAffiliateLinks = affiliateSettings?.enableAffiliateLinks !== false // Default to true

                    // Skip if affiliate links are disabled
                    if (!enableAffiliateLinks) {
                        return data
                    }

                    // Get product name and brand for search link
                    const productName = data?.name || ''

                    // Get brand name - it could be a populated object or just an ID
                    let brandName = ''
                    if (data?.brand) {
                        if (typeof data.brand === 'object' && data.brand?.name) {
                            // Brand is already populated
                            brandName = data.brand.name
                        } else if (typeof data.brand === 'string' || typeof data.brand === 'number') {
                            // Brand is just an ID, need to fetch it
                            try {
                                const brand = await req.payload.findByID({
                                    collection: 'brands',
                                    id: data.brand,
                                    depth: 0,
                                })
                                brandName = brand?.name || ''
                            } catch (e) {
                                console.log('[affiliate-links] Could not fetch brand:', e)
                            }
                        }
                    }

                    // Need at least a product name to generate any link
                    if (!productName) {
                        return data
                    }

                    let affiliateUrl: string
                    let linkType: 'direct' | 'search' = 'search'

                    if (data?.amazonAsin) {
                        // Priority 1: Direct product link with ASIN
                        const asin = data.amazonAsin.toUpperCase()
                        affiliateUrl = affiliateTag
                            ? `https://www.amazon.com/dp/${asin}?tag=${affiliateTag}`
                            : `https://www.amazon.com/dp/${asin}`
                        linkType = 'direct'
                    } else {
                        // Priority 2: Search link using product name + brand
                        const searchQuery = brandName
                            ? `${brandName} ${productName}`
                            : productName
                        const encodedQuery = encodeURIComponent(searchQuery)
                        affiliateUrl = affiliateTag
                            ? `https://www.amazon.com/s?k=${encodedQuery}&tag=${affiliateTag}`
                            : `https://www.amazon.com/s?k=${encodedQuery}`
                    }

                    // Check if Amazon link already exists in purchaseLinks
                    const existingLinks = data.purchaseLinks || []
                    const amazonLinkIndex = existingLinks.findIndex(
                        (link: { retailer?: string }) => link.retailer?.toLowerCase() === 'amazon'
                    )

                    // Safely get existing price if link exists
                    const existingPrice = amazonLinkIndex >= 0 ? (existingLinks[amazonLinkIndex]?.price || '') : ''

                    const amazonLink = {
                        retailer: 'Amazon',
                        url: affiliateUrl,
                        price: existingPrice,
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
                    console.error('Failed to process affiliate link:', error)
                }
                return data
            },

            // ============================================
            // HOOK 9: AI CATEGORY CLASSIFICATION
            // Auto-suggest category for new products
            // ============================================
            async ({ data, req, operation }) => {
                // Only on create and if no category set
                if (operation !== 'create') return data
                if (data?.category) return data

                // Check if AI categories are enabled and product has a name
                if (!data?.name) return data

                try {
                    const result = await classifyCategory(req.payload, {
                        name: data.name,
                        brand: data.brand,
                        ingredientsRaw: data.ingredientsRaw,
                    })

                    if (result.autoAssigned && result.suggestion?.categoryId) {
                        data.category = result.suggestion.categoryId
                        console.log(`[AI Category] Auto-assigned "${result.suggestion.categoryName}" to "${data.name}"`)
                    } else if (result.suggestion?.categoryName) {
                        // Store suggestion for manual review
                        data.pendingCategoryName = result.suggestion.categoryName
                        console.log(`[AI Category] Suggested "${result.suggestion.categoryName}" for "${data.name}" (${result.suggestion.confidence}% confidence)`)
                    }
                } catch (error) {
                    console.error('[AI Category] Classification failed:', error)
                }

                return data
            },

            // ============================================
            // HOOK 10: OCR IMAGE EXTRACTION
            // Auto-extract product info from uploaded image
            // ============================================
            async ({ data, req, operation }) => {
                // Only on create and if image is provided but name is empty
                if (operation !== 'create') return data
                if (data?.name) return data // Already has a name
                if (!data?.image) return data

                try {
                    const result = await extractAndPopulateProduct(req.payload, {
                        name: data.name,
                        brand: data.brand,
                        ingredientsRaw: data.ingredientsRaw,
                        upc: data.upc,
                        image: data.image,
                    })

                    if (result.updated) {
                        Object.assign(data, result.fields)
                        console.log(`[OCR] Extracted fields for product: ${Object.keys(result.fields).join(', ')}`)
                    }
                } catch (error) {
                    console.error('[OCR] Extraction failed:', error)
                }

                return data
            },
        ],

        // ============================================
        // AFTER CHANGE: AUTO BACKGROUND REMOVAL ON PUBLISH
        // ============================================
        afterChange: [
            async ({ doc, previousDoc, req }) => {
                // Only process if:
                // 1. Status just changed to 'published'
                // 2. Product has an image (imageUrl or image)
                // 3. Background hasn't been removed yet
                const justPublished = doc.status === 'published' && previousDoc?.status !== 'published'
                const hasImage = !!(doc.imageUrl || doc.image)
                const notProcessed = !doc.backgroundRemoved

                if (justPublished && hasImage && notProcessed) {
                    console.log(`[Auto BG Removal] Product ${doc.id} published with image, queuing background removal...`)

                    // Process in background (don't block the save)
                    // Use setTimeout to not block the response
                    setTimeout(async () => {
                        try {
                            // Call the background removal endpoint internally
                            const response = await fetch(
                                `${process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'}/api/background/remove`,
                                {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                        // Use internal auth - the endpoint will check for user
                                        'Cookie': req.headers.get('cookie') || '',
                                    },
                                    body: JSON.stringify({
                                        productId: doc.id,
                                        preview: false,
                                    }),
                                }
                            )

                            if (response.ok) {
                                // Update the backgroundRemoved flag
                                await req.payload.update({
                                    collection: 'products',
                                    id: doc.id,
                                    data: { backgroundRemoved: true },
                                })
                                console.log(`[Auto BG Removal] Successfully removed background for product ${doc.id}`)
                            } else {
                                const error = await response.json()
                                console.error(`[Auto BG Removal] Failed for product ${doc.id}:`, error)
                            }
                        } catch (error) {
                            console.error(`[Auto BG Removal] Error for product ${doc.id}:`, error)
                        }
                    }, 100) // Small delay to let the response complete
                }

                return doc
            },

            // ============================================
            // HOOK: RECALCULATE FEATURED PRODUCT FOR CATEGORY
            // ============================================
            async ({ doc, previousDoc, req }) => {
                // Get the product's current and previous category
                const currentCategoryId = typeof doc.category === 'number'
                    ? doc.category
                    : (doc.category as { id?: number })?.id

                const previousCategoryId = previousDoc
                    ? (typeof previousDoc.category === 'number'
                        ? previousDoc.category
                        : (previousDoc.category as { id?: number })?.id)
                    : null

                // Recalculate featured product when:
                // 1. Product is published
                // 2. Product has a category
                // 3. Something relevant changed (status, verdict, badges, image, category)
                const isPublished = doc.status === 'published'
                const wasPublished = previousDoc?.status === 'published'
                const statusChanged = doc.status !== previousDoc?.status
                const verdictChanged = doc.verdict !== previousDoc?.verdict
                const categoryChanged = currentCategoryId !== previousCategoryId
                const badgesChanged = JSON.stringify(doc.badges) !== JSON.stringify(previousDoc?.badges)
                const imageChanged = doc.image !== previousDoc?.image || doc.imageUrl !== previousDoc?.imageUrl

                const shouldRecalculate = isPublished && currentCategoryId && (
                    statusChanged || verdictChanged || categoryChanged || badgesChanged || imageChanged
                )

                // Also recalculate if product was unpublished/deleted from category
                const shouldRecalculatePrevious = wasPublished && previousCategoryId && (
                    !isPublished || categoryChanged
                )

                // Recalculate in background using debounced function to prevent race conditions
                if (shouldRecalculate && currentCategoryId) {
                    debouncedRecalculateFeaturedProduct(currentCategoryId, req.payload)
                }
                // If category changed, also recalculate the old category
                if (shouldRecalculatePrevious && previousCategoryId && previousCategoryId !== currentCategoryId) {
                    debouncedRecalculateFeaturedProduct(previousCategoryId, req.payload)
                }

                return doc
            },

            // NOTE: UPDATE INGREDIENT PRODUCT COUNTS hook REMOVED - Liability Shield


            // ============================================
            // HOOK: AUTO-SUGGEST SAFE ALTERNATIVES
            // Populate comparedWith for AVOID products
            // ============================================
            async ({ doc, previousDoc, req }) => {
                // Only process if:
                // 1. Product just became 'avoid' verdict
                // 2. Product just became 'published'
                // 3. comparedWith is empty
                const justBecameAvoid = doc.verdict === 'avoid' && previousDoc?.verdict !== 'avoid'
                const justPublished = doc.status === 'published' && previousDoc?.status !== 'published'
                const isPublishedAvoid = doc.status === 'published' && doc.verdict === 'avoid'
                const hasNoAlternatives = !doc.comparedWith || doc.comparedWith.length === 0

                if ((justBecameAvoid || justPublished) && isPublishedAvoid && hasNoAlternatives) {
                    // Process in background to not block save
                    setTimeout(async () => {
                        try {
                            await populateSafeAlternatives(req.payload, doc.id)
                        } catch (error) {
                            console.error('[Safe Alternatives] Failed to populate:', error)
                        }
                    }, 100)
                }

                return doc
            },

            // ============================================
            // HOOK: IMPACT NOTIFICATIONS ("Your product was tested!")
            // Notify all users who voted for this product when it's published
            // ============================================
            async ({ doc, previousDoc, req }) => {
                // Only trigger when product transitions to 'published' and has a UPC
                const justPublished = doc.status === 'published' && previousDoc?.status !== 'published'
                const hasBarcode = !!doc.upc

                if (justPublished && hasBarcode) {
                    // Process in background to not block save
                    setTimeout(async () => {
                        try {
                            // Dynamic import to avoid circular dependencies
                            const { notifyProductTestingComplete } = await import('../lib/expo-push')

                            const result = await notifyProductTestingComplete(
                                req.payload,
                                doc.upc,
                                doc.name || 'Unknown Product',
                                String(doc.id)
                            )

                            if (result.sent > 0) {
                                console.log(`[Impact Notification] Sent ${result.sent} notifications for ${doc.name} (${doc.upc})`)
                            }
                        } catch (error) {
                            console.error('[Impact Notification] Failed:', error)
                        }
                    }, 500) // Slight delay to ensure product is fully saved
                }

                return doc
            },

            // ============================================
            // HOOK: UPDATE CATEGORY PRODUCT COUNTS
            // Updates productCount on categories when products change
            // ============================================
            async ({ doc, previousDoc, req, operation }) => {
                const currentCategoryId = typeof doc.category === 'number'
                    ? doc.category
                    : (doc.category as { id?: number })?.id

                const previousCategoryId = previousDoc
                    ? (typeof previousDoc.category === 'number'
                        ? previousDoc.category
                        : (previousDoc.category as { id?: number })?.id)
                    : null

                // Determine which categories need updating
                const categoriesToUpdate = new Set<number>()

                // Category changed - update both old and new
                if (currentCategoryId !== previousCategoryId) {
                    if (currentCategoryId) categoriesToUpdate.add(currentCategoryId)
                    if (previousCategoryId) categoriesToUpdate.add(previousCategoryId)
                }

                // Product status changed to/from published - update current category
                if (currentCategoryId && doc.status !== previousDoc?.status) {
                    categoriesToUpdate.add(currentCategoryId)
                }

                // On create with category
                if (operation === 'create' && currentCategoryId) {
                    categoriesToUpdate.add(currentCategoryId)
                }

                // Update counts in background
                if (categoriesToUpdate.size > 0) {
                    setTimeout(async () => {
                        try {
                            for (const categoryId of Array.from(categoriesToUpdate)) {
                                // Count published products in this category
                                const { totalDocs } = await req.payload.count({
                                    collection: 'products',
                                    where: {
                                        category: { equals: categoryId },
                                        status: { equals: 'published' },
                                    },
                                })

                                // Update the category's productCount
                                await req.payload.update({
                                    collection: 'categories',
                                    id: categoryId,
                                    data: { productCount: totalDocs },
                                })

                                console.log(`[Category Count] Updated category ${categoryId} productCount to ${totalDocs}`)
                            }
                        } catch (error) {
                            console.error('[Category Count] Failed to update:', error)
                        }
                    }, 100)
                }

                return doc
            },
        ],

        // ============================================
        // AFTER DELETE: UPDATE CATEGORY PRODUCT COUNTS
        // ============================================
        afterDelete: [
            async ({ doc, req }) => {
                const categoryId = typeof doc.category === 'number'
                    ? doc.category
                    : (doc.category as { id?: number })?.id

                if (categoryId && doc.status === 'published') {
                    setTimeout(async () => {
                        try {
                            const { totalDocs } = await req.payload.count({
                                collection: 'products',
                                where: {
                                    category: { equals: categoryId },
                                    status: { equals: 'published' },
                                },
                            })

                            await req.payload.update({
                                collection: 'categories',
                                id: categoryId,
                                data: { productCount: totalDocs },
                            })

                            console.log(`[Category Count] After delete: Updated category ${categoryId} productCount to ${totalDocs}`)
                        } catch (error) {
                            console.error('[Category Count] Failed to update after delete:', error)
                        }
                    }, 100)
                }

                return doc
            },
        ],

        // TEMPORARILY DISABLED - afterRead hook causing API timeouts
        // afterRead: [],
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
            name: 'displayTitle',
            type: 'text',
            admin: {
                hidden: true,
                description: 'Auto-generated: Brand - Product Name',
            },
            hooks: {
                beforeChange: [
                    ({ siblingData }) => {
                        const brand = siblingData?.brand || ''
                        const name = siblingData?.name || ''
                        return brand && name ? `${brand} - ${name}` : name || brand || 'Unnamed Product'
                    },
                ],
                afterRead: [
                    // Dynamically compute displayTitle for existing products that don't have it
                    ({ value, siblingData }) => {
                        if (value) return value
                        const brand = siblingData?.brand || ''
                        const name = siblingData?.name || ''
                        return brand && name ? `${brand} - ${name}` : name || brand || 'Unnamed Product'
                    },
                ],
            },
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
        // Find image button - searches Google + Open Food Facts
        {
            name: 'retryImageSearch',
            type: 'ui',
            admin: {
                components: {
                    Field: '@/components/RetryImageSearch',
                },
            },
        },
        // Background removal UI button (no database column - UI only)
        // NOTE: If this component doesn't render, run: pnpm payload generate:importmap
        {
            name: 'backgroundRemoveAction',
            type: 'ui',
            admin: {
                components: {
                    Field: '@/components/BackgroundRemoveButton',
                },
            },
        },
        // Track if background has been removed (prevents duplicate API charges)
        {
            name: 'backgroundRemoved',
            type: 'checkbox',
            defaultValue: false,
            admin: {
                description: 'Auto-set when background is removed. Prevents duplicate processing.',
                position: 'sidebar',
                readOnly: true,
            },
        },

        // === VERDICT SYSTEM ===
        {
            name: 'verdict',
            type: 'select',
            required: true,
            defaultValue: 'recommend',
            index: true, // Added for query performance
            options: [
                { label: '✅ RECOMMEND', value: 'recommend' },
                { label: '⚠️ CAUTION', value: 'caution' },
                { label: '🚫 AVOID', value: 'avoid' },
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

        // NOTE: INGREDIENTS fields REMOVED - Liability Shield


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
            name: 'amazonLinkStatus',
            type: 'select',
            label: 'Amazon Link Status',
            defaultValue: 'unchecked',
            options: [
                { label: 'Unchecked', value: 'unchecked' },
                { label: 'Valid', value: 'valid' },
                { label: 'Invalid', value: 'invalid' },
            ],
            admin: {
                position: 'sidebar',
                description: 'Validation status of the Amazon product link',
                readOnly: true,
            },
        },
        {
            name: 'amazonLinkLastChecked',
            type: 'date',
            label: 'Link Last Validated',
            admin: {
                position: 'sidebar',
                readOnly: true,
                date: {
                    displayFormat: 'MMM d, yyyy h:mm a',
                },
            },
        },
        {
            name: 'amazonLinkError',
            type: 'text',
            label: 'Link Validation Error',
            admin: {
                position: 'sidebar',
                readOnly: true,
                condition: (data) => data?.amazonLinkStatus === 'invalid',
            },
        },
        // Amazon link validation button in sidebar
        {
            name: 'amazonValidateButton',
            type: 'ui',
            admin: {
                position: 'sidebar',
                components: {
                    Field: '@/components/AmazonValidateButton',
                },
            },
        },
        // === SOURCE INFORMATION ===
        // Collapsible section grouping all source-related fields
        // NOTE: 'collapsible' type is UI-only - no database migration needed
        {
            type: 'collapsible',
            label: '📹 Source Information',
            admin: {
                initCollapsed: false, // Keep expanded by default for reviewers
            },
            fields: [
                // Smart source link display at the top (UI-only, no DB field)
                {
                    name: 'sourceLinkDisplay',
                    type: 'ui',
                    admin: {
                        components: {
                            Field: '@/components/SourceVideoLink',
                        },
                    },
                },
                {
                    name: 'sourceUrl',
                    type: 'text',
                    label: 'Source URL',
                    admin: {
                        description: 'TikTok, Amazon, or other URL where data was extracted',
                    },
                },
                {
                    name: 'sourceVideo',
                    type: 'relationship',
                    relationTo: 'videos',
                    label: 'Source Video',
                    admin: {
                        description: 'YouTube video from Videos collection (if applicable)',
                    },
                },
            ],
        },
        {
            name: 'sourceCount',
            type: 'number',
            defaultValue: 1,
            admin: {
                position: 'sidebar',
                description: 'Number of video/article sources that mentioned this product. Auto-updated when sources are linked.',
            },
        },

        // === AI EXTRACTION METADATA ===
        // These fields are populated when products are created via AI extraction
        // (video transcript analysis, crowdsource submissions, automated imports)
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
                description: 'AI confidence level when this product was auto-extracted. Set during AI import workflow.',
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
                { label: 'Crowdsource', value: 'crowdsource' },
            ],
            admin: {
                position: 'sidebar',
                description: 'Method used to extract this product. Set during AI import workflow.',
                condition: (data) => data?.status === 'ai_draft',
            },
        },
        {
            name: 'aiMentions',
            type: 'number',
            admin: {
                position: 'sidebar',
                description: 'Times product was mentioned in source video/content. Higher = more relevant.',
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
        {
            name: 'hasRestrictedLabData',
            type: 'checkbox',
            label: 'Lab Data Restricted',
            defaultValue: false,
            admin: {
                position: 'sidebar',
                readOnly: true,
                description: 'Auto-set when verdict is AVOID. Lab data hidden from non-premium users.',
                condition: (data) => data?.verdict === 'avoid',
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
                read: verdictBasedFieldAccess, // Hidden for AVOID products to non-premium users
            },
        },

        // === PURCHASE LINKS ===
        // NOTE: No access control - affiliate links must be visible to all users for monetization
        {
            name: 'purchaseLinks',
            type: 'array',
            label: '🛒 Where to Buy',
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
                read: verdictBasedFieldAccess, // Hidden for AVOID products to non-premium users
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

        // === BADGES & AWARDS ===
        {
            name: 'badges',
            type: 'group',
            label: '🏆 Badges & Awards',
            admin: {
                description: 'Award badges displayed on product cards and pages',
            },
            fields: [
                {
                    name: 'isBestOverall',
                    type: 'checkbox',
                    label: 'Best Overall',
                    defaultValue: false,
                    admin: {
                        description: '🥇 Mark this product as the #1 pick for its category. Only ONE product per category should have this enabled.',
                    },
                },
                {
                    name: 'isBestInCategory',
                    type: 'checkbox',
                    label: 'Best in Category',
                    defaultValue: false,
                    admin: {
                        description: 'Featured product for this category',
                    },
                },
                {
                    name: 'isRecommended',
                    type: 'checkbox',
                    label: 'Recommended',
                    defaultValue: false,
                    admin: {
                        description: 'Staff recommended product',
                    },
                },
                {
                    name: 'isBestValue',
                    type: 'checkbox',
                    label: 'Best Value',
                    defaultValue: false,
                    admin: {
                        description: 'Best price-to-quality ratio',
                    },
                },
                {
                    name: 'isEditorsChoice',
                    type: 'checkbox',
                    label: "Editor's Choice",
                    defaultValue: false,
                    admin: {
                        description: "Selected as editor's top pick",
                    },
                },
                // === SYSTEM-CALCULATED ARCHETYPES ===
                {
                    name: 'isArchetypePremium',
                    type: 'checkbox',
                    label: 'Archetype: Premium',
                    defaultValue: false,
                    admin: {
                        description: 'System-calculated: Highest price in category. Enable "Override Archetype" to prevent auto-changes.',
                    },
                },
                {
                    name: 'isArchetypeValue',
                    type: 'checkbox',
                    label: 'Archetype: Best Value',
                    defaultValue: false,
                    admin: {
                        description: 'System-calculated: Best score/price ratio in category. Enable "Override Archetype" to prevent auto-changes.',
                    },
                },
                {
                    name: 'archetypeOverride',
                    type: 'checkbox',
                    label: 'Override Archetype',
                    defaultValue: false,
                    admin: {
                        description: 'Enable to prevent system from changing archetype badges on this product',
                    },
                },
                {
                    name: 'archetypeCalculatedAt',
                    type: 'date',
                    label: 'Last Calculated',
                    admin: {
                        readOnly: true,
                        description: 'When archetype was last auto-calculated',
                    },
                },
            ],
        },

        // === TRENDING STATUS ===
        {
            name: 'trending',
            type: 'group',
            label: 'Trending Status',
            admin: {
                position: 'sidebar',
                description: 'Auto-calculated from brand trending status',
            },
            fields: [
                {
                    name: 'isTrending',
                    type: 'checkbox',
                    defaultValue: false,
                    admin: { readOnly: true },
                },
                {
                    name: 'trendingScore',
                    type: 'number',
                    min: 0,
                    max: 100,
                    admin: { readOnly: true },
                },
                {
                    name: 'trendingSentiment',
                    type: 'select',
                    options: [
                        { label: 'Positive', value: 'positive' },
                        { label: 'Negative', value: 'negative' },
                        { label: 'Neutral', value: 'neutral' },
                        { label: 'Mixed', value: 'mixed' },
                    ],
                    admin: { readOnly: true },
                },
                {
                    name: 'trendingReason',
                    type: 'text',
                    admin: { readOnly: true },
                },
            ],
        },

        // ═══════════════════════════════════════════════════════════════
        // CASE ATTRIBUTION
        // Who helped get this product tested? Recognition for the community.
        // ═══════════════════════════════════════════════════════════════
        {
            name: 'scoutAttribution',
            type: 'group',
            admin: {
                description: 'Contributors who helped get this product tested',
            },
            fields: [
                {
                    name: 'firstScout',
                    type: 'relationship',
                    relationTo: 'contributor-profiles',
                    admin: {
                        description: 'The first contributor to open this case',
                        readOnly: true,
                    },
                },
                {
                    name: 'firstScoutNumber',
                    type: 'number',
                    admin: {
                        description: 'Contributor number for display (e.g., "Contributor #47")',
                        readOnly: true,
                    },
                },
                {
                    name: 'totalScouts',
                    type: 'number',
                    defaultValue: 0,
                    admin: {
                        description: 'Total contributors who documented this product',
                        readOnly: true,
                    },
                },
                {
                    name: 'scoutContributors',
                    type: 'json',
                    defaultValue: [],
                    admin: {
                        description: 'All contributors who helped. Structure: [{ scoutId, scoutNumber, displayName }]',
                    },
                },
                {
                    name: 'linkedProductVote',
                    type: 'relationship',
                    relationTo: 'product-votes',
                    admin: {
                        description: 'The ProductVote that led to this product being tested',
                    },
                },
                {
                    name: 'scansAfterTesting',
                    type: 'number',
                    defaultValue: 0,
                    admin: {
                        description: 'How many people scanned this after testing (for "helped X people" metric)',
                        readOnly: true,
                    },
                },
            ],
        },

    ],
}
