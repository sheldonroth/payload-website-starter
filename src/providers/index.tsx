import React, { Suspense } from 'react'

import { AnalyticsProvider } from './Analytics'
import { HeaderThemeProvider } from './HeaderTheme'
import { IntercomProvider } from './Intercom'
import { ThemeProvider } from './Theme'

export const Providers: React.FC<{
  children: React.ReactNode
}> = ({ children }) => {
  return (
    <ThemeProvider>
      <HeaderThemeProvider>
        <Suspense fallback={null}>
          <AnalyticsProvider>
            <IntercomProvider>{children}</IntercomProvider>
          </AnalyticsProvider>
        </Suspense>
      </HeaderThemeProvider>
    </ThemeProvider>
  )
}
