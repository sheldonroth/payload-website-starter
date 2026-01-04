import type { PayloadHandler, PayloadRequest } from 'payload'
import { GoogleGenerativeAI } from '@google/generative-ai'

/**
 * Magic URL Endpoint
 * POST /api/magic-url
 * 
 * The "One-Input" dream: paste any URL and auto-fill a product record.
 * Supports:
 * - Amazon product URLs → extract name, brand, price, image, ingredients
 * - YouTube URLs → trigger video analysis and product extraction
 */
export const magicUrlHandler: PayloadHandler = async (req: PayloadRequest) => {
    if (!req.user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const geminiKey = process.env.GEMINI_API_KEY
    if (!geminiKey) {
        return Response.json({ error: 'Gemini API key not configured' }, { status: 500 })
    }

    try {
        const body = await req.json?.()
        const { url, autoCreate = false } = body || {}

        if (!url) {
            return Response.json({ error: 'url is required' }, { status: 400 })
        }

        const payload = req.payload

        // Detect URL type
        const urlType = detectUrlType(url)

        if (urlType === 'youtube') {
            // Delegate to video analysis
            return Response.json({
                type: 'youtube',
                message: 'Use /api/video/analyze for YouTube URLs',
                redirectTo: '/api/video/analyze',
                videoId: extractYouTubeVideoId(url),
            })
        }

        if (urlType === 'amazon' || urlType === 'product_page') {
            // Extract product info using Gemini
            const productData = await extractProductFromUrl(url, geminiKey)

            if (!productData) {
                return Response.json({
                    error: 'Could not extract product info from URL',
                    url,
                }, { status: 400 })
            }

            // Check for existing product with same name+brand
            const existing = await payload.find({
                collection: 'products',
                where: {
                    and: [
                        { name: { equals: productData.name } },
                        { brand: { equals: productData.brand } },
                    ],
                },
                limit: 1,
            })

            if (existing.docs.length > 0) {
                return Response.json({
                    type: 'product',
                    action: 'exists',
                    productId: existing.docs[0].id,
                    message: `Product "${productData.name}" by ${productData.brand} already exists`,
                    existingProduct: existing.docs[0],
                    extractedData: productData,
                })
            }

            // Auto-create if requested
            if (autoCreate) {
                const newProduct = await payload.create({
                    collection: 'products',
                    data: {
                        name: productData.name,
                        brand: productData.brand,
                        imageUrl: productData.imageUrl,
                        summary: productData.summary,
                        sourceUrl: url,
                        verdict: 'recommend', // Default to recommend, will be reviewed
                        status: 'ai_draft',
                        priceRange: (productData.priceRange || '$$') as '$' | '$$' | '$$$' | '$$$$',
                    },
                })

                return Response.json({
                    type: 'product',
                    action: 'created',
                    productId: newProduct.id,
                    message: `Created AI draft: ${productData.name}`,
                    product: newProduct,
                })
            }

            // Return extracted data for review
            return Response.json({
                type: 'product',
                action: 'preview',
                message: 'Product data extracted - review and create',
                extractedData: productData,
                sourceUrl: url,
            })
        }

        return Response.json({
            error: 'Unsupported URL type',
            url,
            detectedType: urlType,
        }, { status: 400 })

    } catch (error) {
        console.error('Magic URL error:', error)
        return Response.json(
            { error: error instanceof Error ? error.message : 'Failed to process URL' },
            { status: 500 }
        )
    }
}

function detectUrlType(url: string): 'youtube' | 'amazon' | 'product_page' | 'unknown' {
    const lower = url.toLowerCase()

    if (lower.includes('youtube.com') || lower.includes('youtu.be')) {
        return 'youtube'
    }
    if (lower.includes('amazon.com') || lower.includes('amzn.to') || lower.includes('amzn.com')) {
        return 'amazon'
    }
    if (lower.includes('walmart.com') || lower.includes('target.com') || lower.includes('iherb.com')) {
        return 'product_page'
    }

    return 'unknown'
}

/**
 * Extract Amazon ASIN from various URL formats
 */
function extractAmazonASIN(url: string): string | null {
    const patterns = [
        /\/dp\/([A-Z0-9]{10})/i,           // /dp/ASIN
        /\/gp\/product\/([A-Z0-9]{10})/i,   // /gp/product/ASIN
        /\/product\/([A-Z0-9]{10})/i,       // /product/ASIN
        /\/ASIN\/([A-Z0-9]{10})/i,          // /ASIN/ASIN
        /\?.*asin=([A-Z0-9]{10})/i,         // ?asin=ASIN
    ]

    for (const pattern of patterns) {
        const match = url.match(pattern)
        if (match) return match[1].toUpperCase()
    }

    return null
}

/**
 * Extract product data directly from Amazon HTML using selectors
 */
function extractAmazonDataFromHTML(html: string): Partial<ExtractedProductData> {
    const result: Partial<ExtractedProductData> = {}

    // Product title
    const titleMatch = html.match(/id="productTitle"[^>]*>([^<]+)</i) ||
                       html.match(/class="product-title[^"]*"[^>]*>([^<]+)</i)
    if (titleMatch) {
        result.name = titleMatch[1].trim()
    }

    // Brand
    const brandMatch = html.match(/id="bylineInfo"[^>]*>([^<]+)</i) ||
                       html.match(/class="a-link-normal.+?brand[^"]*"[^>]*>([^<]+)</i) ||
                       html.match(/Visit the ([^<]+) Store/i)
    if (brandMatch) {
        result.brand = brandMatch[1].replace(/Visit the\s+/i, '').replace(/\s+Store$/i, '').trim()
    }

    // Main image
    const imageMatch = html.match(/id="landingImage"[^>]*src="([^"]+)"/i) ||
                       html.match(/data-old-hires="([^"]+)"/i) ||
                       html.match(/"hiRes":"([^"]+)"/i)
    if (imageMatch) {
        result.imageUrl = imageMatch[1]
    }

    // Price
    const priceMatch = html.match(/class="a-price-whole"[^>]*>([^<]+)</i) ||
                       html.match(/id="priceblock_ourprice"[^>]*>([^<]+)</i)
    if (priceMatch) {
        const price = parseFloat(priceMatch[1].replace(/[,$]/g, ''))
        if (price < 15) result.priceRange = '$'
        else if (price < 50) result.priceRange = '$$'
        else if (price < 150) result.priceRange = '$$$'
        else result.priceRange = '$$$$'
    }

    // Ingredients (often in feature bullets or description)
    const ingredientMatch = html.match(/Ingredients?:?\s*([^<]{20,500})/i)
    if (ingredientMatch) {
        result.ingredients = ingredientMatch[1].trim()
    }

    return result
}

