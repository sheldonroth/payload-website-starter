import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import Stripe from 'stripe'
import { trackServer, identifyServer, flushServer } from '@/lib/analytics/rudderstack-server'

export const dynamic = 'force-dynamic'

// Lazy-initialize Stripe to avoid build-time errors when env vars are not set
let stripe: Stripe | null = null
function getStripe(): Stripe {
  if (!stripe) {
    const apiKey = process.env.STRIPE_SECRET_KEY
    if (!apiKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured')
    }
    stripe = new Stripe(apiKey, {
      apiVersion: '2025-12-15.clover',
    })
  }
  return stripe
}

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET

type SubscriptionStatus = 'free' | 'trial' | 'premium' | 'cancelled'

/**
 * Map Stripe subscription status to our internal status
 */
function mapStripeStatus(stripeStatus: Stripe.Subscription.Status, cancelAtPeriodEnd?: boolean): SubscriptionStatus {
  switch (stripeStatus) {
    case 'active':
      return 'premium'
    case 'trialing':
      return 'trial'
    case 'past_due':
      // Still has access but payment issue - keep premium
      return 'premium'
    case 'canceled':
      return 'cancelled'
    case 'incomplete':
    case 'incomplete_expired':
      return 'free'
    case 'unpaid':
      return 'cancelled'
    case 'paused':
      return 'cancelled'
    default:
      return 'free'
  }
}

/**
 * Find user by Stripe customer ID or email
 */
