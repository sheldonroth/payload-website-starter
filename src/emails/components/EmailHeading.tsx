/**
 * Email Heading Components
 *
 * Styled headings for emails.
 */

import { Heading, Text } from '@react-email/components'
import * as React from 'react'

interface HeadingProps {
  children?: React.ReactNode
  align?: 'left' | 'center' | 'right'
}

export const EmailH1: React.FC<HeadingProps> = ({ children, align = 'left' }) => (
  <Heading
    as="h1"
    style={{
      ...h1Style,
      textAlign: align,
    }}
  >
    {children}
  </Heading>
)

export const EmailH2: React.FC<HeadingProps> = ({ children, align = 'left' }) => (
  <Heading
    as="h2"
    style={{
      ...h2Style,
      textAlign: align,
    }}
  >
    {children}
  </Heading>
)

export const EmailH3: React.FC<HeadingProps> = ({ children, align = 'left' }) => (
  <Heading
    as="h3"
    style={{
      ...h3Style,
      textAlign: align,
    }}
  >
    {children}
  </Heading>
)

interface TextProps {
  children?: React.ReactNode
  muted?: boolean
  small?: boolean
  align?: 'left' | 'center' | 'right'
}

export const EmailText: React.FC<TextProps> = ({
  children,
  muted = false,
  small = false,
  align = 'left',
}) => (
  <Text
    style={{
      ...textStyle,
      color: muted ? '#64748b' : '#0f172a',
      fontSize: small ? '14px' : '16px',
      textAlign: align,
    }}
  >
    {children}
  </Text>
)

// Styles
const h1Style = {
  color: '#0f172a',
  fontSize: '28px',
  fontWeight: '700',
  lineHeight: '36px',
  margin: '0 0 16px',
}

const h2Style = {
  color: '#0f172a',
  fontSize: '22px',
  fontWeight: '600',
  lineHeight: '28px',
  margin: '0 0 12px',
}

const h3Style = {
  color: '#0f172a',
  fontSize: '18px',
  fontWeight: '600',
  lineHeight: '24px',
  margin: '0 0 8px',
}

const textStyle = {
  lineHeight: '24px',
  margin: '0 0 16px',
}

export default { EmailH1, EmailH2, EmailH3, EmailText }
