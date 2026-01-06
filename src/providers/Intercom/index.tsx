'use client'

import { useEffect } from 'react'
import Intercom from '@intercom/messenger-js-sdk'

export const IntercomProvider: React.FC<{
  children: React.ReactNode
}> = ({ children }) => {
  useEffect(() => {
    // Initialize Intercom for anonymous visitors
    // When you have user authentication, you can pass user data here
    Intercom({
      app_id: process.env.NEXT_PUBLIC_INTERCOM_APP_ID || 'bxcqvcfl',
    })

    // Cleanup on unmount
    return () => {
      if (typeof window !== 'undefined' && window.Intercom) {
        window.Intercom('shutdown')
      }
    }
  }, [])

  return <>{children}</>
}
