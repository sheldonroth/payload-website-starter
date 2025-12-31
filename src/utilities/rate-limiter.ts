/**
 * Simple in-memory rate limiter for AI endpoints
 * Prevents abuse and manages API costs
 */

interface RateLimitEntry {
    count: number
    resetAt: number
}

interface RateLimitConfig {
    maxRequests: number    // Max requests per window
    windowMs: number       // Time window in milliseconds
    identifier?: string    // Custom identifier (defaults to IP/user)
}

// In-memory store (resets on server restart, which is fine for rate limiting)
const rateLimitStore: Map<string, RateLimitEntry> = new Map()

// Cleanup old entries every 5 minutes
setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of rateLimitStore.entries()) {
        if (entry.resetAt < now) {
            rateLimitStore.delete(key)
        }
    }
}, 5 * 60 * 1000)

/**
 * Check if a request should be rate limited
 * @returns Object with allowed status and remaining requests
 */
export function checkRateLimit(
    key: string,
    config: RateLimitConfig
): { allowed: boolean; remaining: number; resetAt: number } {
    const now = Date.now()
    const storeKey = `${key}:${config.identifier || 'default'}`

    let entry = rateLimitStore.get(storeKey)

    // Create new entry or reset if window expired
    if (!entry || entry.resetAt < now) {
        entry = {
            count: 0,
            resetAt: now + config.windowMs,
        }
    }

    // Check if limit exceeded
    if (entry.count >= config.maxRequests) {
        return {
            allowed: false,
            remaining: 0,
            resetAt: entry.resetAt,
        }
    }

    // Increment and store
    entry.count++
    rateLimitStore.set(storeKey, entry)

    return {
        allowed: true,
        remaining: config.maxRequests - entry.count,
        resetAt: entry.resetAt,
    }
}

/**
 * Rate limit response helper
 */
export function rateLimitResponse(resetAt: number): Response {
    const retryAfter = Math.ceil((resetAt - Date.now()) / 1000)
    return Response.json(
        {
            error: 'Rate limit exceeded',
            retryAfter,
            message: `Too many requests. Please try again in ${retryAfter} seconds.`
        },
        {
            status: 429,
            headers: {
                'Retry-After': String(retryAfter),
                'X-RateLimit-Reset': String(resetAt),
            }
        }
    )
}

/**
 * Pre-configured rate limit configs for different endpoint types
 */
export const RateLimits = {
    // AI analysis endpoints (expensive API calls)
    AI_ANALYSIS: {
        maxRequests: 10,
        windowMs: 60 * 1000, // 10 per minute
    },

    // Batch operations
    BATCH_OPERATIONS: {
        maxRequests: 5,
        windowMs: 60 * 1000, // 5 per minute
    },

    // Content generation (SEO, polls, etc.)
    CONTENT_GENERATION: {
        maxRequests: 20,
        windowMs: 60 * 1000, // 20 per minute
    },

    // Standard API calls
    STANDARD: {
        maxRequests: 100,
        windowMs: 60 * 1000, // 100 per minute
    },

    // Login/OAuth attempts
    LOGIN: {
        maxRequests: 10,
        windowMs: 60 * 1000, // 10 per minute
    },
}

/**
 * Get identifier for rate limiting from request
 */
export function getRateLimitKey(req: Request, userId?: string | number): string {
    if (userId) {
        return `user:${userId}`
    }

    // Try to get IP from headers
    const forwarded = req.headers.get('x-forwarded-for')
    const ip = forwarded?.split(',')[0]?.trim() ||
               req.headers.get('x-real-ip') ||
               'anonymous'

    return `ip:${ip}`
}
