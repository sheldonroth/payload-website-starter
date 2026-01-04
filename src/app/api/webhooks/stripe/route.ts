import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import Stripe from 'stripe'

export const dynamic = 'force-dynamic'

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-12-18.acacia',
})

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
    event = stripe.webhooks.constructEvent(body, signature, WEBHOOK_SECRET)
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
        const subscription = await stripe.subscriptions.retrieve(subscriptionId)

        await updateUserSubscription(payload, user.id, {
          subscriptionStatus: mapStripeStatus(subscription.status),
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
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
          const customer = await stripe.customers.retrieve(customerId)
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

        await updateUserSubscription(payload, user.id, {
          subscriptionStatus: newStatus,
          stripeSubscriptionId: subscription.id,
        })

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
          const customer = await stripe.customers.retrieve(customerId)
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

        break
      }

      // ============================================
      // Invoice payment succeeded (renewal)
      // ============================================
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice

        if (!invoice.subscription) {
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

        break
      }

      // ============================================
      // Invoice payment failed
      // ============================================
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice

        if (!invoice.subscription) {
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

        break
      }

      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('[Stripe Webhook] Error processing event:', error)
    // Return 200 to prevent infinite retries for processing errors
    return NextResponse.json({ received: true, error: 'Processing error' })
  }
}
