/**
 * Brand Subscription API Endpoints
 *
 * Handles Stripe subscription management for Brand Portal:
 * - Create Checkout Session: Start a new subscription
 * - Create Portal Session: Manage existing subscription
 * - Get Subscription Status: Current plan details
 * - Webhook Handler: Process Stripe events
 *
 * @openapi
 * components:
 *   schemas:
 *     CheckoutSession:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         checkoutUrl:
 *           type: string
 *           format: uri
 *         sessionId:
 *           type: string
 *     PortalSession:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         portalUrl:
 *           type: string
 *           format: uri
 *     SubscriptionStatus:
 *       type: object
 *       properties:
 *         tier:
 *           type: string
 *           enum: [free, starter, pro, enterprise]
 *         tierName:
 *           type: string
 *         startDate:
 *           type: string
 *           format: date-time
 *         endDate:
 *           type: string
 *           format: date-time
 *         canUpgrade:
 *           type: boolean
 *         canDowngrade:
 *           type: boolean
 */

import type { Endpoint } from 'payload'
import Stripe from 'stripe'

// Initialize Stripe (will be undefined if not configured)
const stripe = process.env.STRIPE_SECRET_KEY
    ? new Stripe(process.env.STRIPE_SECRET_KEY)
    : null

// Stripe Product/Price IDs (configure in environment)
const STRIPE_PRICES = {
    starter: {
        monthly: process.env.STRIPE_PRICE_STARTER_MONTHLY || 'price_starter_monthly',
        annual: process.env.STRIPE_PRICE_STARTER_ANNUAL || 'price_starter_annual',
    },
    pro: {
        monthly: process.env.STRIPE_PRICE_PRO_MONTHLY || 'price_pro_monthly',
        annual: process.env.STRIPE_PRICE_PRO_ANNUAL || 'price_pro_annual',
    },
    enterprise: {
        monthly: process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY || 'price_enterprise_monthly',
        annual: process.env.STRIPE_PRICE_ENTERPRISE_ANNUAL || 'price_enterprise_annual',
    },
}

// Subscription tier metadata
const TIER_METADATA = {
    free: { name: 'Free', price: 0 },
    starter: { name: 'Starter', monthlyPrice: 99, annualPrice: 990 },
    pro: { name: 'Pro', monthlyPrice: 299, annualPrice: 2990 },
    enterprise: { name: 'Enterprise', monthlyPrice: 999, annualPrice: 9990 },
}

/**
 * @openapi
 * /brand/subscription/create-checkout:
 *   post:
 *     summary: Create Stripe Checkout session
 *     description: Initiates a Stripe Checkout session for subscription purchase
 *     tags: [Brand Subscription]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [tier]
 *             properties:
 *               tier:
 *                 type: string
 *                 enum: [starter, pro, enterprise]
 *                 description: Subscription tier to purchase
 *               billingPeriod:
 *                 type: string
 *                 enum: [monthly, annual]
 *                 default: monthly
 *     responses:
 *       200:
 *         description: Checkout session created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CheckoutSession'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       400:
 *         description: Invalid tier or billing period
 */
