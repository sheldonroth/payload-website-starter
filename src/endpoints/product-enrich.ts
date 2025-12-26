import type { PayloadHandler, PayloadRequest } from 'payload'

interface ProductInfo {
    imageUrl: string | null
    priceRange: string | null
    source: string | null
    searchQuery: string
}

const SEARCH_PROMPT = `You are a product research assistant. Given a product name and brand, find:
1. A direct image URL from a reputable source (Amazon, manufacturer site, etc.)
2. The typical price range for this product

IMPORTANT:
- For imageUrl, provide a DIRECT link to a product image (ending in .jpg, .png, .webp, etc.) from a reputable retailer or manufacturer
- For priceRange, provide a realistic USD price range like "$15-25" or "$49.99"
- If you can't find reliable info, return null for that field

Output ONLY a valid JSON object:
{
  "imageUrl": "string or null (direct image URL)",
  "priceRange": "string or null (e.g., '$15-25')",
  "source": "string or null (where the info came from)",
  "searchQuery": "string (what you would search for)"
}`

async function searchProductInfo(productName: string, brand: string | null): Promise<ProductInfo> {
    const { GoogleGenerativeAI } = await import('@google/generative-ai')
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

    const searchTerm = brand ? `${brand} ${productName}` : productName

    const result = await model.generateContent({
        contents: [{
            role: 'user',
            parts: [{
                text: `${SEARCH_PROMPT}\n\nProduct: ${productName}\nBrand: ${brand || 'Unknown'}\n\nSearch for this product and provide image URL and price range.`
            }]
        }],
        generationConfig: {
            temperature: 0.3,
            responseMimeType: 'application/json',
        },
    })

    const content = result.response.text()
    if (!content) {
        return { imageUrl: null, priceRange: null, source: null, searchQuery: searchTerm }
    }

    try {
        const parsed = JSON.parse(content)
        return {
            imageUrl: parsed.imageUrl || null,
            priceRange: parsed.priceRange || null,
            source: parsed.source || null,
            searchQuery: parsed.searchQuery || searchTerm,
        }
    } catch {
        return { imageUrl: null, priceRange: null, source: null, searchQuery: searchTerm }
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

        // Optionally auto-apply to product
        if (autoApply && (info.imageUrl || info.priceRange)) {
            const updateData: Record<string, unknown> = {}

            if (info.imageUrl && !productData.imageUrl) {
                updateData.imageUrl = info.imageUrl
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
