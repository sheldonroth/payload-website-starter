/**
 * Email Divider Component
 *
 * Styled horizontal rule for email sections.
 */

import { Hr } from '@react-email/components'
import * as React from 'react'

interface DividerProps {
  spacing?: 'sm' | 'md' | 'lg'
}

export const EmailDivider: React.FC<DividerProps> = ({ spacing = 'md' }) => {
  const margins = {
    sm: '12px 0',
    md: '24px 0',
    lg: '32px 0',
  }

  return (
    <Hr
      style={{
        borderColor: '#e2e8f0',
        borderWidth: '1px 0 0 0',
        margin: margins[spacing],
      }}
    />
  )
}

export default EmailDivider
