/**
 * Barcode Lookup Utility
 *
 * Multi-source product lookup from barcodes (UPC, EAN).
 * Sources (in order of priority):
 * 1. Local database (Products collection)
 * 2. Open Food Facts (free, food products)
 * 3. UPCitemdb (general products, free tier)
 *
 * @module utilities/barcode-lookup
 */

import type { Payload } from 'payload'

export interface BarcodeProduct {
    barcode: string
    name: string
    brand?: string
    description?: string
    imageUrl?: string
    ingredients?: string
    nutritionFacts?: {
        servingSize?: string
        calories?: number
        fat?: number
        saturatedFat?: number
        carbs?: number
        sugar?: number
        fiber?: number
        protein?: number
        sodium?: number
    }
    categories?: string[]
    source: 'local' | 'open_food_facts' | 'upcitemdb' | 'user_submission'
    confidence: number
}

export interface BarcodeNotFound {
    found: false
    barcode: string
    message: string
    suggestion?: string
}

export interface BarcodeFound {
    found: true
    product: BarcodeProduct
    localProductId?: number
}

export type BarcodeResult = BarcodeFound | BarcodeNotFound

/**
 * Look up a product by barcode from multiple sources
 */
export async function lookupBarcode(
    barcode: string,
    payload?: Payload,
    options: {
        skipLocal?: boolean
        skipExternal?: boolean
    } = {}
): Promise<BarcodeResult> {
    // Normalize barcode (remove leading zeros for UPC-A to EAN-13 conversion)
    const normalizedBarcode = barcode.replace(/^0+/, '').padStart(12, '0')

    // 1. Check local database first
    if (payload && !options.skipLocal) {
        const localResult = await lookupLocal(normalizedBarcode, payload)
        if (localResult.found) {
            return localResult
        }
        // Also try original barcode format
        if (normalizedBarcode !== barcode) {
            const originalResult = await lookupLocal(barcode, payload)
            if (originalResult.found) {
                return originalResult
            }
        }
    }

    if (options.skipExternal) {
        return {
            found: false,
            barcode,
            message: 'Product not found in local database',
            suggestion: 'Scan product photos to help add it',
        }
    }

    // 2. Try Open Food Facts (best for food products)
    const offResult = await lookupOpenFoodFacts(barcode)
    if (offResult.found) {
        return offResult
    }

    // 3. Try UPCitemdb (general products)
    const upcResult = await lookupUPCitemdb(barcode)
    if (upcResult.found) {
        return upcResult
    }

    return {
        found: false,
        barcode,
        message: 'Product not found in any database',
        suggestion: 'Help add this product by capturing front & back photos',
    }
}

/**
 * Look up in local Products collection
 */
async function lookupLocal(barcode: string, payload: Payload): Promise<BarcodeResult> {
    try {
        const result = await payload.find({
            collection: 'products',
            where: {
                upc: { equals: barcode },
            },
            limit: 1,
        })

        if (result.docs.length > 0) {
            const product = result.docs[0] as {
                id: number
                name: string
                brand?: string
                description?: string
                ingredientsRaw?: string
                upc?: string
                image?: { url?: string } | number
            }

            return {
                found: true,
                product: {
                    barcode,
                    name: product.name,
                    brand: product.brand,
                    description: product.description,
                    ingredients: product.ingredientsRaw,
                    imageUrl: typeof product.image === 'object' ? product.image?.url : undefined,
                    source: 'local',
                    confidence: 1.0,
                },
                localProductId: product.id,
            }
        }

        return {
            found: false,
            barcode,
            message: 'Not found locally',
        }
    } catch (error) {
        console.error('[Barcode Lookup] Local lookup error:', error)
        return {
            found: false,
            barcode,
            message: 'Database error',
        }
    }
}

/**
 * Look up in Open Food Facts (free, open-source food database)
 * API Docs: https://wiki.openfoodfacts.org/API
 */
