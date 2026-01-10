import type { PayloadHandler, PayloadRequest, Payload } from 'payload'
import { checkRateLimitAsync, rateLimitResponse, getRateLimitKey, RateLimits } from '../utilities/rate-limiter'

interface ProductInfo {
    mediaId: number | null
    priceRange: string | null
    source: string | null
    searchQuery: string
    triedUrls: number
    error?: string
}

interface GoogleSearchResult {
    link: string
    image?: {
        contextLink: string
        height: number
        width: number
    }
}

interface GoogleSearchResponse {
    items?: GoogleSearchResult[]
    error?: { message: string }
}

/**
 * Try to download and upload an image, returns mediaId on success
 */
async function tryDownloadImage(
    payload: Payload,
    imageUrl: string,
    productName: string,
    brand: string | null
): Promise<{ mediaId: number | null; error?: string }> {
    try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 10000)

        const response = await fetch(imageUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Referer': 'https://www.google.com/',
            },
            signal: controller.signal,
        })
        clearTimeout(timeoutId)

        if (!response.ok) {
            return { mediaId: null, error: `HTTP ${response.status}` }
        }

        const contentType = response.headers.get('content-type') || ''
        if (!contentType.includes('image')) {
            return { mediaId: null, error: `Not an image: ${contentType}` }
        }

        const arrayBuffer = await response.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        if (buffer.length < 1000) {
            return { mediaId: null, error: 'Image too small' }
        }

        const ext = contentType.includes('png') ? 'png' :
            contentType.includes('webp') ? 'webp' :
                contentType.includes('gif') ? 'gif' : 'jpg'

        const safeBrand = (brand || 'product').toLowerCase().replace(/[^a-z0-9]/g, '-')
        const safeName = productName.toLowerCase().replace(/[^a-z0-9]/g, '-')
        const filename = `${safeBrand}-${safeName}-${Date.now()}.${ext}`

        const media = await payload.create({
            collection: 'media',
            data: {
                alt: `${brand || ''} ${productName}`.trim(),
            },
            file: {
                data: buffer,
                name: filename,
                mimetype: contentType,
                size: buffer.length,
            },
        })

        return { mediaId: media.id as number }
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error'
        return { mediaId: null, error: msg.includes('abort') ? 'Timeout' : msg }
    }
}

/**
 * Search Google for product images and return multiple URLs to try
 */
async function getGoogleImageUrls(productName: string, brand: string | null): Promise<string[]> {
    const apiKey = process.env.GOOGLE_SEARCH_API_KEY
    const cseId = process.env.GOOGLE_CSE_ID

    if (!apiKey || !cseId) {
        console.log('Google Custom Search not configured')
        return []
    }

    const searchQuery = brand ? `${brand} ${productName} product` : `${productName} product`
    const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cseId}&searchType=image&q=${encodeURIComponent(searchQuery)}&num=10&imgSize=large&safe=active`

    try {
        const response = await fetch(url)
        const data: GoogleSearchResponse = await response.json()

        if (data.error || !data.items) {
            return []
        }

        // Sort by preference: preferred domains first, then by size
        const preferredDomains = ['amazon.com', 'walmart.com', 'target.com', 'instacart.com']

        const sorted = data.items
            .filter(item => !item.image || (item.image.width >= 200 && item.image.height >= 200))
            .sort((a, b) => {
                const aPreferred = preferredDomains.some(d => a.link.includes(d) || a.image?.contextLink?.includes(d))
                const bPreferred = preferredDomains.some(d => b.link.includes(d) || b.image?.contextLink?.includes(d))
                if (aPreferred && !bPreferred) return -1
                if (bPreferred && !aPreferred) return 1
                return 0
            })

        return sorted.map(item => item.link)
    } catch (error) {
        console.error('Google Search failed:', error)
        return []
    }
}

/**
 * Search Open Food Facts for product images
 */
async function getOpenFoodFactsImageUrls(productName: string, brand: string | null): Promise<string[]> {
    try {
        const searchQuery = brand ? `${brand} ${productName}` : productName
        const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(searchQuery)}&search_simple=1&action=process&json=1&page_size=5`

        const response = await fetch(url, {
            headers: { 'User-Agent': 'ProductReport/1.0' }
        })

        if (!response.ok) return []

        const data = await response.json()
        const urls: string[] = []

        for (const product of data.products || []) {
            if (product.image_url) urls.push(product.image_url)
            if (product.image_front_url) urls.push(product.image_front_url)
        }

        return urls
    } catch (error) {
        console.error('Open Food Facts search failed:', error)
        return []
    }
}

