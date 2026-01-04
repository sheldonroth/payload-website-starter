import { Button, Heading, Text } from '@react-email/components'
import * as React from 'react'
import { EmailWrapper } from '../components/EmailWrapper'

interface PasswordResetProps {
  resetUrl: string
}

export function PasswordReset({
  resetUrl = 'https://www.theproductreport.org/reset-password',
}: PasswordResetProps) {
  return (
    <EmailWrapper preview="Reset your password">
      <Heading as="h1" style={heading}>
        Reset Your Password
      </Heading>

      <Text style={paragraph}>
        We received a request to reset the password for your account. Click the button below to
        create a new password.
      </Text>

      <Button href={resetUrl} style={button}>
        Reset Password
      </Button>

      <Text style={disclaimer}>
        This link will expire in 1 hour. If you didn&apos;t request this, you can safely ignore this
        email.
      </Text>
    </EmailWrapper>
  )
}

// Styles
const heading = {
  fontFamily: 'Georgia, serif',
  fontSize: '24px',
  fontWeight: '700' as const,
  color: '#0f172a',
  marginBottom: '20px',
}

const paragraph = {
  fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
  fontSize: '16px',
  lineHeight: '24px',
  color: '#475569',
  marginBottom: '24px',
}

const button = {
  display: 'inline-block',
  backgroundColor: '#059669',
  color: '#ffffff',
  padding: '14px 32px',
  fontSize: '16px',
  fontWeight: '600' as const,
  borderRadius: '8px',
  textDecoration: 'none',
  textAlign: 'center' as const,
  marginBottom: '24px',
}

const disclaimer = {
  fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
  fontSize: '14px',
  color: '#94a3b8',
  marginTop: '24px',
}

export default PasswordReset
