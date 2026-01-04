import type { PayloadHandler, PayloadRequest } from 'payload'
import { classifyCategory } from '../utilities/ai-category'

/**
 * Product Preview Endpoint
 *
 * POST /api/product/preview
 * Returns a preview of product data without creating it.
 * Includes AI category suggestion.
 *
 * Request body: { input: string } - URL, barcode, or product identifier
 */

interface ExtractedProduct {
    name: string
    brand?: string
    imageUrl?: string
    ingredients?: string
    summary?: string
    priceRange?: string
    sourceUrl?: string
}

interface PreviewResult {
    success: boolean
    inputType: string
    product: ExtractedProduct | null
    suggestedCategory?: {
        id: number | null
        name: string
        confidence: number
        reasoning: string
    }
    existingProduct?: {
        id: number
        name: string
        status: string
    }
    message: string
}

export const productPreviewHandler: PayloadHandler = async (req: PayloadRequest) => {
    if (!req.user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify admin or editor role
    const userRole = (req.user as { role?: string }).role
    const isAdminFlag = (req.user as { isAdmin?: boolean }).isAdmin
    if (userRole !== 'admin' && userRole !== 'product_editor' && !isAdminFlag) {
        return Response.json({ error: 'Forbidden: Admin or Editor access required' }, { status: 403 })
    }

    try {
        const body = await req.json?.()
        const { input } = body || {}

        if (!input) {
            return Response.json({ error: 'input is required' }, { status: 400 })
        }

        const payload = req.payload
        const baseUrl = req.headers.get('origin') || process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'

        // Call unified-ingest with autoCreate=false for preview mode
        const ingestResponse = await fetch(`${baseUrl}/api/ingest`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': req.headers.get('cookie') || '',
            },
            body: JSON.stringify({
                input,
                autoCreate: false, // Preview mode - don't create
            }),
        })

        const ingestResult = await ingestResponse.json()

        // Build preview result
        const result: PreviewResult = {
            success: false,
            inputType: ingestResult.inputType || 'unknown',
            product: null,
            message: ingestResult.message || 'Preview failed',
        }

        // Handle different response types
        if (ingestResult.details?.extractedData) {
            // Product page or Amazon - has extracted data
            const extracted = ingestResult.details.extractedData
            result.success = true
            result.product = {
                name: extracted.name,
                brand: extracted.brand,
                imageUrl: extracted.imageUrl,
                ingredients: extracted.ingredients,
                summary: extracted.summary,
                priceRange: extracted.priceRange,
                sourceUrl: input,
            }
            result.message = 'Product data extracted - ready to create'

            // Check if already exists
            if (ingestResult.details.existingProductId) {
                result.existingProduct = {
                    id: ingestResult.details.existingProductId,
                    name: extracted.name,
                    status: ingestResult.details.existingProduct?.status || 'unknown',
                }
                result.message = `Product already exists: ${extracted.name}`
            }

            // Get AI category suggestion
            if (result.product) {
                const categoryResult = await classifyCategory(payload, {
                    name: result.product.name,
                    brand: result.product.brand,
                    ingredientsRaw: result.product.ingredients,
                })

                if (categoryResult.suggestion) {
                    result.suggestedCategory = {
                        id: categoryResult.suggestion.categoryId,
                        name: categoryResult.suggestion.categoryName,
                        confidence: categoryResult.suggestion.confidence,
                        reasoning: categoryResult.suggestion.reasoning,
                    }
                }
            }
        } else if (ingestResult.details?.productId) {
            // Barcode found existing product
            result.success = true
            result.existingProduct = {
                id: ingestResult.details.productId,
                name: ingestResult.details.name || `Product #${ingestResult.details.productId}`,
                status: ingestResult.details.status || 'unknown',
            }
            result.message = 'Existing product found'
        } else if (ingestResult.inputType === 'youtube' || ingestResult.inputType === 'youtube_channel') {
            // YouTube URLs should use video analysis instead
            result.success = false
            result.message = 'YouTube URLs extract multiple products. Use the main Magic Input for video analysis.'
        } else if (ingestResult.inputType === 'tiktok') {
            // TikTok URLs should use video analysis instead
            result.success = false
            result.message = 'TikTok URLs extract multiple products. Use the main Magic Input for video analysis.'
        } else if (!ingestResult.success) {
            result.message = ingestResult.message || 'Could not extract product data'
        }

        return Response.json(result)
    } catch (error) {
        console.error('[Product Preview] Error:', error)
        return Response.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Preview failed',
            },
            { status: 500 }
        )
    }
}

/**
 * Product Confirm Endpoint
 *
 * POST /api/product/confirm
 * Creates a product from previewed data.
 *
 * Request body: { product: ExtractedProduct, categoryId?: number }
 */
export const productConfirmHandler: PayloadHandler = async (req: PayloadRequest) => {
    if (!req.user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify admin or editor role
    const userRole = (req.user as { role?: string }).role
    const isAdminFlag = (req.user as { isAdmin?: boolean }).isAdmin
    if (userRole !== 'admin' && userRole !== 'product_editor' && !isAdminFlag) {
        return Response.json({ error: 'Forbidden: Admin or Editor access required' }, { status: 403 })
    }

    try {
        const body = await req.json?.()
        const { product, categoryId } = body || {}

        if (!product?.name) {
            return Response.json({ error: 'Product name is required' }, { status: 400 })
        }

        const payload = req.payload

        // Check for duplicate
        const existing = await payload.find({
            collection: 'products',
            where: {
                and: [
                    { name: { equals: product.name } },
                    ...(product.brand ? [{ brand: { equals: product.brand } }] : []),
                ],
            },
            limit: 1,
        })

        if (existing.docs.length > 0) {
            return Response.json({
                success: false,
                error: 'Product already exists',
                existingId: existing.docs[0].id,
            })
        }

        // Create the product
        const newProduct = await payload.create({
            collection: 'products',
            data: {
                name: product.name,
                brand: product.brand || 'Unknown',
                imageUrl: product.imageUrl,
                summary: product.summary,
                sourceUrl: product.sourceUrl,
                verdict: 'recommend', // Default
                status: 'ai_draft',
                priceRange: (product.priceRange || '$$') as '$' | '$$' | '$$$' | '$$$$',
                category: categoryId || undefined,
            },
        })

        return Response.json({
            success: true,
            productId: newProduct.id,
            message: `Created AI draft: ${product.name}`,
        })
    } catch (error) {
        console.error('[Product Confirm] Error:', error)
        return Response.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to create product',
            },
            { status: 500 }
        )
    }
}
