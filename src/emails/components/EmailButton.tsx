/**
 * Email Button Component
 *
 * Styled CTA button for emails with proper fallbacks.
 */

import { Button } from '@react-email/components'
import * as React from 'react'

interface EmailButtonProps {
  href: string
  children?: React.ReactNode
  variant?: 'primary' | 'secondary' | 'outline'
}

export const EmailButton: React.FC<EmailButtonProps> = ({
  href,
  children,
  variant = 'primary',
}) => {
  const styles = {
    primary: {
      backgroundColor: '#059669',
      color: '#ffffff',
      border: 'none',
    },
    secondary: {
      backgroundColor: '#0f172a',
      color: '#ffffff',
      border: 'none',
    },
    outline: {
      backgroundColor: 'transparent',
      color: '#059669',
      border: '2px solid #059669',
    },
  }

  const variantStyle = styles[variant]

  return (
    <Button
      href={href}
      style={{
        ...baseStyle,
        ...variantStyle,
      }}
    >
      {children}
    </Button>
  )
}

const baseStyle = {
  display: 'inline-block',
  padding: '14px 32px',
  fontSize: '16px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  borderRadius: '8px',
}

export default EmailButton
