'use client'

/**
 * Analytics Provider
 *
 * Initializes RudderStack CDP on the client side for website analytics.
 * Tracks page views automatically on route changes.
 */

import type { ApiObject, IdentifyTraits } from '@rudderstack/analytics-js'
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import {
  initializeRudderStack,
  isRudderStackEnabled,
  page,
  identify,
  track,
  reset,
  setAnonymousId,
} from '@/lib/analytics/rudderstack-client'
import { getFingerprint } from '@/lib/fingerprint/client'

interface AnalyticsContextValue {
  isInitialized: boolean
  trackEvent: (eventName: string, properties?: ApiObject) => void
  identifyUser: (userId: string, traits?: IdentifyTraits) => void
  resetUser: () => void
  setAnonymousUserId: (anonymousId: string) => void
}

const AnalyticsContext = createContext<AnalyticsContextValue>({
  isInitialized: false,
  trackEvent: () => {},
  identifyUser: () => {},
  resetUser: () => {},
  setAnonymousUserId: () => {},
})

export const AnalyticsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isInitialized, setIsInitialized] = useState(false)
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Initialize RudderStack on mount
  useEffect(() => {
    const init = async () => {
      const rudderOk = initializeRudderStack()
      setIsInitialized(rudderOk)

      // Set fingerprint as anonymous ID for cross-platform identity
      if (rudderOk) {
        const fingerprint = await getFingerprint()
        if (fingerprint) {
          setAnonymousId(fingerprint)
          console.log('[Analytics] Set fingerprint as anonymous ID for cross-platform identity')
        }
      }
    }

    init()
  }, [])

  // Track page views on route changes
  useEffect(() => {
    if (!isInitialized || !isRudderStackEnabled()) return

    // Build page properties
    const url = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : '')
    const pageProperties: ApiObject = {
      path: pathname,
      url,
      referrer: typeof document !== 'undefined' ? document.referrer : undefined,
    }

    // Track the page view
    page('Website', pathname, pageProperties)
  }, [pathname, searchParams, isInitialized])

  // Wrapped tracking functions
  const trackEvent = useCallback(
    (eventName: string, properties?: ApiObject) => {
      if (!isInitialized) return
      track(eventName, properties)
    },
    [isInitialized],
  )

  const identifyUser = useCallback(
    (userId: string, traits?: IdentifyTraits) => {
      if (!isInitialized) return
      identify(userId, traits)
    },
    [isInitialized],
  )

  const resetUser = useCallback(() => {
    if (!isInitialized) return
    reset()
  }, [isInitialized])

  const setAnonymousUserId = useCallback(
    (anonymousId: string) => {
      if (!isInitialized) return
      setAnonymousId(anonymousId)
    },
    [isInitialized],
  )

  const value: AnalyticsContextValue = {
    isInitialized,
    trackEvent,
    identifyUser,
    resetUser,
    setAnonymousUserId,
  }

  return <AnalyticsContext.Provider value={value}>{children}</AnalyticsContext.Provider>
}

/**
 * Hook to access analytics context
 */
export const useAnalytics = (): AnalyticsContextValue => {
  return useContext(AnalyticsContext)
}