async function findUserByStripeCustomer(
  payload: any,
  customerId: string,
  customerEmail?: string | null
): Promise<any | null> {
  // First try by Stripe customer ID
  const byCustomerId = await payload.find({
    collection: 'users',
    where: { stripeCustomerId: { equals: customerId } },
    limit: 1,
  })

  if (byCustomerId.docs.length > 0) {
    return byCustomerId.docs[0]
  }

  // Fall back to email if provided
  if (customerEmail) {
    const byEmail = await payload.find({
      collection: 'users',
      where: { email: { equals: customerEmail } },
      limit: 1,
    })

    if (byEmail.docs.length > 0) {
      return byEmail.docs[0]
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
    stripeCustomerId?: string
    stripeSubscriptionId?: string
  }
) {
  await payload.update({
    collection: 'users',
    id: userId,
    data,
  })

  console.log(`[Stripe Webhook] Updated user ${userId}:`, data)
}

/**
 * POST /api/webhooks/stripe
 * Handle Stripe webhook events for subscription management
 */
export async function POST(request: Request) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!WEBHOOK_SECRET) {
    console.error('[Stripe Webhook] STRIPE_WEBHOOK_SECRET not configured')
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  if (!signature) {
    console.error('[Stripe Webhook] No signature provided')
    return NextResponse.json({ error: 'No signature' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = getStripe().webhooks.constructEvent(body, signature, WEBHOOK_SECRET)
  } catch (err) {
    console.error('[Stripe Webhook] Signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const payload = await getPayload({ config })

  console.log(`[Stripe Webhook] Received event: ${event.type}`)

  try {
    switch (event.type) {
      // ============================================
      // Checkout completed - new subscription
      // ============================================
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session

        if (session.mode !== 'subscription') {
          // Not a subscription checkout, ignore
          break
        }

        const customerId = session.customer as string
        const subscriptionId = session.subscription as string
        const customerEmail = session.customer_email || session.customer_details?.email

        // Try to find user by client_reference_id (our user ID) first
        let user = null
        if (session.client_reference_id) {
          try {
            user = await payload.findByID({
              collection: 'users',
              id: session.client_reference_id,
            })
          } catch {
            // User not found by ID
          }
        }

        // Fall back to customer lookup
        if (!user) {
          user = await findUserByStripeCustomer(payload, customerId, customerEmail)
        }

        if (!user) {
          console.error(`[Stripe Webhook] User not found for checkout session: ${session.id}`)
          // Return 200 to prevent retries - we'll need manual intervention
          return NextResponse.json({ received: true, warning: 'User not found' })
        }

        // Get subscription details
        const subscription = await getStripe().subscriptions.retrieve(subscriptionId)

        await updateUserSubscription(payload, user.id, {
          subscriptionStatus: mapStripeStatus(subscription.status),
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
        })

        // Track subscription started in RudderStack
        const priceAmount = subscription.items.data[0]?.price?.unit_amount
        const currency = subscription.items.data[0]?.price?.currency
        const interval = subscription.items.data[0]?.price?.recurring?.interval

        trackServer('Subscription Started', {
          subscription_id: subscriptionId,
          customer_id: customerId,
          plan: subscription.items.data[0]?.price?.nickname || 'premium',
          amount: priceAmount ? priceAmount / 100 : undefined,
          currency: currency?.toUpperCase(),
          interval,
          source: 'stripe',
        }, { userId: String(user.id) })

        // Update user traits
        identifyServer(String(user.id), {
          email: user.email,
          subscription_status: 'premium',
          stripe_customer_id: customerId,
          subscription_started_at: new Date().toISOString(),
        })

        break
      }

      // ============================================
      // Subscription updated
      // ============================================
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string

        // Get customer email for fallback lookup
        let customerEmail: string | null = null
        try {
          const customer = await getStripe().customers.retrieve(customerId)
          if (customer && !customer.deleted) {
            customerEmail = customer.email
          }
        } catch {
          // Ignore customer fetch errors
        }

        const user = await findUserByStripeCustomer(payload, customerId, customerEmail)

        if (!user) {
          console.error(`[Stripe Webhook] User not found for subscription update: ${subscription.id}`)
          return NextResponse.json({ received: true, warning: 'User not found' })
        }

        const newStatus = mapStripeStatus(subscription.status, subscription.cancel_at_period_end)
        const previousStatus = user.subscriptionStatus

        await updateUserSubscription(payload, user.id, {
          subscriptionStatus: newStatus,
          stripeSubscriptionId: subscription.id,
        })

        // Track status change if significant
        if (previousStatus !== newStatus) {
          trackServer('Subscription Updated', {
            subscription_id: subscription.id,
            previous_status: previousStatus,
            new_status: newStatus,
            cancel_at_period_end: subscription.cancel_at_period_end,
            source: 'stripe',
          }, { userId: String(user.id) })

          // Update user traits
          identifyServer(String(user.id), {
            subscription_status: newStatus,
          })
        }

        break
      }

      // ============================================
      // Subscription deleted/cancelled
      // ============================================
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string

        let customerEmail: string | null = null
        try {
          const customer = await getStripe().customers.retrieve(customerId)
          if (customer && !customer.deleted) {
            customerEmail = customer.email
          }
        } catch {
          // Ignore
        }

        const user = await findUserByStripeCustomer(payload, customerId, customerEmail)

        if (!user) {
          console.error(`[Stripe Webhook] User not found for subscription deletion: ${subscription.id}`)
          return NextResponse.json({ received: true, warning: 'User not found' })
        }

        await updateUserSubscription(payload, user.id, {
          subscriptionStatus: 'cancelled',
        })

        // Track subscription cancellation
        trackServer('Subscription Cancelled', {
          subscription_id: subscription.id,
          customer_id: customerId,
          cancellation_reason: subscription.cancellation_details?.reason || 'unknown',
          source: 'stripe',
        }, { userId: String(user.id) })

        // Update user traits
        identifyServer(String(user.id), {
          subscription_status: 'cancelled',
          subscription_cancelled_at: new Date().toISOString(),
        })

        break
      }

      // ============================================
      // Invoice payment succeeded (renewal)
      // ============================================
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice

        // Check if this invoice is related to a subscription
        if (!invoice.parent?.subscription_details) {
          // Not a subscription invoice
          break
        }

        const customerId = invoice.customer as string
        const customerEmail = invoice.customer_email

        const user = await findUserByStripeCustomer(payload, customerId, customerEmail)

        if (!user) {
          console.error(`[Stripe Webhook] User not found for invoice: ${invoice.id}`)
          return NextResponse.json({ received: true, warning: 'User not found' })
        }

        // Ensure subscription is active
        await updateUserSubscription(payload, user.id, {
          subscriptionStatus: 'premium',
        })

        // Track renewal payment
        trackServer('Subscription Renewed', {
          invoice_id: invoice.id,
          customer_id: customerId,
          amount: invoice.amount_paid ? invoice.amount_paid / 100 : undefined,
          currency: invoice.currency?.toUpperCase(),
          source: 'stripe',
        }, { userId: String(user.id) })

        break
      }

      // ============================================
      // Invoice payment failed
      // ============================================
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice

        // Check if this invoice is related to a subscription
        if (!invoice.parent?.subscription_details) {
          break
        }

        const customerId = invoice.customer as string
        const customerEmail = invoice.customer_email

        const user = await findUserByStripeCustomer(payload, customerId, customerEmail)

        if (!user) {
          console.error(`[Stripe Webhook] User not found for failed invoice: ${invoice.id}`)
          return NextResponse.json({ received: true, warning: 'User not found' })
        }

        // Don't immediately downgrade - Stripe will retry
        // Just log for now, subscription.updated will handle status change
        console.log(`[Stripe Webhook] Payment failed for user ${user.id}, invoice ${invoice.id}`)

        // Track payment failure
        trackServer('Payment Failed', {
          invoice_id: invoice.id,
          customer_id: customerId,
          amount: invoice.amount_due ? invoice.amount_due / 100 : undefined,
          currency: invoice.currency?.toUpperCase(),
          attempt_count: invoice.attempt_count,
          source: 'stripe',
        }, { userId: String(user.id) })

        break
      }

      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`)
    }

    // Flush RudderStack events before responding
    await flushServer()

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('[Stripe Webhook] Error processing event:', error)
    // Return 200 to prevent infinite retries for processing errors
    return NextResponse.json({ received: true, error: 'Processing error' })
  }
}
