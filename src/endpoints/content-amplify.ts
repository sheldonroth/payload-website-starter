import type { PayloadHandler, PayloadRequest, Payload } from 'payload'
import { createAuditLog } from '../collections/AuditLog'

/**
 * Content Amplification Endpoint
 * POST /api/content/amplify
 *
 * Generates multi-platform content from product data:
 * - Social media posts (Twitter, Instagram, TikTok scripts)
 * - Email newsletter snippets
 * - SEO-optimized article sections
 * - Video script outlines
 *
 * Uses Gemini 2.0 Flash for fast, cost-effective generation.
 */

interface AmplifyRequest {
    productId?: number
    ingredientId?: number
    articleId?: number
    platforms: Array<'twitter' | 'instagram' | 'tiktok' | 'newsletter' | 'article' | 'video_script'>
    tone?: 'urgent' | 'informative' | 'educational' | 'conversational'
    includeCallToAction?: boolean
}

interface GeneratedContent {
    platform: string
    content: string
    hashtags?: string[]
    characterCount?: number
    estimatedDuration?: string
}

interface AmplifyResult {
    success: boolean
    sourceType: 'product' | 'ingredient' | 'article'
    sourceName: string
    generated: GeneratedContent[]
    errors: string[]
}

// Platform-specific prompts
const PLATFORM_PROMPTS: Record<string, { maxLength: number; style: string }> = {
    twitter: {
        maxLength: 280,
        style: 'Punchy, attention-grabbing. Use emojis strategically. Include 2-3 relevant hashtags.',
    },
    instagram: {
        maxLength: 2200,
        style: 'Engaging, informative. Start with a hook. Use line breaks for readability. Include 5-10 hashtags at the end.',
    },
    tiktok: {
        maxLength: 1000,
        style: 'Script format with hook in first 3 seconds. Conversational, energetic. Include visual cues in brackets.',
    },
    newsletter: {
        maxLength: 500,
        style: 'Professional but friendly. Summarize key points. Include a clear call-to-action.',
    },
    article: {
        maxLength: 2000,
        style: 'SEO-optimized. Include H2 headers. Informative and well-researched tone.',
    },
    video_script: {
        maxLength: 1500,
        style: 'Spoken word format with timing cues. Engaging opener. Clear sections for intro, body, conclusion.',
    },
}

async function generateContent(
    sourceData: {
        type: 'product' | 'ingredient' | 'article'
        name: string
        verdict?: string
        reason?: string
        ingredients?: string[]
        content?: string
    },
    platform: string,
    tone: string,
    includeCTA: boolean
): Promise<GeneratedContent | null> {
    const geminiKey = process.env.GEMINI_API_KEY
    if (!geminiKey) {
        console.error('Gemini API key not configured')
        return null
    }

    const platformConfig = PLATFORM_PROMPTS[platform]
    if (!platformConfig) return null

    // Build context about the source
    let context = ''
    if (sourceData.type === 'product') {
        context = `Product: ${sourceData.name}
Verdict: ${sourceData.verdict || 'pending review'}
${sourceData.reason ? `Reason: ${sourceData.reason}` : ''}
${sourceData.ingredients?.length ? `Key ingredients: ${sourceData.ingredients.slice(0, 5).join(', ')}` : ''}`
    } else if (sourceData.type === 'ingredient') {
        context = `Ingredient: ${sourceData.name}
Verdict: ${sourceData.verdict || 'unknown'}
${sourceData.reason ? `Why: ${sourceData.reason}` : ''}`
    } else if (sourceData.type === 'article') {
        context = `Article: ${sourceData.name}
${sourceData.content?.substring(0, 500) || ''}`
    }

    const prompt = `You are a content creator for The Product Report, a consumer safety organization focused on exposing harmful ingredients in everyday products.

Generate content for ${platform.toUpperCase()} about:
${context}

Style requirements:
- ${platformConfig.style}
- Tone: ${tone}
- Maximum ${platformConfig.maxLength} characters
${includeCTA ? '- Include a call-to-action to check the full report on theproductreport.org' : ''}

${platform === 'twitter' ? 'Return ONLY the tweet text with hashtags.' : ''}
${platform === 'instagram' ? 'Return the caption with hashtags at the end.' : ''}
${platform === 'tiktok' ? 'Return a script with [VISUAL] cues and timing notes.' : ''}
${platform === 'newsletter' ? 'Return a newsletter snippet with a subject line suggestion.' : ''}
${platform === 'article' ? 'Return an SEO-optimized article section with H2 headers in markdown.' : ''}
${platform === 'video_script' ? 'Return a video script with [INTRO], [BODY], [OUTRO] sections and timing.' : ''}

Be factual and avoid sensationalism while still being engaging.`

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: Math.ceil(platformConfig.maxLength / 2),
                    },
                }),
            }
        )

        if (!response.ok) {
            console.error('Gemini API error:', await response.text())
            return null
        }

        const data = await response.json()
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text

        if (!content) return null

        // Extract hashtags if present
        const hashtags = content.match(/#\w+/g) || []

        // Estimate duration for video content
        let estimatedDuration: string | undefined
        if (platform === 'tiktok' || platform === 'video_script') {
            const wordCount = content.split(/\s+/).length
            const minutes = Math.ceil(wordCount / 150) // ~150 words per minute
            estimatedDuration = minutes <= 1 ? '< 1 minute' : `~${minutes} minutes`
        }

        return {
            platform,
            content: content.trim(),
            hashtags: hashtags.length > 0 ? hashtags : undefined,
            characterCount: content.length,
            estimatedDuration,
        }
    } catch (error) {
        console.error('Content generation failed:', error)
        return null
    }
}

