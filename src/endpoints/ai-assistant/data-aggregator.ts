/**
 * AI Business Assistant - Data Aggregator
 *
 * Fetches and aggregates all business data for AI analysis
 */

import type { Payload } from 'payload'
import type { BusinessContext } from './types'
import { fetchRevenueCatData, getSubscriptionCounts } from '../business-analytics/revenuecat-service'
import { fetchMixpanelData } from '../business-analytics/mixpanel-service'
import { fetchStatsigData } from '../business-analytics/statsig-service'
import {
    calculateChurnByCohort,
    calculateReferralAttribution,
    predictMRR,
} from '../business-analytics/metrics-calculator'

// Simple in-memory cache for aggregated data (5 min TTL)
let cachedContext: { data: BusinessContext; timestamp: number } | null = null
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

/**
 * Fetch all business data for AI context
 */
export async function aggregateBusinessData(
    payload: Payload,
    serverUrl: string
): Promise<BusinessContext> {
    // Check cache
    if (cachedContext && Date.now() - cachedContext.timestamp < CACHE_TTL) {
        console.log('[AI Assistant] Using cached business context')
        return cachedContext.data
    }

    console.log('[AI Assistant] Aggregating fresh business data...')

    // Fetch all data sources directly (bypassing HTTP endpoint for auth)
    const [
        revenueResult,
        subscriptionResult,
        trialsResult,
        experimentsResult,
        churnResult,
        referralsResult,
        mrrResult,
    ] = await Promise.allSettled([
        fetchRevenueCatData(),
        getSubscriptionCounts(),
        fetchMixpanelData(),
        fetchStatsigData(),
        calculateChurnByCohort(payload),
        calculateReferralAttribution(payload),
        predictMRR(payload),
    ])

    // Extract raw results
    const revenueRaw = revenueResult.status === 'fulfilled' ? revenueResult.value : null
    const subscriptions = subscriptionResult.status === 'fulfilled' ? subscriptionResult.value : null
    const trialsRaw = trialsResult.status === 'fulfilled' ? trialsResult.value : null
    const experimentsRaw = experimentsResult.status === 'fulfilled' ? experimentsResult.value : []
    const churnRaw = churnResult.status === 'fulfilled' ? churnResult.value : null
    const referralsRaw = referralsResult.status === 'fulfilled' ? referralsResult.value : null
    const predictedMRRRaw = mrrResult.status === 'fulfilled' ? mrrResult.value : null

    // Log any errors
    if (revenueResult.status === 'rejected') {
        console.error('[AI Assistant] RevenueCat error:', revenueResult.reason)
    }
    if (trialsResult.status === 'rejected') {
        console.error('[AI Assistant] Mixpanel error:', trialsResult.reason)
    }
    if (experimentsResult.status === 'rejected') {
        console.error('[AI Assistant] Statsig error:', experimentsResult.reason)
    }

    // Fetch product catalog metrics
    const productMetrics = await fetchProductMetrics(payload)

    // Fetch email metrics
    const emailMetrics = await fetchEmailMetrics(payload)

    // Transform revenue data to match BusinessContext type
    const revenue: BusinessContext['revenue'] = revenueRaw ? {
        daily: revenueRaw.daily ?? null,
        weekly: revenueRaw.weekly ?? null,
        dailyChange: revenueRaw.dailyChange ?? null,
        weeklyChange: revenueRaw.weeklyChange ?? null,
        mrr: revenueRaw.daily ? revenueRaw.daily * 30 : null, // Estimate MRR from daily
        activeSubscribers: revenueRaw.activeSubscribers ?? subscriptions?.active ?? null,
    } : null

    // Transform trials data
    const trials: BusinessContext['trials'] = trialsRaw ? {
        started: trialsRaw.started ?? 0,
        active: trialsRaw.active ?? subscriptions?.trials ?? 0,
        converted: trialsRaw.converted ?? 0,
        conversionRate: trialsRaw.conversionRate ?? 0,
    } : null

    // Transform churn data
    const churn: BusinessContext['churn'] = churnRaw ? {
        overall: churnRaw.overall ?? 0,
        byCohort: (churnRaw.byCohort || []).map((c: { cohort?: string; month?: string; totalUsers?: number; churned?: number; churnRate?: number }) => ({
            month: c.cohort || c.month || 'Unknown',
            totalUsers: c.totalUsers ?? 0,
            churned: c.churned ?? 0,
            churnRate: c.churnRate ?? 0,
        })),
    } : null

    // Transform experiments data
    const experiments: BusinessContext['experiments'] = (experimentsRaw || []).map((exp: { name?: string; status?: string; variants?: { name?: string; conversionRate?: number; isWinning?: boolean; sampleSize?: number }[] }) => ({
        name: exp.name || 'Unknown',
        status: exp.status || 'unknown',
        variants: (exp.variants || []).map((v) => ({
            name: v.name || 'Unknown',
            conversionRate: v.conversionRate ?? 0,
            isWinning: v.isWinning ?? false,
            sampleSize: v.sampleSize ?? 0,
        })),
    }))

    // Transform referrals data (using property names from ReferralMetrics type)
    const referrals: BusinessContext['referrals'] = referralsRaw ? {
        total: referralsRaw.totalReferrals ?? 0,
        active: referralsRaw.activeReferrals ?? 0,
        bySource: referralsRaw.bySource || [],
        topReferrers: (referralsRaw.topReferrers || []).map((r: { code?: string; referralCode?: string; totalReferrals?: number; commission?: number }) => ({
            code: r.code || r.referralCode || 'Unknown',
            totalReferrals: r.totalReferrals ?? 0,
            commission: r.commission ?? 0,
        })),
        commissionPending: referralsRaw.commissionPending ?? 0,
        commissionPaid: referralsRaw.commissionPaid ?? 0,
    } : null

    // Transform predictions data (using property names from MRRPrediction type)
    const predictions: BusinessContext['predictions'] = predictedMRRRaw ? {
        currentMRR: predictedMRRRaw.current ?? 0,
        predicted30Day: predictedMRRRaw.predicted30Day ?? 0,
        predicted90Day: predictedMRRRaw.predicted90Day ?? 0,
        confidence: predictedMRRRaw.confidence ?? 0.5,
        trend: predictedMRRRaw.trend ?? 'stable',
        growthRate: predictedMRRRaw.growthRate ?? 0,
    } : null

    const context: BusinessContext = {
        revenue,
        trials,
        churn,
        experiments,
        referrals,
        predictions,
        productCatalog: productMetrics,
        emailMetrics: emailMetrics,
    }

    // Cache the result
    cachedContext = { data: context, timestamp: Date.now() }

    return context
}