export const brandCreateCheckoutHandler: Endpoint = {
    path: '/brand/subscription/create-checkout',
    method: 'post',
    handler: async (req) => {
        try {
            // Check authentication
            if (!req.user || req.user.collection !== 'brand-users') {
                return Response.json({ error: 'Authentication required' }, { status: 401 })
            }

            if (!stripe) {
                return Response.json({ error: 'Stripe not configured' }, { status: 500 })
            }

            const body = await req.json?.() || {}
            const { tier, billingPeriod = 'monthly' } = body

            if (!tier || !['starter', 'pro', 'enterprise'].includes(tier)) {
                return Response.json({ error: 'Invalid subscription tier' }, { status: 400 })
            }

            if (!['monthly', 'annual'].includes(billingPeriod)) {
                return Response.json({ error: 'Invalid billing period' }, { status: 400 })
            }

            const user = req.user as {
                id: number
                email: string
                name: string
                stripeCustomerId?: string
            }

            // Get or create Stripe customer
            let customerId = user.stripeCustomerId

            if (!customerId) {
                const customer = await stripe.customers.create({
                    email: user.email,
                    name: user.name,
                    metadata: {
                        brandUserId: String(user.id),
                    },
                })
                customerId = customer.id

                // Save customer ID
                await req.payload.update({
                    collection: 'brand-users',
                    id: user.id,
                    data: { stripeCustomerId: customerId },
                })
            }

            // Get price ID
            const priceId = STRIPE_PRICES[tier as keyof typeof STRIPE_PRICES][billingPeriod as 'monthly' | 'annual']

            // Create checkout session
            const session = await stripe.checkout.sessions.create({
                customer: customerId,
                mode: 'subscription',
                line_items: [
                    {
                        price: priceId,
                        quantity: 1,
                    },
                ],
                success_url: `https://brands.theproductreport.org/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `https://brands.theproductreport.org/subscription/cancel`,
                metadata: {
                    brandUserId: String(user.id),
                    tier,
                    billingPeriod,
                },
                subscription_data: {
                    metadata: {
                        brandUserId: String(user.id),
                        tier,
                    },
                },
                allow_promotion_codes: true,
                billing_address_collection: 'required',
            })

            console.log(`[BrandSubscription] Checkout created for user ${user.id}, tier: ${tier}`)

            return Response.json({
                success: true,
                checkoutUrl: session.url,
                sessionId: session.id,
            })
        } catch (error) {
            console.error('[BrandSubscription] Checkout error:', error)
            return Response.json({ error: 'Failed to create checkout session' }, { status: 500 })
        }
    },
}

/**
 * Create Customer Portal Session
 * POST /api/brand/subscription/create-portal
 *
 * Creates a Stripe Customer Portal session for subscription management
 */
export const brandCreatePortalHandler: Endpoint = {
    path: '/brand/subscription/create-portal',
    method: 'post',
    handler: async (req) => {
        try {
            // Check authentication
            if (!req.user || req.user.collection !== 'brand-users') {
                return Response.json({ error: 'Authentication required' }, { status: 401 })
            }

            if (!stripe) {
                return Response.json({ error: 'Stripe not configured' }, { status: 500 })
            }

            const user = req.user as {
                id: number
                stripeCustomerId?: string
            }

            if (!user.stripeCustomerId) {
                return Response.json({
                    error: 'No subscription found',
                    code: 'NO_SUBSCRIPTION',
                }, { status: 400 })
            }

            // Create portal session
            const session = await stripe.billingPortal.sessions.create({
                customer: user.stripeCustomerId,
                return_url: 'https://brands.theproductreport.org/dashboard',
            })

            return Response.json({
                success: true,
                portalUrl: session.url,
            })
        } catch (error) {
            console.error('[BrandSubscription] Portal error:', error)
            return Response.json({ error: 'Failed to create portal session' }, { status: 500 })
        }
    },
}

