'use client'

import React, { useEffect, useState } from 'react'

/**
 * GDPR/CCPA Cookie Consent Banner
 *
 * Features:
 * - Respects Global Privacy Control (GPC) signals automatically
 * - Stores consent in localStorage (not cookies, to avoid circular dependency)
 * - Shows "Do Not Sell or Share My Personal Information" link (CCPA requirement)
 * - Easy to withdraw consent
 */

type ConsentState = 'pending' | 'accepted' | 'declined' | 'gpc-declined'

export const CookieConsent: React.FC = () => {
  const [consent, setConsent] = useState<ConsentState>('pending')
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Check for Global Privacy Control signal
    const gpcEnabled = (navigator as any).globalPrivacyControl === true

    if (gpcEnabled) {
      // Automatically respect GPC - don't show banner, just decline
      localStorage.setItem('cookie-consent', 'gpc-declined')
      localStorage.setItem('cookie-consent-date', new Date().toISOString())
      setConsent('gpc-declined')
      return
    }

    // Check existing consent
    const storedConsent = localStorage.getItem('cookie-consent') as ConsentState | null

    if (storedConsent) {
      setConsent(storedConsent)
    } else {
      // Show banner after a short delay
      setTimeout(() => setIsVisible(true), 1000)
    }
  }, [])

  const handleAccept = () => {
    localStorage.setItem('cookie-consent', 'accepted')
    localStorage.setItem('cookie-consent-date', new Date().toISOString())
    setConsent('accepted')
    setIsVisible(false)
  }

  const handleDecline = () => {
    localStorage.setItem('cookie-consent', 'declined')
    localStorage.setItem('cookie-consent-date', new Date().toISOString())
    setConsent('declined')
    setIsVisible(false)

    // Clear any existing tracking cookies
    clearTrackingCookies()
  }

  const clearTrackingCookies = () => {
    // Clear common analytics cookies
    const cookiesToClear = ['_ga', '_gid', '_gat', '_fbp', '_fbc']
    cookiesToClear.forEach(name => {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`
    })
  }

  if (!isVisible || consent !== 'pending') {
    return null
  }

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 shadow-lg"
      role="dialog"
      aria-label="Cookie consent"
    >
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-start md:items-center gap-4">
        <div className="flex-1">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            We use cookies to improve your experience and analyze site traffic.
            By clicking &quot;Accept&quot;, you consent to our use of cookies.
            You can change your preferences at any time.{' '}
            <a
              href="/privacy"
              className="text-emerald-600 dark:text-emerald-400 underline hover:no-underline"
            >
              Privacy Policy
            </a>
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            California residents:{' '}
            <button
              onClick={handleDecline}
              className="text-emerald-600 dark:text-emerald-400 underline hover:no-underline"
            >
              Do Not Sell or Share My Personal Information
            </button>
          </p>
        </div>
        <div className="flex gap-3 shrink-0">
          <button
            onClick={handleDecline}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            Decline
          </button>
          <button
            onClick={handleAccept}
            className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Hook to check if user has consented to cookies
 * Returns true only if user explicitly accepted (not GPC declined)
 */
export function useCookieConsent(): boolean {
  const [hasConsent, setHasConsent] = useState(false)

  useEffect(() => {
    const consent = localStorage.getItem('cookie-consent')
    setHasConsent(consent === 'accepted')
  }, [])

  return hasConsent
}

/**
 * Check if GPC is enabled (for server-side or immediate checks)
 */
export function isGPCEnabled(): boolean {
  if (typeof navigator === 'undefined') return false
  return (navigator as any).globalPrivacyControl === true
}
