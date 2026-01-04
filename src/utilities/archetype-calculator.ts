import type { Payload } from 'payload'
import { createAuditLog } from '../collections/AuditLog'

/**
 * Archetype Calculator
 *
 * Automatically calculates and assigns archetype badges to products:
 * - ARCHETYPE_PREMIUM: Highest price in category
 * - ARCHETYPE_VALUE: Best score/price ratio in category
 *
 * Runs nightly via cron or can be triggered on-demand.
 */

interface ArchetypeResult {
    premiumProductId: number | null
    valueProductId: number | null
    premiumProduct?: { id: number; name: string; brand?: string; priceValue: number }
    valueProduct?: { id: number; name: string; brand?: string; ratio: number }
    previousPremiumId?: number | null
    previousValueId?: number | null
}

interface Product {
    id: number
    name: string
    brand?: string
    priceRange?: string
    overallScore?: number
    badges?: {
        archetypeOverride?: boolean
        isArchetypePremium?: boolean
        isArchetypeValue?: boolean
    }
}

/**
 * Convert price range string to numeric value for comparison
 */
function getPriceValue(priceRange: string | undefined): number {
    const map: Record<string, number> = {
        $: 1,
        $$: 2,
        $$$: 3,
        $$$$: 4,
    }
    return map[priceRange || '$$'] || 2
}

/**
 * Calculate score/price ratio for value comparison
 * Higher ratio = better value (more score per price)
 */
function getScorePriceRatio(product: Product): number {
    const score = product.overallScore || 50 // Default to 50 if no score
    const priceValue = getPriceValue(product.priceRange)
    return score / priceValue
}

/**
 * Calculate archetypes for a single category
 *
 * @param payload - Payload instance
 * @param categoryId - Category ID to calculate archetypes for
 * @returns ArchetypeResult with premium and value product IDs
 */
export async function calculateArchetypesForCategory(
    payload: Payload,
    categoryId: number
): Promise<ArchetypeResult> {
    // Find all RECOMMEND + published products in this category
    const products = await payload.find({
        collection: 'products',
        where: {
            category: { equals: categoryId },
            verdict: { equals: 'recommend' },
            status: { equals: 'published' },
        },
        sort: '-createdAt',
        limit: 500, // Reasonable limit for a category
        depth: 0,
    })

    if (products.docs.length === 0) {
        return { premiumProductId: null, valueProductId: null }
    }

    const productDocs = products.docs as Product[]

    // Filter out products with override enabled
    const eligibleProducts = productDocs.filter((p) => !p.badges?.archetypeOverride)

    if (eligibleProducts.length === 0) {
        return { premiumProductId: null, valueProductId: null }
    }

    // Track previous holders
    const previousPremiumId = productDocs.find((p) => p.badges?.isArchetypePremium)?.id || null
    const previousValueId = productDocs.find((p) => p.badges?.isArchetypeValue)?.id || null

    // Calculate ARCHETYPE_PREMIUM (highest price)
    const sortedByPrice = [...eligibleProducts].sort(
        (a, b) => getPriceValue(b.priceRange) - getPriceValue(a.priceRange)
    )
    const premiumProduct = sortedByPrice[0]

    // Calculate ARCHETYPE_VALUE (best score/price ratio)
    const withRatios = eligibleProducts.map((p) => ({
        ...p,
        ratio: getScorePriceRatio(p),
    }))
    const sortedByValue = [...withRatios].sort((a, b) => b.ratio - a.ratio)
    const valueProduct = sortedByValue[0]

    return {
        premiumProductId: premiumProduct?.id || null,
        valueProductId: valueProduct?.id || null,
        premiumProduct: premiumProduct
            ? {
                  id: premiumProduct.id,
                  name: premiumProduct.name,
                  brand: premiumProduct.brand,
                  priceValue: getPriceValue(premiumProduct.priceRange),
              }
            : undefined,
        valueProduct: valueProduct
            ? {
                  id: valueProduct.id,
                  name: valueProduct.name,
                  brand: valueProduct.brand,
                  ratio: valueProduct.ratio,
              }
            : undefined,
        previousPremiumId,
        previousValueId,
    }
}

