/**
 * Mixpanel API Service
 *
 * Fetches user analytics data from Mixpanel Data Export API.
 * Used for trial starts, conversions, and funnel analysis.
 *
 * API Docs: https://developer.mixpanel.com/reference/overview
 */

import type { TrialMetrics, DailyTrials } from '../../components/BusinessAnalyticsDashboard/types'
import { analyticsCache, CACHE_TTL, CACHE_KEYS } from './cache'

const MIXPANEL_API_BASE = 'https://data.mixpanel.com/api/2.0'
const MIXPANEL_INSIGHTS_BASE = 'https://mixpanel.com/api/2.0'

// Event names used in the mobile app
const EVENTS = {
    TRIAL_STARTED: 'Trial Started',
    SUBSCRIPTION_STARTED: 'Subscription Started',
    PAYWALL_SHOWN: 'Paywall Shown',
    PAYWALL_CONVERTED: 'Paywall Converted',
}

interface MixpanelJQLResponse {
    error?: string
    result?: Record<string, number>[]
}

interface MixpanelInsightResponse {
    computed_at: string
    results: {
        [key: string]: {
            analysis: {
                count: number
            }
        }
    }
}

/**
 * Fetch trial and conversion metrics from Mixpanel
 */
export async function fetchMixpanelData(): Promise<TrialMetrics> {
    // Check cache first
    const cached = analyticsCache.get<TrialMetrics>(CACHE_KEYS.TRIALS)
    if (cached) {
        return cached
    }

    const apiSecret = process.env.MIXPANEL_API_SECRET
    if (!apiSecret) {
        console.warn('[Mixpanel] MIXPANEL_API_SECRET not configured')
        return getEmptyTrialMetrics()
    }

    try {
        // Calculate date range (last 7 days)
        const today = new Date()
        const sevenDaysAgo = new Date(today)
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

        const fromDate = sevenDaysAgo.toISOString().split('T')[0]
        const toDate = today.toISOString().split('T')[0]

        // Fetch trial and conversion counts using JQL
        const [trialsData, conversionsData, historyData] = await Promise.all([
            queryEventCount(apiSecret, EVENTS.TRIAL_STARTED, fromDate, toDate),
            queryEventCount(apiSecret, EVENTS.SUBSCRIPTION_STARTED, fromDate, toDate),
            queryDailyEvents(apiSecret, fromDate, toDate),
        ])

        const started = trialsData
        const converted = conversionsData
        const conversionRate = started > 0 ? converted / started : 0

        // Calculate active trials (started - converted in last 7 days)
        const active = Math.max(0, started - converted)

        const result: TrialMetrics = {
            started,
            active,
            converted,
            conversionRate: Math.round(conversionRate * 1000) / 1000,
            trialHistory: historyData,
        }

        analyticsCache.set(CACHE_KEYS.TRIALS, result, CACHE_TTL.MIXPANEL)
        return result

    } catch (error) {
        console.error('[Mixpanel] Error fetching data:', error)
        return getEmptyTrialMetrics()
    }
}

/**
 * Query total event count for a date range
 */
async function queryEventCount(
    apiSecret: string,
    eventName: string,
    fromDate: string,
    toDate: string
): Promise<number> {
    try {
        const auth = Buffer.from(`${apiSecret}:`).toString('base64')

        // Use the Insights API for simple counts
        const params = new URLSearchParams({
            from_date: fromDate,
            to_date: toDate,
            event: JSON.stringify([eventName]),
        })

        const response = await fetch(`${MIXPANEL_INSIGHTS_BASE}/events?${params}`, {
            headers: {
                'Authorization': `Basic ${auth}`,
                'Accept': 'application/json',
            },
        })

        if (!response.ok) {
            console.error(`[Mixpanel] Events API error: ${response.status}`)
            return 0
        }

        const data = await response.json()

        // Sum up the event counts
        let total = 0
        if (data.data && data.data.values && data.data.values[eventName]) {
            const values = data.data.values[eventName]
            for (const date in values) {
                total += values[date] || 0
            }
        }

        return total

    } catch (error) {
        console.error(`[Mixpanel] Error querying ${eventName}:`, error)
        return 0
    }
}

/**
 * Query daily event counts for history chart
 */
async function queryDailyEvents(
    apiSecret: string,
    fromDate: string,
    toDate: string
): Promise<DailyTrials[]> {
    try {
        const auth = Buffer.from(`${apiSecret}:`).toString('base64')

        // Fetch both trial and subscription events
        const params = new URLSearchParams({
            from_date: fromDate,
            to_date: toDate,
            event: JSON.stringify([EVENTS.TRIAL_STARTED, EVENTS.SUBSCRIPTION_STARTED]),
        })

        const response = await fetch(`${MIXPANEL_INSIGHTS_BASE}/events?${params}`, {
            headers: {
                'Authorization': `Basic ${auth}`,
                'Accept': 'application/json',
            },
        })

        if (!response.ok) {
            return generateEmptyHistory(fromDate, toDate)
        }

        const data = await response.json()

        // Build daily history
        const history: DailyTrials[] = []
        const startDate = new Date(fromDate)
        const endDate = new Date(toDate)

        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toISOString().split('T')[0]
            const started = data.data?.values?.[EVENTS.TRIAL_STARTED]?.[dateStr] || 0
            const converted = data.data?.values?.[EVENTS.SUBSCRIPTION_STARTED]?.[dateStr] || 0

            history.push({
                date: dateStr,
                started,
                converted,
            })
        }

        return history

    } catch (error) {
        console.error('[Mixpanel] Error querying daily events:', error)
        return generateEmptyHistory(fromDate, toDate)
    }
}

/**
 * Generate empty history for date range
 */
function generateEmptyHistory(fromDate: string, toDate: string): DailyTrials[] {
    const history: DailyTrials[] = []
    const startDate = new Date(fromDate)
    const endDate = new Date(toDate)

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        history.push({
            date: d.toISOString().split('T')[0],
            started: 0,
            converted: 0,
        })
    }

    return history
}

/**
 * Get empty trial metrics (when API is unavailable)
 */
function getEmptyTrialMetrics(): TrialMetrics {
    const today = new Date()
    const sevenDaysAgo = new Date(today)
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    return {
        started: 0,
        active: 0,
        converted: 0,
        conversionRate: 0,
        trialHistory: generateEmptyHistory(
            sevenDaysAgo.toISOString().split('T')[0],
            today.toISOString().split('T')[0]
        ),
    }
}

/**
 * Get funnel conversion rates
 */
export async function getFunnelConversions(apiSecret: string): Promise<{
    paywallShown: number
    paywallConverted: number
    conversionRate: number
}> {
    if (!apiSecret) {
        return { paywallShown: 0, paywallConverted: 0, conversionRate: 0 }
    }

    const today = new Date()
    const sevenDaysAgo = new Date(today)
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const fromDate = sevenDaysAgo.toISOString().split('T')[0]
    const toDate = today.toISOString().split('T')[0]

    const [shown, converted] = await Promise.all([
        queryEventCount(apiSecret, EVENTS.PAYWALL_SHOWN, fromDate, toDate),
        queryEventCount(apiSecret, EVENTS.PAYWALL_CONVERTED, fromDate, toDate),
    ])

    return {
        paywallShown: shown,
        paywallConverted: converted,
        conversionRate: shown > 0 ? converted / shown : 0,
    }
}
