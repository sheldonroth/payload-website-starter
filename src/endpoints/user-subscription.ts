/**
 * User Subscription Status Endpoint
 *
 * Secure endpoint for frontend to check user subscription status by email.
 * Requires PAYLOAD_API_SECRET in x-api-key header for authentication.
 *
 * @openapi
 * /user-subscription:
 *   get:
 *     summary: Get user subscription status
 *     description: |
 *       Check subscription status for a user by email address.
 *       This is an internal endpoint that requires API key authentication.
 *
 *       **Use Cases:**
 *       - Frontend checking premium status before showing gated content
 *       - Mobile app verifying subscription after purchase
 *     tags: [User, Subscription]
 *     security:
 *       - apiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *           format: email
 *         description: User email address
 *         example: "user@example.com"
 *     responses:
 *       200:
 *         description: Subscription status retrieved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserSubscription'
 *       400:
 *         description: Missing email parameter
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Bad Request"
 *                 message:
 *                   type: string
 *                   example: "email query parameter required"
 *       401:
 *         description: Invalid or missing API key
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Unauthorized"
 *                 message:
 *                   type: string
 *                   example: "Valid x-api-key header required"
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */

import type { PayloadHandler, PayloadRequest } from 'payload'

export const userSubscriptionHandler: PayloadHandler = async (req: PayloadRequest) => {
    try {
        // Verify API key from trusted frontend
        const apiKey = req.headers.get('x-api-key')
        const expectedKey = process.env.PAYLOAD_API_SECRET

        if (!apiKey || !expectedKey || apiKey !== expectedKey) {
            return Response.json(
                { error: 'Unauthorized', message: 'Valid x-api-key header required' },
                { status: 401 }
            )
        }

        // Get email from query params
        const url = new URL(req.url || '', 'http://localhost')
        const email = url.searchParams.get('email')

        if (!email) {
            return Response.json(
                { error: 'Bad Request', message: 'email query parameter required' },
                { status: 400 }
            )
        }

        // Look up user by email
        const users = await req.payload.find({
            collection: 'users',
            where: {
                email: { equals: email.toLowerCase() },
            },
            limit: 1,
            depth: 0,
        })

        if (users.docs.length === 0) {
            return Response.json({
                found: false,
                email,
                subscriptionStatus: null,
                message: 'User not found',
            })
        }

        const user = users.docs[0] as {
            id: number
            email: string
            name?: string
            subscriptionStatus?: string
            memberState?: string
            trialEndDate?: string
            stripeCustomerId?: string
            revenuecatUserId?: string
        }

        // Return subscription info
        return Response.json({
            found: true,
            email: user.email,
            userId: user.id,
            name: user.name,
            subscriptionStatus: user.subscriptionStatus || 'free',
            memberState: user.memberState || 'virgin',
            trialEndDate: user.trialEndDate,
            isPremium: user.subscriptionStatus === 'premium' || user.memberState === 'member',
            hasStripe: !!user.stripeCustomerId,
            hasRevenueCat: !!user.revenuecatUserId,
        })
    } catch (error) {
        console.error('[UserSubscription] Error:', error)
        return Response.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
