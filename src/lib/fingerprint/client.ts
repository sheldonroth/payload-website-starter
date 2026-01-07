/**
 * Fingerprint.js Pro Client for Website
 *
 * Device identification for cross-platform user tracking.
 * Links with RudderStack for unified analytics across mobile and web.
 *
 * Environment Variables:
 * - NEXT_PUBLIC_FINGERPRINT_API_KEY: Fingerprint.js Pro API key
 */

import * as FingerprintJS from '@fingerprintjs/fingerprintjs-pro'

// Fingerprint storage key (matches mobile app for cross-platform consistency)
const FINGERPRINT_STORAGE_KEY = 'tpr_fp_hash'
const FINGERPRINT_API_KEY = process.env.NEXT_PUBLIC_FINGERPRINT_API_KEY || ''

const LOG_PREFIX = '[Fingerprint]'

// Cached fingerprint
let cachedFingerprint: string | null = null

/**
 * Get or generate fingerprint hash
 * Returns cached value if available, otherwise generates new one
 */
export const getFingerprint = async (): Promise<string | null> => {
  // Only run on client
  if (typeof window === 'undefined') {
    return null
  }

  // Return cached value if available
  if (cachedFingerprint) {
    return cachedFingerprint
  }

  try {
    // Check localStorage first
    const storedHash = localStorage.getItem(FINGERPRINT_STORAGE_KEY)
    if (storedHash) {
      cachedFingerprint = storedHash
      console.log(`${LOG_PREFIX} Loaded cached fingerprint`)
      return storedHash
    }

    // Generate fingerprint using Fingerprint.js Pro SDK if API key available
    if (FINGERPRINT_API_KEY) {
      try {
        const fpPromise = FingerprintJS.load({
          apiKey: FINGERPRINT_API_KEY,
          region: 'us',
        })

        const fp = await fpPromise
        const result = await fp.get()
        const hash = result.visitorId

        localStorage.setItem(FINGERPRINT_STORAGE_KEY, hash)
        cachedFingerprint = hash
        console.log(`${LOG_PREFIX} Generated fingerprint via SDK`)
        return hash
      } catch (sdkError) {
        console.error(`${LOG_PREFIX} SDK error, falling back:`, sdkError)
      }
    }

    // Fallback: Generate browser-based fingerprint
    const fallbackHash = await generateFallbackFingerprint()
    localStorage.setItem(FINGERPRINT_STORAGE_KEY, fallbackHash)
    cachedFingerprint = fallbackHash
    console.log(`${LOG_PREFIX} Generated fallback fingerprint`)
    return fallbackHash
  } catch (error) {
    console.error(`${LOG_PREFIX} Error getting fingerprint:`, error)
    return null
  }
}

/**
 * Generate fallback fingerprint using browser characteristics
 * Used when Fingerprint.js Pro API key is not available
 */
const generateFallbackFingerprint = async (): Promise<string> => {
  const components: string[] = []

  // Browser info
  components.push(navigator.userAgent)
  components.push(navigator.language)
  components.push(String(navigator.hardwareConcurrency || 0))
  components.push(String(screen.width))
  components.push(String(screen.height))
  components.push(String(screen.colorDepth))
  components.push(Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown')

  // Create hash from components
  const str = components.join('|')
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash
  }

  return `fp_web_${Math.abs(hash).toString(16)}`
}

/**
 * Clear cached fingerprint (useful for testing)
 */
export const clearFingerprint = (): void => {
  if (typeof window === 'undefined') return

  try {
    localStorage.removeItem(FINGERPRINT_STORAGE_KEY)
    cachedFingerprint = null
    console.log(`${LOG_PREFIX} Cleared fingerprint`)
  } catch (error) {
    console.error(`${LOG_PREFIX} Error clearing fingerprint:`, error)
  }
}

/**
 * Get cached fingerprint without generating
 */
export const getCachedFingerprint = (): string | null => {
  return cachedFingerprint
}
