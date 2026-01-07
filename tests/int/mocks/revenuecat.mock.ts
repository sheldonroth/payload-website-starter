/**
 * RevenueCat API Mock for Integration Tests
 *
 * Mocks the RevenueCat subscription service to:
 * - Simulate subscription status lookups
 * - Generate webhook events for testing
 * - Control premium feature access
 */

import { vi } from 'vitest'

export type SubscriptionTier = 'free' | 'starter' | 'pro' | 'enterprise'

export interface MockSubscriber {
    userId: string
    appUserId: string
    tier: SubscriptionTier
    isActive: boolean
    expiresAt?: Date
    productId?: string
    purchaseDate?: Date
    originalPurchaseDate?: Date
}

export interface RevenueCatMockState {
    subscribers: Map<string, MockSubscriber>
    webhookAuthKey: string
}

const state: RevenueCatMockState = {
    subscribers: new Map(),
    webhookAuthKey: 'test_revenuecat_webhook_key',
}

/**
 * Default subscription response structure
 */
function createSubscriberResponse(subscriber: MockSubscriber) {
    const now = new Date()
    const expiresDate = subscriber.expiresAt || new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    return {
        request_date: now.toISOString(),
        request_date_ms: now.getTime(),
        subscriber: {
            entitlements: subscriber.isActive ? {
                premium: {
                    expires_date: expiresDate.toISOString(),
                    product_identifier: subscriber.productId || 'tpr_premium_monthly',
                    purchase_date: subscriber.purchaseDate?.toISOString() || now.toISOString(),
                },
            } : {},
            first_seen: subscriber.originalPurchaseDate?.toISOString() || now.toISOString(),
            last_seen: now.toISOString(),
            management_url: 'https://apps.apple.com/account/subscriptions',
            non_subscriptions: {},
            original_app_user_id: subscriber.appUserId,
            original_application_version: '1.0.0',
            original_purchase_date: subscriber.originalPurchaseDate?.toISOString() || now.toISOString(),
            other_purchases: {},
            subscriptions: subscriber.isActive ? {
                [subscriber.productId || 'tpr_premium_monthly']: {
                    auto_resume_date: null,
                    billing_issues_detected_at: null,
                    expires_date: expiresDate.toISOString(),
                    grace_period_expires_date: null,
                    is_sandbox: false,
                    original_purchase_date: subscriber.originalPurchaseDate?.toISOString() || now.toISOString(),
                    ownership_type: 'PURCHASED',
                    period_type: 'normal',
                    purchase_date: subscriber.purchaseDate?.toISOString() || now.toISOString(),
                    refunded_at: null,
                    store: 'app_store',
                    unsubscribe_detected_at: null,
                },
            } : {},
        },
    }
}

/**
 * Mock RevenueCat API client
 */
export const mockRevenueCatAPI = {
    getSubscriber: vi.fn(async (appUserId: string) => {
        const subscriber = state.subscribers.get(appUserId)

        if (!subscriber) {
            // Return free tier response
            return createSubscriberResponse({
                userId: appUserId,
                appUserId,
                tier: 'free',
                isActive: false,
            })
        }

        return createSubscriberResponse(subscriber)
    }),
}

/**
 * Reset mock state between tests
 */
export function resetRevenueCatMock(): void {
    state.subscribers.clear()
    mockRevenueCatAPI.getSubscriber.mockClear()
}

/**
 * Add a subscriber to the mock
 */
export function addMockSubscriber(subscriber: MockSubscriber): void {
    state.subscribers.set(subscriber.appUserId, subscriber)
}

/**
 * Remove a subscriber from the mock
 */
export function removeMockSubscriber(appUserId: string): void {
    state.subscribers.delete(appUserId)
}

/**
 * Set a user's subscription tier
 */
export function setSubscriptionTier(appUserId: string, tier: SubscriptionTier): void {
    const existing = state.subscribers.get(appUserId)
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

    state.subscribers.set(appUserId, {
        userId: existing?.userId || appUserId,
        appUserId,
        tier,
        isActive: tier !== 'free',
        expiresAt: tier !== 'free' ? expiresAt : undefined,
        productId: tier !== 'free' ? `tpr_${tier}_monthly` : undefined,
        purchaseDate: new Date(),
        originalPurchaseDate: existing?.originalPurchaseDate || new Date(),
    })
}

/**
 * Create a mock RevenueCat webhook event for testing
 */
export function createMockRevenueCatWebhookEvent(
    type: 'INITIAL_PURCHASE' | 'RENEWAL' | 'CANCELLATION' | 'UNCANCELLATION' | 'NON_RENEWING_PURCHASE' | 'SUBSCRIPTION_PAUSED' | 'EXPIRATION' | 'BILLING_ISSUE' | 'PRODUCT_CHANGE',
    appUserId: string,
    additionalData: Record<string, any> = {}
): { event: object; headers: Record<string, string> } {
    const now = new Date()
    const subscriber = state.subscribers.get(appUserId)

    const event = {
        api_version: '1.0',
        event: {
            aliases: [appUserId],
            app_id: 'test_app_id',
            app_user_id: appUserId,
            commission_percentage: 0.15,
            country_code: 'US',
            currency: 'USD',
            entitlement_id: 'premium',
            entitlement_ids: ['premium'],
            environment: 'SANDBOX',
            event_timestamp_ms: now.getTime(),
            expiration_at_ms: subscriber?.expiresAt?.getTime() || now.getTime() + 30 * 24 * 60 * 60 * 1000,
            id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            is_family_share: false,
            offer_code: null,
            original_app_user_id: appUserId,
            original_transaction_id: `txn_${Date.now()}`,
            period_type: 'NORMAL',
            presented_offering_id: null,
            price: 9.99,
            price_in_purchased_currency: 9.99,
            product_id: subscriber?.productId || 'tpr_premium_monthly',
            purchased_at_ms: subscriber?.purchaseDate?.getTime() || now.getTime(),
            store: 'APP_STORE',
            subscriber_attributes: {},
            takehome_percentage: 0.85,
            tax_percentage: 0,
            transaction_id: `txn_${Date.now()}`,
            type,
            ...additionalData,
        },
    }

    return {
        event,
        headers: {
            'Authorization': `Bearer ${state.webhookAuthKey}`,
            'Content-Type': 'application/json',
        },
    }
}

/**
 * Verify webhook authorization header
 */
export function verifyWebhookAuth(authHeader: string): boolean {
    return authHeader === `Bearer ${state.webhookAuthKey}`
}

/**
 * Get subscription tier from product ID
 */
export function getTierFromProductId(productId: string): SubscriptionTier {
    if (productId.includes('enterprise')) return 'enterprise'
    if (productId.includes('pro')) return 'pro'
    if (productId.includes('starter')) return 'starter'
    return 'free'
}

export default {
    mockRevenueCatAPI,
    resetRevenueCatMock,
    addMockSubscriber,
    removeMockSubscriber,
    setSubscriptionTier,
    createMockRevenueCatWebhookEvent,
    verifyWebhookAuth,
    getTierFromProductId,
}
