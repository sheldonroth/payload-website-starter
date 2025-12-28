import type { PayloadHandler, PayloadRequest } from 'payload'
import { GoogleGenerativeAI } from '@google/generative-ai'

interface HarmfulIngredient {
    ingredient: string
    reason: string
}

interface QualityIndicator {
    indicator: string
    description: string
}

interface EnrichmentResult {
    harmfulIngredients: HarmfulIngredient[]
    qualityIndicators: QualityIndicator[]
    researchNotes: string
}

/**
 * Category Enricher Endpoint
 * POST /api/category/enrich
 * 
 * Analyzes video transcripts for a category to extract:
 * - Harmful ingredients to avoid
 * - Quality indicators to look for
 * - Research findings and notes
 * - Auto-checks products against findings
 */
export const categoryEnrichHandler: PayloadHandler = async (req: PayloadRequest) => {
    if (!req.user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const geminiKey = process.env.GEMINI_API_KEY
    if (!geminiKey) {
        return Response.json({ error: 'Gemini API key not configured' }, { status: 500 })
    }

    try {
        const body = await req.json?.()
        const { categoryId, checkProducts = false } = body || {}

        if (!categoryId) {
            return Response.json({ error: 'categoryId is required' }, { status: 400 })
        }

        const payload = req.payload

        // 1. Fetch the category
        const category = await payload.findByID({
            collection: 'categories',
            id: categoryId,
        })

        if (!category) {
            return Response.json({ error: 'Category not found' }, { status: 404 })
        }

        // 2. Find all videos linked to this category
        const videos = await payload.find({
            collection: 'videos',
            where: {
                category: { equals: categoryId },
            },
            limit: 50,
        })

        if (videos.docs.length === 0) {
            return Response.json({
                error: 'No videos found for this category. Add videos first.',
                categoryName: category.name,
            }, { status: 400 })
        }

        // 3. Collect transcripts from videos
        const transcripts: string[] = []
        for (const video of videos.docs) {
            const videoData = video as unknown as { transcript?: string; title?: string }
            if (videoData.transcript) {
                transcripts.push(`Video: ${videoData.title || 'Untitled'}\n${videoData.transcript}`)
            }
        }

        if (transcripts.length === 0) {
            return Response.json({
                error: 'No transcripts found in videos. Analyze videos first.',
                categoryName: category.name,
                videosFound: videos.docs.length,
            }, { status: 400 })
        }

        // 4. Use Gemini to analyze transcripts
        const genAI = new GoogleGenerativeAI(geminiKey)
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

        const combinedTranscripts = transcripts.join('\n\n---\n\n')

        const prompt = `You are a product research analyst. Analyze the following video transcripts about "${category.name}" products.

Extract the following information:

1. HARMFUL INGREDIENTS: List any ingredients, chemicals, or substances that are mentioned as harmful, concerning, or to be avoided. For each, explain why.

2. QUALITY INDICATORS: List characteristics, certifications, or features that indicate a HIGH QUALITY product in this category.

3. RESEARCH NOTES: Summarize the key findings, testing methodologies, and important takeaways for consumers.

Respond in this exact JSON format:
{
  "harmfulIngredients": [
    {"ingredient": "name", "reason": "why to avoid"}
  ],
  "qualityIndicators": [
    {"indicator": "name", "description": "what it means"}
  ],
  "researchNotes": "Summary of research findings..."
}

TRANSCRIPTS:
${combinedTranscripts.substring(0, 100000)}` // Limit to 100k chars

        const result = await model.generateContent(prompt)
        const responseText = result.response.text()

        // Parse JSON from response
        let enrichment: EnrichmentResult
        try {
            const jsonMatch = responseText.match(/\{[\s\S]*\}/)
            if (!jsonMatch) throw new Error('No JSON found in response')
            enrichment = JSON.parse(jsonMatch[0])
        } catch {
            return Response.json({
                error: 'Failed to parse AI response',
                rawResponse: responseText.substring(0, 500),
            }, { status: 500 })
        }

        // 5. Update category with research findings
        await payload.update({
            collection: 'categories',
            id: categoryId,
            data: {
                harmfulIngredients: enrichment.harmfulIngredients,
                qualityIndicators: enrichment.qualityIndicators,
                researchNotes: enrichment.researchNotes,
                lastEnrichedAt: new Date().toISOString(),
            } as Record<string, unknown>,
        })

        // 6. Optionally check products against harmful ingredients
        let productsChecked = 0
        let productsRecommended = 0

        if (checkProducts && enrichment.harmfulIngredients.length > 0) {
            const products = await payload.find({
                collection: 'products',
                where: {
                    category: { equals: categoryId },
                },
                limit: 100,
            })

            const harmfulList = enrichment.harmfulIngredients.map(h => h.ingredient.toLowerCase())

            for (const product of products.docs) {
                productsChecked++
                const productData = product as unknown as {
                    ingredients?: string
                    badges?: { isRecommended?: boolean }
                }

                const ingredients = (productData.ingredients || '').toLowerCase()
                const hasHarmful = harmfulList.some(harmful =>
                    ingredients.includes(harmful.toLowerCase())
                )

                // Mark as recommended if no harmful ingredients found
                if (!hasHarmful && !productData.badges?.isRecommended) {
                    await payload.update({
                        collection: 'products',
                        id: product.id as number,
                        data: {
                            badges: {
                                ...productData.badges,
                                isRecommended: true,
                            },
                        } as Record<string, unknown>,
                    })
                    productsRecommended++
                }
            }
        }

        return Response.json({
            success: true,
            categoryName: category.name,
            videosAnalyzed: transcripts.length,
            harmfulIngredients: enrichment.harmfulIngredients.length,
            qualityIndicators: enrichment.qualityIndicators.length,
            productsChecked,
            productsRecommended,
            enrichment,
        })

    } catch (error) {
        console.error('Category enrichment error:', error)
        return Response.json(
            { error: error instanceof Error ? error.message : 'Enrichment failed' },
            { status: 500 }
        )
    }
}
