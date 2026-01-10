import type { PayloadHandler, PayloadRequest } from 'payload'
import { checkRateLimitAsync, rateLimitResponse, getRateLimitKey, RateLimits } from '../utilities/rate-limiter'

interface SEOOutput {
    metaTitle: string
    metaDescription: string
    keywords: string[]
    ogTitle: string
    ogDescription: string
}

const SYSTEM_PROMPT = `You are an SEO expert for 'The Product Report,' a consumer investigation platform. Generate optimized meta information for products and articles.

Rules:
1. Meta Title: 50-60 characters, include brand/product name, mention reviews or ratings
2. Meta Description: 150-160 characters, compelling, include call-to-action
3. Keywords: 5-8 relevant search terms, mix of short and long-tail
4. OG Title: Slightly different from meta title, more engaging for social
5. OG Description: 150-200 characters, designed to get clicks from social media

Output ONLY a valid JSON object with this exact schema:
{
  "metaTitle": "string (50-60 chars)",
  "metaDescription": "string (150-160 chars)",
  "keywords": ["string"],
  "ogTitle": "string (for social sharing)",
  "ogDescription": "string (for social sharing)"
}`

async function generateSEOMeta(
    type: 'product' | 'article',
    name: string,
    brand: string | null,
    category: string | null,
    summary: string | null
): Promise<SEOOutput> {
    const { GoogleGenerativeAI } = await import('@google/generative-ai')
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

    const context = type === 'product'
        ? `Product: ${name}
Brand: ${brand || 'Unknown'}
Category: ${category || 'General'}
Summary: ${summary || 'No summary available'}`
        : `Article: ${name}
Summary: ${summary || 'No summary available'}`

    const fullPrompt = `${SYSTEM_PROMPT}\n\nGenerate SEO meta information for this ${type}:\n\n${context}`

    const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
        generationConfig: {
            temperature: 0.5,
            responseMimeType: 'application/json',
        },
    })

    const content = result.response.text()
    if (!content) {
        throw new Error('No response from Gemini')
    }

    return JSON.parse(content)
}

export const seoGenerateHandler: PayloadHandler = async (req: PayloadRequest) => {
    // Check if user is authenticated
    if (!req.user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Rate limiting (using Vercel KV for serverless)
    const rateLimitKey = getRateLimitKey(req as unknown as Request, req.user?.id)
    const rateLimit = await checkRateLimitAsync(rateLimitKey, RateLimits.CONTENT_GENERATION)
    if (!rateLimit.allowed) {
        return rateLimitResponse(rateLimit.resetAt)
    }

    if (!process.env.GEMINI_API_KEY) {
        return Response.json({ error: 'Gemini API key not configured' }, { status: 500 })
    }

    try {
        const body = await req.json?.()
        const { type, id, autoApply = false } = body || {}

        if (!type || !id) {
            return Response.json({ error: 'type and id are required' }, { status: 400 })
        }

        if (type !== 'product' && type !== 'article') {
            return Response.json({ error: 'type must be "product" or "article"' }, { status: 400 })
        }

        // Fetch the item
        const collection = type === 'product' ? 'products' : 'articles'
        const item = await req.payload.findByID({
            collection,
            id,
        })

        if (!item) {
            return Response.json({ error: `${type} not found` }, { status: 404 })
        }

        // Get relevant fields (cast to any for dynamic access)
        const itemData = item as unknown as Record<string, unknown>
        const name = (itemData.name || itemData.title || 'Unknown') as string
        const brand = (itemData.brand || null) as string | null
        const categoryObj = itemData.category
        const category = typeof categoryObj === 'object' && categoryObj && 'name' in categoryObj
            ? (categoryObj as { name: string }).name
            : null
        const summary = (itemData.summary || itemData.excerpt || null) as string | null

        // Generate SEO meta
        const seoMeta = await generateSEOMeta(type, name, brand, category, summary)

        return Response.json({
            success: true,
            itemName: name,
            seo: seoMeta,
        })
    } catch (error) {
        console.error('SEO generation error:', error)
        return Response.json(
            { error: error instanceof Error ? error.message : 'Generation failed' },
            { status: 500 }
        )
    }
}
