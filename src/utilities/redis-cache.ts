/**
 * Redis Caching Utility with In-Memory Fallback
 *
 * Provides a unified caching interface that uses Redis when available
 * and falls back to an in-memory Map cache when Redis is unavailable.
 * All operations are type-safe using TypeScript generics.
 */

import { createClient, RedisClientType } from 'redis'

// ═══════════════════════════════════════════════════════════════
// TTL CONSTANTS (in seconds for Redis, milliseconds for internal use)
// ═══════════════════════════════════════════════════════════════

export const CacheTTL = {
    /** 30 seconds - for frequently changing data */
    SHORT: 30,
    /** 5 minutes - for moderately cached data */
    MEDIUM: 5 * 60,
    /** 1 hour - for stable data */
    LONG: 60 * 60,
    /** 24 hours - for rarely changing data */
    DAY: 24 * 60 * 60,
} as const

export type CacheTTLValue = (typeof CacheTTL)[keyof typeof CacheTTL]

// ═══════════════════════════════════════════════════════════════
// CACHE KEY NAMESPACES
// ═══════════════════════════════════════════════════════════════

export const CacheNamespace = {
    /** User-related cache keys */
    USER: 'user',
    /** Product data cache */
    PRODUCT: 'product',
    /** Analytics and metrics */
    ANALYTICS: 'analytics',
    /** API responses */
    API: 'api',
    /** Session data */
    SESSION: 'session',
    /** Search results */
    SEARCH: 'search',
    /** Configuration data */
    CONFIG: 'config',
    /** Computed/aggregated data */
    COMPUTED: 'computed',
} as const

export type CacheNamespaceValue = (typeof CacheNamespace)[keyof typeof CacheNamespace]

// ═══════════════════════════════════════════════════════════════
// IN-MEMORY FALLBACK CACHE
// ═══════════════════════════════════════════════════════════════

interface MemoryCacheEntry<T> {
    data: T
    expiresAt: number
}

class MemoryCache {
    private cache = new Map<string, MemoryCacheEntry<unknown>>()

    get<T>(key: string): T | null {
        const entry = this.cache.get(key)
        if (!entry) return null

        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key)
            return null
        }

        return entry.data as T
    }

    set<T>(key: string, data: T, ttlSeconds: number): void {
        this.cache.set(key, {
            data,
            expiresAt: Date.now() + ttlSeconds * 1000,
        })
    }

    del(key: string): boolean {
        return this.cache.delete(key)
    }

    keys(pattern?: string): string[] {
        const allKeys = Array.from(this.cache.keys())
        if (!pattern) return allKeys

        // Convert Redis glob pattern to regex
        const regexPattern = pattern
            .replace(/\*/g, '.*')
            .replace(/\?/g, '.')
        const regex = new RegExp(`^${regexPattern}$`)

        return allKeys.filter((key) => regex.test(key))
    }

    clear(): void {
        this.cache.clear()
    }

    cleanup(): number {
        const now = Date.now()
        let cleaned = 0

        for (const [key, entry] of this.cache.entries()) {
            if (now > entry.expiresAt) {
                this.cache.delete(key)
                cleaned++
            }
        }

        return cleaned
    }

    stats(): { size: number; keys: string[] } {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys()),
        }
    }
}

// ═══════════════════════════════════════════════════════════════
// REDIS CACHE CLASS
// ═══════════════════════════════════════════════════════════════

class RedisCache {
    private client: RedisClientType | null = null
    private memoryFallback: MemoryCache
    private isConnected = false
    private isConnecting = false
    private connectionPromise: Promise<void> | null = null

    constructor() {
        this.memoryFallback = new MemoryCache()
        this.initializeRedis()
    }

