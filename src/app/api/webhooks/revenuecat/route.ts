import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

export const dynamic = 'force-dynamic'

// RevenueCat webhook authorization - set this in RevenueCat dashboard
const REVENUECAT_WEBHOOK_SECRET = process.env.REVENUECAT_WEBHOOK_SECRET

type SubscriptionStatus = 'free' | 'trial' | 'premium' | 'cancelled'

/**
 * RevenueCat webhook event types
 * See: https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields
 */
type RevenueCatEventType =
  | 'INITIAL_PURCHASE'
  | 'RENEWAL'
  | 'CANCELLATION'
  | 'UNCANCELLATION'
  | 'EXPIRATION'
  | 'BILLING_ISSUE'
  | 'PRODUCT_CHANGE'
  | 'SUBSCRIBER_ALIAS'
  | 'SUBSCRIPTION_PAUSED'
  | 'SUBSCRIPTION_EXTENDED'
  | 'TRANSFER'
  | 'TEST'

interface RevenueCatEvent {
  type: RevenueCatEventType
  id: string
  event_timestamp_ms: number
  app_id: string
  app_user_id: string
  original_app_user_id: string
  aliases: string[]
  subscriber_attributes?: Record<string, { value: string; updated_at_ms: number }>
  product_id?: string
  entitlement_id?: string
  entitlement_ids?: string[]
  period_type?: 'TRIAL' | 'INTRO' | 'NORMAL' | 'PROMOTIONAL'
  purchased_at_ms?: number
  expiration_at_ms?: number
  environment?: 'SANDBOX' | 'PRODUCTION'
  store?: 'APP_STORE' | 'PLAY_STORE' | 'STRIPE' | 'PROMOTIONAL'
  is_family_share?: boolean
  takehome_percentage?: number
  offer_code?: string
  price?: number
  currency?: string
  price_in_purchased_currency?: number
  tax_percentage?: number
  commission_percentage?: number
  cancel_reason?: string
  expiration_reason?: string
  new_product_id?: string
  presented_offering_id?: string
  // Subscriber info (for INITIAL_PURCHASE, RENEWAL, etc.)
  subscriber?: {
    original_app_user_id: string
    first_seen: string
    last_seen: string
    management_url?: string
    original_application_version?: string
    original_purchase_date?: string
    non_subscriptions?: Record<string, any[]>
    subscriptions?: Record<string, {
      billing_issues_detected_at?: string
      expires_date: string
      grace_period_expires_date?: string
      is_sandbox: boolean
      original_purchase_date: string
      ownership_type: string
      period_type: string
      purchase_date: string
      store: string
      unsubscribe_detected_at?: string
    }>
    entitlements?: Record<string, {
      expires_date?: string
      grace_period_expires_date?: string
      product_identifier: string
      purchase_date: string
    }>
  }
}

interface RevenueCatWebhookPayload {
  api_version: string
  event: RevenueCatEvent
}

/**
 * Map RevenueCat event to our subscription status
 */
function mapEventToStatus(event: RevenueCatEvent): SubscriptionStatus | null {
  const eventType = event.type

  switch (eventType) {
    case 'INITIAL_PURCHASE':
      // Check if it's a trial
      if (event.period_type === 'TRIAL') {
        return 'trial'
      }
      return 'premium'

    case 'RENEWAL':
      return 'premium'

    case 'UNCANCELLATION':
      return 'premium'

    case 'SUBSCRIPTION_EXTENDED':
      return 'premium'

    case 'CANCELLATION':
      // User cancelled but may still have access until expiration
      // Check if subscription has expired
      if (event.expiration_at_ms && event.expiration_at_ms < Date.now()) {
        return 'cancelled'
      }
      // Still has access, don't change status yet
      // The EXPIRATION event will handle the final status change
      return null

    case 'EXPIRATION':
      return 'cancelled'

    case 'BILLING_ISSUE':
      // Keep premium but we should flag this somewhere
      // For now, don't change status - give grace period
      return null

    case 'SUBSCRIPTION_PAUSED':
      return 'cancelled'

    case 'PRODUCT_CHANGE':
      // Product changed but still subscribed
      return 'premium'

    case 'SUBSCRIBER_ALIAS':
    case 'TRANSFER':
    case 'TEST':
      // These don't affect subscription status
      return null

    default:
      return null
  }
}

/**
 * Find user by RevenueCat app_user_id or aliases
 * The app_user_id could be:
 * 1. Our Payload user ID (if we called Purchases.logIn(userId))
 * 2. An anonymous RevenueCat ID (starts with $RCAnonymousID:)
 * 3. An email address (from subscriber attributes)
 */
