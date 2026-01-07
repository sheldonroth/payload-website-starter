/**
 * RevenueCat Webhook Handler
 *
 * Handles subscription lifecycle events from RevenueCat.
 * Updates referral status when:
 * - New subscription → Mark referral as 'active', set commission dates
 * - Renewal → Accrue commission, extend next commission date
 * - Cancellation → Mark referral as 'churned'
 *
 * Commission: $25/year per active referred subscriber
 * Timing: Annual payouts on subscription anniversary
 *
 * Webhook URL: https://cms.theproductreport.org/api/revenuecat-webhook
 * Configure in RevenueCat Dashboard → Integrations → Webhooks
 */

import type { Endpoint } from 'payload'
import { trackServer, identifyServer, flushServer } from '../lib/analytics/rudderstack-server'

// RevenueCat webhook event types
type RevenueCatEventType =
    | 'INITIAL_PURCHASE'
    | 'RENEWAL'
    | 'CANCELLATION'
    | 'UNCANCELLATION'
    | 'NON_RENEWING_PURCHASE'
    | 'SUBSCRIPTION_PAUSED'
    | 'EXPIRATION'
    | 'BILLING_ISSUE'
    | 'PRODUCT_CHANGE'
    | 'TRANSFER'

interface RevenueCatEvent {
    type: RevenueCatEventType
    app_user_id: string
    subscriber_id?: string
    product_id?: string
    price?: number
    currency?: string
    expiration_at_ms?: number
    purchased_at_ms?: number
    event_timestamp_ms: number
    original_app_user_id?: string
    aliases?: string[]
}

interface RevenueCatWebhookPayload {
    api_version: string
    event: RevenueCatEvent
}

const COMMISSION_AMOUNT = 25.00 // $25/year per referral

// RevenueCat shared secret for webhook verification
// Set this in RevenueCat Dashboard → Integrations → Webhooks → Authorization Header
const REVENUECAT_WEBHOOK_SECRET = process.env.REVENUECAT_WEBHOOK_SECRET

export const revenuecatWebhookHandler: Endpoint = {
    path: '/revenuecat-webhook',
    method: 'post',
    handler: async (req) => {
        const payload = req.payload

        try {
            // Verify authorization header
            const authHeader = req.headers.get('authorization')

            if (REVENUECAT_WEBHOOK_SECRET) {
                // If secret is configured, require it
                if (!authHeader || authHeader !== `Bearer ${REVENUECAT_WEBHOOK_SECRET}`) {
                    console.warn('[RevenueCat Webhook] Unauthorized request - invalid or missing auth header')
                    return Response.json({ error: 'Unauthorized' }, { status: 401 })
                }
            } else {
                // Warn if no secret configured (allow in development)
                console.warn('[RevenueCat Webhook] No REVENUECAT_WEBHOOK_SECRET configured - skipping auth')
            }

            const body = (typeof req.body === 'object' && req.body !== null ? req.body : {}) as RevenueCatWebhookPayload

            if (!body?.event) {
                return Response.json({ error: 'Invalid webhook payload' }, { status: 400 })
            }

            const event = body.event
            const subscriberId = event.app_user_id || event.subscriber_id

            if (!subscriberId) {
                return Response.json({ error: 'Missing subscriber ID' }, { status: 400 })
            }

            console.log(`[RevenueCat Webhook] ${event.type} for ${subscriberId}`)

            switch (event.type) {
                case 'INITIAL_PURCHASE':
                    await handleNewSubscription(payload, subscriberId, event)
                    // Track in RudderStack
                    trackServer('Subscription Started', {
                        subscriber_id: subscriberId,
                        product_id: event.product_id,
                        price: event.price,
                        currency: event.currency,
                        source: 'revenuecat',
                    }, { anonymousId: subscriberId })
                    break

                case 'RENEWAL':
                    await handleRenewal(payload, subscriberId, event)
                    // Track in RudderStack
                    trackServer('Subscription Renewed', {
                        subscriber_id: subscriberId,
                        product_id: event.product_id,
                        price: event.price,
                        currency: event.currency,
                        source: 'revenuecat',
                    }, { anonymousId: subscriberId })
                    break

                case 'CANCELLATION':
                case 'EXPIRATION':
                    await handleCancellation(payload, subscriberId, event)
                    // Track in RudderStack
                    trackServer('Subscription Cancelled', {
                        subscriber_id: subscriberId,
                        event_type: event.type,
                        source: 'revenuecat',
                    }, { anonymousId: subscriberId })
                    break

                case 'UNCANCELLATION':
                    await handleReactivation(payload, subscriberId, event)
                    // Track in RudderStack
                    trackServer('Subscription Reactivated', {
                        subscriber_id: subscriberId,
                        source: 'revenuecat',
                    }, { anonymousId: subscriberId })
                    break

                case 'BILLING_ISSUE':
                    // Track billing issue
                    trackServer('Payment Failed', {
                        subscriber_id: subscriberId,
                        source: 'revenuecat',
                    }, { anonymousId: subscriberId })
                    break

                default:
                    console.log(`[RevenueCat Webhook] Unhandled event type: ${event.type}`)
            }

            // Flush events before responding
            await flushServer()

            return Response.json({ success: true })
        } catch (error) {
            console.error('[RevenueCat Webhook] Error:', error)
            return Response.json({ error: 'Internal server error' }, { status: 500 })
        }
    },
}

