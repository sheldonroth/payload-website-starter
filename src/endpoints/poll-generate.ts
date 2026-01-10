import type { PayloadHandler, PayloadRequest } from 'payload'
import { checkRateLimitAsync, rateLimitResponse, getRateLimitKey, RateLimits } from '../utilities/rate-limiter'

interface PollOption {
    name: string
    description: string
}

interface GeneratedPoll {
    title: string
    description: string
    options: PollOption[]
}

// Auto-generate trending poll with NO user input required
const AUTO_POLL_PROMPT = `You are a content strategist for 'The Product Report,' a consumer investigation platform. Your job is to generate a poll asking members what they want us to investigate next.

IMPORTANT: Generate topics based on:
1. Current health and consumer safety trends in the news
2. Emerging product categories people are concerned about
3. Food, supplements, baby products, pet food, cosmetics, and household items
4. Things that could be harmful or misleading to consumers

Rules:
1. Poll question should ask what to investigate next
2. Generate 4 specific, timely options (NOT generic categories)
3. Each option should reference a real concern or trend
4. Be specific: "Heavy metals in rice baby cereal" NOT just "Baby food"
5. Think trending: What's in the news? What are people worried about?

Output ONLY a valid JSON object:
{
  "title": "string (poll question, 10 words max)",
  "description": "string (context for voters, 20 words max)",
  "options": [
    {
      "name": "string (specific investigation topic)",
      "description": "string (why it matters, 10 words max)"
    }
  ]
}`

async function generateAutoPolls(existingProducts: string[], existingCategories: string[]): Promise<GeneratedPoll> {
    const { GoogleGenerativeAI } = await import('@google/generative-ai')
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

    const avoidList = [...existingProducts, ...existingCategories].slice(0, 30).join(', ')

    const userPrompt = `Generate a poll for our members to vote on what we should investigate next.

AVOID these topics (we've already covered them):
${avoidList || 'None yet'}

Focus on trending consumer safety concerns, recent news about product recalls, contamination, misleading claims, or emerging health trends.`

    const fullPrompt = `${AUTO_POLL_PROMPT}\n\n${userPrompt}`

    const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
        generationConfig: {
            temperature: 0.8,
            responseMimeType: 'application/json',
        },
    })

    const content = result.response.text()
    if (!content) {
        throw new Error('No response from Gemini')
    }

    return JSON.parse(content)
}

export const pollGenerateHandler: PayloadHandler = async (req: PayloadRequest) => {
    // Check if user is authenticated
    if (!req.user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Rate limiting
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
        const { autoCreate = false } = body || {}

        // Fetch existing products and categories to avoid
        const [productsResult, categoriesResult] = await Promise.all([
            req.payload.find({
                collection: 'products',
                limit: 50,
            }),
            req.payload.find({
                collection: 'categories',
                limit: 50,
            }),
        ])

        const existingProducts = productsResult.docs.map((p: { name?: string }) => p.name || '').filter(Boolean)
        const existingCategories = categoriesResult.docs.map((c: { name?: string }) => c.name || '').filter(Boolean)

        // Generate poll with AI (no user input needed)
        const generatedPoll = await generateAutoPolls(existingProducts, existingCategories)

        // Optionally auto-create the poll
        let createdPoll = null
        if (autoCreate) {
            createdPoll = await req.payload.create({
                collection: 'investigation-polls',
                data: {
                    title: generatedPoll.title,
                    description: generatedPoll.description,
                    status: 'active',
                    options: generatedPoll.options.map((opt) => ({
                        name: opt.name,
                        description: opt.description,
                        votes: 0,
                    })),
                    voters: {},
                    totalVotes: 0,
                },
            })
        }

        return Response.json({
            success: true,
            poll: generatedPoll,
            created: autoCreate,
            pollId: createdPoll?.id || null,
        })
    } catch (error) {
        console.error('Poll generation error:', error)
        return Response.json(
            { error: error instanceof Error ? error.message : 'Generation failed' },
            { status: 500 }
        )
    }
}
