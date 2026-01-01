import type { Payload, PayloadHandler, PayloadRequest } from 'payload'
import { checkRateLimit, getRateLimitKey, rateLimitResponse, RateLimits } from '@/utilities/rate-limiter'

/**
 * Image Internalization Endpoint
 *
 * Migrates external image URLs to internal Media storage.
 * This eliminates dependency on external hosts and improves reliability.
 *
 * Endpoints:
 * - GET /api/images/internalize/status - Get count of products with external URLs
 * - POST /api/images/internalize - Internalize all external images
 */

/**
 * Fetch image from URL with timeout
 */
async function fetchImageFromUrl(url: string): Promise<Buffer> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)

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
                throw new Error(`Blocked (403): ${url.slice(0, 80)}`)
            } else if (response.status === 404) {
                throw new Error(`Not found (404): ${url.slice(0, 80)}`)
            }
            throw new Error(`Fetch failed (${response.status}): ${url.slice(0, 80)}`)
        }

        const contentType = response.headers.get('content-type') || ''
        if (!contentType.includes('image')) {
            throw new Error(`Not an image (${contentType}): ${url.slice(0, 80)}`)
        }

        const arrayBuffer = await response.arrayBuffer()
        if (arrayBuffer.byteLength === 0) {
            throw new Error(`Empty response: ${url.slice(0, 80)}`)
        }

        return Buffer.from(arrayBuffer)
    } catch (error) {
        clearTimeout(timeoutId)
        if (error instanceof Error) {
            if (error.name === 'AbortError') {
                throw new Error(`Timeout (15s): ${url.slice(0, 80)}`)
            }
            // Wrap any other error with URL context
            throw new Error(`${url.slice(0, 60)}: ${error.message}`)
        }
        throw new Error(`${url.slice(0, 60)}: Unknown error`)
    }
}

/**
 * Internalize a single product's external image
 */
async function internalizeProductImage(
    payload: Payload,
    product: {
        id: number
        name?: string
        imageUrl: string
        brand?: { name?: string } | null
    }
): Promise<{ success: boolean; productId: number; mediaId?: number; error?: string }> {
    try {
        const productName = (product.name as string) || 'product'
        const brandName = product.brand?.name || null

        // Download the image
        const buffer = await fetchImageFromUrl(product.imageUrl)

        // Generate filename
        const safeBrand = (brandName || 'product').toLowerCase().replace(/[^a-z0-9]/g, '-')
        const safeName = productName.toLowerCase().replace(/[^a-z0-9]/g, '-')

        // Detect extension from URL
        let ext = 'jpg'
        try {
            const urlPath = new URL(product.imageUrl).pathname
            ext = urlPath.match(/\.(jpg|jpeg|png|gif|webp)$/i)?.[1]?.toLowerCase() || 'jpg'
        } catch {
            // Invalid URL, use default
        }

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

        // Update product to use internal image and clear external URL
        await payload.update({
            collection: 'products',
            id: product.id,
            data: {
                image: media.id,
                imageUrl: null,
            },
        })

        console.log(`Internalized product ${product.id}: ${productName} -> Media ${media.id}`)

        return {
            success: true,
            productId: product.id,
            mediaId: media.id as number,
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error(`Failed to internalize product ${product.id}:`, errorMessage)
        return {
            success: false,
            productId: product.id,
            error: errorMessage,
        }
    }
}

/**
 * Get status of external images
 * GET /api/images/internalize/status
 */
export const imageInternalizeStatusHandler: PayloadHandler = async (req: PayloadRequest) => {
    if (!req.user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        // Count products with external imageUrl
        const withExternal = await req.payload.find({
            collection: 'products',
            where: {
                imageUrl: { exists: true },
            },
            limit: 0, // Just get count
        })

        // Count products with internal image
        const withInternal = await req.payload.find({
            collection: 'products',
            where: {
                image: { exists: true },
            },
            limit: 0,
        })

        // Count products with no image
        const withNeither = await req.payload.find({
            collection: 'products',
            where: {
                and: [
                    { imageUrl: { exists: false } },
                    { image: { exists: false } },
                ],
            },
            limit: 0,
        })

        return Response.json({
            externalUrls: withExternal.totalDocs,
            internalImages: withInternal.totalDocs,
            noImage: withNeither.totalDocs,
        })
    } catch (error) {
        console.error('Failed to get internalization status:', error)
        return Response.json(
            { error: error instanceof Error ? error.message : 'Failed to get status' },
            { status: 500 }
        )
    }
}

/**
 * Internalize all external images
 * POST /api/images/internalize
 */
export const imageInternalizeHandler: PayloadHandler = async (req: PayloadRequest) => {
    if (!req.user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Rate limiting
    const rateLimitKey = getRateLimitKey(req as unknown as Request, req.user?.id)
    const rateLimit = checkRateLimit(rateLimitKey, RateLimits.BG_REMOVAL_BATCH)
    if (!rateLimit.allowed) {
        return rateLimitResponse(rateLimit.resetAt)
    }

    try {
        // Find all products with external imageUrl
        const products = await req.payload.find({
            collection: 'products',
            where: {
                imageUrl: { exists: true },
            },
            limit: 200, // Process in batches
            depth: 1, // Get brand info
        })

        if (products.docs.length === 0) {
            return Response.json({
                success: true,
                message: 'No products with external URLs found',
                processed: 0,
                successCount: 0,
                failureCount: 0,
                results: [],
            })
        }

        const results: Array<{
            productId: number
            productName: string
            success: boolean
            mediaId?: number
            error?: string
        }> = []

        // Process each product with delay to avoid overwhelming external servers
        for (let i = 0; i < products.docs.length; i++) {
            const product = products.docs[i] as any

            // Add delay between requests
            if (i > 0) {
                await new Promise((resolve) => setTimeout(resolve, 500))
            }

            const result = await internalizeProductImage(req.payload, {
                id: product.id,
                name: product.name,
                imageUrl: product.imageUrl,
                brand: product.brand,
            })

            results.push({
                productId: result.productId,
                productName: product.name || 'Unknown',
                success: result.success,
                ...(result.mediaId && { mediaId: result.mediaId }),
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
            remaining: products.totalDocs - results.length,
            results,
        })
    } catch (error) {
        console.error('Image internalization error:', error)
        return Response.json(
            { error: error instanceof Error ? error.message : 'Internalization failed' },
            { status: 500 }
        )
    }
}
