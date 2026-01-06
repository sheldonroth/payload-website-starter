/**
 * In-Memory Caching Layer
 *
 * Simple cache with TTL for rate-limiting external API calls.
 * Uses Map with automatic expiration checking.
 */

interface CacheEntry<T> {
    data: T
    timestamp: number
    ttl: number
}

class AnalyticsCache {
    private cache = new Map<string, CacheEntry<unknown>>()

    /**
     * Get cached data if valid
     */
    get<T>(key: string): T | null {
        const entry = this.cache.get(key)
        if (!entry) return null

        const now = Date.now()
        if (now - entry.timestamp > entry.ttl) {
            this.cache.delete(key)
            return null
        }

        return entry.data as T
    }

    /**
     * Set data with TTL
     * @param key Cache key
     * @param data Data to cache
     * @param ttlMs Time-to-live in milliseconds
     */
    set<T>(key: string, data: T, ttlMs: number): void {
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            ttl: ttlMs,
        })
    }

    /**
     * Check if key exists and is valid
     */
    has(key: string): boolean {
        return this.get(key) !== null
    }

    /**
     * Delete a specific key
     */
    delete(key: string): void {
        this.cache.delete(key)
    }

    /**
     * Clear all cached data
     */
    clear(): void {
        this.cache.clear()
    }

    /**
     * Get cache stats for debugging
     */
    stats(): { size: number; keys: string[] } {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys()),
        }
    }

    /**
     * Cleanup expired entries (called periodically)
     */
    cleanup(): number {
        const now = Date.now()
        let cleaned = 0

        for (const [key, entry] of this.cache.entries()) {
            if (now - entry.timestamp > entry.ttl) {
                this.cache.delete(key)
                cleaned++
            }
        }

        return cleaned
    }
}

// Singleton instance
export const analyticsCache = new AnalyticsCache()

// Cache TTL constants (in milliseconds)
export const CACHE_TTL = {
    REVENUECAT: 5 * 60 * 1000, // 5 minutes
    MIXPANEL: 5 * 60 * 1000, // 5 minutes
    STATSIG: 5 * 60 * 1000, // 5 minutes
    INTERNAL: 30 * 1000, // 30 seconds
    AGGREGATED: 60 * 1000, // 1 minute for full response
} as const

// Cache keys
export const CACHE_KEYS = {
    REVENUE: 'analytics:revenue',
    TRIALS: 'analytics:trials',
    EXPERIMENTS: 'analytics:experiments',
    CHURN: 'analytics:churn',
    REFERRALS: 'analytics:referrals',
    MRR: 'analytics:mrr',
    FULL_RESPONSE: 'analytics:full',
} as const

// Start cleanup interval (every 5 minutes)
if (typeof setInterval !== 'undefined') {
    setInterval(() => {
        const cleaned = analyticsCache.cleanup()
        if (cleaned > 0) {
            console.log(`[AnalyticsCache] Cleaned ${cleaned} expired entries`)
        }
    }, 5 * 60 * 1000)
}
