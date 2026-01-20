/**
 * Grok (xAI) Proxy Endpoint
 *
 * Proxies requests to Grok API using server-side API key.
 * This prevents exposing the API key in client-side mobile app bundles.
 *
 * Note: Grok API uses OpenAI-compatible format, so we use the OpenAI SDK
 * with a custom baseURL.
 *
 * Security:
 * - Requires authenticated user (JWT token)
 * - API key is stored server-side only (not EXPO_PUBLIC_*)
 * - Rate limiting per user
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { headers } from 'next/headers'
import OpenAI from 'openai'
import { checkRateLimitAsync, rateLimitResponse } from '../../../../utilities/rate-limiter'

export const dynamic = 'force-dynamic'

// Rate limit config for Grok proxy
const GROK_PROXY_RATE_LIMIT = {
  maxRequests: 60,
  windowMs: 60 * 1000, // 60 requests per minute per user
}

// Valid Grok models allowed through the proxy
const ALLOWED_MODELS = [
  'grok-3-latest',
  'grok-3-fast-latest',
  'grok-3-mini-latest',
  'grok-2-latest',
  'grok-2-mini-latest',
]

/**
 * @swagger
 * /api/proxy/grok:
 *   post:
 *     summary: Proxy requests to Grok (xAI) API
 *     description: |
 *       Proxies chat completion requests to Grok using server-side API key.
 *       Requires user authentication via JWT token.
 *       Uses OpenAI-compatible format with xAI's base URL.
 *     tags: [Mobile, Proxy]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [messages]
 *             properties:
 *               messages:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     role:
 *                       type: string
 *                       enum: [system, user, assistant]
 *                     content:
 *                       type: string
 *               model:
 *                 type: string
 *                 default: grok-3-mini-latest
 *                 description: Grok model to use
 *               temperature:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 2
 *                 default: 0.7
 *               max_tokens:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 4096
 *                 default: 1024
 *     responses:
 *       200:
 *         description: Grok response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 choices:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       message:
 *                         type: object
 *                         properties:
 *                           role:
 *                             type: string
 *                           content:
 *                             type: string
 *                       finish_reason:
 *                         type: string
 *                 usage:
 *                   type: object
 *                   properties:
 *                     prompt_tokens:
 *                       type: integer
 *                     completion_tokens:
 *                       type: integer
 *                     total_tokens:
 *                       type: integer
 *       401:
 *         description: Unauthorized - authentication required
 *       429:
 *         description: Rate limit exceeded
 *       503:
 *         description: Grok API not configured
 */
export async function POST(request: NextRequest) {
  try {
    // Check if Grok API key is configured (server-side only)
    const apiKey = process.env.GROK_API_KEY
    if (!apiKey) {
      console.error('[Grok Proxy] GROK_API_KEY not configured')
      return NextResponse.json(
        { error: 'Grok API not configured' },
        { status: 503 }
      )
    }

    // Authenticate user - parallelize independent calls
    const [payload, headersList] = await Promise.all([
      getPayload({ config }),
      headers(),
    ])
    const { user } = await payload.auth({ headers: headersList })

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Rate limiting per user using Vercel KV
    const rateLimit = await checkRateLimitAsync(`grok-proxy:${user.id}`, GROK_PROXY_RATE_LIMIT)
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit.resetAt)
    }

    // Parse request body
    const body = await request.json().catch(() => ({}))
    const {
      messages,
      model = 'grok-3-mini-latest',
      temperature = 0.7,
      max_tokens = 1024,
    } = body

    // Validate messages
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'messages array is required' },
        { status: 400 }
      )
    }

    // Validate each message
    for (const msg of messages) {
      if (!msg.role || !msg.content) {
        return NextResponse.json(
          { error: 'Each message must have role and content' },
          { status: 400 }
        )
      }
      if (!['system', 'user', 'assistant'].includes(msg.role)) {
        return NextResponse.json(
          { error: 'Invalid message role. Must be: system, user, or assistant' },
          { status: 400 }
        )
      }
    }

    // Validate model
    if (!ALLOWED_MODELS.includes(model)) {
      return NextResponse.json(
        { error: `Invalid model. Allowed models: ${ALLOWED_MODELS.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate temperature and max_tokens
    const safeTemperature = Math.min(Math.max(0, temperature), 2)
    const safeMaxTokens = Math.min(Math.max(1, max_tokens), 4096)

    // Create Grok client (OpenAI-compatible with xAI base URL)
    const grok = new OpenAI({
      apiKey,
      baseURL: 'https://api.x.ai/v1',
    })

    // Make the request to Grok
    const completion = await grok.chat.completions.create({
      model,
      messages,
      temperature: safeTemperature,
      max_tokens: safeMaxTokens,
    })

    // Return the response
    return NextResponse.json({
      choices: completion.choices,
      usage: completion.usage,
      model: completion.model,
    })
  } catch (error) {
    console.error('[Grok Proxy] Error:', error)

    // Handle OpenAI-compatible errors
    if (error instanceof OpenAI.APIError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status || 500 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    )
  }
}