    /**
     * Initialize Redis connection if REDIS_URL is configured
     */
    private async initializeRedis(): Promise<void> {
        const redisUrl = process.env.REDIS_URL

        if (!redisUrl) {
            console.log('[RedisCache] REDIS_URL not configured, using in-memory fallback')
            return
        }

        if (this.isConnecting) {
            await this.connectionPromise
            return
        }

        this.isConnecting = true

        this.connectionPromise = (async () => {
            try {
                this.client = createClient({
                    url: redisUrl,
                    socket: {
                        connectTimeout: 5000,
                        reconnectStrategy: (retries) => {
                            if (retries > 3) {
                                console.log('[RedisCache] Max reconnection attempts reached, using fallback')
                                return false
                            }
                            return Math.min(retries * 100, 3000)
                        },
                    },
                })

                this.client.on('error', (err) => {
                    console.error('[RedisCache] Redis error:', err.message)
                    this.isConnected = false
                })

                this.client.on('connect', () => {
                    console.log('[RedisCache] Connected to Redis')
                    this.isConnected = true
                })

                this.client.on('disconnect', () => {
                    console.log('[RedisCache] Disconnected from Redis, using fallback')
                    this.isConnected = false
                })

                await this.client.connect()
                this.isConnected = true
            } catch (error) {
                console.error('[RedisCache] Failed to connect to Redis:', error instanceof Error ? error.message : error)
                this.isConnected = false
                this.client = null
            } finally {
                this.isConnecting = false
            }
        })()

        await this.connectionPromise
    }

    /**
     * Build a namespaced cache key
     */
    buildKey(namespace: CacheNamespaceValue, ...parts: (string | number)[]): string {
        return [namespace, ...parts].join(':')
    }

    /**
     * Get a value from cache
     */
    async get<T>(key: string): Promise<T | null> {
        try {
            if (this.isConnected && this.client) {
                const value = await this.client.get(key)
                if (value === null) return null
                return JSON.parse(value) as T
            }
        } catch (error) {
            console.error('[RedisCache] Get error, falling back to memory:', error instanceof Error ? error.message : error)
        }

        // Fallback to memory cache
        return this.memoryFallback.get<T>(key)
    }

    /**
     * Set a value in cache with TTL
     */
    async set<T>(key: string, value: T, ttlSeconds: number = CacheTTL.MEDIUM): Promise<boolean> {
        // Always set in memory fallback for redundancy
        this.memoryFallback.set(key, value, ttlSeconds)

        try {
            if (this.isConnected && this.client) {
                await this.client.setEx(key, ttlSeconds, JSON.stringify(value))
                return true
            }
        } catch (error) {
            console.error('[RedisCache] Set error:', error instanceof Error ? error.message : error)
        }

        return true // Memory fallback succeeded
    }

    /**
     * Delete a key from cache
     */
    async del(key: string): Promise<boolean> {
        this.memoryFallback.del(key)

        try {
            if (this.isConnected && this.client) {
                await this.client.del(key)
                return true
            }
        } catch (error) {
            console.error('[RedisCache] Delete error:', error instanceof Error ? error.message : error)
        }

        return true
    }

    /**
     * Invalidate all keys matching a pattern
     * Pattern uses Redis glob-style matching: * matches any characters, ? matches single character
     * Example: "user:*" matches "user:123", "user:456:profile", etc.
     */
    async invalidatePattern(pattern: string): Promise<number> {
        let count = 0

        // Invalidate in memory fallback
        const memoryKeys = this.memoryFallback.keys(pattern)
        for (const key of memoryKeys) {
            this.memoryFallback.del(key)
            count++
        }

        try {
            if (this.isConnected && this.client) {
                // Use SCAN for production-safe key iteration
                let cursor = 0
                const keysToDelete: string[] = []

                do {
                    const result = await this.client.scan(cursor, {
                        MATCH: pattern,
                        COUNT: 100,
                    })
                    cursor = result.cursor
                    keysToDelete.push(...result.keys)
                } while (cursor !== 0)

                if (keysToDelete.length > 0) {
                    await this.client.del(keysToDelete)
                    count = keysToDelete.length
                }
            }
        } catch (error) {
            console.error('[RedisCache] Invalidate pattern error:', error instanceof Error ? error.message : error)
        }

        return count
    }

    /**
     * Get a value from cache, or compute and cache it if not present
     * This is the recommended way to use the cache for most use cases
     */
    async getOrSet<T>(
        key: string,
        loader: () => Promise<T>,
        ttlSeconds: number = CacheTTL.MEDIUM
    ): Promise<T> {
        // Try to get from cache first
        const cached = await this.get<T>(key)
        if (cached !== null) {
            return cached
        }

        // Compute the value
        const value = await loader()

        // Cache the result (don't await to avoid blocking)
        this.set(key, value, ttlSeconds).catch((err) => {
            console.error('[RedisCache] Background set failed:', err instanceof Error ? err.message : err)
        })

        return value
    }

