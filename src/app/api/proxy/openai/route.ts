/**
 * OpenAI Proxy Endpoint
 *
 * Proxies requests to OpenAI API using server-side API key.
 * This prevents exposing the API key in client-side mobile app bundles.
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

// Rate limit config for OpenAI proxy
const OPENAI_PROXY_RATE_LIMIT = {
  maxRequests: 60,
  windowMs: 60 * 1000, // 60 requests per minute per user
}

// Valid OpenAI models allowed through the proxy
const ALLOWED_MODELS = [
  'gpt-4.1-2025-04-14',
  'o4-mini-2025-04-16',
  'gpt-4o-2024-11-20',
  'gpt-4o-mini',
  'gpt-4o',
  'gpt-4-turbo',
  'gpt-4',
  'gpt-3.5-turbo',
]

/**
 * @swagger
 * /api/proxy/openai:
 *   post:
 *     summary: Proxy requests to OpenAI API
 *     description: |
 *       Proxies chat completion requests to OpenAI using server-side API key.
 *       Requires user authentication via JWT token.
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
 *                 default: gpt-4o-mini
 *                 description: OpenAI model to use
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
 *         description: OpenAI response
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
 *         description: OpenAI API not configured
 */
export async function POST(request: NextRequest) {
  try {
    // Check if OpenAI API key is configured (server-side only)
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      console.error('[OpenAI Proxy] OPENAI_API_KEY not configured')
      return NextResponse.json(
        { error: 'OpenAI API not configured' },
        { status: 503 }
      )
    }

    // Authenticate user
    const payload = await getPayload({ config })
    const headersList = await headers()

    const { user } = await payload.auth({ headers: headersList })

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Rate limiting per user using Vercel KV
    const rateLimit = await checkRateLimitAsync(`openai-proxy:${user.id}`, OPENAI_PROXY_RATE_LIMIT)
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit.resetAt)
    }

    // Parse request body
    const body = await request.json().catch(() => ({}))
    const {
      messages,
      model = 'gpt-4o-mini',
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

    // Create OpenAI client with server-side key
    const openai = new OpenAI({ apiKey })

    // Make the request to OpenAI
    const completion = await openai.chat.completions.create({
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
    console.error('[OpenAI Proxy] Error:', error)

    // Handle OpenAI-specific errors
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
