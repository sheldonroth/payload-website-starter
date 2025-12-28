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

// Fetch YouTube transcript using captions - returns null if unavailable
async function getYouTubeTranscript(videoUrl: string): Promise<string | null> {
    const videoId = extractYouTubeVideoId(videoUrl)
    if (!videoId) {
        return null
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
        console.log('Transcript unavailable, will use video analysis:', error)
        return null
    }
}

// Extract products directly from video using Gemini video understanding
async function extractProductsFromVideo(
    videoUrl: string,
    existingCategories: string[]
): Promise<ExtractedProduct[]> {
    const { GoogleGenerativeAI } = await import('@google/generative-ai')
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

    const systemPrompt = generateSystemPrompt(existingCategories)

    // For video analysis, we ask Gemini to watch and analyze the video
    const fullPrompt = `${systemPrompt}

IMPORTANT: You are analyzing a YouTube video directly (not a transcript). 
Watch/analyze the video at this URL: ${videoUrl}

Extract all products that are reviewed or discussed in this video. If you cannot access the video content, return an empty products array.

Analyze this video and extract all products reviewed:`

    const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
        generationConfig: {
            temperature: 0.3,
            responseMimeType: 'application/json',
        },
    })

    const content = result.response.text()
    if (!content) {
        return []
    }

    try {
        const parsed = JSON.parse(content)
        return parsed.products || []
    } catch (error) {
        console.error('Video analysis JSON parse error:', error)
        return []
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
4. HIERARCHICAL CATEGORY DETECTION:
   - Use "Parent > Child" format for granular categorization
   - Examples:
     * "Food & Beverage > Sports Drinks" for Prime Hydration
     * "Food & Beverage > Protein Bars" for protein bars
     * "Supplements > Pre-Workout" for pre-workout supplements
     * "Baby & Kids > Baby Food" for baby food products
     * "Pet Care > Dog Food" for dog food
   - If a product fits an EXISTING category, use that exact name
   - If suggesting a NEW category, use the Parent > Child format
   - Set isNewCategory to true for any category not in the existing list

Output ONLY a valid JSON object with this exact schema:
{
  "products": [
    {
      "productName": "string",
      "brandName": "string", 
      "suggestedCategory": "string (use 'Parent > Child' format, e.g., 'Food & Beverage > Sports Drinks')",
      "isNewCategory": boolean (true if this is a NEW category not in the existing list),
      "sentimentScore": number,
      "pros": ["string"],
      "cons": ["string"],
      "summary": "string (2 sentences max)"
    }
  ]
}`
}

// Extract products from transcript using Gemini with category awareness
async function extractProductsFromTranscript(
    transcript: string,
    existingCategories: string[]
): Promise<ExtractedProduct[]> {
    const { GoogleGenerativeAI } = await import('@google/generative-ai')
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

    const systemPrompt = generateSystemPrompt(existingCategories)
    const fullPrompt = `${systemPrompt}\n\nAnalyze this video transcript and extract all products reviewed:\n\n${transcript}`

    const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
        generationConfig: {
            temperature: 0.3,
            responseMimeType: 'application/json',
        },
    })

    const content = result.response.text()
    if (!content) {
        throw new Error('No response from Gemini')
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
    if (!process.env.GEMINI_API_KEY) {
        return Response.json({ error: 'Gemini API key not configured' }, { status: 500 })
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

        // Step 2: Try to get transcript, fallback to video analysis
        const transcript = await getYouTubeTranscript(videoUrl)
        let products: ExtractedProduct[]
        let analysisMethod: 'transcript' | 'video'

        // Step 2.5: Find or create Video record and save transcript
        const videoId = extractYouTubeVideoId(videoUrl)
        let videoRecord: { id: number } | null = null
        if (videoId) {
            // Check if video already exists
            const existingVideos = await req.payload.find({
                collection: 'videos',
                where: { youtubeId: { equals: videoId } },
                limit: 1,
            })

            if (existingVideos.docs.length > 0) {
                videoRecord = existingVideos.docs[0] as { id: number }
                // Update transcript if we have one
                if (transcript) {
                    await req.payload.update({
                        collection: 'videos',
                        id: videoRecord.id,
                        data: {
                            transcript,
                            transcriptUpdatedAt: new Date().toISOString(),
                            analyzedAt: new Date().toISOString(),
                        },
                    })
                }
            }
        }

        if (transcript) {
            // Use transcript-based extraction
            analysisMethod = 'transcript'
            products = await extractProductsFromTranscript(transcript, existingCategories)
        } else {
            // Fallback to Gemini video analysis
            analysisMethod = 'video'
            console.log('Using Gemini video analysis for:', videoUrl)
            products = await extractProductsFromVideo(videoUrl, existingCategories)
        }
        /* ============================================================================
         * ⚠️⚠️⚠️ WARNING: AI DUPLICATE DETECTION FEATURE ⚠️⚠️⚠️
         * ============================================================================
         * This feature checks for duplicate products ONLY in 'ai_draft' status.
         * It will NOT affect products with other statuses (draft, published, etc.)
         * 
         * Added: December 2024
         * Reason: AI was creating many duplicate product entries
         * 
         * HOW IT WORKS:
         * 1. Before creating each AI draft, we search for existing ai_draft products
         * 2. If a product with same name+brand exists as ai_draft, we SKIP it
         * 3. This ONLY applies to ai_draft, not draft/published/etc.
         * 
         * IF THIS CAUSES PROBLEMS:
         * - Check if legitimate products are being skipped
         * - The duplicate check is case-insensitive
         * - Products are matched by (name + brand) combination
         * - To disable: remove the duplicate check block below and change status to 'draft'
         * ============================================================================ */

        // Step 4: Create AI drafts in Payload (with duplicate detection)
        const createdDrafts: { id: number; name: string; category: string; isNewCategory: boolean }[] = []
        const skippedDuplicates: string[] = []

        for (const product of products) {
            try {
                // ⚠️ DUPLICATE CHECK: Only affects ai_draft status products
                const existingAiDraft = await req.payload.find({
                    collection: 'products',
                    where: {
                        and: [
                            { status: { equals: 'ai_draft' } },
                            { name: { equals: product.productName } },
                            ...(product.brandName ? [{ brand: { equals: product.brandName } }] : []),
                        ],
                    },
                    limit: 1,
                })

                if (existingAiDraft.docs.length > 0) {
                    skippedDuplicates.push(`${product.brandName || ''} ${product.productName}`.trim())
                    continue // Skip this duplicate
                }

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

                // Build product data object
                const productData: Record<string, unknown> = {
                    name: product.productName,
                    brand: product.brandName,
                    status: 'ai_draft',
                    priceRange: '$$',
                    summary: `${product.summary}\n\nPros: ${product.pros.join(', ')}\nCons: ${product.cons.join(', ')}`,
                    verdict: product.sentimentScore >= 7 ? 'recommend' :
                        product.sentimentScore >= 4 ? 'caution' : 'avoid',
                    verdictReason: `AI-extracted from video. Sentiment: ${product.sentimentScore}/10.`,
                }
                if (categoryId) productData.category = categoryId
                if (product.isNewCategory) productData.pendingCategoryName = product.suggestedCategory

                // @ts-expect-error - Payload types require specific product shape but we're building dynamically
                const created = await req.payload.create({
                    collection: 'products',
                    data: productData,
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
            analysisMethod,
            transcript: transcript ? transcript.substring(0, 500) + '...' : null,
            productsFound: products.length,
            products,
            draftsCreated: createdDrafts,
            skippedDuplicates, // ⚠️ Products skipped due to duplicate detection
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