    /**
     * Check if a key exists in cache
     */
    async has(key: string): Promise<boolean> {
        try {
            if (this.isConnected && this.client) {
                const exists = await this.client.exists(key)
                return exists > 0
            }
        } catch (error) {
            console.error('[RedisCache] Has error:', error instanceof Error ? error.message : error)
        }

        return this.memoryFallback.get(key) !== null
    }

    /**
     * Get remaining TTL for a key (in seconds)
     * Returns -1 if key exists but has no TTL, -2 if key doesn't exist
     */
    async ttl(key: string): Promise<number> {
        try {
            if (this.isConnected && this.client) {
                return await this.client.ttl(key)
            }
        } catch (error) {
            console.error('[RedisCache] TTL error:', error instanceof Error ? error.message : error)
        }

        // Memory fallback doesn't track TTL granularly
        return this.memoryFallback.get(key) !== null ? -1 : -2
    }

    /**
     * Increment a numeric value (useful for counters)
     */
    async incr(key: string, amount: number = 1): Promise<number> {
        try {
            if (this.isConnected && this.client) {
                if (amount === 1) {
                    return await this.client.incr(key)
                }
                return await this.client.incrBy(key, amount)
            }
        } catch (error) {
            console.error('[RedisCache] Increment error:', error instanceof Error ? error.message : error)
        }

        // Fallback: handle increment in memory
        const current = this.memoryFallback.get<number>(key) || 0
        const newValue = current + amount
        this.memoryFallback.set(key, newValue, CacheTTL.DAY)
        return newValue
    }

    /**
     * Get cache statistics
     */
    async stats(): Promise<{
        isRedisConnected: boolean
        memoryFallbackSize: number
        memoryFallbackKeys: string[]
    }> {
        const memStats = this.memoryFallback.stats()
        return {
            isRedisConnected: this.isConnected,
            memoryFallbackSize: memStats.size,
            memoryFallbackKeys: memStats.keys,
        }
    }

    /**
     * Clear all cache data (use with caution)
     */
    async clear(): Promise<void> {
        this.memoryFallback.clear()

        try {
            if (this.isConnected && this.client) {
                await this.client.flushDb()
            }
        } catch (error) {
            console.error('[RedisCache] Clear error:', error instanceof Error ? error.message : error)
        }
    }

    /**
     * Gracefully disconnect from Redis
     */
    async disconnect(): Promise<void> {
        try {
            if (this.client) {
                await this.client.quit()
                this.isConnected = false
                this.client = null
            }
        } catch (error) {
            console.error('[RedisCache] Disconnect error:', error instanceof Error ? error.message : error)
        }
    }
}

// ═══════════════════════════════════════════════════════════════
// SINGLETON INSTANCE
// ═══════════════════════════════════════════════════════════════

export const cache = new RedisCache()

// Start cleanup interval for memory fallback (every 5 minutes)
if (typeof setInterval !== 'undefined') {
    setInterval(() => {
        // Access private method through the instance
        const memoryCache = (cache as unknown as { memoryFallback: MemoryCache }).memoryFallback
        const cleaned = memoryCache.cleanup()
        if (cleaned > 0) {
            console.log(`[RedisCache] Cleaned ${cleaned} expired memory entries`)
        }
    }, 5 * 60 * 1000)
}

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Create a cache key with namespace
 */
export function cacheKey(namespace: CacheNamespaceValue, ...parts: (string | number)[]): string {
    return cache.buildKey(namespace, ...parts)
}

/**
 * Decorator-style cache wrapper for functions
 * Usage: const cachedFn = withCache('namespace:key', originalFn, CacheTTL.MEDIUM)
 */
export function withCache<T, Args extends unknown[]>(
    keyOrKeyFn: string | ((...args: Args) => string),
    fn: (...args: Args) => Promise<T>,
    ttlSeconds: number = CacheTTL.MEDIUM
): (...args: Args) => Promise<T> {
    return async (...args: Args): Promise<T> => {
        const key = typeof keyOrKeyFn === 'function' ? keyOrKeyFn(...args) : keyOrKeyFn
        return cache.getOrSet(key, () => fn(...args), ttlSeconds)
    }
}