export const contentAmplifyHandler: PayloadHandler = async (req: PayloadRequest) => {
    // Check authentication
    if (!req.user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const body = await req.json?.() as AmplifyRequest
        const {
            productId,
            ingredientId,
            articleId,
            platforms,
            tone = 'informative',
            includeCallToAction = true,
        } = body

        if (!platforms || platforms.length === 0) {
            return Response.json({
                error: 'At least one platform is required',
            }, { status: 400 })
        }

        if (!productId && !ingredientId && !articleId) {
            return Response.json({
                error: 'Either productId, ingredientId, or articleId is required',
            }, { status: 400 })
        }

        const result: AmplifyResult = {
            success: true,
            sourceType: productId ? 'product' : ingredientId ? 'ingredient' : 'article',
            sourceName: '',
            generated: [],
            errors: [],
        }

        // Fetch source data
        let sourceData: {
            type: 'product' | 'ingredient' | 'article'
            name: string
            verdict?: string
            reason?: string
            ingredients?: string[]
            content?: string
        }

        if (productId) {
            const product = await req.payload.findByID({
                collection: 'products',
                id: productId,
                depth: 1,
            }) as {
                name: string
                verdict?: string
                verdictOverrideReason?: string
                ingredientsList?: Array<{ name: string }>
            }

            sourceData = {
                type: 'product',
                name: product.name,
                verdict: product.verdict,
                reason: product.verdictOverrideReason,
                ingredients: product.ingredientsList?.map(i => i.name),
            }
            result.sourceName = product.name
        // NOTE: Ingredient branch removed - Ingredients collection archived
        } else {
            const article = await req.payload.findByID({
                collection: 'articles',
                id: articleId!,
            }) as {
                title: string
                excerpt?: string
            }

            sourceData = {
                type: 'article',
                name: article.title,
                content: article.excerpt,
            }
            result.sourceName = article.title
        }

        // Generate content for each platform
        for (const platform of platforms) {
            const generated = await generateContent(sourceData, platform, tone, includeCallToAction)

            if (generated) {
                result.generated.push(generated)
            } else {
                result.errors.push(`Failed to generate ${platform} content`)
            }
        }

        // Create audit log
        await createAuditLog(req.payload, {
            action: 'ai_seo_generated',
            sourceType: 'manual',
            targetCollection: result.sourceType === 'product' ? 'products' :
                             result.sourceType === 'ingredient' ? 'ingredients' : 'articles',
            targetId: productId || ingredientId || articleId,
            targetName: result.sourceName,
            aiModel: 'gemini-2.0-flash',
            metadata: {
                type: 'content_amplification',
                platforms,
                successfulPlatforms: result.generated.map(g => g.platform),
                tone,
            },
            performedBy: (req.user as { id?: number })?.id,
        })

        return Response.json(result)
    } catch (error) {
        console.error('Content amplification error:', error)
        return Response.json({
            success: false,
            error: error instanceof Error ? error.message : 'Amplification failed',
        }, { status: 500 })
    }
}

/**
 * Batch amplify content for newsletter generation
 */
export async function batchAmplifyForNewsletter(
    payload: Payload,
    options: { limit?: number; category?: string } = {}
): Promise<{
    subject: string
    sections: Array<{ title: string; content: string; productId?: number }>
}> {
    const { limit = 5 } = options

    // Get recent products with strong verdicts
    const products = await payload.find({
        collection: 'products',
        where: {
            status: { equals: 'published' },
            verdict: { in: ['avoid', 'recommend'] },
        },
        sort: '-updatedAt',
        limit,
    })

    const sections: Array<{ title: string; content: string; productId?: number }> = []

    for (const product of products.docs) {
        const productData = product as {
            id: number
            name: string
            verdict?: string
            verdictOverrideReason?: string
        }

        const sourceData = {
            type: 'product' as const,
            name: productData.name,
            verdict: productData.verdict,
            reason: productData.verdictOverrideReason,
        }

        const generated = await generateContent(sourceData, 'newsletter', 'informative', true)

        if (generated) {
            sections.push({
                title: productData.name,
                content: generated.content,
                productId: productData.id,
            })
        }
    }

    // Generate subject line
    const avoidCount = products.docs.filter(p => (p as { verdict?: string }).verdict === 'avoid').length
    const subject = avoidCount > 0
        ? `⚠️ ${avoidCount} Products to Avoid This Week`
        : `This Week's Product Safety Report`

    return { subject, sections }
}
