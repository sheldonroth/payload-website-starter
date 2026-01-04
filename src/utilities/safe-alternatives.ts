import type { Payload } from 'payload'
import { getThresholds } from './get-thresholds'
import { createAuditLog } from '../collections/AuditLog'
import { logError } from './error-logger'

/**
 * Safe Alternatives Utility
 *
 * Automatically suggests and populates safe alternatives
 * for products marked as AVOID.
 *
 * Finds products in the same category with RECOMMEND verdict
 * sorted by overallScore.
 */

interface AlternativeProduct {
    id: number
    name: string
    brand?: string
    overallScore?: number
}

interface AlternativesResult {
    alternatives: AlternativeProduct[]
    populated: boolean
    message: string
}

/**
 * Find safe alternatives for an AVOID product
 */
export async function findSafeAlternatives(
    payload: Payload,
    productData: {
        id: number
        name: string
        category?: number
        verdict?: string
        comparedWith?: number[]
    }
): Promise<AlternativesResult> {
    const result: AlternativesResult = {
        alternatives: [],
        populated: false,
        message: '',
    }

    // Check if auto alternatives are enabled
    const thresholds = await getThresholds(payload)
    if (!thresholds.enableAutoAlternatives) {
        result.message = 'Auto-suggest alternatives is disabled'
        return result
    }

    // Only suggest alternatives for AVOID products
    if (productData.verdict !== 'avoid') {
        result.message = 'Product is not marked as AVOID'
        return result
    }

    // Skip if already has alternatives
    if (productData.comparedWith && productData.comparedWith.length > 0) {
        result.message = 'Product already has alternatives set'
        return result
    }

    // Need a category to find similar products
    if (!productData.category) {
        result.message = 'No category set - cannot find alternatives'
        return result
    }

    try {
        // Find recommended products in same category
        const alternatives = await payload.find({
            collection: 'products',
            where: {
                and: [
                    { category: { equals: productData.category } },
                    { verdict: { equals: 'recommend' } },
                    { status: { equals: 'published' } },
                    { id: { not_equals: productData.id } }, // Exclude self
                ],
            },
            sort: '-overallScore',
            limit: thresholds.autoAlternativesLimit,
        })

        if (alternatives.docs.length === 0) {
            result.message = 'No recommended alternatives found in this category'
            return result
        }

        result.alternatives = alternatives.docs.map(doc => {
            const alt = doc as {
                id: number
                name: string
                brand?: string
                overallScore?: number
            }
            return {
                id: alt.id,
                name: alt.name,
                brand: alt.brand,
                overallScore: alt.overallScore,
            }
        })

        result.populated = true
        result.message = `Found ${result.alternatives.length} safe alternative(s)`

        return result
    } catch (error) {
        await logError(payload, {
            category: 'safe_alternatives_error',
            message: `Failed to find alternatives for "${productData.name}"`,
            targetCollection: 'products',
            targetId: productData.id,
            targetName: productData.name,
            error,
        })

        result.message = 'Failed to find alternatives'
        return result
    }
}

/**
 * Populate comparedWith field for an AVOID product
 * Called from Products afterChange hook
 */
export async function populateSafeAlternatives(
    payload: Payload,
    productId: number
): Promise<boolean> {
    try {
        // Fetch the product
        const product = await payload.findByID({
            collection: 'products',
            id: productId,
        })

        if (!product) return false

        const productData = product as {
            id: number
            name: string
            category?: number
            verdict?: string
            comparedWith?: Array<{ product: number }>
            status?: string
        }

        // Only auto-populate for published AVOID products without existing alternatives
        if (productData.verdict !== 'avoid') return false
        if (productData.status !== 'published') return false
        if (productData.comparedWith && productData.comparedWith.length > 0) return false

        // Find alternatives
        const result = await findSafeAlternatives(payload, {
            id: productId,
            name: productData.name,
            category: productData.category,
            verdict: productData.verdict,
        })

        if (!result.populated || result.alternatives.length === 0) return false

        // Update product with alternatives (comparedWith is a simple relationship array)
        await payload.update({
            collection: 'products',
            id: productId,
            data: {
                comparedWith: result.alternatives.map(alt => alt.id),
            },
        })

        // Log to audit
        await createAuditLog(payload, {
            action: 'ai_product_created', // Reusing action type for auto-population
            sourceType: 'system',
            targetCollection: 'products',
            targetId: productId,
            targetName: productData.name,
            metadata: {
                action: 'auto_populated_alternatives',
                alternativeCount: result.alternatives.length,
                alternativeIds: result.alternatives.map(a => a.id),
                alternativeNames: result.alternatives.map(a => a.name),
            },
        })

        console.log(`Auto-populated ${result.alternatives.length} alternatives for "${productData.name}"`)
        return true
    } catch (error) {
        console.error('Failed to populate safe alternatives:', error)
        return false
    }
}
