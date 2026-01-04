/**
 * Expo Push Notification Sender
 *
 * Sends push notifications to mobile devices via Expo's push notification service.
 * Used to notify users when products they voted for complete testing.
 *
 * @see https://docs.expo.dev/push-notifications/sending-notifications/
 */

import type { Payload } from 'payload'

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

interface ExpoPushMessage {
  to: string
  title: string
  body: string
  data?: Record<string, unknown>
  sound?: 'default' | null
  badge?: number
  channelId?: string
  priority?: 'default' | 'normal' | 'high'
  ttl?: number
}

interface ExpoPushTicket {
  id?: string
  status: 'ok' | 'error'
  message?: string
  details?: {
    error?: 'DeviceNotRegistered' | 'InvalidCredentials' | 'MessageTooBig' | 'MessageRateExceeded'
  }
}

interface ExpoPushResponse {
  data: ExpoPushTicket[]
}

/**
 * Send a push notification to a single device
 */
export async function sendPushNotification(
  token: string,
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<ExpoPushTicket> {
  const message: ExpoPushMessage = {
    to: token,
    title,
    body,
    sound: 'default',
    priority: 'high',
    data,
  }

  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    })

    const result: ExpoPushResponse = await response.json()
    return result.data[0]
  } catch (error) {
    console.error('[ExpoPush] Send error:', error)
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Send push notifications to multiple devices
 */
export async function sendPushNotifications(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<ExpoPushTicket[]> {
  // Expo recommends sending in chunks of 100
  const CHUNK_SIZE = 100
  const results: ExpoPushTicket[] = []

  const messages: ExpoPushMessage[] = tokens.map((token) => ({
    to: token,
    title,
    body,
    sound: 'default',
    priority: 'high',
    data,
  }))

  for (let i = 0; i < messages.length; i += CHUNK_SIZE) {
    const chunk = messages.slice(i, i + CHUNK_SIZE)

    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(chunk),
      })

      const result: ExpoPushResponse = await response.json()
      results.push(...result.data)
    } catch (error) {
      console.error('[ExpoPush] Batch send error:', error)
      // Add error results for this chunk
      chunk.forEach(() => {
        results.push({
          status: 'error',
          message: 'Failed to send notification',
        })
      })
    }
  }

  return results
}

/**
 * Notify all subscribers when a product's testing is complete
 */
export async function notifyProductTestingComplete(
  payload: Payload,
  barcode: string,
  productName: string,
  productId?: string
): Promise<{ sent: number; failed: number }> {
  let sent = 0
  let failed = 0

  try {
    // Find all push tokens subscribed to this product
    const tokens = await payload.find({
      collection: 'push-tokens',
      where: {
        and: [
          { isActive: { equals: true } },
          {
            'productSubscriptions.barcode': { equals: barcode },
          },
        ],
      },
      limit: 1000,
    })

    if (tokens.docs.length === 0) {
      console.log(`[ExpoPush] No subscribers for product ${barcode}`)
      return { sent: 0, failed: 0 }
    }

    console.log(`[ExpoPush] Notifying ${tokens.docs.length} subscribers for ${barcode}`)

    // Prepare notification
    const title = 'Your Product Was Tested!'
    const body = `Great news! ${productName || 'A product you voted for'} has completed lab testing. Tap to see the results.`
    const data = {
      type: 'product_testing_complete',
      barcode,
      productId,
      screen: 'ProductReport',
    }

    // Send notifications in batches
    const tokenStrings = tokens.docs.map((doc) => doc.token)
    const results = await sendPushNotifications(tokenStrings, title, body, data)

    // Process results and update token records
    for (let i = 0; i < results.length; i++) {
      const result = results[i]
      const tokenDoc = tokens.docs[i]

      if (result.status === 'ok') {
        sent++

        // Mark subscription as notified
        const updatedSubscriptions = (tokenDoc.productSubscriptions || []).map(
          (sub) => {
            if (sub.barcode === barcode) {
              return { ...sub, notified: true }
            }
            return sub
          }
        )

        await payload.update({
          collection: 'push-tokens',
          id: tokenDoc.id,
          data: {
            lastUsed: new Date().toISOString(),
            failureCount: 0,
            productSubscriptions: updatedSubscriptions,
          },
        })
      } else {
        failed++

        // Handle specific errors
        if (result.details?.error === 'DeviceNotRegistered') {
          // Mark token as inactive
          await payload.update({
            collection: 'push-tokens',
            id: tokenDoc.id,
            data: { isActive: false },
          })
        } else {
          // Increment failure count
          const newFailureCount = (tokenDoc.failureCount || 0) + 1

          await payload.update({
            collection: 'push-tokens',
            id: tokenDoc.id,
            data: {
              failureCount: newFailureCount,
              // Deactivate after 5 consecutive failures
              isActive: newFailureCount < 5,
            },
          })
        }
      }
    }

    console.log(`[ExpoPush] Sent ${sent} notifications, ${failed} failed for ${barcode}`)
    return { sent, failed }
  } catch (error) {
    console.error('[ExpoPush] notifyProductTestingComplete error:', error)
    return { sent, failed }
  }
}

/**
 * Send a test notification (for debugging)
 */
export async function sendTestNotification(token: string): Promise<ExpoPushTicket> {
  return sendPushNotification(
    token,
    'Test Notification',
    'This is a test notification from The Product Report.',
    { type: 'test' }
  )
}