/**
 * Try multiple image sources until one downloads successfully
 * Returns mediaId only if we successfully internalized an image
 */
async function findAndInternalizeImage(
    payload: Payload,
    productName: string,
    brand: string | null
): Promise<{ mediaId: number | null; source: string | null; triedUrls: number; error?: string }> {
    let triedUrls = 0
    const errors: string[] = []

    // Try Google Images first
    console.log(`Searching Google for: ${brand || ''} ${productName}`)
    const googleUrls = await getGoogleImageUrls(productName, brand)

    for (const url of googleUrls) {
        triedUrls++
        console.log(`  Trying Google result ${triedUrls}: ${url.slice(0, 60)}...`)
        const result = await tryDownloadImage(payload, url, productName, brand)

        if (result.mediaId) {
            console.log(`  ✓ Success from Google`)
            return { mediaId: result.mediaId, source: 'Google Images', triedUrls }
        }
        errors.push(`Google #${triedUrls}: ${result.error}`)
    }

    // Try Open Food Facts as backup
    console.log(`Searching Open Food Facts for: ${brand || ''} ${productName}`)
    const offUrls = await getOpenFoodFactsImageUrls(productName, brand)

    for (const url of offUrls) {
        triedUrls++
        console.log(`  Trying OFF result: ${url.slice(0, 60)}...`)
        const result = await tryDownloadImage(payload, url, productName, brand)

        if (result.mediaId) {
            console.log(`  ✓ Success from Open Food Facts`)
            return { mediaId: result.mediaId, source: 'Open Food Facts', triedUrls }
        }
        errors.push(`OFF: ${result.error}`)
    }

    // All sources failed
    const errorSummary = triedUrls === 0
        ? 'No image URLs found'
        : `Tried ${triedUrls} URLs, all failed`

    return {
        mediaId: null,
        source: null,
        triedUrls,
        error: errorSummary
    }
}

/**
 * Use Gemini AI to estimate price range (more reliable than image search)
 */
async function searchProductPrice(productName: string, brand: string | null): Promise<string | null> {
    try {
        const { GoogleGenerativeAI } = await import('@google/generative-ai')
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

        const result = await model.generateContent({
            contents: [{
                role: 'user',
                parts: [{
                    text: `What is the typical retail price range for "${brand || ''} ${productName}" in USD? 
                    Reply with ONLY a price range like "$15-25" or "$49.99" or "$$" (budget) / "$$$" (mid) / "$$$$" (premium).
                    If unknown, reply with just "$$".`
                }]
            }],
            generationConfig: { temperature: 0.3 },
        })

        const content = result.response.text().trim()
        // Clean up the response - extract just the price part
        const priceMatch = content.match(/\$[\d,.]+-?[\d,.]*|\${2,4}/i)
        return priceMatch ? priceMatch[0] : '$$'
    } catch (error) {
        console.error('Price search failed:', error)
        return '$$'
    }
}

async function searchProductInfo(
    payload: Payload,
    productName: string,
    brand: string | null
): Promise<ProductInfo> {
    const searchQuery = brand ? `${brand} ${productName}` : productName

    // Search for image and immediately internalize - no external URL storage
    const imageResult = await findAndInternalizeImage(payload, productName, brand)

    // Search for price using Gemini (good at price estimation)
    const priceRange = await searchProductPrice(productName, brand)

    return {
        mediaId: imageResult.mediaId,
        priceRange,
        source: imageResult.source,
        searchQuery,
        triedUrls: imageResult.triedUrls,
        error: imageResult.error,
    }
}