/**
 * @openapi
 * /brand/subscription/status:
 *   get:
 *     summary: Get current subscription status
 *     description: Returns detailed subscription information including Stripe status
 *     tags: [Brand Subscription]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Subscription status
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SubscriptionStatus'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
export const brandSubscriptionStatusHandler: Endpoint = {
    path: '/brand/subscription/status',
    method: 'get',
    handler: async (req) => {
        try {
            // Check authentication
            if (!req.user || req.user.collection !== 'brand-users') {
                return Response.json({ error: 'Authentication required' }, { status: 401 })
            }

            const user = req.user as {
                id: number
                subscription: string
                subscriptionStartDate?: string
                subscriptionEndDate?: string
                stripeCustomerId?: string
                stripeSubscriptionId?: string
                features: any
            }

            let stripeDetails = null

            // Fetch live subscription data from Stripe if available
            if (stripe && user.stripeSubscriptionId) {
                try {
                    const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId) as Stripe.Subscription
                    // In Stripe v20+, current_period_end is on SubscriptionItem, not Subscription
                    const currentPeriodEnd = subscription.items.data[0]?.current_period_end
                    stripeDetails = {
                        status: subscription.status,
                        currentPeriodEnd: currentPeriodEnd
                            ? new Date(currentPeriodEnd * 1000).toISOString()
                            : null,
                        cancelAtPeriodEnd: subscription.cancel_at_period_end,
                        cancelAt: subscription.cancel_at
                            ? new Date(subscription.cancel_at * 1000).toISOString()
                            : null,
                    }
                } catch (stripeError) {
                    console.error('[BrandSubscription] Stripe fetch error:', stripeError)
                }
            }

            const tierInfo = TIER_METADATA[user.subscription as keyof typeof TIER_METADATA] || TIER_METADATA.free

            return Response.json({
                tier: user.subscription,
                tierName: tierInfo.name,
                startDate: user.subscriptionStartDate,
                endDate: user.subscriptionEndDate,
                features: user.features,
                stripe: stripeDetails,
                pricing: {
                    monthly: 'monthlyPrice' in tierInfo ? tierInfo.monthlyPrice : 0,
                    annual: 'annualPrice' in tierInfo ? tierInfo.annualPrice : 0,
                },
                canUpgrade: user.subscription !== 'enterprise',
                canDowngrade: user.subscription !== 'free',
            })
        } catch (error) {
            console.error('[BrandSubscription] Status error:', error)
            return Response.json({ error: 'Failed to fetch subscription status' }, { status: 500 })
        }
    },
}

/**
 * @openapi
 * /brand/subscription/plans:
 *   get:
 *     summary: Get available subscription plans
 *     description: Returns all available subscription tiers with features and pricing
 *     tags: [Brand Subscription]
 *     responses:
 *       200:
 *         description: Available plans
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 plans:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/SubscriptionPlan'
 *                 currency:
 *                   type: string
 *                   example: USD
 *                 billingPeriods:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example: [monthly, annual]
 */
export const brandSubscriptionPlansHandler: Endpoint = {
    path: '/brand/subscription/plans',
    method: 'get',
    handler: async (req) => {
        try {
            const plans = [
                {
                    id: 'free',
                    name: 'Free',
                    description: 'Get started with basic product scores',
                    monthlyPrice: 0,
                    annualPrice: 0,
                    features: [
                        'View your brand\'s trust score',
                        'See product scores for up to 5 products',
                        'Basic dashboard access',
                    ],
                    limitations: [
                        'Limited to 1 brand',
                        'No competitor analysis',
                        'No data export',
                    ],
                },
                {
                    id: 'starter',
                    name: 'Starter',
                    description: 'Essential analytics for growing brands',
                    monthlyPrice: 99,
                    annualPrice: 990,
                    annualSavings: 198,
                    features: [
                        'All Free features',
                        'Unlimited product views',
                        'Historical analytics (30 days)',
                        'Email notifications',
                        'Priority support',
                    ],
                    limitations: [
                        'Limited to 1 brand',
                        'No competitor analysis',
                    ],
                },
                {
                    id: 'pro',
                    name: 'Pro',
                    description: 'Advanced insights for competitive advantage',
                    monthlyPrice: 299,
                    annualPrice: 2990,
                    annualSavings: 598,
                    popular: true,
                    features: [
                        'All Starter features',
                        'Competitor benchmarking',
                        'Consumer demand signals',
                        'Data export (CSV/API)',
                        'Historical analytics (1 year)',
                        'Up to 5 team members',
                        'Custom reports',
                    ],
                    limitations: [
                        'Limited to 3 brands',
                    ],
                },
                {
                    id: 'enterprise',
                    name: 'Enterprise',
                    description: 'Full platform access for large organizations',
                    monthlyPrice: 999,
                    annualPrice: 9990,
                    annualSavings: 1998,
                    features: [
                        'All Pro features',
                        'Unlimited brands',
                        'Unlimited team members',
                        'Full API access',
                        'Custom integrations',
                        'Dedicated account manager',
                        'SLA guarantees',
                        'White-label reports',
                    ],
                    limitations: [],
                    contactSales: true,
                },
            ]

            return Response.json({
                plans,
                currency: 'USD',
                billingPeriods: ['monthly', 'annual'],
            })
        } catch (error) {
            console.error('[BrandSubscription] Plans error:', error)
            return Response.json({ error: 'Failed to fetch plans' }, { status: 500 })
        }
    },
}

