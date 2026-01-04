import type { PayloadHandler, PayloadRequest } from 'payload'
import { extractProductFromImage, extractFromMediaItem, ExtractedProductData } from '../utilities/image-extraction'
import { createAuditLog } from '../collections/AuditLog'

/**
 * Image Extract Endpoint
 * POST /api/products/extract-from-image
 *
 * Extracts product information from an image using GPT-4 Vision.
 *
 * Request body options:
 * - { imageBase64: string } - Base64 encoded image
 * - { mediaId: number } - ID of existing media item
 * - { productId: number } - Extract from product's existing image
 */

interface ExtractRequest {
    imageBase64?: string
    mimeType?: string
    mediaId?: number
    productId?: number
}

interface ExtractResponse {
    success: boolean
    data?: ExtractedProductData
    message: string
    productId?: number
}

export const imageExtractHandler: PayloadHandler = async (req: PayloadRequest) => {
    // Require authentication
    if (!req.user) {
        return Response.json({
            success: false,
            message: 'Authentication required',
        }, { status: 401 })
    }

    try {
        const body = await req.json?.() as ExtractRequest

        if (!body.imageBase64 && !body.mediaId && !body.productId) {
            return Response.json({
                success: false,
                message: 'Provide imageBase64, mediaId, or productId',
            }, { status: 400 })
        }

        let extracted: ExtractedProductData

        // Option 1: Extract from base64 image
        if (body.imageBase64) {
            extracted = await extractProductFromImage(body.imageBase64, {
                mimeType: body.mimeType,
            })
        }
        // Option 2: Extract from media item
        else if (body.mediaId) {
            extracted = await extractFromMediaItem(req.payload, body.mediaId)
        }
        // Option 3: Extract from product's image
        else if (body.productId) {
            const product = await req.payload.findByID({
                collection: 'products',
                id: body.productId,
            })

            if (!product) {
                return Response.json({
                    success: false,
                    message: 'Product not found',
                }, { status: 404 })
            }

            const productData = product as {
                image?: number | { id: number }
                name?: string
            }

            let mediaId: number | undefined
            if (productData.image) {
                if (typeof productData.image === 'number') {
                    mediaId = productData.image
                } else if (productData.image.id) {
                    mediaId = productData.image.id
                }
            }

            if (!mediaId) {
                return Response.json({
                    success: false,
                    message: 'Product has no image',
                }, { status: 400 })
            }

            extracted = await extractFromMediaItem(req.payload, mediaId)
        } else {
            return Response.json({
                success: false,
                message: 'Invalid request',
            }, { status: 400 })
        }

        // Log the extraction
        await createAuditLog(req.payload, {
            action: 'image_enriched',
            sourceType: 'manual',
            targetCollection: 'products',
            targetId: body.productId,
            aiModel: 'gpt-4o',
            confidence: Math.round(extracted.confidence * 100),
            performedBy: (req.user as { id?: number })?.id,
            metadata: {
                mediaId: body.mediaId,
                productId: body.productId,
                extractedData: extracted,
            },
        })

        const response: ExtractResponse = {
            success: extracted.confidence > 0.5,
            data: extracted,
            message: extracted.error || (extracted.confidence > 0.5
                ? `Extracted with ${Math.round(extracted.confidence * 100)}% confidence`
                : 'Low confidence extraction'),
            productId: body.productId,
        }

        return Response.json(response)
    } catch (error) {
        console.error('Image extract error:', error)
        return Response.json({
            success: false,
            message: 'Failed to process image',
        }, { status: 500 })
    }
}

/**
 * Apply extraction to product
 * POST /api/products/extract-from-image/apply
 *
 * Extracts from product image and updates the product fields
 */
export const imageExtractApplyHandler: PayloadHandler = async (req: PayloadRequest) => {
    // Require authentication
    if (!req.user) {
        return Response.json({
            success: false,
            message: 'Authentication required',
        }, { status: 401 })
    }

    try {
        const body = await req.json?.() as { productId: number }

        if (!body.productId) {
            return Response.json({
                success: false,
                message: 'productId is required',
            }, { status: 400 })
        }

        // Fetch product
        const product = await req.payload.findByID({
            collection: 'products',
            id: body.productId,
        })

        if (!product) {
            return Response.json({
                success: false,
                message: 'Product not found',
            }, { status: 404 })
        }

        const productData = product as {
            id: number
            name?: string
            brand?: string
            ingredientsRaw?: string
            upc?: string
            image?: number | { id: number }
        }

        // Get media ID
        let mediaId: number | undefined
        if (productData.image) {
            if (typeof productData.image === 'number') {
                mediaId = productData.image
            } else if (productData.image.id) {
                mediaId = productData.image.id
            }
        }

        if (!mediaId) {
            return Response.json({
                success: false,
                message: 'Product has no image',
            }, { status: 400 })
        }

        // Extract from image
        const extracted = await extractFromMediaItem(req.payload, mediaId)

        if (extracted.confidence < 0.5) {
            return Response.json({
                success: false,
                message: extracted.error || 'Low confidence extraction',
                data: extracted,
            })
        }

        // Build update data (only update empty fields)
        const updateData: Record<string, unknown> = {}
        const updatedFields: string[] = []

        if (!productData.name && extracted.productName) {
            updateData.name = extracted.productName
            updatedFields.push('name')
        }

        if (!productData.brand && extracted.brand) {
            updateData.brand = extracted.brand
            updatedFields.push('brand')
        }

        if (!productData.ingredientsRaw && extracted.ingredients) {
            updateData.ingredientsRaw = extracted.ingredients
            updatedFields.push('ingredientsRaw')
        }

        if (!productData.upc && extracted.upc) {
            updateData.upc = extracted.upc
            updatedFields.push('upc')
        }

        if (Object.keys(updateData).length === 0) {
            return Response.json({
                success: true,
                message: 'No empty fields to populate',
                data: extracted,
            })
        }

        // Update product
        await req.payload.update({
            collection: 'products',
            id: body.productId,
            data: updateData,
        })

        // Log the update
        await createAuditLog(req.payload, {
            action: 'image_enriched',
            sourceType: 'manual',
            targetCollection: 'products',
            targetId: body.productId,
            aiModel: 'gpt-4o',
            confidence: Math.round(extracted.confidence * 100),
            performedBy: (req.user as { id?: number })?.id,
            before: {
                name: productData.name,
                brand: productData.brand,
                ingredientsRaw: productData.ingredientsRaw,
                upc: productData.upc,
            },
            after: updateData,
            metadata: {
                updatedFields,
                extractedData: extracted,
            },
        })

        return Response.json({
            success: true,
            message: `Updated ${updatedFields.length} field(s): ${updatedFields.join(', ')}`,
            data: extracted,
            updatedFields,
        })
    } catch (error) {
        console.error('Image extract apply error:', error)
        return Response.json({
            success: false,
            message: 'Failed to apply extraction',
        }, { status: 500 })
    }
}
