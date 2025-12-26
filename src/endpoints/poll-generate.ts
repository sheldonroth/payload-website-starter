import type { PayloadHandler, PayloadRequest } from 'payload'

interface GeneratedPoll {
    title: string
    description: string
    options: Array<{
        name: string
        description: string
    }>
}

const SYSTEM_PROMPT = `You are a content strategist for 'The Product Report,' a consumer investigation platform. Your job is to generate engaging poll questions that will drive user engagement and help us decide what products/categories to investigate next.

Rules:
1. Make questions conversational and engaging
2. Options should be specific product categories or investigation topics
3. Include 4-6 options per poll
4. Each option should have a brief, compelling description (10 words max)
5. Focus on topics that affect consumer health, safety, or wallet

Output ONLY a valid JSON object with this exact schema:
{
  "title": "string (the poll question, 10 words max)",
  "description": "string (context for voters, 20 words max)",
  "options": [
    {
      "name": "string (category/topic name)",
      "description": "string (why it matters, 10 words max)"
    }
  ]
}`

async function generatePollWithAI(topic: string, existingCategories: string[]): Promise<GeneratedPoll> {
    const OpenAI = (await import('openai')).default
    const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    })

    const categoryContext = existingCategories.length > 0
        ? `Current categories we cover: ${existingCategories.join(', ')}`
        : 'We are a new platform.'

    const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            {
                role: 'user',
                content: `Generate an investigation poll about: "${topic}"

${categoryContext}

Create an engaging poll that asks users what they want us to investigate next related to this topic.`,
            },
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' },
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
        throw new Error('No response from GPT-4o')
    }

    return JSON.parse(content)
}

export const pollGenerateHandler: PayloadHandler = async (req: PayloadRequest) => {
    // Check if user is authenticated
    if (!req.user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!process.env.OPENAI_API_KEY) {
        return Response.json({ error: 'OpenAI API key not configured' }, { status: 500 })
    }

    try {
        const body = await req.json?.()
        const { topic, autoCreate = false } = body || {}

        if (!topic) {
            return Response.json({ error: 'topic is required' }, { status: 400 })
        }

        // Fetch existing categories for context
        const categoriesResult = await req.payload.find({
            collection: 'categories',
            limit: 100,
        })
        const existingCategories = categoriesResult.docs.map((cat: { name: string }) => cat.name)

        // Generate poll with AI
        const generatedPoll = await generatePollWithAI(topic, existingCategories)

        // Optionally auto-create the poll
        let createdPoll = null
        if (autoCreate) {
            createdPoll = await req.payload.create({
                collection: 'investigation-polls',
                data: {
                    title: generatedPoll.title,
                    description: generatedPoll.description,
                    status: 'active',
                    options: generatedPoll.options.map(opt => ({
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
