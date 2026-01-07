/**
 * Unit tests for rate-limiter utility
 *
 * Tests the in-memory rate limiting functionality including:
 * - Basic request counting
 * - Window expiration
 * - Different configs
 * - Request key extraction
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  checkRateLimit,
  rateLimitResponse,
  getRateLimitKey,
  getMobileRateLimitKey,
  applyRateLimit,
  RateLimits,
} from '@/utilities/rate-limiter'

// Mock Date.now for deterministic tests
const mockNow = 1700000000000 // Fixed timestamp

describe('rate-limiter', () => {
  beforeEach(() => {
    // Reset Date.now mock before each test
    vi.useFakeTimers()
    vi.setSystemTime(mockNow)
  })

  describe('checkRateLimit', () => {
    it('allows requests under the limit', () => {
      const config = { maxRequests: 5, windowMs: 60000 }
      const key = `test-${Date.now()}-1`

      const result = checkRateLimit(key, config)

      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(4) // 5 - 1 = 4 remaining
    })

    it('tracks request count correctly', () => {
      const config = { maxRequests: 5, windowMs: 60000 }
      const key = `test-${Date.now()}-2`

      // Make 3 requests
      checkRateLimit(key, config)
      checkRateLimit(key, config)
      const result = checkRateLimit(key, config)

      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(2) // 5 - 3 = 2 remaining
    })

    it('blocks requests at the limit', () => {
      const config = { maxRequests: 3, windowMs: 60000 }
      const key = `test-${Date.now()}-3`

      // Make 3 requests (exhaust limit)
      checkRateLimit(key, config)
      checkRateLimit(key, config)
      checkRateLimit(key, config)

      // 4th request should be blocked
      const result = checkRateLimit(key, config)

      expect(result.allowed).toBe(false)
      expect(result.remaining).toBe(0)
    })

    it('resets after window expires', () => {
      const config = { maxRequests: 2, windowMs: 60000 }
      const key = `test-${Date.now()}-4`

      // Exhaust limit
      checkRateLimit(key, config)
      checkRateLimit(key, config)
      const blocked = checkRateLimit(key, config)
      expect(blocked.allowed).toBe(false)

      // Advance time past window
      vi.advanceTimersByTime(61000)

      // Should be allowed again
      const result = checkRateLimit(key, config)
      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(1) // Fresh window
    })

    it('uses identifier in store key', () => {
      const config = { maxRequests: 2, windowMs: 60000, identifier: 'custom' }
      const key = `test-${Date.now()}-5`

      // Make requests with identifier
      checkRateLimit(key, config)
      const result1 = checkRateLimit(key, config)
      expect(result1.remaining).toBe(0)

      // Same key without identifier should have fresh count
      const configNoId = { maxRequests: 2, windowMs: 60000 }
      const result2 = checkRateLimit(key, configNoId)
      expect(result2.remaining).toBe(1) // Different store key
    })

    it('returns correct resetAt timestamp', () => {
      const config = { maxRequests: 5, windowMs: 60000 }
      const key = `test-${Date.now()}-6`

      const result = checkRateLimit(key, config)

      expect(result.resetAt).toBe(mockNow + 60000)
    })
  })

  describe('rateLimitResponse', () => {
    it('returns 429 status', async () => {
      const resetAt = mockNow + 30000 // 30 seconds from now

      const response = rateLimitResponse(resetAt)

      expect(response.status).toBe(429)
    })

    it('includes Retry-After header', () => {
      const resetAt = mockNow + 30000

      const response = rateLimitResponse(resetAt)

      expect(response.headers.get('Retry-After')).toBe('30')
    })

    it('includes reset timestamp header', () => {
      const resetAt = mockNow + 30000

      const response = rateLimitResponse(resetAt)

      expect(response.headers.get('X-RateLimit-Reset')).toBe(String(resetAt))
    })

    it('returns JSON error body', async () => {
      const resetAt = mockNow + 45000

      const response = rateLimitResponse(resetAt)
      const body = await response.json()

      expect(body.error).toBe('Rate limit exceeded')
      expect(body.retryAfter).toBe(45)
      expect(body.message).toContain('45 seconds')
    })
  })

  describe('getRateLimitKey', () => {
    it('returns user key when userId provided', () => {
      const mockRequest = new Request('http://test.com', {
        headers: { 'x-forwarded-for': '1.2.3.4' },
      })

      const key = getRateLimitKey(mockRequest, 'user123')

      expect(key).toBe('user:user123')
    })

    it('extracts IP from x-forwarded-for header', () => {
      const mockRequest = new Request('http://test.com', {
        headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' },
      })

      const key = getRateLimitKey(mockRequest)

      expect(key).toBe('ip:1.2.3.4')
    })

    it('extracts IP from x-real-ip header', () => {
      const mockRequest = new Request('http://test.com', {
        headers: { 'x-real-ip': '9.8.7.6' },
      })

      const key = getRateLimitKey(mockRequest)

      expect(key).toBe('ip:9.8.7.6')
    })

    it('falls back to anonymous when no IP headers', () => {
      const mockRequest = new Request('http://test.com')

      const key = getRateLimitKey(mockRequest)

      expect(key).toBe('ip:anonymous')
    })

    it('prefers x-forwarded-for over x-real-ip', () => {
      const mockRequest = new Request('http://test.com', {
        headers: {
          'x-forwarded-for': '1.1.1.1',
          'x-real-ip': '2.2.2.2',
        },
      })

      const key = getRateLimitKey(mockRequest)

      expect(key).toBe('ip:1.1.1.1')
    })
  })

  describe('getMobileRateLimitKey', () => {
    it('returns device key when fingerprint header present', () => {
      const mockRequest = new Request('http://test.com', {
        headers: { 'x-fingerprint': 'abc123xyz' },
      })

      const key = getMobileRateLimitKey(mockRequest)

      expect(key).toBe('device:abc123xyz')
    })

    it('falls back to IP when no fingerprint', () => {
      const mockRequest = new Request('http://test.com', {
        headers: { 'x-forwarded-for': '1.2.3.4' },
      })

      const key = getMobileRateLimitKey(mockRequest)

      expect(key).toBe('ip:1.2.3.4')
    })
  })

  describe('applyRateLimit', () => {
    it('returns null when request allowed', () => {
      const mockRequest = new Request('http://test.com', {
        headers: { 'x-fingerprint': `device-${Date.now()}-1` },
      })
      const config = { maxRequests: 10, windowMs: 60000 }

      const response = applyRateLimit(mockRequest, config)

      expect(response).toBeNull()
    })

    it('returns 429 response when rate limited', () => {
      const fingerprint = `device-${Date.now()}-2`
      const mockRequest = new Request('http://test.com', {
        headers: { 'x-fingerprint': fingerprint },
      })
      const config = { maxRequests: 1, windowMs: 60000 }

      // First request allowed
      applyRateLimit(mockRequest, config)

      // Second request blocked
      const response = applyRateLimit(mockRequest, config)

      expect(response).not.toBeNull()
      expect(response?.status).toBe(429)
    })

    it('accepts custom identifier', () => {
      const mockRequest = new Request('http://test.com')
      const config = { maxRequests: 1, windowMs: 60000 }
      const customId = `custom-${Date.now()}`

      // First request with custom ID
      const first = applyRateLimit(mockRequest, config, customId)
      expect(first).toBeNull()

      // Second request with same custom ID - blocked
      const second = applyRateLimit(mockRequest, config, customId)
      expect(second).not.toBeNull()
    })
  })

  describe('RateLimits configs', () => {
    it('defines AI_ANALYSIS config', () => {
      expect(RateLimits.AI_ANALYSIS.maxRequests).toBe(10)
      expect(RateLimits.AI_ANALYSIS.windowMs).toBe(60000)
    })

    it('defines MOBILE_SCAN config', () => {
      expect(RateLimits.MOBILE_SCAN.maxRequests).toBe(30)
      expect(RateLimits.MOBILE_SCAN.windowMs).toBe(60000)
    })

    it('defines SMART_SCAN config with lower limit', () => {
      expect(RateLimits.SMART_SCAN.maxRequests).toBe(5)
      expect(RateLimits.SMART_SCAN.windowMs).toBe(60000)
    })

    it('has all expected configs', () => {
      const expectedConfigs = [
        'AI_ANALYSIS',
        'BATCH_OPERATIONS',
        'CONTENT_GENERATION',
        'STANDARD',
        'LOGIN',
        'BG_REMOVAL',
        'BG_REMOVAL_BATCH',
        'AI_BUSINESS_ASSISTANT',
        'MOBILE_SCAN',
        'MOBILE_PHOTO_UPLOAD',
        'MOBILE_PROFILE_UPDATE',
        'MOBILE_PRODUCT_SUBMIT',
        'MOBILE_SEARCH',
        'MOBILE_FEEDBACK',
        'SMART_SCAN',
      ]

      for (const config of expectedConfigs) {
        expect(RateLimits).toHaveProperty(config)
        expect(RateLimits[config as keyof typeof RateLimits]).toHaveProperty('maxRequests')
        expect(RateLimits[config as keyof typeof RateLimits]).toHaveProperty('windowMs')
      }
    })
  })
})
