import { Button, Heading, Text } from '@react-email/components'
import * as React from 'react'
import { EmailWrapper } from '../components/EmailWrapper'

interface WelcomeEmailProps {
  name: string
}

export function WelcomeEmail({ name = 'there' }: WelcomeEmailProps) {
  return (
    <EmailWrapper preview="You just took back control">
      <Text style={paragraph}>Hi {name},</Text>

      <Text style={paragraph}>
        Most people trust labels. They trust marketing. They trust that someone, somewhere, is
        checking.
      </Text>

      <Text style={paragraphBold}>You just said no to that.</Text>

      <Text style={paragraph}>
        The Product Report exists because the old system is broken. Brands pay for reviews.
        Influencers sell trust. And consumers? They&apos;re left guessing.
      </Text>

      <Text style={paragraph}>We do things differently.</Text>

      <Text style={paragraph}>
        We buy every product ourselves. Send it to certified labs. Publish real results. Take $0
        from brands.
      </Text>

      <Text style={paragraph}>This only works because people like you believe it should exist.</Text>

      <Text style={paragraph}>Welcome to the Watchdogs.</Text>

      <Button href="https://www.theproductreport.org/browse" style={button}>
        START EXPLORING
      </Button>

      <Text style={signature}>&mdash;The Product Report Team</Text>

      <Text style={ps}>P.S. Reply anytime. We read everything.</Text>
    </EmailWrapper>
  )
}

// Styles
const paragraph = {
  fontFamily: 'Georgia, serif',
  fontSize: '18px',
  lineHeight: '1.8',
  color: '#1a1a1a',
  marginBottom: '24px',
}

const paragraphBold = {
  ...paragraph,
  fontWeight: 'bold' as const,
}

const button = {
  display: 'inline-block',
  backgroundColor: '#1A4D2E',
  color: '#ffffff',
  padding: '16px 32px',
  fontSize: '14px',
  fontWeight: '600' as const,
  letterSpacing: '0.5px',
  borderRadius: '8px',
  textDecoration: 'none',
  textAlign: 'center' as const,
  marginTop: '16px',
  marginBottom: '40px',
}

const signature = {
  fontFamily: 'Georgia, serif',
  fontSize: '16px',
  color: '#666666',
  marginTop: '40px',
}

const ps = {
  fontFamily: 'Georgia, serif',
  fontSize: '14px',
  color: '#999999',
  fontStyle: 'italic' as const,
  marginTop: '24px',
}

export default WelcomeEmail
