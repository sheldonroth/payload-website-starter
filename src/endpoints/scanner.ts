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
import { GoogleGenerativeAI } from '@google/generative-ai'
import {
    validationError,
    internalError,
    successResponse,
    externalServiceError,
} from '../utilities/api-response'

/**
 * @openapi
 * /scanner/lookup:
 *   post:
 *     summary: Look up product by barcode
 *     description: |
 *       Searches for a product using its barcode (UPC-A, EAN-13, etc.).
 *       Returns product details if found, or voting statistics if not.
 *     tags: [Scanner, Mobile]
 *     security:
 *       - fingerprintAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [barcode]
 *             properties:
 *               barcode:
 *                 type: string
 *                 description: Product barcode (8-14 digits)
 *                 example: "5000328657950"
 *               fingerprintHash:
 *                 type: string
 *                 description: Device fingerprint for tracking
 *               saveIfFound:
 *                 type: boolean
 *                 default: false
 *                 description: Save external product to local database
 *     responses:
 *       200:
 *         description: Product lookup result
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - type: object
 *                   properties:
 *                     found:
 *                       type: boolean
 *                       example: true
 *                     product:
 *                       $ref: '#/components/schemas/Product'
 *                 - type: object
 *                   properties:
 *                     found:
 *                       type: boolean
 *                       example: false
 *                     barcode:
 *                       type: string
 *                     message:
 *                       type: string
 *                     voteStats:
 *                       type: object
 *       400:
 *         description: Invalid barcode format
 *       429:
 *         $ref: '#/components/responses/RateLimited'
 */
export const scannerLookupHandler: PayloadHandler = async (req: PayloadRequest) => {
    try {
        const body = await req.json?.()
        const { barcode, fingerprintHash, saveIfFound = false } = body || {}

        if (!barcode) {
            return validationError('barcode is required')
        }

        // Validate barcode format (UPC-A: 12 digits, EAN-13: 13 digits)
        const cleanBarcode = barcode.toString().replace(/\D/g, '')
        if (cleanBarcode.length < 8 || cleanBarcode.length > 14) {
            return validationError('Invalid barcode format. Expected 8-14 digits.')
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
        return internalError('Failed to look up barcode')
    }
}

/**
 * @openapi
 * /scanner/submit:
 *   post:
 *     summary: Submit product photos for OCR processing
 *     description: |
 *       Submit product photos (front and/or back) for OCR processing.
 *       Creates a UserSubmission entry and optionally processes the back image
 *       for ingredient extraction using Gemini Vision.
 *
 *       **Supported Formats:**
 *       - `multipart/form-data` with file uploads
 *       - `application/json` with pre-uploaded media IDs
 *
 *       **OCR Processing:**
 *       The back image is processed using Gemini Vision AI to extract:
 *       - Raw label text
 *       - Normalized ingredient list
 *       - Confidence score
 *     tags: [Scanner, Mobile]
 *     security:
 *       - fingerprintAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [barcode]
 *             properties:
 *               barcode:
 *                 type: string
 *                 description: Product barcode
 *               frontImage:
 *                 type: string
 *                 format: binary
 *                 description: Front of product image
 *               backImage:
 *                 type: string
 *                 format: binary
 *                 description: Back of product (ingredients label)
 *               fingerprintHash:
 *                 type: string
 *               content:
 *                 type: string
 *                 description: Optional notes about the product
 *         application/json:
 *           schema:
 *             type: object
 *             required: [barcode]
 *             properties:
 *               barcode:
 *                 type: string
 *               frontImageId:
 *                 type: integer
 *                 description: Media ID of uploaded front image
 *               backImageId:
 *                 type: integer
 *                 description: Media ID of uploaded back image
 *               fingerprintHash:
 *                 type: string
 *               content:
 *                 type: string
 *     responses:
 *       200:
 *         description: Photos submitted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 submissionId:
 *                   type: integer
 *                 imagesUploaded:
 *                   type: integer
 *                 ocrResult:
 *                   type: object
 *                   properties:
 *                     success:
 *                       type: boolean
 *                     ingredients:
 *                       type: string
 *                     rawText:
 *                       type: string
 *                     confidence:
 *                       type: number
 *                     error:
 *                       type: string
 *                 message:
 *                   type: string
 *       400:
 *         description: Missing barcode or images
 *       500:
 *         $ref: '#/components/responses/InternalError'
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
                return validationError('Invalid form data')
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
            return validationError('barcode is required')
        }

        if (!frontImageId && !backImageId) {
            return validationError('At least one image is required (frontImageId or backImageId)')
        }

        // Build images array for UserSubmission
        const images: { image: number; imageType: string }[] = []
        if (frontImageId) {
            images.push({ image: frontImageId, imageType: 'front' })
        }
        if (backImageId) {
            images.push({ image: backImageId, imageType: 'back' })
        }

        // Create UserSubmission (use Function cast to bypass strict type checking)
        const submission = await (req.payload.create as Function)({
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
        return internalError('Failed to submit product photos')
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
 * Process back image with OCR using Gemini Vision
 */
async function processBackImage(
    mediaId: number,
    payload: PayloadRequest['payload']
): Promise<{ success: boolean; ingredients?: string; rawText?: string; confidence?: number; error?: string }> {
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

        // Use Gemini Vision for OCR
        const geminiKey = process.env.GEMINI_API_KEY
        if (!geminiKey) {
            console.warn('[Scanner] Gemini API key not configured, skipping OCR')
            return { success: false, error: 'OCR not configured' }
        }

        // Fetch image and convert to base64
        const imageResponse = await fetch(mediaUrl)
        if (!imageResponse.ok) {
            return { success: false, error: 'Failed to fetch image' }
        }
        const imageBuffer = await imageResponse.arrayBuffer()
        const base64Image = Buffer.from(imageBuffer).toString('base64')
        const mimeType = imageResponse.headers.get('content-type') || 'image/jpeg'

        // Initialize Gemini
        const genAI = new GoogleGenerativeAI(geminiKey)
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

        const prompt = `You are an expert at reading nutrition and ingredient labels from product photos.
Extract ALL ingredients from this label image.

Rules:
1. Extract every ingredient mentioned, including sub-ingredients in parentheses
2. Normalize ingredient names (e.g., "SODIUM CHLORIDE" -> "Salt")
3. Remove quantities and percentages, just list ingredient names
4. List in order of appearance (highest to lowest by weight)
5. If parts are unclear, note them

Return ONLY valid JSON in this exact format:
{
  "rawText": "Full text from the label",
  "ingredients": ["ingredient1", "ingredient2", ...],
  "confidence": 0.95,
  "unclear": ["any unclear parts"]
}`

        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    mimeType,
                    data: base64Image,
                },
            },
        ])

        const responseText = result.response.text()

        // Extract JSON from response
        const jsonMatch = responseText.match(/\{[\s\S]*\}/)
        if (!jsonMatch) {
            console.error('[Scanner] No JSON in Gemini response:', responseText)
            return { success: false, error: 'Invalid OCR response format' }
        }

        const parsed = JSON.parse(jsonMatch[0])

        return {
            success: true,
            ingredients: parsed.ingredients?.join(', '),
            rawText: parsed.rawText,
            confidence: parsed.confidence,
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