/**
 * Handle new subscription - activate referral if exists
 */
async function handleNewSubscription(
    payload: any,
    subscriberId: string,
    event: RevenueCatEvent
) {
    // Find referral by subscriber ID or app_user_id
    const referrals = await payload.find({
        collection: 'referrals',
        where: {
            or: [
                { referredDeviceId: { equals: subscriberId } },
                { revenuecatSubscriberId: { equals: subscriberId } },
            ],
        },
        limit: 1,
    })

    if (referrals.docs.length === 0) {
        console.log(`[RevenueCat Webhook] No referral found for ${subscriberId}`)
        return
    }

    const referral = referrals.docs[0]
    const now = new Date()
    const nextYear = new Date(now)
    nextYear.setFullYear(nextYear.getFullYear() + 1)

    // Update referral to active status
    await payload.update({
        collection: 'referrals',
        id: referral.id,
        data: {
            status: 'active',
            revenuecatSubscriberId: subscriberId,
            firstSubscriptionDate: now.toISOString(),
            lastRenewalDate: now.toISOString(),
            nextCommissionDate: nextYear.toISOString(),
            yearsActive: 1,
        },
    })

    console.log(`[RevenueCat Webhook] Activated referral ${referral.id} for ${subscriberId}`)
}

/**
 * Handle subscription renewal - accrue commission
 */
async function handleRenewal(
    payload: any,
    subscriberId: string,
    event: RevenueCatEvent
) {
    // Find active referral for this subscriber
    const referrals = await payload.find({
        collection: 'referrals',
        where: {
            revenuecatSubscriberId: { equals: subscriberId },
            status: { equals: 'active' },
        },
        limit: 1,
    })

    if (referrals.docs.length === 0) {
        console.log(`[RevenueCat Webhook] No active referral for ${subscriberId}`)
        return
    }

    const referral = referrals.docs[0]
    const now = new Date()
    const nextYear = new Date(now)
    nextYear.setFullYear(nextYear.getFullYear() + 1)

    // Check if we should accrue commission (subscription anniversary passed)
    const nextCommissionDate = referral.nextCommissionDate ? new Date(referral.nextCommissionDate) : null

    if (nextCommissionDate && now >= nextCommissionDate) {
        // Accrue commission
        const newTotalPaid = (referral.totalCommissionPaid || 0) + COMMISSION_AMOUNT
        const newYearsActive = (referral.yearsActive || 0) + 1

        await payload.update({
            collection: 'referrals',
            id: referral.id,
            data: {
                lastRenewalDate: now.toISOString(),
                nextCommissionDate: nextYear.toISOString(),
                totalCommissionPaid: newTotalPaid,
                yearsActive: newYearsActive,
            },
        })

        // Create pending payout entry
        await accrueCommission(payload, referral, COMMISSION_AMOUNT)

        console.log(`[RevenueCat Webhook] Accrued $${COMMISSION_AMOUNT} commission for referral ${referral.id}`)
    } else {
        // Just update renewal date
        await payload.update({
            collection: 'referrals',
            id: referral.id,
            data: {
                lastRenewalDate: now.toISOString(),
            },
        })
    }
}

