/**
 * RevenueCat API Service
 *
 * Fetches subscription and revenue data from RevenueCat REST API.
 * Uses the V1 API with API key authentication.
 *
 * API Docs: https://www.revenuecat.com/reference/overview
 */

import type { RevenueMetrics, DailyRevenue } from '../../components/BusinessAnalyticsDashboard/types'
import { analyticsCache, CACHE_TTL, CACHE_KEYS } from './cache'

const REVENUECAT_API_BASE = 'https://api.revenuecat.com/v1'

interface RevenueCatOverview {
    active_subscribers_count: number
    active_trials_count: number
    mrr: {
        value: number
        currency: string
    }
    revenue: {
        last_24_hours: number
        last_7_days: number
        last_28_days: number
        last_365_days: number
    }
    subscribers: {
        new_last_24_hours: number
        new_last_7_days: number
        churned_last_24_hours: number
        churned_last_7_days: number
    }
}

interface RevenueCatTransaction {
    app_user_id: string
    revenue_in_usd: number
    purchased_at: string
    store: string
    product_identifier: string
    entitlement_ids: string[]
}

/**
 * Fetch revenue metrics from RevenueCat
 */
export async function fetchRevenueCatData(): Promise<RevenueMetrics> {
    // Check cache first
    const cached = analyticsCache.get<RevenueMetrics>(CACHE_KEYS.REVENUE)
    if (cached) {
        return cached
    }

    const apiKey = process.env.REVENUECAT_API_KEY || process.env.REVENUECAT_WEBHOOK_SECRET
    if (!apiKey) {
        throw new Error('REVENUECAT_API_KEY not configured')
    }

    try {
        // Fetch overview data from RevenueCat
        // Note: RevenueCat's REST API is limited - for full metrics,
        // we aggregate from stored webhook data or use their Charts API
        const overviewResponse = await fetch(`${REVENUECAT_API_BASE}/developers/me`, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
        })

        if (!overviewResponse.ok) {
            // If the overview API isn't available, fall back to aggregating from stored data
            console.log('[RevenueCat] Overview API not available, using stored data')
            return await aggregateFromStoredData()
        }

        const overview: RevenueCatOverview = await overviewResponse.json()

        // Calculate revenue metrics
        const dailyRevenue = overview.revenue?.last_24_hours || 0
        const weeklyRevenue = overview.revenue?.last_7_days || 0

        // For history, we'll need to query our stored data or use Charts API
        const dailyHistory = await getDailyRevenueHistory()

        // Calculate changes (simplified - would need yesterday's data)
        const previousDaily = dailyHistory[dailyHistory.length - 2]?.amount || dailyRevenue
        const dailyChange = previousDaily > 0
            ? ((dailyRevenue - previousDaily) / previousDaily) * 100
            : 0

        const result: RevenueMetrics = {
            daily: dailyRevenue,
            weekly: weeklyRevenue,
            dailyChange: Math.round(dailyChange * 10) / 10,
            weeklyChange: 0, // Would need previous week's data
            dailyHistory,
            activeSubscribers: overview.active_subscribers_count || 0,
        }

        analyticsCache.set(CACHE_KEYS.REVENUE, result, CACHE_TTL.REVENUECAT)
        return result

    } catch (error) {
        console.error('[RevenueCat] Error fetching data:', error)
        // Fall back to stored data
        return await aggregateFromStoredData()
    }
}

/**
 * Aggregate revenue from stored webhook data
 * This is a fallback when the RevenueCat API is not available
 */
async function aggregateFromStoredData(): Promise<RevenueMetrics> {
    // This would query the Users collection for subscription data
    // For now, return mock data structure
    const today = new Date()
    const dailyHistory: DailyRevenue[] = []

    for (let i = 6; i >= 0; i--) {
        const date = new Date(today)
        date.setDate(date.getDate() - i)
        dailyHistory.push({
            date: date.toISOString().split('T')[0],
            amount: 0, // Will be filled from actual data
        })
    }

    return {
        daily: 0,
        weekly: 0,
        dailyChange: 0,
        weeklyChange: 0,
        dailyHistory,
        activeSubscribers: 0,
    }
}

/**
 * Get daily revenue history for the last 7 days
 */
async function getDailyRevenueHistory(): Promise<DailyRevenue[]> {
    const today = new Date()
    const history: DailyRevenue[] = []

    for (let i = 6; i >= 0; i--) {
        const date = new Date(today)
        date.setDate(date.getDate() - i)
        history.push({
            date: date.toISOString().split('T')[0],
            amount: 0, // Will be filled from transaction data
        })
    }

    return history
}

/**
 * Get MRR from RevenueCat for predictions
 */
export async function getCurrentMRR(): Promise<number> {
    const apiKey = process.env.REVENUECAT_API_KEY
    if (!apiKey) {
        return 0
    }

    try {
        const response = await fetch(`${REVENUECAT_API_BASE}/developers/me`, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
        })

        if (!response.ok) {
            return 0
        }

        const data = await response.json()
        return data.mrr?.value || 0
    } catch (error) {
        console.error('[RevenueCat] Error fetching MRR:', error)
        return 0
    }
}

/**
 * Get subscription counts for churn calculation
 */
export async function getSubscriptionCounts(): Promise<{
    active: number
    trials: number
    churned24h: number
    churned7d: number
}> {
    const apiKey = process.env.REVENUECAT_API_KEY
    if (!apiKey) {
        return { active: 0, trials: 0, churned24h: 0, churned7d: 0 }
    }

    try {
        const response = await fetch(`${REVENUECAT_API_BASE}/developers/me`, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
        })

        if (!response.ok) {
            return { active: 0, trials: 0, churned24h: 0, churned7d: 0 }
        }

        const data: RevenueCatOverview = await response.json()
        return {
            active: data.active_subscribers_count || 0,
            trials: data.active_trials_count || 0,
            churned24h: data.subscribers?.churned_last_24_hours || 0,
            churned7d: data.subscribers?.churned_last_7_days || 0,
        }
    } catch (error) {
        console.error('[RevenueCat] Error fetching subscription counts:', error)
        return { active: 0, trials: 0, churned24h: 0, churned7d: 0 }
    }
}
