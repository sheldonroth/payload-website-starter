import type { Payload, PayloadHandler, PayloadRequest } from 'payload'
import { checkRateLimit, getRateLimitKey, rateLimitResponse, RateLimits } from '@/utilities/rate-limiter'
import { getServerSideURL } from '@/utilities/getURL'

/**
 * Background Removal Endpoint
 *
 * Uses Photoroom API to remove backgrounds from product images.
 * Supports both single product and batch processing.
 *
 * Endpoints:
 * - POST /api/background/remove - Remove background from single product
 * - POST /api/background/batch - Remove backgrounds from multiple products
 */

interface RemoveBackgroundRequest {
    productId: number
    preview?: boolean // If true, return preview without saving
    force?: boolean // If true, re-process even if already done
}

interface BatchRemoveRequest {
    productIds: number[]
    force?: boolean // If true, re-process even if already done
}

/**
 * Call Photoroom API to remove background from image
 */
async function removeBackgroundWithPhotoroom(imageBuffer: Buffer): Promise<Buffer> {
    const apiKey = process.env.PHOTOROOM_API_KEY

    if (!apiKey) {
        throw new Error('PHOTOROOM_API_KEY not configured')
    }

    // Create form data for Photoroom API
    const formData = new FormData()
    formData.append('image_file', new Blob([imageBuffer]), 'image.png')
    formData.append('size', 'full')
    formData.append('format', 'png')
    // Note: Omitting bg_color gives transparent background (PNG with alpha channel)
    // To use white background instead: formData.append('bg_color', 'white')

    const response = await fetch('https://sdk.photoroom.com/v1/segment', {
        method: 'POST',
        headers: {
            'x-api-key': apiKey,
        },
        body: formData,
    })

    if (!response.ok) {
        const errorText = await response.text()
        // Parse common Photoroom errors
        if (response.status === 401) {
            throw new Error('Photoroom API: Invalid API key')
        } else if (response.status === 402) {
            throw new Error('Photoroom API: Payment required / credits exhausted')
        } else if (response.status === 429) {
            throw new Error('Photoroom API: Rate limit exceeded')
        } else if (response.status === 400) {
            throw new Error(`Photoroom API: Bad request - ${errorText}`)
        }
        throw new Error(`Photoroom API error (${response.status}): ${errorText.slice(0, 200)}`)
    }

    return Buffer.from(await response.arrayBuffer())
}

/**
 * Fetch image from URL with timeout
 */
async function fetchImageFromUrl(url: string): Promise<Buffer> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000) // 15s timeout

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; ProductReport/1.0)',
            },
            signal: controller.signal,
        })
        clearTimeout(timeoutId)

        if (!response.ok) {
            if (response.status === 403) {
                throw new Error(`Image fetch blocked (403 Forbidden): ${url.slice(0, 100)}`)
            } else if (response.status === 404) {
                throw new Error(`Image not found (404): ${url.slice(0, 100)}`)
            }
            throw new Error(`Image fetch failed (${response.status}): ${url.slice(0, 100)}`)
        }

        const contentType = response.headers.get('content-type') || ''
        if (!contentType.includes('image')) {
            throw new Error(`URL is not an image (content-type: ${contentType}): ${url.slice(0, 100)}`)
        }

        const arrayBuffer = await response.arrayBuffer()
        if (arrayBuffer.byteLength === 0) {
            throw new Error(`Empty image response: ${url.slice(0, 100)}`)
        }

        return Buffer.from(arrayBuffer)
    } catch (error) {
        clearTimeout(timeoutId)
        if (error instanceof Error) {
            if (error.name === 'AbortError') {
                throw new Error(`Timeout (15s): ${url.slice(0, 100)}`)
            }
            // Wrap any other error with URL context
            throw new Error(`Fetch failed for ${url.slice(0, 80)}: ${error.message}`)
        }
        throw new Error(`Fetch failed for ${url.slice(0, 80)}: Unknown error`)
    }
}

/**
 * Internalize an external image URL by downloading and storing in Media collection
 * Returns the new Media ID
 */
