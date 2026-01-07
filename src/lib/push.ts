/**
 * Expo Push Notification Helper
 *
 * Sends push notifications to mobile devices using Expo's push service.
 *
 * My Cases notifications:
 * - Results Ready: "🔬 Results are in" - when a product's testing is complete
 * - Testing Started: "🧪 Testing started" - when product enters lab
 * - Trending: "🔥 Your case is trending" - when a product gains velocity
 */

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

export interface ExpoPushMessage {
    to: string // ExponentPushToken[...]
    title: string
    body: string
    data?: Record<string, unknown>
    sound?: 'default' | null
    badge?: number
    channelId?: string
    priority?: 'default' | 'normal' | 'high'
    ttl?: number
}

export interface ExpoPushTicket {
    status: 'ok' | 'error'
    id?: string // Receipt ID if status is 'ok'
    message?: string // Error message if status is 'error'
    details?: {
        error?: 'DeviceNotRegistered' | 'InvalidCredentials' | 'MessageTooBig' | 'MessageRateExceeded'
    }
}

export interface ExpoPushReceipt {
    status: 'ok' | 'error'
    message?: string
    details?: {
        error?: string
    }
}

/**
 * Send a single push notification
 */
export async function sendPushNotification(message: ExpoPushMessage): Promise<ExpoPushTicket> {
    const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Accept-Encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
    })

    const result = await response.json()

    // Expo returns { data: [ticket] } for single messages
    if (result.data && Array.isArray(result.data)) {
        return result.data[0]
    }

    return result
}

/**
 * Send batch of push notifications (up to 100 at a time)
 * Expo recommends batching for efficiency
 */
export async function sendPushNotificationBatch(
    messages: ExpoPushMessage[]
): Promise<ExpoPushTicket[]> {
    if (messages.length === 0) return []

    // Expo limits to 100 messages per request
    const batches: ExpoPushMessage[][] = []
    for (let i = 0; i < messages.length; i += 100) {
        batches.push(messages.slice(i, i + 100))
    }

    const allTickets: ExpoPushTicket[] = []

    for (const batch of batches) {
        const response = await fetch(EXPO_PUSH_URL, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Accept-Encoding': 'gzip, deflate',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(batch),
        })

        const result = await response.json()

        if (result.data && Array.isArray(result.data)) {
            allTickets.push(...result.data)
        }
    }

    return allTickets
}

/**
 * Check push receipts (to verify delivery)
 * Call this ~15 minutes after sending to check delivery status
 */
export async function getPushReceipts(receiptIds: string[]): Promise<Record<string, ExpoPushReceipt>> {
    if (receiptIds.length === 0) return {}

    const response = await fetch('https://exp.host/--/api/v2/push/getReceipts', {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ids: receiptIds }),
    })

    const result = await response.json()
    return result.data || {}
}

// ===== My Cases Notification Templates =====

/**
 * Results Ready notification
 * Sent when a product's lab testing is complete
 */
export function createResultsReadyNotification(
    token: string,
    productName: string,
    score: number,
    barcode: string,
    productId?: string
): ExpoPushMessage {
    return {
        to: token,
        title: '🔬 Results are in',
        body: `${productName}: ${score}/100. You helped make this happen.`,
        sound: 'default',
        priority: 'high',
        data: {
            type: 'results_ready',
            barcode,
            productId,
            score,
        },
    }
}

/**
 * Testing Started notification
 * Sent when a product enters the lab
 */
export function createTestingStartedNotification(
    token: string,
    productName: string,
    barcode: string
): ExpoPushMessage {
    return {
        to: token,
        title: '🧪 Testing started',
        body: `${productName} just entered our lab. You'll be first to know.`,
        sound: 'default',
        data: {
            type: 'testing_started',
            barcode,
        },
    }
}

/**
 * Trending notification
 * Sent when a product gains significant velocity
 */
export function createTrendingNotification(
    token: string,
    productName: string,
    barcode: string,
    positionChange: number,
    totalWatchers: number
): ExpoPushMessage {
    return {
        to: token,
        title: '🔥 Your case is trending',
        body: `${productName} jumped ${positionChange} spots today. ${totalWatchers} people want this tested.`,
        sound: 'default',
        data: {
            type: 'trending',
            barcode,
            positionChange,
            totalWatchers,
        },
    }
}
