/**
 * Audio Transcription Proxy Endpoint
 *
 * Proxies audio transcription requests to OpenAI Whisper API using server-side API key.
 * This prevents exposing the API key in client-side mobile app bundles.
 *
 * Security:
 * - Requires authenticated user (JWT token)
 * - API key is stored server-side only (not EXPO_PUBLIC_*)
 * - Rate limiting per user
 * - File size validation
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { headers } from 'next/headers'
import { checkRateLimitAsync, rateLimitResponse } from '../../../../utilities/rate-limiter'

export const dynamic = 'force-dynamic'

// Maximum file size (25MB - OpenAI's limit)
const MAX_FILE_SIZE = 25 * 1024 * 1024

// Rate limit config for audio transcription proxy
const AUDIO_TRANSCRIPTION_RATE_LIMIT = {
  maxRequests: 30,
  windowMs: 60 * 1000, // 30 requests per minute per user
}

// Valid audio models
const ALLOWED_MODELS = ['whisper-1', 'gpt-4o-transcribe']

/**
 * @swagger
 * /api/proxy/audio-transcription:
 *   post:
 *     summary: Proxy audio transcription to OpenAI Whisper API
 *     description: |
 *       Transcribes audio files using OpenAI's Whisper API with server-side key.
 *       Requires user authentication via JWT token.
 *       Accepts multipart/form-data with audio file.
 *     tags: [Mobile, Proxy]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Audio file to transcribe (mp3, mp4, m4a, wav, webm)
 *               model:
 *                 type: string
 *                 default: whisper-1
 *                 description: Whisper model to use
 *               language:
 *                 type: string
 *                 default: en
 *                 description: Language code (ISO-639-1)
 *     responses:
 *       200:
 *         description: Transcription result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 text:
 *                   type: string
 *                   description: Transcribed text
 *       401:
 *         description: Unauthorized - authentication required
 *       413:
 *         description: File too large
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
      console.error('[Audio Transcription Proxy] OPENAI_API_KEY not configured')
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
    const rateLimit = await checkRateLimitAsync(`audio-transcription:${user.id}`, AUDIO_TRANSCRIPTION_RATE_LIMIT)
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit.resetAt)
    }

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const model = (formData.get('model') as string) || 'whisper-1'
    const language = (formData.get('language') as string) || 'en'

    // Validate file
    if (!file) {
      return NextResponse.json(
        { error: 'Audio file is required' },
        { status: 400 }
      )
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 413 }
      )
    }

    // Validate model
    if (!ALLOWED_MODELS.includes(model)) {
      return NextResponse.json(
        { error: `Invalid model. Allowed models: ${ALLOWED_MODELS.join(', ')}` },
        { status: 400 }
      )
    }

    // Build form data for OpenAI
    const openaiFormData = new FormData()
    openaiFormData.append('file', file)
    openaiFormData.append('model', model)
    openaiFormData.append('language', language)

    // Make request to OpenAI
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: openaiFormData,
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[Audio Transcription Proxy] OpenAI error:', errorText)
      return NextResponse.json(
        { error: 'Transcription failed' },
        { status: response.status }
      )
    }

    const result = await response.json()

    return NextResponse.json({
      text: result.text,
    })
  } catch (error) {
    console.error('[Audio Transcription Proxy] Error:', error)

    return NextResponse.json(
      { error: 'Failed to process transcription request' },
      { status: 500 }
    )
  }
}