async function findUserByRevenueCatId(
  payload: any,
  event: RevenueCatEvent
): Promise<any | null> {
  const { app_user_id, original_app_user_id, aliases, subscriber_attributes } = event

  // Collect all possible user identifiers
  const possibleIds = [app_user_id, original_app_user_id, ...aliases].filter(Boolean)

  // 1. Try to find by revenuecatUserId field
  for (const id of possibleIds) {
    const byRevenueCatId = await payload.find({
      collection: 'users',
      where: { revenuecatUserId: { equals: id } },
      limit: 1,
    })

    if (byRevenueCatId.docs.length > 0) {
      return byRevenueCatId.docs[0]
    }
  }

  // 2. Try to find by Payload user ID (if app_user_id is a number or numeric string)
  for (const id of possibleIds) {
    // Skip anonymous IDs
    if (id.startsWith('$RCAnonymousID:')) continue

    // Try as numeric ID
    const numericId = parseInt(id, 10)
    if (!isNaN(numericId)) {
      try {
        const user = await payload.findByID({
          collection: 'users',
          id: numericId,
        })
        if (user) {
          // Store RevenueCat ID for future lookups
          await payload.update({
            collection: 'users',
            id: user.id,
            data: { revenuecatUserId: app_user_id },
          })
          return user
        }
      } catch {
        // User not found by ID
      }
    }
  }

  // 3. Try to find by email from subscriber attributes
  const email = subscriber_attributes?.$email?.value
  if (email) {
    const byEmail = await payload.find({
      collection: 'users',
      where: { email: { equals: email } },
      limit: 1,
    })

    if (byEmail.docs.length > 0) {
      const user = byEmail.docs[0]
      // Store RevenueCat ID for future lookups
      await payload.update({
        collection: 'users',
        id: user.id,
        data: { revenuecatUserId: app_user_id },
      })
      return user
    }
  }

  // 4. Check if any alias looks like an email
  for (const id of possibleIds) {
    if (id.includes('@') && !id.startsWith('$')) {
      const byEmail = await payload.find({
        collection: 'users',
        where: { email: { equals: id } },
        limit: 1,
      })

      if (byEmail.docs.length > 0) {
        const user = byEmail.docs[0]
        await payload.update({
          collection: 'users',
          id: user.id,
          data: { revenuecatUserId: app_user_id },
        })
        return user
      }
    }
  }

  return null
}

/**
 * Update user subscription status
 */
async function updateUserSubscription(
  payload: any,
  userId: string | number,
  data: {
    subscriptionStatus?: SubscriptionStatus
    revenuecatUserId?: string
  }
) {
  await payload.update({
    collection: 'users',
    id: userId,
    data,
  })

  console.log(`[RevenueCat Webhook] Updated user ${userId}:`, data)
}

/**
 * POST /api/webhooks/revenuecat
 * Handle RevenueCat webhook events for subscription management
 *
 * Setup in RevenueCat Dashboard:
 * 1. Go to Project Settings > Integrations > Webhooks
 * 2. Add webhook URL: https://your-domain.com/api/webhooks/revenuecat
 * 3. Set Authorization header to: Bearer YOUR_SECRET
 * 4. Enable events you want to receive
 */
export async function POST(request: Request) {
  // Verify authorization header
  if (REVENUECAT_WEBHOOK_SECRET) {
    const authHeader = request.headers.get('authorization')
    const expectedAuth = `Bearer ${REVENUECAT_WEBHOOK_SECRET}`

    if (authHeader !== expectedAuth) {
      console.error('[RevenueCat Webhook] Invalid authorization header')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  } else {
    console.warn('[RevenueCat Webhook] REVENUECAT_WEBHOOK_SECRET not configured - accepting all requests')
  }

  let webhookPayload: RevenueCatWebhookPayload

  try {
    webhookPayload = await request.json()
  } catch (error) {
    console.error('[RevenueCat Webhook] Invalid JSON payload')
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { event } = webhookPayload

  if (!event) {
    console.error('[RevenueCat Webhook] No event in payload')
    return NextResponse.json({ error: 'No event' }, { status: 400 })
  }

  console.log(`[RevenueCat Webhook] Received event: ${event.type} for app_user_id: ${event.app_user_id}`)

  // Handle test events
  if (event.type === 'TEST') {
    console.log('[RevenueCat Webhook] Test event received')
    return NextResponse.json({ received: true, message: 'Test event processed' })
  }

  // Skip sandbox events in production (optional - remove if you want to process sandbox events)
  if (event.environment === 'SANDBOX' && process.env.NODE_ENV === 'production') {
    console.log('[RevenueCat Webhook] Skipping sandbox event in production')
    return NextResponse.json({ received: true, message: 'Sandbox event skipped' })
  }

  const payload = await getPayload({ config })

  try {
    // Find the user
    const user = await findUserByRevenueCatId(payload, event)

    if (!user) {
      console.error(`[RevenueCat Webhook] User not found for event: ${event.type}, app_user_id: ${event.app_user_id}`)
      // Return 200 to prevent retries - we might need manual intervention
      // Consider storing orphaned events for later processing
      return NextResponse.json({
        received: true,
        warning: 'User not found',
        app_user_id: event.app_user_id,
      })
    }

    // Determine new subscription status
    const newStatus = mapEventToStatus(event)

    if (newStatus) {
      await updateUserSubscription(payload, user.id, {
        subscriptionStatus: newStatus,
        revenuecatUserId: event.app_user_id,
      })

      console.log(`[RevenueCat Webhook] User ${user.id} subscription updated to: ${newStatus}`)
    } else {
      // Event doesn't change status, but still update RevenueCat ID if needed
      if (!user.revenuecatUserId) {
        await updateUserSubscription(payload, user.id, {
          revenuecatUserId: event.app_user_id,
        })
      }
      console.log(`[RevenueCat Webhook] Event ${event.type} processed, no status change`)
    }

    return NextResponse.json({
      received: true,
      user_id: user.id,
      new_status: newStatus,
    })
  } catch (error) {
    console.error('[RevenueCat Webhook] Error processing event:', error)
    // Return 200 to prevent infinite retries
    return NextResponse.json({ received: true, error: 'Processing error' })
  }
}
