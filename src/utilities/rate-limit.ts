/**
 * Rate Limiting Utility with Vercel KV (Redis)
 *
 * Provides serverless-compatible rate limiting using Vercel KV.
 * Falls back gracefully when KV is unavailable.
 *
 * Why Vercel KV instead of standard Redis?
 * - Standard Redis requires persistent connections
 * - Serverless functions are ephemeral - connections don't persist
 * - Each request may hit a different serverless instance
 * - Vercel KV uses REST API - no connection pooling issues
 *
 * @see https://vercel.com/docs/storage/vercel-kv
 */

import { kv } from '@vercel/kv'

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface RateLimitConfig {
    /** Unique key for this rate limit (e.g., 'vote:userId' or 'api:ip') */
    key: string
    /** Maximum requests allowed in the window */
    limit: number
    /** Time window in seconds */
    window: number
}

export interface RateLimitResult {
    /** Whether the request is allowed */
    success: boolean
    /** Number of requests remaining in the current window */
    remaining: number
    /** Unix timestamp (seconds) when the limit resets */
    reset: number
}

// ═══════════════════════════════════════════════════════════════
// CORE RATE LIMITING FUNCTION
// ═══════════════════════════════════════════════════════════════

/**
 * Check rate limit using Vercel KV
 *
 * Uses a sliding window counter algorithm:
 * - Key format: ratelimit:{key}:{window_number}
 * - Window number = floor(current_time / window_size)
 * - Auto-expires after window duration
 *
 * @example
 * ```ts
 * const result = await checkRateLimit({
 *     key: `vote:${userId}`,
 *     limit: 10,
 *     window: 60, // 60 seconds
 * })
 *
 * if (!result.success) {
 *     return Response.json({ error: 'Rate limited' }, { status: 429 })
 * }
 * ```
 */
export async function checkRateLimit(config: RateLimitConfig): Promise<RateLimitResult> {
    const { key, limit, window } = config
    const now = Math.floor(Date.now() / 1000)
    const windowNumber = Math.floor(now / window)
    const windowKey = `ratelimit:${key}:${windowNumber}`

    try {
        // Increment counter atomically
        const count = await kv.incr(windowKey)

        // Set expiry on first request in window (TTL slightly longer than window)
        if (count === 1) {
            await kv.expire(windowKey, window + 1)
        }

        const remaining = Math.max(0, limit - count)
        const reset = (windowNumber + 1) * window

        return {
            success: count <= limit,
            remaining,
            reset,
        }
    } catch (error) {
        // Log error but fail open - allow request if KV is unavailable
        // This prevents service outages when KV has issues
        console.error('[RateLimit] KV error, allowing request:', error instanceof Error ? error.message : error)

        return {
            success: true,
            remaining: limit,
            reset: now + window,
        }
    }
}

// ═══════════════════════════════════════════════════════════════
// CONVENIENCE FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Simple rate limit check with defaults
 *
 * @param identifier - Unique identifier (user ID, IP, etc.)
 * @param limit - Max requests (default: 10)
 * @param windowSeconds - Window in seconds (default: 60)
 *
 * @example
 * ```ts
 * const result = await rateLimit(userId, 10, 60)
 * ```
 */
export async function rateLimit(
    identifier: string,
    limit: number = 10,
    windowSeconds: number = 60
): Promise<RateLimitResult> {
    return checkRateLimit({
        key: identifier,
        limit,
        window: windowSeconds,
    })
}

/**
 * Create a rate limit response with proper headers
 *
 * @param result - Rate limit result from checkRateLimit
 * @param message - Optional custom error message
 */
export function rateLimitedResponse(
    result: RateLimitResult,
    message: string = 'Rate limit exceeded'
): Response {
    const now = Math.floor(Date.now() / 1000)
    const retryAfter = Math.max(1, result.reset - now)

    return Response.json(
        {
            error: message,
            retryAfter,
            message: `Too many requests. Please try again in ${retryAfter} seconds.`,
        },
        {
            status: 429,
            headers: {
                'X-RateLimit-Limit': String(result.remaining + 1),
                'X-RateLimit-Remaining': String(result.remaining),
                'X-RateLimit-Reset': String(result.reset),
                'Retry-After': String(retryAfter),
            },
        }
    )
}

// ═══════════════════════════════════════════════════════════════
// IDENTIFIER HELPERS
// ═══════════════════════════════════════════════════════════════

/**
 * Extract rate limit identifier from request
 * Prefers user ID, falls back to IP address
 */