async function lookupOpenFoodFacts(barcode: string): Promise<BarcodeResult> {
    try {
        const response = await fetch(
            `https://world.openfoodfacts.org/api/v2/product/${barcode}.json`,
            {
                headers: {
                    'User-Agent': 'TheProductReport/1.0 (contact@theproductreport.com)',
                },
            }
        )

        if (!response.ok) {
            return {
                found: false,
                barcode,
                message: 'Open Food Facts API error',
            }
        }

        const data = await response.json()

        if (data.status !== 1 || !data.product) {
            return {
                found: false,
                barcode,
                message: 'Not found in Open Food Facts',
            }
        }

        const p = data.product

        // Extract nutrition facts
        const nutrients = p.nutriments || {}
        const nutritionFacts = {
            servingSize: p.serving_size,
            calories: nutrients['energy-kcal_serving'] || nutrients['energy-kcal_100g'],
            fat: nutrients.fat_serving || nutrients.fat_100g,
            saturatedFat: nutrients['saturated-fat_serving'] || nutrients['saturated-fat_100g'],
            carbs: nutrients.carbohydrates_serving || nutrients.carbohydrates_100g,
            sugar: nutrients.sugars_serving || nutrients.sugars_100g,
            fiber: nutrients.fiber_serving || nutrients.fiber_100g,
            protein: nutrients.proteins_serving || nutrients.proteins_100g,
            sodium: nutrients.sodium_serving || nutrients.sodium_100g,
        }

        return {
            found: true,
            product: {
                barcode,
                name: p.product_name || p.product_name_en || 'Unknown Product',
                brand: p.brands || p.brand_owner,
                description: p.generic_name || p.generic_name_en,
                imageUrl: p.image_front_url || p.image_url,
                ingredients: p.ingredients_text || p.ingredients_text_en,
                nutritionFacts: Object.values(nutritionFacts).some(v => v !== undefined)
                    ? nutritionFacts
                    : undefined,
                categories: p.categories_tags?.map((c: string) =>
                    c.replace('en:', '').replace(/-/g, ' ')
                ),
                source: 'open_food_facts',
                confidence: p.completeness ? Math.min(p.completeness, 1) : 0.8,
            },
        }
    } catch (error) {
        console.error('[Barcode Lookup] Open Food Facts error:', error)
        return {
            found: false,
            barcode,
            message: 'Open Food Facts lookup failed',
        }
    }
}

/**
 * Look up in UPCitemdb (general product database)
 * API Docs: https://www.upcitemdb.com/wp/docs/main/development/getting-started/
 * Free tier: 100 requests/day
 */
async function lookupUPCitemdb(barcode: string): Promise<BarcodeResult> {
    try {
        // Use the trial endpoint (no API key needed, 100/day limit)
        const response = await fetch(
            `https://api.upcitemdb.com/prod/trial/lookup?upc=${barcode}`,
            {
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'TheProductReport/1.0',
                },
            }
        )

        if (!response.ok) {
            // Check for rate limit
            if (response.status === 429) {
                console.warn('[Barcode Lookup] UPCitemdb rate limit exceeded')
            }
            return {
                found: false,
                barcode,
                message: 'UPCitemdb API error',
            }
        }

        const data = await response.json()

        if (data.code !== 'OK' || !data.items || data.items.length === 0) {
            return {
                found: false,
                barcode,
                message: 'Not found in UPCitemdb',
            }
        }

        const item = data.items[0]

        return {
            found: true,
            product: {
                barcode,
                name: item.title || 'Unknown Product',
                brand: item.brand,
                description: item.description,
                imageUrl: item.images?.[0],
                categories: item.category ? [item.category] : undefined,
                source: 'upcitemdb',
                confidence: 0.75, // Lower confidence than OFF since less food-specific
            },
        }
    } catch (error) {
        console.error('[Barcode Lookup] UPCitemdb error:', error)
        return {
            found: false,
            barcode,
            message: 'UPCitemdb lookup failed',
        }
    }
}

/**
 * Save external product data to local database
 */
export async function saveProductFromLookup(
    product: BarcodeProduct,
    payload: Payload,
    options: {
        status?: 'ai_draft' | 'published' | 'review'
        createdBy?: number
    } = {}
): Promise<{ id: number; created: boolean }> {
    // Check if already exists
    const existing = await payload.find({
        collection: 'products',
        where: {
            upc: { equals: product.barcode },
        },
        limit: 1,
    })

    if (existing.docs.length > 0) {
        return {
            id: (existing.docs[0] as { id: number }).id,
            created: false,
        }
    }

    // Create new product
    // @ts-expect-error Product fields may not be in generated types yet
    const newProduct = await payload.create({
        collection: 'products',
        data: {
            name: product.name,
            brand: product.brand || 'Unknown',
            upc: product.barcode,
            status: options.status || 'ai_draft',
            verdict: 'recommend', // Default, will be analyzed
            verdictReason: `Auto-imported from ${product.source}`,
            sourceUrl: product.source === 'open_food_facts'
                ? `https://world.openfoodfacts.org/product/${product.barcode}`
                : undefined,
        },
    })

    return {
        id: (newProduct as { id: number }).id,
        created: true,
    }
}
