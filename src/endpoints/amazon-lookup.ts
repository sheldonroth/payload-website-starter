import type { PayloadHandler, PayloadRequest } from 'payload'

interface AmazonResult {
    asin: string
    title: string
    price?: string
    imageUrl?: string
    url: string
    rating?: string
    reviews?: number
}

/**
 * Extract ASIN from various Amazon URL formats
 */
function extractAsinFromUrl(url: string): string | null {
    // Match patterns like:
    // /dp/B07XYZ123
    // /gp/product/B07XYZ123
    // /product/B07XYZ123
    // /gp/aw/d/B07XYZ123
    const patterns = [
        /\/dp\/([A-Z0-9]{10})/i,
        /\/gp\/product\/([A-Z0-9]{10})/i,
        /\/product\/([A-Z0-9]{10})/i,
        /\/gp\/aw\/d\/([A-Z0-9]{10})/i,
        /\/ASIN\/([A-Z0-9]{10})/i,
    ]

    for (const pattern of patterns) {
        const match = url.match(pattern)
        if (match) {
            return match[1].toUpperCase()
        }
    }
    return null
}

/**
 * Search Google for Amazon products and extract ASINs from URLs
 */
async function searchAmazonProducts(
    productName: string,
    brand: string | null
): Promise<AmazonResult[]> {
    const apiKey = process.env.GOOGLE_SEARCH_API_KEY
    const cseId = process.env.GOOGLE_CSE_ID

    if (!apiKey || !cseId) {
        console.log('Google Custom Search not configured')
        return []
    }

    // Search for the product on Amazon specifically
    const searchQuery = brand
        ? `${brand} ${productName} site:amazon.com`
        : `${productName} site:amazon.com`

    const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cseId}&q=${encodeURIComponent(searchQuery)}&num=10`

    try {
        const response = await fetch(url)
        const data = await response.json()

        if (data.error || !data.items) {
            console.log('Google Search error:', data.error?.message || 'No results')
            return []
        }

        const results: AmazonResult[] = []
        const seenAsins = new Set<string>()

        for (const item of data.items) {
            // Only process Amazon URLs
            if (!item.link?.includes('amazon.com')) continue

            const asin = extractAsinFromUrl(item.link)
            if (!asin || seenAsins.has(asin)) continue

            seenAsins.add(asin)

            // Extract price from snippet if present
            let price: string | undefined
            const priceMatch = item.snippet?.match(/\$[\d,.]+/)
            if (priceMatch) {
                price = priceMatch[0]
            }

            // Get image from pagemap if available
            let imageUrl: string | undefined
            if (item.pagemap?.cse_image?.[0]?.src) {
                imageUrl = item.pagemap.cse_image[0].src
            } else if (item.pagemap?.cse_thumbnail?.[0]?.src) {
                imageUrl = item.pagemap.cse_thumbnail[0].src
            }

            // Extract rating if present in snippet
            let rating: string | undefined
            const ratingMatch = item.snippet?.match(/([\d.]+)\s*out of\s*5/i)
            if (ratingMatch) {
                rating = ratingMatch[1]
            }

            results.push({
                asin,
                title: item.title?.replace(/ - Amazon\.com.*$/i, '').replace(/Amazon\.com:\s*/i, '') || 'Unknown Product',
                price,
                imageUrl,
                url: `https://www.amazon.com/dp/${asin}`,
                rating,
            })
        }

        return results
    } catch (error) {
        console.error('Amazon search failed:', error)
        return []
    }
}

/**
 * Amazon Product Lookup Handler
 * POST /api/product/amazon-lookup - Search for Amazon products
 * PUT /api/product/amazon-lookup - Apply ASIN to product
 */
export const amazonLookupHandler: PayloadHandler = async (req: PayloadRequest) => {
    if (!req.user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const method = req.method?.toUpperCase()

    // PUT: Apply ASIN to product
    if (method === 'PUT') {
        try {
            const body = await req.json?.()
            const { productId, asin } = body || {}

            if (!productId || !asin) {
                return Response.json({ error: 'productId and asin are required' }, { status: 400 })
            }

            // Validate ASIN format
            if (!/^[A-Z0-9]{10}$/i.test(asin)) {
                return Response.json({ error: 'Invalid ASIN format' }, { status: 400 })
            }

            // Verify product exists
            const product = await req.payload.findByID({
                collection: 'products',
                id: productId,
            })

            if (!product) {
                return Response.json({ error: 'Product not found' }, { status: 404 })
            }

            // Update the product with the ASIN
            await req.payload.update({
                collection: 'products',
                id: productId,
                data: {
                    amazonAsin: asin.toUpperCase(),
                },
            })

            return Response.json({
                success: true,
                message: `ASIN ${asin.toUpperCase()} applied to product`,
            })
        } catch (error) {
            console.error('ASIN apply error:', error)
            return Response.json(
                { error: error instanceof Error ? error.message : 'Failed to apply ASIN' },
                { status: 500 }
            )
        }
    }

    // POST: Search for Amazon products
    try {
        const body = await req.json?.()
        const { productId } = body || {}

        if (!productId) {
            return Response.json({ error: 'productId is required' }, { status: 400 })
        }

        // Fetch the product
        const product = await req.payload.findByID({
            collection: 'products',
            id: productId,
            depth: 1, // Include brand relation
        })

        if (!product) {
            return Response.json({ error: 'Product not found' }, { status: 404 })
        }

        const productData = product as unknown as Record<string, unknown>
        const productName = (productData.name || '') as string

        // Get brand name - could be populated object or just ID
        let brandName: string | null = null
        if (productData.brand) {
            if (typeof productData.brand === 'object' && (productData.brand as Record<string, unknown>)?.name) {
                brandName = (productData.brand as Record<string, unknown>).name as string
            }
        }

        if (!productName) {
            return Response.json({ error: 'Product has no name' }, { status: 400 })
        }

        const searchQuery = brandName ? `${brandName} ${productName}` : productName

        // Search for Amazon products
        const results = await searchAmazonProducts(productName, brandName)

        if (results.length === 0) {
            // If no results from Google, provide a fallback with manual search link
            return Response.json({
                success: true,
                results: [],
                searchQuery,
                manualSearchUrl: `https://www.amazon.com/s?k=${encodeURIComponent(searchQuery)}`,
                message: 'No Amazon products found via search. Try the manual search link.',
            })
        }

        return Response.json({
            success: true,
            results,
            searchQuery,
        })
    } catch (error) {
        console.error('Amazon lookup error:', error)
        return Response.json(
            { error: error instanceof Error ? error.message : 'Search failed' },
            { status: 500 }
        )
    }
}
