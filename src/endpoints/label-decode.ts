import type { PayloadHandler, PayloadRequest } from 'payload'
import { createAuditLog } from '../collections/AuditLog'
import { parseAndLinkIngredients } from '../utilities/smart-automation'
import { checkRateLimit, rateLimitResponse, getRateLimitKey, RateLimits } from '../utilities/rate-limiter'

/**
 * Label Decoder Endpoint
 * POST /api/label/decode
 *
 * Uses GPT-4 Vision to extract ingredients from nutrition/ingredient label photos.
 * Returns structured ingredient data with toxin flagging.
 */

interface DecodedIngredient {
    name: string
    linkedId?: number
    verdict?: 'safe' | 'caution' | 'avoid' | 'unknown'
    confidence: number
}

interface DecodeResult {
    success: boolean
    rawText?: string
    ingredients: DecodedIngredient[]
    linkedCount: number
    unmatchedCount: number
    flaggedToxins: string[]
    autoVerdict?: 'recommend' | 'caution' | 'avoid'
    productId?: number
    error?: string
}

export const labelDecodeHandler: PayloadHandler = async (req: PayloadRequest) => {
    // Check authentication
    if (!req.user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Rate limiting
    const rateLimitKey = getRateLimitKey(req as unknown as Request, req.user?.id)
    const rateLimit = checkRateLimit(rateLimitKey, RateLimits.AI_ANALYSIS)
    if (!rateLimit.allowed) {
        return rateLimitResponse(rateLimit.resetAt)
    }

    // Check for API key
    const openaiKey = process.env.OPENAI_API_KEY
    if (!openaiKey) {
        return Response.json({ error: 'OpenAI API key not configured' }, { status: 500 })
    }

    try {
        const body = await req.json?.()
        const { imageBase64, imageUrl, productId, autoApply = false } = body || {}

        if (!imageBase64 && !imageUrl) {
            return Response.json({
                error: 'Either imageBase64 or imageUrl is required',
            }, { status: 400 })
        }

        // Prepare image content for GPT-4 Vision
        const imageContent = imageBase64
            ? { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
            : { type: 'image_url', image_url: { url: imageUrl } }

        // Call GPT-4 Vision to extract ingredients
        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${openaiKey}`,
            },
            body: JSON.stringify({
                model: 'gpt-4o',
                messages: [
                    {
                        role: 'system',
                        content: `You are an expert at reading nutrition and ingredient labels from product photos.
Your task is to extract ALL ingredients from the label image.

Rules:
1. Extract every ingredient mentioned, including sub-ingredients in parentheses
2. Normalize ingredient names (e.g., "SODIUM CHLORIDE" -> "Salt", "AQUA" -> "Water")
3. Remove quantities and percentages, just list the ingredient names
4. List them in order of appearance (typically highest to lowest by weight)
5. If you cannot read the label clearly, indicate which parts are unclear

Return ONLY a valid JSON object with this exact schema:
{
  "rawText": "The full text you can read from the label",
  "ingredients": ["ingredient1", "ingredient2", ...],
  "confidence": 0.95, // 0-1 confidence in your reading
  "unclear": ["any parts that were hard to read"]
}`
                    },
                    {
                        role: 'user',
                        content: [
                            { type: 'text', text: 'Extract all ingredients from this product label:' },
                            imageContent as { type: 'image_url'; image_url: { url: string } },
                        ],
                    },
                ],
                max_tokens: 2000,
                response_format: { type: 'json_object' },
            }),
        })

        if (!openaiResponse.ok) {
            const errorText = await openaiResponse.text()
            console.error('OpenAI API error:', errorText)
            return Response.json({
                error: 'Failed to analyze image',
                details: errorText,
            }, { status: 500 })
        }

        const openaiData = await openaiResponse.json()
        const content = openaiData.choices?.[0]?.message?.content

        if (!content) {
            return Response.json({ error: 'No response from GPT-4 Vision' }, { status: 500 })
        }

        let parsed: {
            rawText: string
            ingredients: string[]
            confidence: number
            unclear?: string[]
        }

        try {
            parsed = JSON.parse(content)
        } catch (parseError) {
            console.error('Failed to parse GPT-4 Vision response:', content)
            return Response.json({ error: 'Failed to parse AI response' }, { status: 500 })
        }

        // Parse and link ingredients using existing utility
        const ingredientsRaw = parsed.ingredients.join(', ')
        const parseResult = await parseAndLinkIngredients(ingredientsRaw, req.payload)

        // Build result with linked ingredient details
        const decodedIngredients: DecodedIngredient[] = []
        const flaggedToxins: string[] = []

        // Get full ingredient details for linked ones
        if (parseResult.linkedIds.length > 0) {
            const linkedIngredients = await req.payload.find({
                collection: 'ingredients',
                where: { id: { in: parseResult.linkedIds } },
                limit: 100,
            })

            for (const ing of linkedIngredients.docs) {
                const ingredient = ing as { id: number; name: string; verdict?: string }
                decodedIngredients.push({
                    name: ingredient.name,
                    linkedId: ingredient.id,
                    verdict: (ingredient.verdict as 'safe' | 'caution' | 'avoid' | 'unknown') || 'unknown',
                    confidence: parsed.confidence,
                })

                if (ingredient.verdict === 'avoid') {
                    flaggedToxins.push(ingredient.name)
                }
            }
        }

        // Add unmatched ingredients
        for (const name of parseResult.unmatched) {
            decodedIngredients.push({
                name,
                verdict: 'unknown',
                confidence: parsed.confidence,
            })
        }

        // Determine auto-verdict
        let autoVerdict: 'recommend' | 'caution' | 'avoid' | undefined
        if (flaggedToxins.length > 0) {
            autoVerdict = 'avoid'
        } else if (decodedIngredients.some(i => i.verdict === 'caution')) {
            autoVerdict = 'caution'
        } else if (decodedIngredients.length > 0 && decodedIngredients.every(i => i.verdict === 'safe' || i.verdict === 'unknown')) {
            autoVerdict = parseResult.linkedIds.length > 0 ? 'recommend' : undefined
        }

        // Auto-apply to product if requested
        let updatedProductId: number | undefined
        if (autoApply && productId) {
            try {
                await req.payload.update({
                    collection: 'products',
                    id: productId,
                    data: {
                        ingredientsRaw,
                        ingredientsList: parseResult.linkedIds,
                        unmatchedIngredients: parseResult.unmatched.map(name => ({ name })),
                        autoVerdict,
                        verdict: autoVerdict || 'pending',
                    } as Record<string, unknown>,
                })
                updatedProductId = productId
            } catch (updateError) {
                console.error('Failed to update product:', updateError)
            }
        }

        // Create audit log
        await createAuditLog(req.payload, {
            action: 'ai_ingredient_parsed',
            sourceType: 'manual',
            targetCollection: 'products',
            targetId: updatedProductId,
            aiModel: 'gpt-4o-vision',
            confidence: Math.round(parsed.confidence * 100),
            metadata: {
                method: 'label_decode',
                ingredientsFound: parsed.ingredients.length,
                linkedCount: parseResult.linkedIds.length,
                unmatchedCount: parseResult.unmatched.length,
                flaggedToxins,
                unclear: parsed.unclear,
            },
            performedBy: (req.user as { id?: number })?.id,
        })

        const result: DecodeResult = {
            success: true,
            rawText: parsed.rawText,
            ingredients: decodedIngredients,
            linkedCount: parseResult.linkedIds.length,
            unmatchedCount: parseResult.unmatched.length,
            flaggedToxins,
            autoVerdict,
            productId: updatedProductId,
        }

        return Response.json(result)
    } catch (error) {
        console.error('Label decode error:', error)
        return Response.json({
            success: false,
            error: error instanceof Error ? error.message : 'Label decoding failed',
        }, { status: 500 })
    }
}
