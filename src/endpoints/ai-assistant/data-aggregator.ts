/**
 * AI Business Assistant - Data Aggregator
 *
 * Fetches and aggregates all business data for AI analysis
 */

import type { Payload } from 'payload'
import type { BusinessContext } from './types'

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

    // Fetch from existing business-analytics endpoint
    let analyticsData: Record<string, unknown> | null = null
    try {
        const response = await fetch(`${serverUrl}/api/business-analytics`, {
            headers: {
                'Content-Type': 'application/json',
            },
        })
        if (response.ok) {
            analyticsData = await response.json()
        }
    } catch (error) {
        console.error('[AI Assistant] Failed to fetch business analytics:', error)
    }

    // Fetch product catalog metrics
    const productMetrics = await fetchProductMetrics(payload)

    // Fetch email metrics
    const emailMetrics = await fetchEmailMetrics(payload)

    const context: BusinessContext = {
        revenue: analyticsData?.revenue as BusinessContext['revenue'] || null,
        trials: analyticsData?.trials as BusinessContext['trials'] || null,
        churn: analyticsData?.churn as BusinessContext['churn'] || null,
        experiments: (analyticsData?.experiments as BusinessContext['experiments']) || [],
        referrals: analyticsData?.referrals as BusinessContext['referrals'] || null,
        predictions: analyticsData?.predictedMRR as BusinessContext['predictions'] || null,
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
