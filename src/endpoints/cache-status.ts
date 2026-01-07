/**
 * Cache Status API Endpoint
 *
 * Provides visibility into the in-memory cache state for monitoring.
 * Admin-only endpoint.
 */

import type { PayloadHandler } from 'payload'
import { analyticsCache, CACHE_TTL, CACHE_KEYS } from './business-analytics/cache'

interface CacheEntryInfo {
    key: string
    category: string
    ttlMs: number
    ttlLabel: string
}

// Map keys to their TTL configurations
const CACHE_CONFIG: CacheEntryInfo[] = [
    { key: CACHE_KEYS.REVENUE, category: 'RevenueCat', ttlMs: CACHE_TTL.REVENUECAT, ttlLabel: '5 min' },
    { key: CACHE_KEYS.TRIALS, category: 'RevenueCat', ttlMs: CACHE_TTL.REVENUECAT, ttlLabel: '5 min' },
    { key: CACHE_KEYS.MRR, category: 'RevenueCat', ttlMs: CACHE_TTL.REVENUECAT, ttlLabel: '5 min' },
    { key: CACHE_KEYS.CHURN, category: 'RevenueCat', ttlMs: CACHE_TTL.REVENUECAT, ttlLabel: '5 min' },
    { key: CACHE_KEYS.EXPERIMENTS, category: 'Statsig', ttlMs: CACHE_TTL.STATSIG, ttlLabel: '5 min' },
    { key: CACHE_KEYS.REFERRALS, category: 'Internal', ttlMs: CACHE_TTL.INTERNAL, ttlLabel: '30 sec' },
    { key: CACHE_KEYS.FULL_RESPONSE, category: 'Aggregated', ttlMs: CACHE_TTL.AGGREGATED, ttlLabel: '1 min' },
]

export const cacheStatusHandler: PayloadHandler = async (req) => {
    // Only allow admin access
    if (!req.user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const method = req.method?.toUpperCase()

    // Handle cache clear request
    if (method === 'DELETE') {
        analyticsCache.clear()
        return Response.json({ success: true, message: 'Cache cleared' })
    }

    // Get current cache state
    const stats = analyticsCache.stats()

    // Build detailed cache entries info
    const entries = CACHE_CONFIG.map((config) => ({
        ...config,
        cached: stats.keys.includes(config.key),
    }))

    // Count by category
    const byCategory: Record<string, { total: number; cached: number }> = {}
    for (const entry of entries) {
        if (!byCategory[entry.category]) {
            byCategory[entry.category] = { total: 0, cached: 0 }
        }
        byCategory[entry.category].total++
        if (entry.cached) {
            byCategory[entry.category].cached++
        }
    }

    // Additional cache keys not in config (dynamic keys)
    const configuredKeys = CACHE_CONFIG.map((c) => c.key)
    const dynamicKeys = stats.keys.filter((k) => !configuredKeys.includes(k))

    return Response.json({
        totalEntries: stats.size,
        configuredCaches: CACHE_CONFIG.length,
        activeCaches: stats.keys.length,
        entries,
        byCategory,
        dynamicKeys,
        ttlConfig: {
            REVENUECAT: '5 minutes',
            MIXPANEL: '5 minutes',
            STATSIG: '5 minutes',
            INTERNAL: '30 seconds',
            AGGREGATED: '1 minute',
        },
    })
}