async function internalizeExternalImage(
    payload: Payload,
    imageUrl: string,
    productId: number,
    productName: string,
    brandName: string | null
): Promise<{ mediaId: number; buffer: Buffer }> {
    console.log(`Internalizing external image for product ${productId}: ${imageUrl.slice(0, 80)}...`)

    // Download the external image
    const buffer = await fetchImageFromUrl(imageUrl)

    // Generate a filename
    const safeBrand = (brandName || 'product').toLowerCase().replace(/[^a-z0-9]/g, '-')
    const safeName = productName.toLowerCase().replace(/[^a-z0-9]/g, '-')

    // Detect extension from URL or default to jpg
    const urlPath = new URL(imageUrl).pathname
    const ext = urlPath.match(/\.(jpg|jpeg|png|gif|webp)$/i)?.[1]?.toLowerCase() || 'jpg'
    const filename = `${safeBrand}-${safeName}-${Date.now()}.${ext}`

    // Determine mimetype
    const mimeTypes: Record<string, string> = {
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        gif: 'image/gif',
        webp: 'image/webp',
    }
    const mimetype = mimeTypes[ext] || 'image/jpeg'

    // Upload to Media collection
    const media = await payload.create({
        collection: 'media',
        data: {
            alt: `${brandName || ''} ${productName}`.trim(),
        },
        file: {
            data: buffer,
            name: filename,
            mimetype,
            size: buffer.length,
        },
    })

    console.log(`Internalized image for product ${productId} -> Media ID: ${media.id}`)

    return { mediaId: media.id as number, buffer }
}

/**
 * Get image buffer from product (either from external URL or Media relationship)
 * If external URL, internalizes it first and updates the product
 */
async function getProductImageBuffer(
    payload: Payload,
    productId: number,
    product: {
        imageUrl?: string | null
        image?: { url?: string; id?: number } | number | null
        name?: string
        brand?: { name?: string } | null
    }
): Promise<{ buffer: Buffer; source: 'url' | 'media'; mediaId?: number }> {
    // Priority 1: If external URL, internalize it first
    if (product.imageUrl) {
        const productName = (product.name as string) || 'product'
        const brandName = product.brand?.name || null

        const { mediaId, buffer } = await internalizeExternalImage(
            payload,
            product.imageUrl,
            productId,
            productName,
            brandName
        )

        // Update the product to use the internal image and clear external URL
        await payload.update({
            collection: 'products',
            id: productId,
            data: {
                image: mediaId,
                imageUrl: null, // Clear external URL
            },
        })

        return { buffer, source: 'url', mediaId }
    }

    // Priority 2: Try Media relationship (already internal)
    if (product.image) {
        let mediaUrl: string | undefined
        let mediaId: number | undefined

        if (typeof product.image === 'number') {
            // Just an ID, need to fetch the media document
            const media = await payload.findByID({
                collection: 'media',
                id: product.image,
            })
            mediaUrl = media.url as string | undefined
            mediaId = media.id as number
        } else if (typeof product.image === 'object' && product.image.url) {
            mediaUrl = product.image.url
            mediaId = product.image.id
        }

        if (mediaUrl) {
            // Handle relative URLs - use getServerSideURL for production
            const fullUrl = mediaUrl.startsWith('http')
                ? mediaUrl
                : `${getServerSideURL()}${mediaUrl}`

            const buffer = await fetchImageFromUrl(fullUrl)
            return { buffer, source: 'media', mediaId }
        }
    }

    throw new Error('No image found - product has neither imageUrl nor image attachment')
}

/**
 * Upload processed image to Media collection
 * Includes verification to ensure URL is properly set (workaround for Vercel Blob timing issue)
 */
