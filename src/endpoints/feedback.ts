/**
 * Feedback Endpoint
 *
 * Receives user feedback from the mobile app.
 * POST /api/submit-feedback
 *
 * Note: Payload CMS auto-creates a REST API at /api/feedback for the collection.
 * Use this custom endpoint for the simplified response format.
 */

import type { PayloadHandler, PayloadRequest } from 'payload'

interface FeedbackPayload {
    message: string
    userId?: number
    email?: string
    platform?: 'ios' | 'android' | 'web'
    source?: string
    metadata?: Record<string, unknown>
    submittedAt?: string
}

export const feedbackHandler: PayloadHandler = async (req: PayloadRequest) => {
    try {
        const body = await req.json?.() as FeedbackPayload | undefined

        if (!body) {
            return Response.json({ error: 'Request body is required' }, { status: 400 })
        }

        const { message, userId, email, platform, source, metadata } = body

        // Validate required fields
        if (!message || typeof message !== 'string') {
            return Response.json({ error: 'Message is required' }, { status: 400 })
        }

        const trimmedMessage = message.trim()

        if (trimmedMessage.length < 10) {
            return Response.json({ error: 'Message too short (minimum 10 characters)' }, { status: 400 })
        }

        if (trimmedMessage.length > 500) {
            return Response.json({ error: 'Message too long (maximum 500 characters)' }, { status: 400 })
        }

        // Validate platform if provided
        const validPlatforms = ['ios', 'android', 'web']
        if (platform && !validPlatforms.includes(platform)) {
            return Response.json({ error: 'Invalid platform' }, { status: 400 })
        }

        // Create feedback entry
        const feedback = await req.payload.create({
            collection: 'feedback',
            data: {
                message: trimmedMessage,
                email: email || undefined,
                user: userId || undefined,
                platform: platform || 'ios',
                source: source || 'mobile-app',
                status: 'new',
                metadata: metadata || {},
            },
        })

        console.log(`[Feedback] New submission from ${platform || 'ios'}: ${(feedback as { id: number }).id}`)

        return Response.json(
            { success: true, id: (feedback as { id: number }).id },
            { status: 201 }
        )
    } catch (error) {
        console.error('[Feedback] Error:', error)
        return Response.json({ error: 'Failed to submit feedback' }, { status: 500 })
    }
}