/**
 * Handle subscription cancellation - mark referral as churned
 */
async function handleCancellation(
    payload: any,
    subscriberId: string,
    event: RevenueCatEvent
) {
    const referrals = await payload.find({
        collection: 'referrals',
        where: {
            revenuecatSubscriberId: { equals: subscriberId },
            status: { equals: 'active' },
        },
        limit: 1,
    })

    if (referrals.docs.length === 0) {
        return
    }

    const referral = referrals.docs[0]

    await payload.update({
        collection: 'referrals',
        id: referral.id,
        data: {
            status: 'churned',
        },
    })

    console.log(`[RevenueCat Webhook] Churned referral ${referral.id}`)
}

/**
 * Handle subscription reactivation - mark referral as active again
 */
async function handleReactivation(
    payload: any,
    subscriberId: string,
    event: RevenueCatEvent
) {
    const referrals = await payload.find({
        collection: 'referrals',
        where: {
            revenuecatSubscriberId: { equals: subscriberId },
            status: { equals: 'churned' },
        },
        limit: 1,
    })

    if (referrals.docs.length === 0) {
        return
    }

    const referral = referrals.docs[0]

    await payload.update({
        collection: 'referrals',
        id: referral.id,
        data: {
            status: 'active',
        },
    })

    console.log(`[RevenueCat Webhook] Reactivated referral ${referral.id}`)
}

/**
 * Accrue commission for a referrer
 * Creates or updates pending payout record
 */
async function accrueCommission(
    payload: any,
    referral: any,
    amount: number
) {
    const year = new Date().getFullYear().toString()

    // Check for existing pending payout for this referrer in current year
    const existingPayouts = await payload.find({
        collection: 'referral-payouts',
        where: {
            referrerId: { equals: referral.referrerId },
            period: { equals: year },
            status: { equals: 'pending' },
        },
        limit: 1,
    })

    if (existingPayouts.docs.length > 0) {
        // Update existing payout
        const payout = existingPayouts.docs[0]
        const newAmount = (payout.amount || 0) + amount
        const newCount = (payout.referralCount || 0) + 1

        const breakdown = payout.referralBreakdown || []
        breakdown.push({
            referralId: String(referral.id),
            referredEmail: referral.referredEmail,
            amount: amount,
            anniversaryDate: new Date().toISOString(),
        })

        await payload.update({
            collection: 'referral-payouts',
            id: payout.id,
            data: {
                amount: newAmount,
                referralCount: newCount,
                referralBreakdown: breakdown,
            },
        })
    } else {
        // Create new payout record
        await payload.create({
            collection: 'referral-payouts',
            data: {
                referrerId: referral.referrerId,
                referrerEmail: referral.referrerEmail || 'pending@collection.com',
                amount: amount,
                referralCount: 1,
                period: year,
                status: 'pending',
                paymentMethod: 'paypal', // Default, can be changed
                referralBreakdown: [{
                    referralId: String(referral.id),
                    referredEmail: referral.referredEmail,
                    amount: amount,
                    anniversaryDate: new Date().toISOString(),
                }],
            },
        })
    }
}

export default revenuecatWebhookHandler