/**
 * Cancel Subscription
 * POST /api/brand/subscription/cancel
 *
 * Cancels the current subscription at period end
 */
export const brandCancelSubscriptionHandler: Endpoint = {
    path: '/brand/subscription/cancel',
    method: 'post',
    handler: async (req) => {
        try {
            // Check authentication
            if (!req.user || req.user.collection !== 'brand-users') {
                return Response.json({ error: 'Authentication required' }, { status: 401 })
            }

            if (!stripe) {
                return Response.json({ error: 'Stripe not configured' }, { status: 500 })
            }

            const user = req.user as {
                id: number
                stripeSubscriptionId?: string
            }

            if (!user.stripeSubscriptionId) {
                return Response.json({ error: 'No active subscription' }, { status: 400 })
            }

            const body = await req.json?.() || {}
            const { reason, feedback } = body

            // Cancel at period end
            const subscription = await stripe.subscriptions.update(user.stripeSubscriptionId, {
                cancel_at_period_end: true,
                metadata: {
                    cancellationReason: reason || 'not_specified',
                    cancellationFeedback: feedback || '',
                },
            }) as Stripe.Subscription

            // In Stripe v20+, current_period_end is on SubscriptionItem
            const currentPeriodEnd = subscription.items.data[0]?.current_period_end
            const cancelAtDate = currentPeriodEnd ? new Date(currentPeriodEnd * 1000) : new Date()

            console.log(`[BrandSubscription] Cancelled for user ${user.id}, ends: ${cancelAtDate}`)

            return Response.json({
                success: true,
                message: 'Subscription will cancel at the end of the billing period',
                cancelAt: cancelAtDate.toISOString(),
            })
        } catch (error) {
            console.error('[BrandSubscription] Cancel error:', error)
            return Response.json({ error: 'Failed to cancel subscription' }, { status: 500 })
        }
    },
}

/**
 * Reactivate Subscription
 * POST /api/brand/subscription/reactivate
 *
 * Reactivates a cancelled subscription before it expires
 */
export const brandReactivateSubscriptionHandler: Endpoint = {
    path: '/brand/subscription/reactivate',
    method: 'post',
    handler: async (req) => {
        try {
            // Check authentication
            if (!req.user || req.user.collection !== 'brand-users') {
                return Response.json({ error: 'Authentication required' }, { status: 401 })
            }

            if (!stripe) {
                return Response.json({ error: 'Stripe not configured' }, { status: 500 })
            }

            const user = req.user as {
                id: number
                stripeSubscriptionId?: string
            }

            if (!user.stripeSubscriptionId) {
                return Response.json({ error: 'No subscription to reactivate' }, { status: 400 })
            }

            // Remove cancellation
            const subscription = await stripe.subscriptions.update(user.stripeSubscriptionId, {
                cancel_at_period_end: false,
            }) as Stripe.Subscription

            console.log(`[BrandSubscription] Reactivated for user ${user.id}`)

            return Response.json({
                success: true,
                message: 'Subscription reactivated',
                status: subscription.status,
            })
        } catch (error) {
            console.error('[BrandSubscription] Reactivate error:', error)
            return Response.json({ error: 'Failed to reactivate subscription' }, { status: 500 })
        }
    },
}

// Export all handlers
export const brandSubscriptionEndpoints = [
    brandCreateCheckoutHandler,
    brandCreatePortalHandler,
    brandSubscriptionStatusHandler,
    brandSubscriptionPlansHandler,
    brandCancelSubscriptionHandler,
    brandReactivateSubscriptionHandler,
]