/**
 * Apply archetype badges to products and clear from previous holders
 */
export async function applyArchetypes(
    payload: Payload,
    categoryId: number,
    result: ArchetypeResult
): Promise<{ updated: number; cleared: number }> {
    let updated = 0
    let cleared = 0
    const now = new Date().toISOString()

    // Clear previous premium holder (if different from new one)
    if (result.previousPremiumId && result.previousPremiumId !== result.premiumProductId) {
        await payload.update({
            collection: 'products',
            id: result.previousPremiumId,
            data: {
                badges: {
                    isArchetypePremium: false,
                },
            },
        })
        cleared++
    }

    // Clear previous value holder (if different from new one)
    if (result.previousValueId && result.previousValueId !== result.valueProductId) {
        await payload.update({
            collection: 'products',
            id: result.previousValueId,
            data: {
                badges: {
                    isArchetypeValue: false,
                },
            },
        })
        cleared++
    }

    // Set new premium holder
    if (result.premiumProductId) {
        await payload.update({
            collection: 'products',
            id: result.premiumProductId,
            data: {
                badges: {
                    isArchetypePremium: true,
                    archetypeCalculatedAt: now,
                },
            },
        })
        updated++
    }

    // Set new value holder
    if (result.valueProductId && result.valueProductId !== result.premiumProductId) {
        await payload.update({
            collection: 'products',
            id: result.valueProductId,
            data: {
                badges: {
                    isArchetypeValue: true,
                    archetypeCalculatedAt: now,
                },
            },
        })
        updated++
    } else if (result.valueProductId === result.premiumProductId && result.premiumProductId) {
        // Same product is both premium and value - update both flags
        await payload.update({
            collection: 'products',
            id: result.premiumProductId,
            data: {
                badges: {
                    isArchetypePremium: true,
                    isArchetypeValue: true,
                    archetypeCalculatedAt: now,
                },
            },
        })
        // Already counted in updated
    }

    return { updated, cleared }
}

/**
 * Run archetype calculation for all categories
 *
 * @param payload - Payload instance
 * @returns Summary of the calculation run
 */
export async function runArchetypeCalculation(payload: Payload): Promise<{
    categoriesProcessed: number
    productsUpdated: number
    productsCleared: number
    errors: string[]
}> {
    const errors: string[] = []
    let categoriesProcessed = 0
    let productsUpdated = 0
    let productsCleared = 0

    try {
        // Get all categories that have published products
        const categories = await payload.find({
            collection: 'categories',
            limit: 500,
            depth: 0,
        })

        for (const category of categories.docs) {
            try {
                const result = await calculateArchetypesForCategory(payload, category.id)

                if (result.premiumProductId || result.valueProductId) {
                    const { updated, cleared } = await applyArchetypes(payload, category.id, result)
                    productsUpdated += updated
                    productsCleared += cleared

                    // Log to audit
                    await createAuditLog(payload, {
                        action: 'ai_verdict_set',
                        sourceType: 'system',
                        targetCollection: 'categories',
                        targetId: category.id,
                        targetName: category.name as string,
                        metadata: {
                            type: 'archetype_calculation',
                            premiumProduct: result.premiumProduct,
                            valueProduct: result.valueProduct,
                            previousPremiumId: result.previousPremiumId,
                            previousValueId: result.previousValueId,
                        },
                    })
                }

                categoriesProcessed++
            } catch (error) {
                const errMsg = `Failed to calculate archetypes for category ${category.id}: ${error instanceof Error ? error.message : String(error)}`
                errors.push(errMsg)
                console.error(errMsg)
            }
        }
    } catch (error) {
        const errMsg = `Failed to fetch categories: ${error instanceof Error ? error.message : String(error)}`
        errors.push(errMsg)
        console.error(errMsg)
    }

    return {
        categoriesProcessed,
        productsUpdated,
        productsCleared,
        errors,
    }
}
