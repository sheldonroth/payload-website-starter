import React from 'react'

import { HeaderThemeProvider } from './HeaderTheme'
import { IntercomProvider } from './Intercom'
import { ThemeProvider } from './Theme'

export const Providers: React.FC<{
  children: React.ReactNode
}> = ({ children }) => {
  return (
    <ThemeProvider>
      <HeaderThemeProvider>
        <IntercomProvider>{children}</IntercomProvider>
      </HeaderThemeProvider>
    </ThemeProvider>
  )
}
