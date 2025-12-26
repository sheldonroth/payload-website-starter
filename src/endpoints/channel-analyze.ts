import { YoutubeTranscript } from 'youtube-transcript'
import type { PayloadHandler, PayloadRequest } from 'payload'

interface YouTubeVideo {
    id: string
    snippet: {
        title: string
        description: string
        publishedAt: string
    }
}

interface YouTubeSearchResponse {
    items: Array<{
        id: { videoId: string }
        snippet: YouTubeVideo['snippet']
    }>
    nextPageToken?: string
}

interface ExtractedProduct {
    productName: string
    brandName: string
    category: string
    sentimentScore: number
    pros: string[]
    cons: string[]
    summary: string
    sourceVideoId?: string
    sourceVideoTitle?: string
}

const SYSTEM_PROMPT = `You are an expert Editor for 'The Product Report.' You will receive a transcript of a video review. Your job is to extract structured data for every product mentioned.

Rules:
1. Ignore Sponsors: Do not extract products that are clearly ad reads or sponsorships unless the host explicitly reviews them as part of the content.
2. Be Critical: If the host mentions flaws (e.g., 'tastes like chalk'), capture that in the cons list.
3. Sentiment Scoring: Infer a score from 1-10 based on the host's tone:
   - "Love it, buying more" = 9-10
   - "It's okay, but pricey" = 6-7
   - "Don't buy this" = 1-3
4. Categories should be one of: Supplements, Food, Baby & Kids, Water, Cosmetics, Pet Food, Nicotine Pouches, or Other.

Output ONLY a valid JSON object with this exact schema:
{
  "products": [
    {
      "productName": "string",
      "brandName": "string", 
      "category": "string",
      "sentimentScore": number,
      "pros": ["string"],
      "cons": ["string"],
      "summary": "string (2 sentences max)"
    }
  ]
}`

async function getTranscript(videoId: string): Promise<string | null> {
    try {
        const transcriptItems = await YoutubeTranscript.fetchTranscript(videoId)
        return transcriptItems
            .map((item) => item.text)
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim()
    } catch {
        return null // Video may not have captions
    }
}

async function extractProducts(transcript: string): Promise<ExtractedProduct[]> {
    const OpenAI = (await import('openai')).default
    const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    })

    const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            {
                role: 'user',
                content: `Analyze this video transcript and extract all products reviewed:\n\n${transcript}`,
            },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
    })

    const content = response.choices[0]?.message?.content
    if (!content) return []

    try {
        const parsed = JSON.parse(content)
        return parsed.products || []
    } catch {
        return []
    }
}

export const channelAnalyzeHandler: PayloadHandler = async (req: PayloadRequest) => {
    // Check if user is authenticated
    if (!req.user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!process.env.OPENAI_API_KEY) {
        return Response.json({ error: 'OpenAI API key not configured' }, { status: 500 })
    }

    try {
        const { payload } = req
        const body = await req.json?.()
        const { maxVideos = 10 } = body || {}

        // Get YouTube settings
        const settings = await payload.findGlobal({
            slug: 'youtube-settings',
        })

        const { channelId, apiKey } = settings as {
            channelId?: string
            apiKey?: string
        }

        if (!channelId || !apiKey) {
            return Response.json(
                { error: 'YouTube channel ID and API key are required. Configure in CMS Settings.' },
                { status: 400 }
            )
        }

        // Fetch recent videos from channel
        const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search')
        searchUrl.searchParams.set('key', apiKey)
        searchUrl.searchParams.set('channelId', channelId)
        searchUrl.searchParams.set('part', 'snippet')
        searchUrl.searchParams.set('order', 'date')
        searchUrl.searchParams.set('maxResults', String(Math.min(maxVideos, 50)))
        searchUrl.searchParams.set('type', 'video')

        const searchResponse = await fetch(searchUrl.toString())

        if (!searchResponse.ok) {
            const error = await searchResponse.json()
            return Response.json({ error: error.error?.message || 'YouTube API error' }, { status: 500 })
        }

        const searchData: YouTubeSearchResponse = await searchResponse.json()

        const results = {
            videosProcessed: 0,
            videosSkipped: 0,
            productsFound: 0,
            draftsCreated: 0,
            errors: [] as string[],
            createdDrafts: [] as { id: number; name: string; video: string }[],
        }

        // Process each video
        for (const item of searchData.items) {
            const videoId = item.id.videoId
            const videoTitle = item.snippet.title

            // Get transcript
            const transcript = await getTranscript(videoId)

            if (!transcript) {
                results.videosSkipped++
                results.errors.push(`${videoTitle}: No captions available`)
                continue
            }

            // Extract products
            const products = await extractProducts(transcript)

            if (products.length === 0) {
                results.videosSkipped++
                continue
            }

            results.videosProcessed++
            results.productsFound += products.length

            // Create drafts for each product
            for (const product of products) {
                try {
                    const created = await payload.create({
                        collection: 'products',
                        data: {
                            name: product.productName,
                            brand: product.brandName,
                            status: 'draft',
                            priceRange: '$$',
                            summary: `${product.summary}\n\nPros: ${product.pros.join(', ')}\nCons: ${product.cons.join(', ')}\n\nSource: ${videoTitle}`,
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

                    results.draftsCreated++
                    results.createdDrafts.push({
                        id: created.id as number,
                        name: product.productName,
                        video: videoTitle,
                    })
                } catch (error) {
                    results.errors.push(`Failed to create draft for ${product.productName}`)
                }
            }
        }

        return Response.json({
            success: true,
            ...results,
            message: `Processed ${results.videosProcessed} videos, found ${results.productsFound} products, created ${results.draftsCreated} drafts`,
        })
    } catch (error) {
        console.error('Channel analyze error:', error)
        return Response.json(
            { error: error instanceof Error ? error.message : 'Analysis failed' },
            { status: 500 }
        )
    }
}
