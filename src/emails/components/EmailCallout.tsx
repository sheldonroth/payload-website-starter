/**
 * Email Callout Component
 *
 * Highlighted callout box for important information.
 */

import { Section, Text } from '@react-email/components'
import * as React from 'react'

interface CalloutProps {
  children?: React.ReactNode
  variant?: 'info' | 'success' | 'warning' | 'error'
  icon?: string
}

const variantConfig = {
  info: { bg: '#eff6ff', border: '#bfdbfe', color: '#1e40af', icon: 'ℹ️' },
  success: { bg: '#ecfdf5', border: '#a7f3d0', color: '#065f46', icon: '✅' },
  warning: { bg: '#fffbeb', border: '#fde68a', color: '#92400e', icon: '⚠️' },
  error: { bg: '#fef2f2', border: '#fecaca', color: '#991b1b', icon: '🚨' },
}

export const EmailCallout: React.FC<CalloutProps> = ({
  children,
  variant = 'info',
  icon,
}) => {
  const config = variantConfig[variant]

  return (
    <Section
      style={{
        backgroundColor: config.bg,
        borderLeft: `4px solid ${config.border}`,
        borderRadius: '0 8px 8px 0',
        padding: '16px 20px',
        margin: '0 0 24px',
      }}
    >
      <Text
        style={{
          color: config.color,
          fontSize: '15px',
          lineHeight: '24px',
          margin: '0',
        }}
      >
        {icon || config.icon} {children}
      </Text>
    </Section>
  )
}

export default EmailCallout
