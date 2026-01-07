/**
 * Push Tokens API Endpoints
 *
 * Handles push token registration and notification sending.
 *
 * @openapi
 * /push-tokens/register:
 *   post:
 *     summary: Register push notification token
 *     description: |
 *       Registers or updates an Expo push token for a device.
 *       Used to enable push notifications for product testing updates.
 *     tags: [Push Notifications, Mobile]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token]
 *             properties:
 *               token:
 *                 type: string
 *                 description: Expo push token (ExponentPushToken[...])
 *                 example: "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]"
 *               platform:
 *                 type: string
 *                 enum: [ios, android]
 *                 default: ios
 *               fingerprintHash:
 *                 type: string
 *                 description: Device fingerprint for linking
 *     responses:
 *       200:
 *         description: Token registered/updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 tokenId:
 *                   type: integer
 *       400:
 *         description: Missing or invalid token format
 *       500:
 *         description: Registration failed
 *
 * @openapi
 * /push-tokens/subscribe:
 *   post:
 *     summary: Subscribe to product testing notifications
 *     description: Subscribe a device to receive notifications when a product's testing is complete
 *     tags: [Push Notifications, Mobile]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, barcode]
 *             properties:
 *               token:
 *                 type: string
 *                 description: Expo push token
 *               barcode:
 *                 type: string
 *                 description: Product barcode to subscribe to
 *     responses:
 *       200:
 *         description: Subscription successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 barcode:
 *                   type: string
 *                 alreadySubscribed:
 *                   type: boolean
 *       400:
 *         description: Missing token or barcode
 *       404:
 *         description: Push token not found
 *
 * @openapi
 * /push-tokens/unsubscribe:
 *   post:
 *     summary: Unsubscribe from product notifications
 *     description: Remove subscription for a specific product's testing notifications
 *     tags: [Push Notifications, Mobile]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, barcode]
 *             properties:
 *               token:
 *                 type: string
 *                 description: Expo push token
 *               barcode:
 *                 type: string
 *                 description: Product barcode to unsubscribe from
 *     responses:
 *       200:
 *         description: Unsubscription successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 barcode:
 *                   type: string
 *       400:
 *         description: Missing token or barcode
 *       404:
 *         description: Push token not found
 */

import type { PayloadRequest } from 'payload'

/**
 * POST /api/push-tokens/register
 *
 * Register or update a push token for a device
 */
export const pushTokenRegisterHandler = async (req: PayloadRequest): Promise<Response> => {
  try {
    const body = await req.json?.()

    if (!body?.token) {
      return Response.json({ error: 'Push token is required' }, { status: 400 })
    }

    const { token, platform = 'ios', fingerprintHash } = body

    // Validate token format (Expo push token)
    if (!token.startsWith('ExponentPushToken[') && !token.startsWith('ExpoPushToken[')) {
      return Response.json({ error: 'Invalid push token format' }, { status: 400 })
    }

    // Check if token already exists
    const existing = await req.payload.find({
      collection: 'push-tokens',
      where: { token: { equals: token } },
      limit: 1,
    })

    if (existing.docs.length > 0) {
      // Update existing token
      await req.payload.update({
        collection: 'push-tokens',
        id: existing.docs[0].id,
        data: {
          fingerprintHash: fingerprintHash || existing.docs[0].fingerprintHash,
          platform,
          isActive: true,
          failureCount: 0,
        },
      })

      return Response.json({
        success: true,
        message: 'Push token updated',
        tokenId: existing.docs[0].id,
      })
    }

    // Create new token
    const newToken = await req.payload.create({
      collection: 'push-tokens',
      data: {
        token,
        platform,
        fingerprintHash,
        isActive: true,
        failureCount: 0,
        productSubscriptions: [],
      },
    })

    return Response.json({
      success: true,
      message: 'Push token registered',
      tokenId: newToken.id,
    })
  } catch (error) {
    console.error('[PushTokens] Registration error:', error)
    return Response.json({ error: 'Failed to register push token' }, { status: 500 })
  }
}

/**
 * POST /api/push-tokens/subscribe
 *
 * Subscribe a device to product testing notifications
 */
export const pushTokenSubscribeHandler = async (req: PayloadRequest): Promise<Response> => {
  try {
    const body = await req.json?.()

    if (!body?.token || !body?.barcode) {
      return Response.json(
        { error: 'Push token and barcode are required' },
        { status: 400 }
      )
    }

    const { token, barcode } = body

    // Find the token
    const existing = await req.payload.find({
      collection: 'push-tokens',
      where: { token: { equals: token } },
      limit: 1,
    })

    if (existing.docs.length === 0) {
      return Response.json({ error: 'Push token not found' }, { status: 404 })
    }

    const tokenDoc = existing.docs[0]
    const subscriptions = tokenDoc.productSubscriptions || []

    // Check if already subscribed
    const alreadySubscribed = subscriptions.some(
      (sub: { barcode: string }) => sub.barcode === barcode
    )

    if (alreadySubscribed) {
      return Response.json({
        success: true,
        message: 'Already subscribed to this product',
        alreadySubscribed: true,
      })
    }

    // Add subscription
    await req.payload.update({
      collection: 'push-tokens',
      id: tokenDoc.id,
      data: {
        productSubscriptions: [
          ...subscriptions,
          {
            barcode,
            subscribedAt: new Date().toISOString(),
            notified: false,
          },
        ],
      },
    })

    return Response.json({
      success: true,
      message: 'Subscribed to product testing notifications',
      barcode,
    })
  } catch (error) {
    console.error('[PushTokens] Subscribe error:', error)
    return Response.json({ error: 'Failed to subscribe to notifications' }, { status: 500 })
  }
}

/**
 * POST /api/push-tokens/unsubscribe
 *
 * Unsubscribe a device from product testing notifications
 */
export const pushTokenUnsubscribeHandler = async (req: PayloadRequest): Promise<Response> => {
  try {
    const body = await req.json?.()

    if (!body?.token || !body?.barcode) {
      return Response.json(
        { error: 'Push token and barcode are required' },
        { status: 400 }
      )
    }

    const { token, barcode } = body

    // Find the token
    const existing = await req.payload.find({
      collection: 'push-tokens',
      where: { token: { equals: token } },
      limit: 1,
    })

    if (existing.docs.length === 0) {
      return Response.json({ error: 'Push token not found' }, { status: 404 })
    }

    const tokenDoc = existing.docs[0]
    const subscriptions = tokenDoc.productSubscriptions || []

    // Remove subscription
    const updatedSubscriptions = subscriptions.filter(
      (sub: { barcode: string }) => sub.barcode !== barcode
    )

    await req.payload.update({
      collection: 'push-tokens',
      id: tokenDoc.id,
      data: {
        productSubscriptions: updatedSubscriptions,
      },
    })

    return Response.json({
      success: true,
      message: 'Unsubscribed from product testing notifications',
      barcode,
    })
  } catch (error) {
    console.error('[PushTokens] Unsubscribe error:', error)
    return Response.json({ error: 'Failed to unsubscribe from notifications' }, { status: 500 })
  }
}