export function getRateLimitIdentifier(req: Request, userId?: string | number): string {
    if (userId) {
        return `user:${userId}`
    }

    // Extract IP from common headers
    const forwarded = req.headers.get('x-forwarded-for')
    const ip = forwarded?.split(',')[0]?.trim() ||
        req.headers.get('x-real-ip') ||
        req.headers.get('cf-connecting-ip') || // Cloudflare
        'anonymous'

    return `ip:${ip}`
}

/**
 * Get device fingerprint from mobile app requests
 * Falls back to IP if fingerprint not available
 */
export function getMobileIdentifier(req: Request): string {
    const fingerprint = req.headers.get('x-fingerprint')
    if (fingerprint) {
        return `device:${fingerprint}`
    }

    return getRateLimitIdentifier(req)
}

// ═══════════════════════════════════════════════════════════════
// PRE-CONFIGURED RATE LIMITS
// ═══════════════════════════════════════════════════════════════

/**
 * Pre-configured rate limit configurations
 * All values are per-minute windows unless noted
 */
export const RateLimitPresets = {
    // ─── AI & Expensive Operations ───────────────────────────────
    /** AI analysis endpoints (expensive API calls) */
    AI_ANALYSIS: { limit: 10, window: 60 },

    /** AI Business Assistant (Gemini Pro) */
    AI_BUSINESS_ASSISTANT: { limit: 5, window: 60 },

    /** Smart Scan AI analysis */
    SMART_SCAN: { limit: 5, window: 60 },

    // ─── Batch Operations ────────────────────────────────────────
    /** Batch processing operations */
    BATCH_OPERATIONS: { limit: 5, window: 60 },

    /** Background removal batch */
    BG_REMOVAL_BATCH: { limit: 10, window: 60 },

    // ─── Content Operations ──────────────────────────────────────
    /** Content generation (SEO, polls, etc.) */
    CONTENT_GENERATION: { limit: 20, window: 60 },

    /** Background removal (Photoroom API) */
    BG_REMOVAL: { limit: 50, window: 60 },

    // ─── Authentication ──────────────────────────────────────────
    /** Login/OAuth attempts */
    LOGIN: { limit: 10, window: 60 },

    // ─── Standard API ────────────────────────────────────────────
    /** Standard API calls */
    STANDARD: { limit: 100, window: 60 },

    // ─── Mobile API ──────────────────────────────────────────────
    /** Mobile barcode scanning */
    MOBILE_SCAN: { limit: 30, window: 60 },

    /** Mobile photo uploads */
    MOBILE_PHOTO_UPLOAD: { limit: 10, window: 60 },

    /** Mobile profile updates */
    MOBILE_PROFILE_UPDATE: { limit: 5, window: 60 },

    /** Mobile product submissions */
    MOBILE_PRODUCT_SUBMIT: { limit: 10, window: 60 },

    /** Mobile search queries */
    MOBILE_SEARCH: { limit: 60, window: 60 },

    /** Mobile feedback */
    MOBILE_FEEDBACK: { limit: 5, window: 60 },

    // ─── Voting ──────────────────────────────────────────────────
    /** Product/poll voting */
    VOTING: { limit: 10, window: 60 },

    /** Per-product cooldown (more restrictive) */
    VOTE_COOLDOWN: { limit: 1, window: 5 },
} as const

export type RateLimitPresetKey = keyof typeof RateLimitPresets

/**
 * Apply a preset rate limit
 *
 * @example
 * ```ts
 * const result = await applyPreset('VOTING', `vote:${userId}`)
 * if (!result.success) {
 *     return rateLimitedResponse(result)
 * }
 * ```
 */
export async function applyPreset(
    preset: RateLimitPresetKey,
    identifier: string
): Promise<RateLimitResult> {
    const config = RateLimitPresets[preset]
    return checkRateLimit({
        key: identifier,
        limit: config.limit,
        window: config.window,
    })
}

// ═══════════════════════════════════════════════════════════════
// MIDDLEWARE-STYLE HELPER
// ═══════════════════════════════════════════════════════════════

/**
 * Check rate limit and return response if limited
 * Returns null if request is allowed
 *
 * @example
 * ```ts
 * const rateLimited = await checkAndRespond({
 *     key: `api:${getRateLimitIdentifier(req)}`,
 *     limit: 100,
 *     window: 60,
 * })
 *
 * if (rateLimited) {
 *     return rateLimited // Returns 429 response
 * }
 *
 * // Continue with request handling...
 * ```
 */
export async function checkAndRespond(config: RateLimitConfig): Promise<Response | null> {
    const result = await checkRateLimit(config)

    if (!result.success) {
        return rateLimitedResponse(result)
    }

    return null
}