export const productEnrichHandler: PayloadHandler = async (req: PayloadRequest) => {
    if (!req.user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Rate limiting
    const rateLimitKey = getRateLimitKey(req as unknown as Request, req.user?.id)
    const rateLimit = await checkRateLimitAsync(rateLimitKey, RateLimits.AI_ANALYSIS)
    if (!rateLimit.allowed) {
        return rateLimitResponse(rateLimit.resetAt)
    }

    if (!process.env.GEMINI_API_KEY) {
        return Response.json({ error: 'Gemini API key not configured' }, { status: 500 })
    }

    try {
        const body = await req.json?.()
        const { productId, autoApply = false } = body || {}

        if (!productId) {
            return Response.json({ error: 'productId is required' }, { status: 400 })
        }

        // Fetch the product
        const product = await req.payload.findByID({
            collection: 'products',
            id: productId,
        })

        if (!product) {
            return Response.json({ error: 'Product not found' }, { status: 404 })
        }

        const productData = product as unknown as Record<string, unknown>
        const productName = (productData.name || 'Unknown Product') as string
        const brand = (productData.brand || null) as string | null

        // Skip image search if product already has an image
        const needsImage = !productData.image

        // Search for product info - this tries multiple sources and only returns if successful
        const info = await searchProductInfo(req.payload, productName, brand)

        // Auto-apply to product if requested
        if (autoApply && (info.mediaId || info.priceRange)) {
            const updateData: Record<string, unknown> = {}

            // Only set image if we successfully internalized one AND product doesn't have one
            if (info.mediaId && needsImage) {
                updateData.image = info.mediaId
                // Clear any old external URL since we now have internal image
                if (productData.imageUrl) {
                    updateData.imageUrl = null
                }
            }

            if (info.priceRange && !productData.priceRange) {
                updateData.priceRange = info.priceRange
            }

            if (Object.keys(updateData).length > 0) {
                await req.payload.update({
                    collection: 'products',
                    id: productId,
                    data: updateData,
                })
            }
        }

        return Response.json({
            success: true,
            productName,
            brand,
            imageFound: !!info.mediaId,
            mediaId: info.mediaId,
            triedUrls: info.triedUrls,
            imageError: info.error,
            priceRange: info.priceRange,
            source: info.source,
            searchQuery: info.searchQuery,
            applied: autoApply,
        })
    } catch (error) {
        console.error('Product enrichment error:', error)
        return Response.json(
            { error: error instanceof Error ? error.message : 'Enrichment failed' },
            { status: 500 }
        )
    }
}

/**
 * Search for product images without saving - returns URLs for preview
 * POST /api/product/search-images
 */
export const productSearchImagesHandler: PayloadHandler = async (req: PayloadRequest) => {
    if (!req.user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const body = await req.json?.()
        const { productId, excludeUrls = [] } = body || {}

        if (!productId) {
            return Response.json({ error: 'productId is required' }, { status: 400 })
        }

        const product = await req.payload.findByID({
            collection: 'products',
            id: productId,
        })

        if (!product) {
            return Response.json({ error: 'Product not found' }, { status: 404 })
        }

        const productData = product as unknown as Record<string, unknown>
        const productName = (productData.name || 'Unknown Product') as string
        const brand = (productData.brand || null) as string | null

        // Get image URLs from multiple sources
        const googleUrls = await getGoogleImageUrls(productName, brand)
        const offUrls = await getOpenFoodFactsImageUrls(productName, brand)

        // Combine and filter out already-tried URLs
        const allUrls = [...googleUrls, ...offUrls].filter(url => !excludeUrls.includes(url))

        // Return first available URL for preview
        if (allUrls.length === 0) {
            return Response.json({
                success: false,
                error: 'No images found',
                totalUrls: 0,
            })
        }

        // Determine source for the first URL
        const firstUrl = allUrls[0]
        const source = googleUrls.includes(firstUrl) ? 'Google Images' : 'Open Food Facts'

        return Response.json({
            success: true,
            previewUrl: firstUrl,
            source,
            remainingUrls: allUrls.length - 1,
            allUrls, // Return all so frontend can try next if rejected
        })
    } catch (error) {
        console.error('Image search error:', error)
        return Response.json(
            { error: error instanceof Error ? error.message : 'Search failed' },
            { status: 500 }
        )
    }
}

/**
 * Save a specific image URL to a product
 * POST /api/product/save-image
 */
export const productSaveImageHandler: PayloadHandler = async (req: PayloadRequest) => {
    if (!req.user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const body = await req.json?.()
        const { productId, imageUrl } = body || {}

        if (!productId || !imageUrl) {
            return Response.json({ error: 'productId and imageUrl are required' }, { status: 400 })
        }

        const product = await req.payload.findByID({
            collection: 'products',
            id: productId,
        })

        if (!product) {
            return Response.json({ error: 'Product not found' }, { status: 404 })
        }

        const productData = product as unknown as Record<string, unknown>
        const productName = (productData.name || 'Unknown Product') as string
        const brand = (productData.brand || null) as string | null

        // Try to download and save the image
        const result = await tryDownloadImage(req.payload, imageUrl, productName, brand)

        if (!result.mediaId) {
            return Response.json({
                success: false,
                error: result.error || 'Failed to download image',
            })
        }

        // Update the product
        await req.payload.update({
            collection: 'products',
            id: productId,
            data: {
                image: result.mediaId,
                imageUrl: null, // Clear external URL
            },
        })

        return Response.json({
            success: true,
            mediaId: result.mediaId,
        })
    } catch (error) {
        console.error('Save image error:', error)
        return Response.json(
            { error: error instanceof Error ? error.message : 'Save failed' },
            { status: 500 }
        )
    }
}
