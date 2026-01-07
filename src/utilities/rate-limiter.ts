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

    // Background removal (Photoroom API: 100/min limit)
    BG_REMOVAL: {
        maxRequests: 50,
        windowMs: 60 * 1000, // 50 per minute (Photoroom allows 100/min)
    },

    // Background removal batch operations
    BG_REMOVAL_BATCH: {
        maxRequests: 10,
        windowMs: 60 * 1000, // 10 batch operations per minute
    },

    // AI Business Assistant (expensive Gemini 3 Pro calls)
    AI_BUSINESS_ASSISTANT: {
        maxRequests: 5,
        windowMs: 60 * 1000, // 5 per minute
    },

    // ═══════════════════════════════════════════════════════════════
    // MOBILE API RATE LIMITS
    // ═══════════════════════════════════════════════════════════════

    // Mobile barcode scanning (frequent, lightweight)
    MOBILE_SCAN: {
        maxRequests: 30,
        windowMs: 60 * 1000, // 30 scans per minute
    },

    // Mobile photo uploads (heavier, storage costs)
    MOBILE_PHOTO_UPLOAD: {
        maxRequests: 10,
        windowMs: 60 * 1000, // 10 uploads per minute
    },

    // Scout profile updates
    MOBILE_PROFILE_UPDATE: {
        maxRequests: 5,
        windowMs: 60 * 1000, // 5 updates per minute
    },

    // Mobile product submissions
    MOBILE_PRODUCT_SUBMIT: {
        maxRequests: 10,
        windowMs: 60 * 1000, // 10 submissions per minute
    },

    // Mobile search queries
    MOBILE_SEARCH: {
        maxRequests: 60,
        windowMs: 60 * 1000, // 60 searches per minute
    },

    // Mobile feedback submissions
    MOBILE_FEEDBACK: {
        maxRequests: 5,
        windowMs: 60 * 1000, // 5 feedback per minute
    },

    // Smart Scan AI analysis (expensive OpenAI calls)
    SMART_SCAN: {
        maxRequests: 5,
        windowMs: 60 * 1000, // 5 AI scans per minute
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

/**
 * Get mobile device identifier for rate limiting
 * Uses x-fingerprint header (device fingerprint) or falls back to IP
 */
export function getMobileRateLimitKey(req: Request): string {
    // Mobile apps use x-fingerprint header for device identification
    const fingerprint = req.headers.get('x-fingerprint')
    if (fingerprint) {
        return `device:${fingerprint}`
    }

    // Fallback to IP-based limiting
    return getRateLimitKey(req)
}

/**
 * Apply rate limiting with standardized response
 * Returns null if allowed, Response if rate limited
 */
export function applyRateLimit(
    req: Request,
    limitConfig: RateLimitConfig,
    identifier?: string
): Response | null {
    const key = identifier || getMobileRateLimitKey(req)
    const result = checkRateLimit(key, limitConfig)

    if (!result.allowed) {
        return rateLimitResponse(result.resetAt)
    }

    return null
}
