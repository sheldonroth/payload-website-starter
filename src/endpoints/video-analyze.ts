import { YoutubeTranscript } from 'youtube-transcript'
import type { PayloadHandler, PayloadRequest } from 'payload'

// Extract YouTube video ID from various URL formats
function extractYouTubeVideoId(url: string): string | null {
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
        /^([a-zA-Z0-9_-]{11})$/, // Direct video ID
    ]

    for (const pattern of patterns) {
        const match = url.match(pattern)
        if (match) return match[1]
    }
    return null
}

// Fetch YouTube transcript using captions
async function getYouTubeTranscript(videoUrl: string): Promise<string> {
    const videoId = extractYouTubeVideoId(videoUrl)
    if (!videoId) {
        throw new Error('Invalid YouTube URL')
    }

    try {
        const transcriptItems = await YoutubeTranscript.fetchTranscript(videoId)
        const transcript = transcriptItems
            .map((item) => item.text)
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim()

        return transcript
    } catch (error) {
        console.error('Transcript fetch error:', error)
        throw new Error('Failed to fetch transcript. Video may not have captions enabled.')
    }
}

// Product extraction schema with smart category detection
interface ExtractedProduct {
    productName: string
    brandName: string
    suggestedCategory: string
    isNewCategory: boolean
    sentimentScore: number
    pros: string[]
    cons: string[]
    summary: string
}

// Generate system prompt with existing categories
function generateSystemPrompt(existingCategories: string[]): string {
    const categoryList = existingCategories.length > 0
        ? existingCategories.join(', ')
        : 'None yet'

    return `You are an expert Editor for 'The Product Report.' You will receive a transcript of a video review. Your job is to extract structured data for every product mentioned.

EXISTING CATEGORIES IN OUR DATABASE:
${categoryList}

Rules:
1. Ignore Sponsors: Do not extract products that are clearly ad reads or sponsorships unless the host explicitly reviews them as part of the content.
2. Be Critical: If the host mentions flaws (e.g., 'tastes like chalk'), capture that in the cons list.
3. Sentiment Scoring: Infer a score from 1-10 based on the host's tone:
   - "Love it, buying more" = 9-10
   - "It's okay, but pricey" = 6-7
   - "Don't buy this" = 1-3
4. CATEGORY DETECTION:
   - If the product fits an EXISTING category from the list above, use that exact name.
   - If no existing category fits, suggest a NEW category name and set isNewCategory to true.
   - Be specific but not too narrow (e.g., "Energy Drinks" not "Sugar-Free Caffeinated Beverages").

Output ONLY a valid JSON object with this exact schema:
{
  "products": [
    {
      "productName": "string",
      "brandName": "string", 
      "suggestedCategory": "string (use existing category name if it fits, otherwise suggest a new one)",
      "isNewCategory": boolean (true if this is a NEW category not in the existing list),
      "sentimentScore": number,
      "pros": ["string"],
      "cons": ["string"],
      "summary": "string (2 sentences max)"
    }
  ]
}`
}

// Extract products from transcript using GPT-4o with category awareness
async function extractProductsFromTranscript(
    transcript: string,
    existingCategories: string[]
): Promise<ExtractedProduct[]> {
    const OpenAI = (await import('openai')).default
    const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    })

    const systemPrompt = generateSystemPrompt(existingCategories)

    const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
            { role: 'system', content: systemPrompt },
            {
                role: 'user',
                content: `Analyze this video transcript and extract all products reviewed:\n\n${transcript}`,
            },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
        throw new Error('No response from GPT-4o')
    }

    try {
        const parsed = JSON.parse(content)
        return parsed.products || []
    } catch (error) {
        console.error('JSON parse error:', error)
        throw new Error('Failed to parse GPT-4o response as JSON')
    }
}

export const videoAnalyzeHandler: PayloadHandler = async (req: PayloadRequest) => {
    // Check if user is authenticated
    if (!req.user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check for API key
    if (!process.env.OPENAI_API_KEY) {
        return Response.json({ error: 'OpenAI API key not configured' }, { status: 500 })
    }

    try {
        const body = await req.json?.()
        const { videoUrl } = body || {}

        if (!videoUrl) {
            return Response.json({ error: 'videoUrl is required' }, { status: 400 })
        }

        // Validate URL format
        if (!videoUrl.includes('youtube.com') && !videoUrl.includes('youtu.be')) {
            return Response.json({ error: 'Only YouTube URLs are currently supported' }, { status: 400 })
        }

        // Step 1: Fetch existing categories
        const categoriesResult = await req.payload.find({
            collection: 'categories',
            limit: 100,
        })
        const existingCategories = categoriesResult.docs.map((cat: { name: string }) => cat.name)

        // Step 2: Get transcript
        const transcript = await getYouTubeTranscript(videoUrl)

        // Step 3: Extract products with category awareness
        const products = await extractProductsFromTranscript(transcript, existingCategories)

        // Step 4: Create drafts in Payload
        const createdDrafts: { id: number; name: string; category: string; isNewCategory: boolean }[] = []

        for (const product of products) {
            try {
                // Find existing category or leave null for new ones
                let categoryId: number | null = null
                if (!product.isNewCategory) {
                    const existingCat = categoriesResult.docs.find(
                        (cat: { name: string; id: number }) =>
                            cat.name.toLowerCase() === product.suggestedCategory.toLowerCase()
                    )
                    if (existingCat) {
                        categoryId = existingCat.id as number
                    }
                }

                const created = await req.payload.create({
                    collection: 'products',
                    data: {
                        name: product.productName,
                        brand: product.brandName,
                        status: 'draft',
                        priceRange: '$$',
                        summary: `${product.summary}\n\nPros: ${product.pros.join(', ')}\nCons: ${product.cons.join(', ')}`,
                        ...(categoryId && { category: categoryId }),
                        ...(product.isNewCategory && { pendingCategoryName: product.suggestedCategory }),
                        ratings: {
                            performance: product.sentimentScore * 10,
                            reliability: product.sentimentScore * 10,
                            valueForMoney: product.sentimentScore * 10,
                            features: product.sentimentScore * 10,
                        },
                        badges: {
                            isRecommended: product.sentimentScore >= 7,
                            isBestValue: product.sentimentScore >= 8 && product.sentimentScore < 10,
                            isBestInCategory: product.sentimentScore >= 9,
                        },
                    },
                })

                createdDrafts.push({
                    id: created.id as number,
                    name: product.productName,
                    category: product.suggestedCategory,
                    isNewCategory: product.isNewCategory,
                })
            } catch (error) {
                console.error(`Error creating draft for ${product.productName}:`, error)
            }
        }

        return Response.json({
            success: true,
            transcript: transcript.substring(0, 500) + '...',
            productsFound: products.length,
            products,
            draftsCreated: createdDrafts,
            existingCategories,
        })
    } catch (error) {
        console.error('Video analysis error:', error)
        return Response.json(
            { error: error instanceof Error ? error.message : 'Analysis failed' },
            { status: 500 },
        )
    }
}
