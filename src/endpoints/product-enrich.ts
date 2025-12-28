import type { PayloadHandler, PayloadRequest, Payload } from 'payload'

interface ProductInfo {
    imageUrl: string | null
    priceRange: string | null
    source: string | null
    searchQuery: string
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
 * Search for product images using Google Custom Search API
 * Returns the best quality image URL from the search results
 */
async function searchProductImage(productName: string, brand: string | null): Promise<string | null> {
    const apiKey = process.env.GOOGLE_SEARCH_API_KEY
    const cseId = process.env.GOOGLE_CSE_ID

    if (!apiKey || !cseId) {
        console.error('Google Custom Search not configured (missing GOOGLE_SEARCH_API_KEY or GOOGLE_CSE_ID)')
        return null
    }

    const searchQuery = brand ? `${brand} ${productName} product` : `${productName} product`
    const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cseId}&searchType=image&q=${encodeURIComponent(searchQuery)}&num=5&imgSize=large&safe=active`

    try {
        const response = await fetch(url)
        const data: GoogleSearchResponse = await response.json()

        if (data.error) {
            console.error('Google Search API error:', data.error.message)
            return null
        }

        if (!data.items || data.items.length === 0) {
            console.log('No images found for:', searchQuery)
            return null
        }

        // Find the best image - prefer larger images from reputable sources
        const preferredDomains = ['amazon.com', 'walmart.com', 'target.com', 'manufacturer']
        let bestImage: string | null = null

        for (const item of data.items) {
            const link = item.link
            // Skip tiny images
            if (item.image && (item.image.width < 200 || item.image.height < 200)) continue

            // Check if from preferred source
            const isPreferred = preferredDomains.some(domain =>
                item.image?.contextLink?.includes(domain) || link.includes(domain)
            )

            if (isPreferred) {
                bestImage = link
                break
            }

            // Use first valid image as fallback
            if (!bestImage) {
                bestImage = link
            }
        }

        console.log('Found image for', searchQuery, ':', bestImage)
        return bestImage
    } catch (error) {
        console.error('Google Search failed:', error)
        return null
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

async function searchProductInfo(productName: string, brand: string | null): Promise<ProductInfo> {
    const searchQuery = brand ? `${brand} ${productName}` : productName

    // Search for image using Google Custom Search (real web search)
    const imageUrl = await searchProductImage(productName, brand)

    // Search for price using Gemini (good at price estimation)
    const priceRange = await searchProductPrice(productName, brand)

    return {
        imageUrl,
        priceRange,
        source: imageUrl ? 'Google Custom Search' : 'AI Estimated',
        searchQuery,
    }
}

/**
 * Download an image from external URL and upload to Payload CMS Media collection
 * Returns object with mediaId on success or error details on failure
 */
async function downloadAndUploadImage(
    payload: Payload,
    imageUrl: string,
    productName: string,
    brand: string | null
): Promise<{ mediaId: number | null; error?: string }> {
    try {
        // Fetch the image from external URL with timeout
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 10000) // 10s timeout

        const response = await fetch(imageUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; ProductReport/1.0)',
            },
            signal: controller.signal,
        })
        clearTimeout(timeoutId)

        if (!response.ok) {
            const error = `Failed to fetch image: ${response.status} ${response.statusText}`
            console.error(error)
            return { mediaId: null, error }
        }

        // Get image data as buffer
        const arrayBuffer = await response.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        // Check if we actually got image data
        if (buffer.length < 1000) {
            const error = 'Image too small (likely invalid or blocked)'
            console.error(error)
            return { mediaId: null, error }
        }

        // Determine file extension from content-type
        const contentType = response.headers.get('content-type') || 'image/jpeg'
        if (!contentType.includes('image')) {
            const error = `Invalid content type: ${contentType}`
            console.error(error)
            return { mediaId: null, error }
        }

        const ext = contentType.includes('png') ? 'png' :
            contentType.includes('webp') ? 'webp' :
                contentType.includes('gif') ? 'gif' : 'jpg'

        // Generate safe filename
        const safeBrand = (brand || 'product').toLowerCase().replace(/[^a-z0-9]/g, '-')
        const safeName = productName.toLowerCase().replace(/[^a-z0-9]/g, '-')
        const filename = `${safeBrand}-${safeName}-${Date.now()}.${ext}`

        // Create Media document in Payload
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

        console.log(`Uploaded image for ${brand} ${productName}: Media ID ${media.id}`)
        return { mediaId: media.id as number }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error('Failed to download/upload image:', errorMessage)
        return { mediaId: null, error: errorMessage }
    }
}


export const productEnrichHandler: PayloadHandler = async (req: PayloadRequest) => {
    if (!req.user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
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

        // Search for product info
        const info = await searchProductInfo(productName, brand)

        // Track if we successfully downloaded the image
        let imageDownloaded = false
        let mediaId: number | null = null
        let imageError: string | null = null

        // Optionally auto-apply to product
        if (autoApply && (info.imageUrl || info.priceRange)) {
            const updateData: Record<string, unknown> = {}

            // Try to download and upload image to CMS instead of storing external URL
            if (info.imageUrl && !productData.image) {
                const downloadResult = await downloadAndUploadImage(
                    req.payload,
                    info.imageUrl,
                    productName,
                    brand
                )

                if (downloadResult.mediaId) {
                    // Successfully uploaded to CMS - link the Media document
                    updateData.image = downloadResult.mediaId
                    mediaId = downloadResult.mediaId
                    imageDownloaded = true
                } else {
                    // Download failed - store external URL as fallback and report error
                    if (!productData.imageUrl) {
                        updateData.imageUrl = info.imageUrl
                    }
                    imageError = downloadResult.error || 'Download failed'
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
            imageUrl: info.imageUrl,
            imageDownloaded,
            mediaId,
            imageError,
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
