/**
 * Feedback Endpoint
 *
 * Receives user feedback from the mobile app.
 * POST /api/submit-feedback
 *
 * Note: Payload CMS auto-creates a REST API at /api/feedback for the collection.
 * Use this custom endpoint for the simplified response format.
 *
 * @openapi
 * /submit-feedback:
 *   post:
 *     summary: Submit user feedback
 *     description: |
 *       Receives user feedback from mobile apps or web.
 *       Supports various feedback types including bug reports, feature requests,
 *       and general feedback. Messages must be 10-500 characters.
 *     tags: [Feedback, Mobile]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [message]
 *             properties:
 *               message:
 *                 type: string
 *                 minLength: 10
 *                 maxLength: 500
 *                 description: Feedback message content
 *               userId:
 *                 type: string
 *                 description: User ID (string or number accepted)
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Contact email for follow-up
 *               feedbackType:
 *                 type: string
 *                 enum: [general, bug_report, feature_request, complaint, praise, product_question]
 *                 default: general
 *               productId:
 *                 type: string
 *                 description: Related product ID if feedback is product-specific
 *               platform:
 *                 type: string
 *                 enum: [ios, android, web]
 *                 default: ios
 *               appVersion:
 *                 type: string
 *                 description: App version for bug reports
 *               source:
 *                 type: string
 *                 description: Source identifier
 *               metadata:
 *                 type: object
 *                 description: Additional metadata
 *     responses:
 *       201:
 *         description: Feedback submitted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 id:
 *                   type: integer
 *                   description: Created feedback record ID
 *       400:
 *         description: Invalid request (missing message, too short/long, invalid platform)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Message too short (minimum 10 characters)"
 *       500:
 *         description: Failed to submit feedback
 */

import type { PayloadHandler, PayloadRequest } from 'payload'
import { validationError, internalError, successResponse } from '../utilities/api-response'

interface FeedbackPayload {
    message: string
    userId?: number | string  // Accept both string and number from clients
    email?: string
    feedbackType?: 'general' | 'bug_report' | 'feature_request' | 'complaint' | 'praise' | 'product_question'
    productId?: number | string  // Related product if feedback is about a specific product
    platform?: 'ios' | 'android' | 'web'
    appVersion?: string
    source?: string
    metadata?: Record<string, unknown>
    submittedAt?: string
}

export const feedbackHandler: PayloadHandler = async (req: PayloadRequest) => {
    try {
        const body = await req.json?.() as FeedbackPayload | undefined

        if (!body) {
            return validationError('Request body is required')
        }

        const { message, userId, email, feedbackType, productId, platform, appVersion, source, metadata } = body

        // Validate required fields
        if (!message || typeof message !== 'string') {
            return validationError('Message is required')
        }

        const trimmedMessage = message.trim()

        if (trimmedMessage.length < 10) {
            return validationError('Message too short (minimum 10 characters)')
        }

        if (trimmedMessage.length > 500) {
            return validationError('Message too long (maximum 500 characters)')
        }

        // Validate platform if provided
        const validPlatforms = ['ios', 'android', 'web']
        if (platform && !validPlatforms.includes(platform)) {
            return validationError('Invalid platform')
        }

        // Parse userId to number (mobile app may send as string)
        let parsedUserId: number | undefined
        if (userId !== undefined && userId !== null) {
            parsedUserId = typeof userId === 'string' ? parseInt(userId, 10) : userId
            if (isNaN(parsedUserId)) {
                parsedUserId = undefined
            }
        }

        // Parse productId to number (mobile app may send as string)
        let parsedProductId: number | undefined
        if (productId !== undefined && productId !== null) {
            parsedProductId = typeof productId === 'string' ? parseInt(productId, 10) : productId
            if (isNaN(parsedProductId)) {
                parsedProductId = undefined
            }
        }

        // Validate feedbackType if provided
        const validFeedbackTypes = ['general', 'bug_report', 'feature_request', 'complaint', 'praise', 'product_question']
        const validatedFeedbackType = feedbackType && validFeedbackTypes.includes(feedbackType) ? feedbackType : 'general'

        // Create feedback entry
        const feedback = await req.payload.create({
            collection: 'feedback',
            data: {
                message: trimmedMessage,
                feedbackType: validatedFeedbackType as 'general' | 'bug_report' | 'feature_request' | 'complaint' | 'praise' | 'product_question',
                email: email || undefined,
                user: parsedUserId || undefined,
                product: parsedProductId || undefined,
                platform: platform || 'ios',
                appVersion: appVersion || undefined,
                source: source || 'mobile-app',
                status: 'new',
                metadata: metadata || {},
            },
        })

        console.log(`[Feedback] New submission from ${platform || 'ios'}: ID=${(feedback as { id: number }).id}, user=${parsedUserId || 'anonymous'}`)

        return successResponse({ id: (feedback as { id: number }).id }, 201)
    } catch (error) {
        console.error('[Feedback] Error:', error)
        return internalError('Failed to submit feedback')
    }
}