async function uploadProcessedImage(
    payload: Payload,
    imageBuffer: Buffer,
    productName: string,
    brand: string | null
): Promise<number> {
    const safeBrand = (brand || 'product').toLowerCase().replace(/[^a-z0-9]/g, '-')
    const safeName = productName.toLowerCase().replace(/[^a-z0-9]/g, '-')
    const filename = `${safeBrand}-${safeName}-nobg-${Date.now()}.png`

    console.log(`[BG Remove] Creating media document: ${filename} (${imageBuffer.length} bytes)`)

    const media = await payload.create({
        collection: 'media',
        data: {
            alt: `${brand || ''} ${productName} - background removed`.trim(),
        },
        file: {
            data: imageBuffer,
            name: filename,
            mimetype: 'image/png',
            size: imageBuffer.length,
        },
    })

    console.log(`[BG Remove] Media document created: ID=${media.id}, URL=${(media as any).url}`)

    // Workaround: Vercel Blob storage plugin sometimes doesn't populate URL immediately
    // Re-fetch to verify URL is set, and if not, construct it manually
    const verifyMedia = await payload.findByID({
        collection: 'media',
        id: media.id as number,
    })

    if (!verifyMedia.url && verifyMedia.filename) {
        console.log(`[BG Remove] URL not set, constructing from blob storage pattern...`)
        // Construct URL based on Vercel Blob storage pattern
        const blobUrl = `https://4cqt8agccocxf8ch.public.blob.vercel-storage.com/${verifyMedia.filename}`
        await payload.update({
            collection: 'media',
            id: media.id as number,
            data: {
                url: blobUrl,
            },
        })
        console.log(`[BG Remove] Manually set URL: ${blobUrl}`)
    }

    return media.id as number
}

/**
 * Process a single product's background removal
 */
