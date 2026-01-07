/**
 * RudderStack Analytics Client for Website
 *
 * Customer Data Platform (CDP) for tracking website events.
 * Events flow through RudderStack and are routed to configured destinations
 * (Mixpanel, BigQuery, etc.) based on server-side configuration.
 *
 * Environment Variables:
 * - NEXT_PUBLIC_RUDDERSTACK_WRITE_KEY: RudderStack source write key
 * - NEXT_PUBLIC_RUDDERSTACK_DATA_PLANE_URL: RudderStack data plane URL
 */

import type { ApiObject, IdentifyTraits } from '@rudderstack/analytics-js'
import { RudderAnalytics } from '@rudderstack/analytics-js'

// Get RudderStack configuration from environment
const writeKey = process.env.NEXT_PUBLIC_RUDDERSTACK_WRITE_KEY
const dataPlaneUrl = process.env.NEXT_PUBLIC_RUDDERSTACK_DATA_PLANE_URL

// Track if RudderStack is enabled
const isEnabled = typeof window !== 'undefined' && !!writeKey && !!dataPlaneUrl

const LOG_PREFIX = '[RudderStack]'

// RudderStack instance (initialized lazily)
let rudderAnalytics: RudderAnalytics | null = null
let isInitialized = false

/**
 * Initialize RudderStack SDK
 * Call this once when the app starts (in _app.tsx or layout.tsx)
 */
export const initializeRudderStack = (): boolean => {
  if (!isEnabled) {
    console.log(`${LOG_PREFIX} Skipped: not configured or SSR`)
    return false
  }

  if (isInitialized) {
    return true // Already initialized
  }

  try {
    rudderAnalytics = new RudderAnalytics()
    rudderAnalytics.load(writeKey!, dataPlaneUrl!, {
      integrations: { All: true },
      logLevel: process.env.NODE_ENV === 'development' ? 'DEBUG' : 'ERROR',
    })

    isInitialized = true
    console.log(`${LOG_PREFIX} Initialized successfully`)
    return true
  } catch (error) {
    console.error(`${LOG_PREFIX} Initialization failed:`, error)
    return false
  }
}

/**
 * Check if RudderStack is configured and enabled
 */
export const isRudderStackEnabled = (): boolean => isEnabled && isInitialized

/**
 * Track an event with optional properties
 */
export const track = (eventName: string, properties?: ApiObject): void => {
  if (!rudderAnalytics || !isInitialized) {
    return
  }

  try {
    rudderAnalytics.track(eventName, properties)
  } catch (error) {
    console.error(`${LOG_PREFIX} Track error:`, error)
  }
}

/**
 * Track a page view
 */
export const page = (category?: string, name?: string, properties?: ApiObject): void => {
  if (!rudderAnalytics || !isInitialized) {
    return
  }

  try {
    // Use any to work around complex SDK overloads
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(rudderAnalytics as any).page(category, name, properties)
  } catch (error) {
    console.error(`${LOG_PREFIX} Page error:`, error)
  }
}

/**
 * Identify a user
 * @param userId - Unique user identifier
 * @param traits - Optional user traits (email, name, etc.)
 */
export const identify = (userId: string, traits?: IdentifyTraits): void => {
  if (!rudderAnalytics || !isInitialized) {
    return
  }

  try {
    rudderAnalytics.identify(userId, traits)
    console.log(`${LOG_PREFIX} User identified:`, userId)
  } catch (error) {
    console.error(`${LOG_PREFIX} Identify error:`, error)
  }
}

/**
 * Alias a new user ID to the current anonymous ID
 */
export const alias = (userId: string): void => {
  if (!rudderAnalytics || !isInitialized) {
    return
  }

  try {
    rudderAnalytics.alias(userId)
    console.log(`${LOG_PREFIX} User aliased:`, userId)
  } catch (error) {
    console.error(`${LOG_PREFIX} Alias error:`, error)
  }
}

/**
 * Reset user identity (call on logout)
 */
export const reset = (): void => {
  if (!rudderAnalytics || !isInitialized) {
    return
  }

  try {
    rudderAnalytics.reset()
    console.log(`${LOG_PREFIX} User reset`)
  } catch (error) {
    console.error(`${LOG_PREFIX} Reset error:`, error)
  }
}

/**
 * Set anonymous ID (useful for cross-platform identity)
 */
export const setAnonymousId = (anonymousId: string): void => {
  if (!rudderAnalytics || !isInitialized) {
    return
  }

  try {
    rudderAnalytics.setAnonymousId(anonymousId)
    console.log(`${LOG_PREFIX} Anonymous ID set:`, anonymousId)
  } catch (error) {
    console.error(`${LOG_PREFIX} Set anonymous ID error:`, error)
  }
}

/**
 * Group a user into a company/organization
 */
export const group = (groupId: string, traits?: ApiObject): void => {
  if (!rudderAnalytics || !isInitialized) {
    return
  }

  try {
    // Use type assertion for the overload that accepts (groupId, traits)
    ;(rudderAnalytics.group as (id: string, t?: ApiObject) => void)(groupId, traits)
    console.log(`${LOG_PREFIX} User grouped:`, groupId)
  } catch (error) {
    console.error(`${LOG_PREFIX} Group error:`, error)
  }
}

/**
 * Get the RudderStack instance for advanced usage
 */
export const getRudderAnalytics = (): RudderAnalytics | null => rudderAnalytics
