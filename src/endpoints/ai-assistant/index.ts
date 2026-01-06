/**
 * AI Business Assistant Endpoint
 *
 * POST /api/ai-assistant
 *
 * Provides AI-powered business intelligence analysis using Gemini 3 Pro.
 * Aggregates data from RevenueCat, Mixpanel, Statsig, and internal collections.
 */

import type { Endpoint } from 'payload'
import type { AIAssistantRequest, AIAssistantResponse, Insight } from './types'
import { aggregateBusinessData, clearBusinessDataCache } from './data-aggregator'
import {
    buildSystemPrompt,
    buildConversationContext,
    buildInsightGenerationPrompt,
    PROMPT_TEMPLATES,
} from './prompt-builder'
import { checkRateLimit, rateLimitResponse, getRateLimitKey } from '../../utilities/rate-limiter'
import { sanitizeForPrompt } from '../../utilities/prompt-sanitizer'

// Rate limit config for AI assistant (more restrictive due to expensive model)
const AI_ASSISTANT_RATE_LIMIT = {
    maxRequests: 5,
    windowMs: 60 * 1000, // 5 per minute
}

// Model mapping
const MODELS: Record<string, string> = {
    'gemini-2.0-flash': 'gemini-2.0-flash',
    'gemini-3-flash-preview': 'gemini-2.0-flash-exp', // Use experimental as preview
    'gemini-3-pro-preview': 'gemini-2.0-flash', // Fallback until Gemini 3 is available
}

export const aiAssistantEndpoint: Endpoint = {
    path: '/ai-assistant',
    method: 'post',
    handler: async (req) => {
        const payload = req.payload

        // Check authentication
        if (!req.user) {
            return Response.json(
                { success: false, error: 'Unauthorized - Login required' },
                { status: 401 }
            )
        }

        // Check admin role
        const role = (req.user as { role?: string }).role
        const isAdmin = (req.user as { isAdmin?: boolean }).isAdmin
        if (role !== 'admin' && !isAdmin) {
            return Response.json(
                { success: false, error: 'Forbidden - Admin access required' },
                { status: 403 }
            )
        }

        // Rate limiting
        const userId = (req.user as { id?: number }).id
        const rateLimitKey = getRateLimitKey(req as unknown as Request, userId ? String(userId) : undefined)
        const rateCheck = checkRateLimit(rateLimitKey, {
            ...AI_ASSISTANT_RATE_LIMIT,
            identifier: 'ai-assistant',
        })

        if (!rateCheck.allowed) {
            return rateLimitResponse(rateCheck.resetAt)
        }

        // Parse request body
        let body: AIAssistantRequest
        try {
            if (!req.json) {
                return Response.json(
                    { success: false, error: 'Invalid request body' },
                    { status: 400 }
                )
            }
            body = await req.json()
        } catch {
            return Response.json(
                { success: false, error: 'Invalid JSON body' },
                { status: 400 }
            )
        }

        const { action, prompt, analysisType, conversationHistory, model = 'gemini-3-pro-preview' } = body

        if (!action || !['analyze', 'chat'].includes(action)) {
            return Response.json(
                { success: false, error: 'Invalid action. Use "analyze" or "chat"' },
                { status: 400 }
            )
        }

        try {
            // Get server URL for internal API calls
            const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'

            // Aggregate business data
            const businessContext = await aggregateBusinessData(payload, serverUrl)

            // Build system prompt
            const systemPrompt = buildSystemPrompt(businessContext)

            // Initialize Gemini
            const { GoogleGenerativeAI } = await import('@google/generative-ai')
            const apiKey = process.env.GEMINI_API_KEY
            if (!apiKey) {
                return Response.json(
                    { success: false, error: 'Gemini API key not configured' },
                    { status: 500 }
                )
            }

            const genAI = new GoogleGenerativeAI(apiKey)
            const modelId = MODELS[model] || MODELS['gemini-2.0-flash']
            const geminiModel = genAI.getGenerativeModel({ model: modelId })

            let response: AIAssistantResponse

            if (action === 'analyze') {
                // Auto-generate insights
                response = await generateInsights(geminiModel, systemPrompt, analysisType, modelId)
            } else {
                // Chat response
                if (!prompt) {
                    return Response.json(
                        { success: false, error: 'Prompt required for chat action' },
                        { status: 400 }
                    )
                }

                const sanitizedPrompt = sanitizeForPrompt(prompt)
                response = await generateChatResponse(
                    geminiModel,
                    systemPrompt,
                    conversationHistory || [],
                    sanitizedPrompt,
                    modelId
                )
            }

            return Response.json(response)
        } catch (error) {
            console.error('[AI Assistant] Error:', error)
            return Response.json(
                {
                    success: false,
                    error: error instanceof Error ? error.message : 'AI analysis failed',
                },
                { status: 500 }
            )
        }
    },
}