async function processProductBackgroundRemoval(
    payload: Payload,
    productId: number,
    preview: boolean = false,
    force: boolean = false
): Promise<{
    success: boolean
    productId: number
    previewBase64?: string
    newMediaId?: number
    error?: string
}> {
    console.log(`[BG Remove] Starting background removal for product ${productId} (preview=${preview}, force=${force})`)

    try {
        // Fetch product with image relationship populated
        const product = await payload.findByID({
            collection: 'products',
            id: productId,
            depth: 1,
        })

        console.log(`[BG Remove] Product ${productId} fetched: name="${product?.name}", hasImage=${!!(product as any)?.image}, hasImageUrl=${!!(product as any)?.imageUrl}, backgroundRemoved=${(product as any)?.backgroundRemoved}`)

        if (!product) {
            return { success: false, productId, error: 'Product not found' }
        }

        // Skip if already processed (unless in preview mode or force is true)
        if ((product as any).backgroundRemoved && !preview && !force) {
            return { success: false, productId, error: 'Background already removed (use force=true to re-process)' }
        }

        // Get image buffer (internalizes external URLs first)
        const { buffer: originalBuffer, source } = await getProductImageBuffer(payload, productId, product as any)
        console.log(`[BG Remove] Got image buffer: source=${source}, size=${originalBuffer.length} bytes`)

        // Check image size (Photoroom limit is 25MB)
        if (originalBuffer.length > 25 * 1024 * 1024) {
            return { success: false, productId, error: 'Image too large (max 25MB)' }
        }

        // Remove background using Photoroom
        console.log(`[BG Remove] Calling Photoroom API...`)
        const processedBuffer = await removeBackgroundWithPhotoroom(originalBuffer)
        console.log(`[BG Remove] Photoroom returned ${processedBuffer.length} bytes`)

        // If preview mode, return base64 without saving
        if (preview) {
            const previewBase64 = processedBuffer.toString('base64')
            return {
                success: true,
                productId,
                previewBase64: `data:image/png;base64,${previewBase64}`,
            }
        }

        // Upload processed image to Media collection
        const productName = (product.name as string) || 'product'
        // Brand is a text field, not a relationship
        const brandName = typeof product.brand === 'string' ? product.brand : null

        console.log(`[BG Remove] Uploading processed image for product ${productId}: ${brandName} ${productName}`)

        const newMediaId = await uploadProcessedImage(
            payload,
            processedBuffer,
            productName,
            brandName
        )

        console.log(`[BG Remove] Media created with ID ${newMediaId}, now updating product ${productId}`)

        // Update product with new media ID, clear external URL, and mark as processed
        const updateResult = await payload.update({
            collection: 'products',
            id: productId,
            data: {
                image: newMediaId,
                imageUrl: null, // Clear external URL since we now have a Media document
                backgroundRemoved: true, // Mark as processed to prevent duplicate charges
            },
        })

        console.log(`[BG Remove] Product ${productId} updated. New image ID: ${(updateResult as any).image}, backgroundRemoved: ${(updateResult as any).backgroundRemoved}`)

        return {
            success: true,
            productId,
            newMediaId,
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error(`Failed to remove background for product ${productId}:`, errorMessage)
        return {
            success: false,
            productId,
            error: errorMessage,
        }
    }
}

/**
 * Single product background removal handler
 * POST /api/background/remove
 */
export const backgroundRemoveHandler: PayloadHandler = async (req: PayloadRequest) => {
    // Authentication check
    if (!req.user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Rate limiting
    const rateLimitKey = getRateLimitKey(req as unknown as Request, req.user?.id)
    const rateLimit = checkRateLimit(rateLimitKey, RateLimits.BG_REMOVAL)
    if (!rateLimit.allowed) {
        return rateLimitResponse(rateLimit.resetAt)
    }

    // Check for API key
    if (!process.env.PHOTOROOM_API_KEY) {
        return Response.json(
            { error: 'Background removal API not configured. Please set PHOTOROOM_API_KEY.' },
            { status: 503 }
        )
    }

    try {
        const body = (await req.json?.()) as RemoveBackgroundRequest | undefined

        if (!body?.productId) {
            return Response.json({ error: 'productId is required' }, { status: 400 })
        }

        const result = await processProductBackgroundRemoval(
            req.payload,
            body.productId,
            body.preview ?? false,
            body.force ?? false
        )

        if (!result.success) {
            return Response.json({ error: result.error }, { status: 400 })
        }

        return Response.json({
            success: true,
            productId: result.productId,
            ...(result.previewBase64 && { preview: result.previewBase64 }),
            ...(result.newMediaId && { newMediaId: result.newMediaId }),
            remaining: rateLimit.remaining,
        })
    } catch (error) {
        console.error('Background removal error:', error)
        return Response.json(
            { error: error instanceof Error ? error.message : 'Background removal failed' },
            { status: 500 }
        )
    }
}

/**
 * Batch background removal handler
 * POST /api/background/batch
 */
export const backgroundBatchHandler: PayloadHandler = async (req: PayloadRequest) => {
    // Authentication check
    if (!req.user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Rate limiting for batch operations
    const rateLimitKey = getRateLimitKey(req as unknown as Request, req.user?.id)
    const rateLimit = checkRateLimit(rateLimitKey, RateLimits.BG_REMOVAL_BATCH)
    if (!rateLimit.allowed) {
        return rateLimitResponse(rateLimit.resetAt)
    }

    // Check for API key
    if (!process.env.PHOTOROOM_API_KEY) {
        return Response.json(
            { error: 'Background removal API not configured. Please set PHOTOROOM_API_KEY.' },
            { status: 503 }
        )
    }

    try {
        const body = (await req.json?.()) as BatchRemoveRequest | undefined

        if (!body?.productIds || !Array.isArray(body.productIds) || body.productIds.length === 0) {
            return Response.json({ error: 'productIds array is required' }, { status: 400 })
        }

        // Limit batch size to prevent abuse
        const MAX_BATCH_SIZE = 50
        if (body.productIds.length > MAX_BATCH_SIZE) {
            return Response.json(
                { error: `Batch size exceeds maximum of ${MAX_BATCH_SIZE} products` },
                { status: 400 }
            )
        }

        // Estimate cost for user confirmation
        const estimatedCost = body.productIds.length * 0.02

        // Process each product sequentially with delay to respect API rate limits
        const results: Array<{
            productId: number
            success: boolean
            newMediaId?: number
            error?: string
        }> = []

        for (let i = 0; i < body.productIds.length; i++) {
            const productId = body.productIds[i]

            // Add delay between requests to respect Photoroom rate limits (100/min)
            if (i > 0) {
                await new Promise((resolve) => setTimeout(resolve, 700)) // ~85 requests/min max
            }

            const result = await processProductBackgroundRemoval(req.payload, productId, false, body.force ?? false)
            results.push({
                productId: result.productId,
                success: result.success,
                ...(result.newMediaId && { newMediaId: result.newMediaId }),
                ...(result.error && { error: result.error }),
            })
        }

        const successCount = results.filter((r) => r.success).length
        const failureCount = results.filter((r) => !r.success).length

        return Response.json({
            success: true,
            processed: results.length,
            successCount,
            failureCount,
            estimatedCost: `$${estimatedCost.toFixed(2)}`,
            results,
        })
    } catch (error) {
        console.error('Batch background removal error:', error)
        return Response.json(
            { error: error instanceof Error ? error.message : 'Batch background removal failed' },
            { status: 500 }
        )
    }
}