/**
 * Fetch product catalog metrics
 */
async function fetchProductMetrics(payload: Payload): Promise<BusinessContext['productCatalog']> {
    try {
        // Get product counts by status
        const [published, draft, aiDraft, total] = await Promise.all([
            payload.count({
                collection: 'products',
                where: { status: { equals: 'published' } },
            }),
            payload.count({
                collection: 'products',
                where: { status: { equals: 'draft' } },
            }),
            payload.count({
                collection: 'products',
                where: { status: { equals: 'ai_draft' } },
            }),
            payload.count({
                collection: 'products',
            }),
        ])

        // Get recent unlocks (last 7 days)
        const sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

        const recentUnlocks = await payload.count({
            collection: 'product-unlocks',
            where: {
                createdAt: { greater_than: sevenDaysAgo.toISOString() },
            },
        })

        // Get recent votes (last 7 days)
        const recentVotes = await payload.count({
            collection: 'product-votes',
            where: {
                createdAt: { greater_than: sevenDaysAgo.toISOString() },
            },
        })

        return {
            totalProducts: total.totalDocs,
            publishedProducts: published.totalDocs,
            draftProducts: draft.totalDocs,
            aiDrafts: aiDraft.totalDocs,
            recentUnlocks: recentUnlocks.totalDocs,
            recentVotes: recentVotes.totalDocs,
        }
    } catch (error) {
        console.error('[AI Assistant] Failed to fetch product metrics:', error)
        return {
            totalProducts: 0,
            publishedProducts: 0,
            draftProducts: 0,
            aiDrafts: 0,
            recentUnlocks: 0,
            recentVotes: 0,
        }
    }
}

/**
 * Fetch email metrics from EmailSends collection
 */
async function fetchEmailMetrics(payload: Payload): Promise<BusinessContext['emailMetrics']> {
    try {
        // Get total emails sent
        const totalSent = await payload.count({
            collection: 'email-sends',
        })

        // Get emails from last 30 days for rate calculation
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

        const recentEmails = await payload.find({
            collection: 'email-sends',
            where: {
                sentAt: { greater_than: thirtyDaysAgo.toISOString() },
            },
            limit: 1000,
        })

        // Calculate average open/click rates
        let openedCount = 0
        let clickedCount = 0
        const totalRecent = recentEmails.docs.length

        for (const email of recentEmails.docs) {
            if (email.status === 'opened' || email.status === 'clicked') {
                openedCount++
            }
            if (email.status === 'clicked') {
                clickedCount++
            }
        }

        const averageOpenRate = totalRecent > 0 ? (openedCount / totalRecent) * 100 : 0
        const averageClickRate = totalRecent > 0 ? (clickedCount / totalRecent) * 100 : 0

        return {
            totalSent: totalSent.totalDocs,
            averageOpenRate: Math.round(averageOpenRate * 10) / 10,
            averageClickRate: Math.round(averageClickRate * 10) / 10,
            recentCampaigns: totalRecent,
        }
    } catch (error) {
        console.error('[AI Assistant] Failed to fetch email metrics:', error)
        return {
            totalSent: 0,
            averageOpenRate: 0,
            averageClickRate: 0,
            recentCampaigns: 0,
        }
    }
}

/**
 * Clear the cache (useful for testing or manual refresh)
 */
export function clearBusinessDataCache(): void {
    cachedContext = null
    console.log('[AI Assistant] Business data cache cleared')
}
