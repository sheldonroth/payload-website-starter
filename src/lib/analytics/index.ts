/**
 * Analytics Module - Main Export
 *
 * Re-exports analytics functionality for easy importing.
 * Uses RudderStack CDP for event routing to destinations (Mixpanel, BigQuery, etc.)
 *
 * Client-side: Use functions from './rudderstack-client'
 * Server-side: Use functions from './rudderstack-server'
 */

// Client-side analytics (for use in React components)
export {
  initializeRudderStack,
  isRudderStackEnabled,
  track,
  page,
  identify,
  alias,
  reset,
  setAnonymousId,
  group,
  getRudderAnalytics,
} from './rudderstack-client'

// Server-side analytics (for use in API routes, hooks, server actions)
export {
  trackServer,
  identifyServer,
  aliasServer,
  groupServer,
  flushServer,
  // Predefined server events
  trackProductLookup,
  trackReportGenerated,
  trackUserSignup,
  trackSubscription,
  trackVote,
} from './rudderstack-server'
