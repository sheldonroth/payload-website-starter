/**
 * RudderStack Server-Side Analytics Client
 *
 * Server-side tracking for CMS events (API routes, hooks, server actions).
 * Events flow through RudderStack and are routed to configured destinations
 * (Mixpanel, BigQuery, etc.) based on server-side configuration.
 *
 * Environment Variables:
 * - RUDDERSTACK_SERVER_WRITE_KEY: RudderStack Node source write key
 * - RUDDERSTACK_DATA_PLANE_URL: RudderStack data plane URL
 */

import RudderAnalytics from '@rudderstack/rudder-sdk-node'

// Get RudderStack configuration from environment
// Server-side uses a different source than client-side for better separation
const writeKey = process.env.RUDDERSTACK_SERVER_WRITE_KEY || process.env.NEXT_PUBLIC_RUDDERSTACK_WRITE_KEY
const dataPlaneUrl = process.env.RUDDERSTACK_DATA_PLANE_URL || process.env.NEXT_PUBLIC_RUDDERSTACK_DATA_PLANE_URL

const LOG_PREFIX = '[RudderStack Server]'

// RudderStack instance (initialized lazily)
let rudderClient: RudderAnalytics | null = null
let isInitialized = false

/**
 * Initialize RudderStack server SDK
 * Called lazily on first use
 */
const ensureInitialized = (): RudderAnalytics | null => {
  if (isInitialized) {
    return rudderClient
  }

  if (!writeKey || !dataPlaneUrl) {
    console.log(`${LOG_PREFIX} Skipped: not configured`)
    isInitialized = true
    return null
  }

  try {
    rudderClient = new RudderAnalytics(writeKey, {
      dataPlaneUrl,
      flushAt: 10, // Flush after 10 events
      flushInterval: 10000, // Or every 10 seconds
    })

    isInitialized = true
    console.log(`${LOG_PREFIX} Initialized successfully`)
    return rudderClient
  } catch (error) {
    console.error(`${LOG_PREFIX} Initialization failed:`, error)
    isInitialized = true
    return null
  }
}

/**
 * Track a server-side event
 * @param eventName - Name of the event
 * @param properties - Event properties
 * @param userId - Optional user ID (if known)
 * @param anonymousId - Anonymous ID (e.g., fingerprint hash)
 */
export const trackServer = (
  eventName: string,
  properties?: Record<string, unknown>,
  options?: {
    userId?: string
    anonymousId?: string
    context?: Record<string, unknown>
  },
): void => {
  const client = ensureInitialized()
  if (!client) return

  // RudderStack requires either userId or anonymousId
  const hasIdentity = options?.userId || options?.anonymousId
  if (!hasIdentity) {
    console.warn(`${LOG_PREFIX} Track skipped: no userId or anonymousId provided`)
    return
  }

  try {
    // Build the track params based on what identity is available
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const trackParams: any = {
      event: eventName,
      properties: {
        source: 'server',
        ...properties,
      },
      context: {
        app: {
          name: 'The Product Report CMS',
          version: process.env.npm_package_version || '1.0.0',
        },
        ...options?.context,
      },
    }

    if (options?.userId) {
      trackParams.userId = options.userId
    }
    if (options?.anonymousId) {
      trackParams.anonymousId = options.anonymousId
    }

    client.track(trackParams)
  } catch (error) {
    console.error(`${LOG_PREFIX} Track error:`, error)
  }
}

/**
 * Identify a user on the server
 * @param userId - Unique user identifier
 * @param traits - User traits (email, name, etc.)
 * @param anonymousId - Anonymous ID to link
 */
export const identifyServer = (
  userId: string,
  traits?: Record<string, unknown>,
  anonymousId?: string,
): void => {
  const client = ensureInitialized()
  if (!client) return

  try {
    client.identify({
      userId,
      traits: {
        source: 'server',
        ...traits,
      },
      anonymousId,
    })
    console.log(`${LOG_PREFIX} User identified:`, userId)
  } catch (error) {
    console.error(`${LOG_PREFIX} Identify error:`, error)
  }
}

