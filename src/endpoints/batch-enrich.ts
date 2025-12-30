import type { PayloadHandler, PayloadRequest, Payload, Where } from 'payload'
import { createAuditLog } from '../collections/AuditLog'

interface GoogleSearchResponse {
    items?: Array<{
        link: string
        image?: {
            contextLink: string
            height: number
            width: number
        }
    }>
    error?: { message: string }
}

/**
 * Search for product images using Google Custom Search API
 */
async function searchProductImage(productName: string, brand: string | null): Promise<string | null> {
    const apiKey = process.env.GOOGLE_SEARCH_API_KEY
    const cseId = process.env.GOOGLE_CSE_ID

    if (!apiKey || !cseId) {
        return null
    }

    const searchQuery = brand ? `${brand} ${productName} product` : `${productName} product`
    const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cseId}&searchType=image&q=${encodeURIComponent(searchQuery)}&num=5&imgSize=large&safe=active`

    try {
        const response = await fetch(url)
        const data: GoogleSearchResponse = await response.json()

        if (data.error || !data.items?.length) {
            return null
        }

        const preferredDomains = ['amazon.com', 'walmart.com', 'target.com']
        let bestImage: string | null = null

        for (const item of data.items) {
            if (item.image && (item.image.width < 200 || item.image.height < 200)) continue

            const isPreferred = preferredDomains.some(domain =>
                item.image?.contextLink?.includes(domain) || item.link.includes(domain)
            )

            if (isPreferred) {
                bestImage = item.link
                break
            }

            if (!bestImage) {
                bestImage = item.link
            }
        }

        return bestImage
    } catch {
        return null
    }
}

/**
 * Download an image and upload to Payload Media
 */
async function downloadAndUploadImage(
    payload: Payload,
    imageUrl: string,
    productName: string,
    brand: string | null
): Promise<{ mediaId: number | null; error?: string }> {
    try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 10000)

        const response = await fetch(imageUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ProductReport/1.0)' },
            signal: controller.signal,
        })
        clearTimeout(timeoutId)

        if (!response.ok) {
            return { mediaId: null, error: `HTTP ${response.status}` }
        }

        const arrayBuffer = await response.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        if (buffer.length < 1000) {
            return { mediaId: null, error: 'Image too small' }
        }

        const contentType = response.headers.get('content-type') || 'image/jpeg'
        if (!contentType.includes('image')) {
            return { mediaId: null, error: 'Not an image' }
        }

        const ext = contentType.includes('png') ? 'png' :
            contentType.includes('webp') ? 'webp' :
                contentType.includes('gif') ? 'gif' : 'jpg'

        const safeBrand = (brand || 'product').toLowerCase().replace(/[^a-z0-9]/g, '-')
        const safeName = productName.toLowerCase().replace(/[^a-z0-9]/g, '-')
        const filename = `${safeBrand}-${safeName}-${Date.now()}.${ext}`

        const media = await payload.create({
            collection: 'media',
            data: { alt: `${brand || ''} ${productName}`.trim() },
            file: {
                data: buffer,
                name: filename,
                mimetype: contentType,
                size: buffer.length,
            },
        })

        return { mediaId: media.id as number }
    } catch (error) {
        return { mediaId: null, error: error instanceof Error ? error.message : 'Unknown error' }
    }
}

/**
 * Batch Product Enrichment Endpoint
 * POST /api/products/batch-enrich
 *
 * Enriches multiple products at once with images and price data.
 * Supports filtering by criteria (missing images, specific status, etc.)
 */
export const batchEnrichHandler: PayloadHandler = async (req: PayloadRequest) => {
    if (!req.user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const body = await req.json?.()
        const {
            productIds,           // Specific product IDs to enrich
            where,                // Payload query for filtering
            limit = 50,           // Max products to process
            onlyMissingImages = true,  // Only enrich products without images
        } = body || {}

        const payload = req.payload

        // Build query
        let query: Where = {}

        if (productIds?.length) {
            query = { id: { in: productIds } }
        } else if (where) {
            query = where as Where
        } else if (onlyMissingImages) {
            query = {
                and: [
                    { image: { exists: false } },
                    { imageUrl: { exists: false } },
                ],
            }
        }

        // Find products to enrich
        const products = await payload.find({
            collection: 'products',
            where: query,
            limit: Math.min(limit, 100), // Cap at 100 for safety
        })

        const results = {
            total: products.docs.length,
            enriched: 0,
            failed: 0,
            skipped: 0,
            details: [] as Array<{
                id: number
                name: string
                status: 'enriched' | 'failed' | 'skipped'
                imageUrl?: string
                error?: string
            }>,
        }

        // Process each product
        for (const product of products.docs) {
            const productData = product as unknown as {
                id: number
                name: string
                brand?: string
                image?: unknown
                imageUrl?: string
            }

            // Skip if already has image
            if (productData.image || productData.imageUrl) {
                results.skipped++
                results.details.push({
                    id: productData.id,
                    name: productData.name,
                    status: 'skipped',
                })
                continue
            }

            try {
                // Search for image
                const imageUrl = await searchProductImage(productData.name, productData.brand || null)

                if (!imageUrl) {
                    results.failed++
                    results.details.push({
                        id: productData.id,
                        name: productData.name,
                        status: 'failed',
                        error: 'No image found',
                    })
                    continue
                }

                // Download and upload
                const downloadResult = await downloadAndUploadImage(
                    payload,
                    imageUrl,
                    productData.name,
                    productData.brand || null
                )

                if (downloadResult.mediaId) {
                    // Update product with new image
                    await payload.update({
                        collection: 'products',
                        id: productData.id,
                        data: { image: downloadResult.mediaId },
                    })

                    // Create audit log
                    await createAuditLog(payload, {
                        action: 'image_enriched',
                        sourceType: 'system',
                        targetCollection: 'products',
                        targetId: productData.id,
                        targetName: productData.name,
                        after: { imageUrl, mediaId: downloadResult.mediaId },
                        performedBy: (req.user as { id?: number })?.id,
                    })

                    results.enriched++
                    results.details.push({
                        id: productData.id,
                        name: productData.name,
                        status: 'enriched',
                        imageUrl,
                    })
                } else {
                    // Fallback: store external URL
                    await payload.update({
                        collection: 'products',
                        id: productData.id,
                        data: { imageUrl },
                    })

                    results.enriched++
                    results.details.push({
                        id: productData.id,
                        name: productData.name,
                        status: 'enriched',
                        imageUrl,
                        error: `Download failed: ${downloadResult.error}, stored external URL`,
                    })
                }
            } catch (error) {
                results.failed++
                results.details.push({
                    id: productData.id,
                    name: productData.name,
                    status: 'failed',
                    error: error instanceof Error ? error.message : 'Unknown error',
                })
            }

            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 500))
        }

        return Response.json({
            success: true,
            message: `Enriched ${results.enriched}/${results.total} products`,
            ...results,
        })
    } catch (error) {
        console.error('Batch enrichment error:', error)
        return Response.json(
            { error: error instanceof Error ? error.message : 'Batch enrichment failed' },
            { status: 500 }
        )
    }
}
