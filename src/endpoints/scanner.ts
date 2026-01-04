/**
 * Scanner Endpoint
 *
 * Mobile-facing API for barcode scanning and product lookup.
 * POST /api/scanner/lookup - Look up product by barcode
 * POST /api/scanner/submit - Submit product photos for OCR processing
 *
 * @module endpoints/scanner
 */

import type { PayloadHandler, PayloadRequest } from 'payload'
import { lookupBarcode, saveProductFromLookup, BarcodeProduct } from '../utilities/barcode-lookup'
import { createAuditLog } from '../collections/AuditLog'

/**
 * POST /api/scanner/lookup
 *
 * Look up a product by barcode.
 * Returns product data if found, or voting info if not found.
 */
export const scannerLookupHandler: PayloadHandler = async (req: PayloadRequest) => {
    try {
        const body = await req.json?.()
        const { barcode, fingerprintHash, saveIfFound = false } = body || {}

        if (!barcode) {
            return Response.json(
                { error: 'barcode is required' },
                { status: 400 }
            )
        }

        // Validate barcode format (UPC-A: 12 digits, EAN-13: 13 digits)
        const cleanBarcode = barcode.toString().replace(/\D/g, '')
        if (cleanBarcode.length < 8 || cleanBarcode.length > 14) {
            return Response.json(
                { error: 'Invalid barcode format. Expected 8-14 digits.' },
                { status: 400 }
            )
        }

        // Look up barcode
        const result = await lookupBarcode(cleanBarcode, req.payload)

        // Log the scan
        await createAuditLog(req.payload, {
            action: 'scan_requested',
            sourceType: 'barcode',
            sourceUrl: cleanBarcode,
            performedBy: req.user ? (req.user as { id?: number }).id : undefined,
            metadata: {
                barcode: cleanBarcode,
                fingerprintHash,
                found: result.found,
                source: result.found ? result.product.source : undefined,
            },
        })

        if (result.found) {
            // Save to local database if requested and from external source
            let localProductId = result.localProductId
            if (saveIfFound && result.product.source !== 'local') {
                const saved = await saveProductFromLookup(result.product, req.payload)
                localProductId = saved.id
            }

            return Response.json({
                found: true,
                product: {
                    id: localProductId,
                    barcode: result.product.barcode,
                    name: result.product.name,
                    brand: result.product.brand,
                    description: result.product.description,
                    imageUrl: result.product.imageUrl,
                    ingredients: result.product.ingredients,
                    categories: result.product.categories,
                    source: result.product.source,
                    confidence: result.product.confidence,
                },
            })
        }

        // Product not found - get vote stats for this barcode
        const voteStats = await getVoteStats(cleanBarcode, req.payload)

        return Response.json({
            found: false,
            barcode: cleanBarcode,
            message: result.message,
            suggestion: result.suggestion,
            voteStats,
        })
    } catch (error) {
        console.error('[Scanner] Lookup error:', error)
        return Response.json(
            { error: 'Failed to look up barcode' },
            { status: 500 }
        )
    }
}

/**
 * POST /api/scanner/submit
 *
 * Submit product photos (front + back) for OCR processing.
 * Creates a UserSubmission and queues for processing.
 */
export const scannerSubmitHandler: PayloadHandler = async (req: PayloadRequest) => {
    try {
        // Check content type for multipart form data
        const contentType = req.headers.get('content-type') || ''

        let barcode: string
        let frontImageId: number | undefined
        let backImageId: number | undefined
        let fingerprintHash: string | undefined
        let content: string | undefined

        if (contentType.includes('multipart/form-data')) {
            // Handle file uploads
            const formData = await req.formData?.()
            if (!formData) {
                return Response.json({ error: 'Invalid form data' }, { status: 400 })
            }

            barcode = formData.get('barcode') as string
            fingerprintHash = formData.get('fingerprintHash') as string | undefined
            content = formData.get('content') as string | undefined

            const frontImage = formData.get('frontImage') as File | null
            const backImage = formData.get('backImage') as File | null

            // Upload images to Media collection
            if (frontImage && frontImage.size > 0) {
                const frontMedia = await uploadMedia(frontImage, req.payload, 'front', barcode)
                frontImageId = frontMedia?.id
            }

            if (backImage && backImage.size > 0) {
                const backMedia = await uploadMedia(backImage, req.payload, 'back', barcode)
                backImageId = backMedia?.id
            }
        } else {
            // Handle JSON with media IDs
            const body = await req.json?.()
            barcode = body?.barcode
            frontImageId = body?.frontImageId
            backImageId = body?.backImageId
            fingerprintHash = body?.fingerprintHash
            content = body?.content
        }

        if (!barcode) {
            return Response.json(
                { error: 'barcode is required' },
                { status: 400 }
            )
        }

        if (!frontImageId && !backImageId) {
            return Response.json(
                { error: 'At least one image is required (frontImageId or backImageId)' },
                { status: 400 }
            )
        }

        // Build images array for UserSubmission
        const images: { image: number; imageType: string }[] = []
        if (frontImageId) {
            images.push({ image: frontImageId, imageType: 'front' })
        }
        if (backImageId) {
            images.push({ image: backImageId, imageType: 'back' })
        }

        // Create UserSubmission
        // @ts-expect-error user-submissions collection exists but types not regenerated
        const submission = await req.payload.create({
            collection: 'user-submissions',
            data: {
                type: 'product_scan',
                barcode,
                content: content || `Product scan for barcode ${barcode}`,
                images,
                status: 'pending',
                fingerprintHash,
                submittedBy: req.user ? (req.user as { id: number }).id : undefined,
            },
        })

        // Queue OCR processing for back image
        let ocrResult: { success: boolean; ingredients?: string; error?: string } | undefined
        if (backImageId) {
            ocrResult = await processBackImage(backImageId, req.payload)
        }

        // Log the submission
        await createAuditLog(req.payload, {
            action: 'user_submission_created',
            sourceType: 'barcode',
            targetCollection: 'user-submissions',
            targetId: (submission as { id: number }).id,
            performedBy: req.user ? (req.user as { id?: number }).id : undefined,
            metadata: {
                barcode,
                hasfront: !!frontImageId,
                hasBack: !!backImageId,
                ocrSuccess: ocrResult?.success,
            },
        })

        return Response.json({
            success: true,
            submissionId: (submission as { id: number }).id,
            imagesUploaded: images.length,
            ocrResult,
            message: 'Product photos submitted for processing',
        })
    } catch (error) {
        console.error('[Scanner] Submit error:', error)
        return Response.json(
            { error: 'Failed to submit product photos' },
            { status: 500 }
        )
    }
}

