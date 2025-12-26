import type { PayloadHandler, PayloadRequest } from 'payload'

interface PollOption {
    name: string
    description: string
}

interface GeneratedPoll {
    title: string
    description: string
    options: PollOption[]
}

const CATEGORY_POLL_PROMPT = `You are a content strategist for 'The Product Report,' a consumer investigation platform. Generate a poll asking members what CATEGORY of products they want investigated.

Rules:
1. Poll should ask about broad product CATEGORIES, not specific products
2. Generate 6 category options that are distinct from each other
3. Focus on health, safety, and consumer protection categories
4. Each option should be a product category like: Protein Powders, Baby Food, Pet Food, Skincare, Energy Drinks, etc.
5. For each category, include a brief reason why it matters (contaminants, claims, safety, etc.)

Output ONLY a valid JSON object:
{
  "title": "string (poll question about categories, 10 words max)",
  "description": "string (context for voters, 20 words max)",
  "options": [
    {
      "name": "string (category name)",
      "description": "string (why this category matters, 8 words max)"
    }
  ]
}`

async function generateCategoryPoll(existingCategories: string[]): Promise<GeneratedPoll> {
    const { GoogleGenerativeAI } = await import('@google/generative-ai')
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

    const avoidList = existingCategories.slice(0, 20).join(', ')

    const userPrompt = `Generate a category poll for our members to vote on what type of products we should investigate.

Categories we've already covered (avoid these):
${avoidList || 'None yet'}

Focus on consumer health, safety, and transparency. Think about categories where products often make misleading claims or have hidden concerns.`

    const fullPrompt = `${CATEGORY_POLL_PROMPT}\n\n${userPrompt}`

    const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
        generationConfig: {
            temperature: 0.7,
            responseMimeType: 'application/json',
        },
    })

    const content = result.response.text()
    if (!content) {
        throw new Error('No response from Gemini')
    }

    return JSON.parse(content)
}

export const categoryPollHandler: PayloadHandler = async (req: PayloadRequest) => {
    if (!req.user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!process.env.GEMINI_API_KEY) {
        return Response.json({ error: 'Gemini API key not configured' }, { status: 500 })
    }

    try {
        const body = await req.json?.()
        const { autoCreate = false } = body || {}

        // Fetch existing categories to avoid
        const categoriesResult = await req.payload.find({
            collection: 'categories',
            limit: 50,
        })

        const existingCategories = categoriesResult.docs.map((c: { name?: string }) => c.name || '').filter(Boolean)

        // Generate category poll
        const generatedPoll = await generateCategoryPoll(existingCategories)

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
        console.error('Category poll generation error:', error)
        return Response.json(
            { error: error instanceof Error ? error.message : 'Generation failed' },
            { status: 500 }
        )
    }
}