/**
 * Generate structured insights from business data
 */
async function generateInsights(
    model: ReturnType<InstanceType<typeof import('@google/generative-ai').GoogleGenerativeAI>['getGenerativeModel']>,
    systemPrompt: string,
    analysisType?: string,
    modelId?: string
): Promise<AIAssistantResponse> {
    // Get the appropriate prompt template
    const analysisPrompt = analysisType && PROMPT_TEMPLATES[analysisType as keyof typeof PROMPT_TEMPLATES]
        ? PROMPT_TEMPLATES[analysisType as keyof typeof PROMPT_TEMPLATES]
        : PROMPT_TEMPLATES.full

    const insightPrompt = buildInsightGenerationPrompt()

    const fullPrompt = `${systemPrompt}

## ANALYSIS REQUEST
${analysisPrompt}

## OUTPUT FORMAT
${insightPrompt}`

    try {
        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
            generationConfig: {
                temperature: 0.3,
                maxOutputTokens: 2048,
                responseMimeType: 'application/json',
            },
        })

        const responseText = result.response.text()

        // Parse JSON response
        let insights: Insight[] = []
        let message = ''

        try {
            const parsed = JSON.parse(responseText)
            if (parsed.insights && Array.isArray(parsed.insights)) {
                insights = parsed.insights
                message = `Generated ${insights.length} insights based on your business data.`
            } else {
                message = responseText
            }
        } catch {
            // If JSON parsing fails, treat as plain text
            message = responseText
        }

        return {
            success: true,
            message,
            insights: insights.length > 0 ? insights : undefined,
            model: modelId,
            cached: false,
        }
    } catch (error) {
        console.error('[AI Assistant] Insight generation failed:', error)
        throw error
    }
}

/**
 * Generate chat response with conversation context
 */
async function generateChatResponse(
    model: ReturnType<InstanceType<typeof import('@google/generative-ai').GoogleGenerativeAI>['getGenerativeModel']>,
    systemPrompt: string,
    conversationHistory: { role: string; content: string; timestamp: string }[],
    newMessage: string,
    modelId?: string
): Promise<AIAssistantResponse> {
    const messages = buildConversationContext(systemPrompt, conversationHistory, newMessage)

    try {
        const result = await model.generateContent({
            contents: messages,
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 2048,
            },
        })

        const responseText = result.response.text()

        return {
            success: true,
            message: responseText,
            model: modelId,
            cached: false,
        }
    } catch (error) {
        console.error('[AI Assistant] Chat response failed:', error)
        throw error
    }
}

/**
 * Clear cache endpoint (for manual refresh)
 */
export const aiAssistantClearCacheEndpoint: Endpoint = {
    path: '/ai-assistant/clear-cache',
    method: 'post',
    handler: async (req) => {
        // Check admin auth
        if (!req.user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const role = (req.user as { role?: string }).role
        const isAdmin = (req.user as { isAdmin?: boolean }).isAdmin
        if (role !== 'admin' && !isAdmin) {
            return Response.json({ error: 'Forbidden' }, { status: 403 })
        }

        clearBusinessDataCache()
        return Response.json({ success: true, message: 'Cache cleared' })
    },
}

export default aiAssistantEndpoint