/**
 * Alias a user ID to an anonymous ID
 * @param userId - New user ID
 * @param previousId - Previous anonymous ID
 */
export const aliasServer = (userId: string, previousId: string): void => {
  const client = ensureInitialized()
  if (!client) return

  try {
    client.alias({
      userId,
      previousId,
    })
    console.log(`${LOG_PREFIX} User aliased:`, userId)
  } catch (error) {
    console.error(`${LOG_PREFIX} Alias error:`, error)
  }
}

/**
 * Group a user into an organization
 * @param userId - User ID
 * @param groupId - Group/organization ID
 * @param traits - Group traits
 */
export const groupServer = (
  userId: string,
  groupId: string,
  traits?: Record<string, unknown>,
): void => {
  const client = ensureInitialized()
  if (!client) return

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const groupParams: any = {
      userId,
      groupId,
    }
    if (traits) {
      groupParams.traits = traits
    }
    client.group(groupParams)
    console.log(`${LOG_PREFIX} User grouped:`, groupId)
  } catch (error) {
    console.error(`${LOG_PREFIX} Group error:`, error)
  }
}

/**
 * Flush all pending events immediately
 * Call this before process exit or in serverless environments
 */
export const flushServer = async (): Promise<void> => {
  const client = ensureInitialized()
  if (!client) return

  try {
    await client.flush()
    console.log(`${LOG_PREFIX} Events flushed`)
  } catch (error) {
    console.error(`${LOG_PREFIX} Flush error:`, error)
  }
}

// ============================================================================
// Predefined Server Events for CMS
// ============================================================================

/**
 * Track when a product is scanned/looked up
 */
export const trackProductLookup = (
  barcode: string,
  fingerprintHash: string,
  options?: {
    userId?: string
    productName?: string
    source?: 'mobile' | 'website' | 'api'
  },
): void => {
  trackServer(
    'Product Lookup',
    {
      barcode,
      product_name: options?.productName,
      lookup_source: options?.source || 'api',
    },
    {
      anonymousId: fingerprintHash,
      userId: options?.userId,
    },
  )
}

/**
 * Track when a product report is generated
 */
export const trackReportGenerated = (
  barcode: string,
  fingerprintHash: string,
  options?: {
    userId?: string
    score?: number
    ingredientCount?: number
    flaggedCount?: number
  },
): void => {
  trackServer(
    'Report Generated',
    {
      barcode,
      safety_score: options?.score,
      ingredient_count: options?.ingredientCount,
      flagged_count: options?.flaggedCount,
    },
    {
      anonymousId: fingerprintHash,
      userId: options?.userId,
    },
  )
}

/**
 * Track user signup
 */
export const trackUserSignup = (
  userId: string,
  traits: {
    email: string
    name?: string
    source?: 'mobile' | 'website'
  },
  anonymousId?: string,
): void => {
  // Identify the user
  identifyServer(userId, traits, anonymousId)

  // Track the signup event
  trackServer(
    'User Signed Up',
    {
      email: traits.email,
      signup_source: traits.source || 'website',
    },
    {
      userId,
      anonymousId,
    },
  )
}

/**
 * Track subscription events
 */
export const trackSubscription = (
  userId: string,
  event: 'Subscription Started' | 'Subscription Renewed' | 'Subscription Cancelled',
  properties: {
    plan?: string
    amount?: number
    currency?: string
    stripeCustomerId?: string
  },
): void => {
  trackServer(event, properties, { userId })
}

/**
 * Track vote/investigation events
 */
export const trackVote = (
  barcode: string,
  fingerprintHash: string,
  options?: {
    userId?: string
    voteType?: string
  },
): void => {
  trackServer(
    'Product Vote',
    {
      barcode,
      vote_type: options?.voteType,
    },
    {
      anonymousId: fingerprintHash,
      userId: options?.userId,
    },
  )
}
