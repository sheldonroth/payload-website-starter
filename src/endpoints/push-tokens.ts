/**
 * Push Tokens API Endpoints
 *
 * Handles push token registration and notification sending.
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
