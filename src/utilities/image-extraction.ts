import type { Payload } from 'payload'
import { createAuditLog } from '../collections/AuditLog'
import { logError } from './error-logger'

/**
 * Image Extraction Utility
 *
 * Uses GPT-4 Vision to extract product information from images.
 * Shared utility used by:
 * - Crowdsource submissions
 * - Admin product creation
 * - Bulk import
 */

export interface ExtractedProductData {
    productName?: string
    brand?: string
    upc?: string
    ingredients?: string
    confidence: number
    error?: string
}

/**
 * Extract product info from image using GPT-4 Vision
 */
export async function extractProductFromImage(
    imageBase64: string,
    options: {
        mimeType?: string
    } = {}
): Promise<ExtractedProductData> {
    const openaiKey = process.env.OPENAI_API_KEY
    if (!openaiKey) {
        return { confidence: 0, error: 'OpenAI API key not configured' }
    }

    const mimeType = options.mimeType || 'image/jpeg'

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${openaiKey}`,
            },
            body: JSON.stringify({
                model: 'gpt-4o',
                messages: [
                    {
                        role: 'system',
                        content: `You are a product label reader. Extract product information from the image.
Return ONLY valid JSON with this schema:
{
  "productName": "Full product name",
  "brand": "Brand name",
  "upc": "UPC/barcode if visible",
  "ingredients": "Full ingredient list if visible",
  "confidence": 0.95
}
If a field is not visible, omit it.
For confidence, use:
- 0.9+ if text is clear and complete
- 0.7-0.9 if partially readable
- 0.5-0.7 if uncertain
- Below 0.5 if mostly guessing`,
                    },
                    {
                        role: 'user',
                        content: [
                            { type: 'text', text: 'Extract product info from this label:' },
                            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
                        ],
                    },
                ],
                max_tokens: 1500,
                response_format: { type: 'json_object' },
            }),
        })

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            return { confidence: 0, error: `OpenAI API error: ${response.status}` }
        }

        const data = await response.json()
        const content = data.choices?.[0]?.message?.content
        if (!content) {
            return { confidence: 0, error: 'AI returned empty response' }
        }

        return JSON.parse(content) as ExtractedProductData
    } catch (error) {
        console.error('Failed to extract from image:', error)
        return {
            confidence: 0,
            error: error instanceof Error ? error.message : 'AI extraction failed',
        }
    }
}

/**
 * Extract product info from a media item in the database
 */
export async function extractFromMediaItem(
    payload: Payload,
    mediaId: number
): Promise<ExtractedProductData> {
    try {
        const media = await payload.findByID({
            collection: 'media',
            id: mediaId,
        })

        if (!media) {
            return { confidence: 0, error: 'Media not found' }
        }

        const mediaData = media as {
            url?: string
            filename?: string
            mimeType?: string
        }

        if (!mediaData.url) {
            return { confidence: 0, error: 'Media has no URL' }
        }

        // Fetch the image
        const imageResponse = await fetch(mediaData.url)
        if (!imageResponse.ok) {
            return { confidence: 0, error: 'Failed to fetch image' }
        }

        const imageBuffer = await imageResponse.arrayBuffer()
        const imageBase64 = Buffer.from(imageBuffer).toString('base64')

        return extractProductFromImage(imageBase64, {
            mimeType: mediaData.mimeType,
        })
    } catch (error) {
        console.error('Failed to extract from media:', error)
        return {
            confidence: 0,
            error: error instanceof Error ? error.message : 'Failed to process media',
        }
    }
}

/**
 * Extract and populate product fields from an image
 * Used in Products beforeChange hook
 */
export async function extractAndPopulateProduct(
    payload: Payload,
    productData: {
        name?: string
        brand?: string
        ingredientsRaw?: string
        upc?: string
        image?: number | { id: number }
    }
): Promise<{
    updated: boolean
    extractedData?: ExtractedProductData
    fields: Partial<typeof productData>
}> {
    const result: {
        updated: boolean
        extractedData?: ExtractedProductData
        fields: Partial<typeof productData>
    } = {
        updated: false,
        fields: {},
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
        return result
    }

    // Skip if product already has essential fields
    if (productData.name && productData.ingredientsRaw) {
        return result
    }

    try {
        const extracted = await extractFromMediaItem(payload, mediaId)
        result.extractedData = extracted

        if (extracted.confidence < 0.5) {
            // Log low confidence extraction
            await logError(payload, {
                category: 'ocr_extraction_error',
                message: extracted.error || 'Low confidence OCR extraction',
                targetCollection: 'products',
                metadata: {
                    mediaId,
                    confidence: extracted.confidence,
                },
            })
            return result
        }

        // Populate missing fields
        if (!productData.name && extracted.productName) {
            result.fields.name = extracted.productName
            result.updated = true
        }

        if (!productData.brand && extracted.brand) {
            result.fields.brand = extracted.brand
            result.updated = true
        }

        if (!productData.ingredientsRaw && extracted.ingredients) {
            result.fields.ingredientsRaw = extracted.ingredients
            result.updated = true
        }

        if (!productData.upc && extracted.upc) {
            result.fields.upc = extracted.upc
            result.updated = true
        }

        if (result.updated) {
            await createAuditLog(payload, {
                action: 'image_enriched',
                sourceType: 'system',
                targetCollection: 'products',
                aiModel: 'gpt-4o',
                confidence: Math.round(extracted.confidence * 100),
                metadata: {
                    mediaId,
                    extractedFields: Object.keys(result.fields),
                    extractedData: extracted,
                },
            })
        }

        return result
    } catch (error) {
        await logError(payload, {
            category: 'ocr_extraction_error',
            message: 'Failed to extract from product image',
            targetCollection: 'products',
            error,
            metadata: { mediaId },
        })
        return result
    }
}