/**
 * Upload a file to the Media collection
 */
async function uploadMedia(
    file: File,
    payload: PayloadRequest['payload'],
    type: 'front' | 'back',
    barcode: string
): Promise<{ id: number; url: string } | null> {
    try {
        const buffer = await file.arrayBuffer()
        const filename = `product-${barcode}-${type}-${Date.now()}.jpg`

        const media = await payload.create({
            collection: 'media',
            data: {
                alt: `${type} of product ${barcode}`,
                filename,
            },
            file: {
                data: Buffer.from(buffer),
                mimetype: file.type || 'image/jpeg',
                name: filename,
                size: file.size,
            },
        })

        return {
            id: (media as { id: number }).id,
            url: (media as { url?: string }).url || '',
        }
    } catch (error) {
        console.error(`[Scanner] Failed to upload ${type} image:`, error)
        return null
    }
}

/**
 * Process back image with OCR (label-decode)
 */
async function processBackImage(
    mediaId: number,
    payload: PayloadRequest['payload']
): Promise<{ success: boolean; ingredients?: string; error?: string }> {
    try {
        // Get media URL
        const media = await payload.findByID({
            collection: 'media',
            id: mediaId,
        })

        if (!media) {
            return { success: false, error: 'Media not found' }
        }

        const mediaUrl = (media as { url?: string }).url
        if (!mediaUrl) {
            return { success: false, error: 'Media URL not available' }
        }

        // Call GPT-4 Vision for OCR
        const openaiKey = process.env.OPENAI_API_KEY
        if (!openaiKey) {
            console.warn('[Scanner] OpenAI API key not configured, skipping OCR')
            return { success: false, error: 'OCR not configured' }
        }

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
                        content: `You are an expert at reading nutrition and ingredient labels from product photos.
Extract ALL ingredients from the label image.

Rules:
1. Extract every ingredient mentioned, including sub-ingredients in parentheses
2. Normalize ingredient names (e.g., "SODIUM CHLORIDE" -> "Salt")
3. Remove quantities and percentages, just list ingredient names
4. List in order of appearance (highest to lowest by weight)
5. If parts are unclear, note them

Return ONLY valid JSON:
{
  "rawText": "Full text from the label",
  "ingredients": ["ingredient1", "ingredient2", ...],
  "confidence": 0.95,
  "unclear": ["any unclear parts"]
}`
                    },
                    {
                        role: 'user',
                        content: [
                            { type: 'text', text: 'Extract all ingredients from this product label:' },
                            { type: 'image_url', image_url: { url: mediaUrl } },
                        ],
                    },
                ],
                max_tokens: 2000,
                response_format: { type: 'json_object' },
            }),
        })

        if (!response.ok) {
            console.error('[Scanner] OpenAI API error:', await response.text())
            return { success: false, error: 'OCR API error' }
        }

        const data = await response.json()
        const content = data.choices?.[0]?.message?.content

        if (!content) {
            return { success: false, error: 'No OCR response' }
        }

        const parsed = JSON.parse(content)

        return {
            success: true,
            ingredients: parsed.ingredients?.join(', '),
        }
    } catch (error) {
        console.error('[Scanner] OCR processing error:', error)
        return { success: false, error: 'OCR processing failed' }
    }
}

/**
 * Get vote statistics for a barcode
 */
async function getVoteStats(
    barcode: string,
    payload: PayloadRequest['payload']
): Promise<{
    totalVotes: number
    fundingProgress: number
    fundingThreshold: number
}> {
    try {
        // Check ProductVotes collection
        const votes = await payload.find({
            collection: 'product-votes' as 'users',
            where: {
                barcode: { equals: barcode },
            },
            limit: 1,
        })

        if (votes.docs.length > 0) {
            const vote = votes.docs[0] as {
                totalVotes?: number
                totalVoteWeight?: number
            }
            const threshold = 10000 // Default funding threshold
            const progress = Math.min(
                100,
                Math.round(((vote.totalVoteWeight || vote.totalVotes || 0) / threshold) * 100)
            )

            return {
                totalVotes: vote.totalVotes || 0,
                fundingProgress: progress,
                fundingThreshold: threshold,
            }
        }

        return {
            totalVotes: 0,
            fundingProgress: 0,
            fundingThreshold: 10000,
        }
    } catch (error) {
        console.error('[Scanner] Vote stats error:', error)
        return {
            totalVotes: 0,
            fundingProgress: 0,
            fundingThreshold: 10000,
        }
    }
}