function extractYouTubeVideoId(url: string): string | null {
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\s?]+)/,
        /youtube\.com\/shorts\/([^&\s?]+)/,
    ]

    for (const pattern of patterns) {
        const match = url.match(pattern)
        if (match) return match[1]
    }

    return null
}

interface ExtractedProductData {
    name: string
    brand: string
    imageUrl?: string
    ingredients?: string
    summary?: string
    priceRange?: string
}

async function extractProductFromUrl(url: string, geminiApiKey: string): Promise<ExtractedProductData | null> {
    const genAI = new GoogleGenerativeAI(geminiApiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    const isAmazon = url.toLowerCase().includes('amazon.com') || url.toLowerCase().includes('amzn')
    const asin = isAmazon ? extractAmazonASIN(url) : null

    // Fetch page content
    let pageContent = ''
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
            },
            redirect: 'follow',
        })
        pageContent = await response.text()
        pageContent = pageContent.substring(0, 80000)
    } catch (e) {
        console.error('Failed to fetch URL:', e)
        return null
    }

    // For Amazon, try direct HTML extraction first
    let extractedData: Partial<ExtractedProductData> = {}
    if (isAmazon) {
        extractedData = extractAmazonDataFromHTML(pageContent)
        console.log('Amazon direct extraction:', { asin, ...extractedData })
    }

    // Use Gemini to fill gaps or for non-Amazon URLs
    const prompt = `Extract product information from this HTML page content.

Return ONLY valid JSON in this exact format:
{
  "name": "product name",
  "brand": "brand name",
  "imageUrl": "main product image URL (high resolution preferred)",
  "ingredients": "full ingredients list if available",
  "summary": "brief 1-2 sentence description",
  "priceRange": "$" or "$$" or "$$$" or "$$$$"
}

If you cannot find a field, use null. For priceRange, use:
- "$" for under $15
- "$$" for $15-50
- "$$$" for $50-150
- "$$$$" for over $150

PAGE CONTENT:
${pageContent.substring(0, 50000)}`

    try {
        const result = await model.generateContent(prompt)
        const responseText = result.response.text()

        const jsonMatch = responseText.match(/\{[\s\S]*\}/)
        if (!jsonMatch) {
            // If Gemini fails but we have Amazon data, use that
            if (extractedData.name && extractedData.brand) {
                return extractedData as ExtractedProductData
            }
            return null
        }

        const geminiData = JSON.parse(jsonMatch[0]) as ExtractedProductData

        // Merge Amazon direct extraction with Gemini (prefer direct extraction)
        return {
            name: extractedData.name || geminiData.name,
            brand: extractedData.brand || geminiData.brand,
            imageUrl: extractedData.imageUrl || geminiData.imageUrl,
            ingredients: extractedData.ingredients || geminiData.ingredients,
            summary: geminiData.summary,
            priceRange: extractedData.priceRange || geminiData.priceRange,
        }
    } catch (e) {
        console.error('Failed to parse product data:', e)
        // Return Amazon extraction if available
        if (extractedData.name && extractedData.brand) {
            return extractedData as ExtractedProductData
        }
        return null
    }
}
