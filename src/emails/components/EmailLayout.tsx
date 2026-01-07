/**
 * Base Email Layout Component
 *
 * Provides consistent branding and structure for all emails.
 * Uses React Email components for cross-client compatibility.
 */

import {
  Body,
  Container,
  Head,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import * as React from 'react'

interface EmailLayoutProps {
  previewText?: string
  children: React.ReactNode
}

const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'https://www.theproductreport.org'

export const EmailLayout: React.FC<EmailLayoutProps> = ({
  previewText,
  children,
}) => {
  return (
    <Html>
      <Head />
      {previewText && <Preview>{previewText}</Preview>}
      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Link href={baseUrl} style={logoLink}>
              <Text style={logoText}>The Product Report</Text>
            </Link>
          </Section>

          {/* Main Content */}
          <Section style={content}>
            {children}
          </Section>

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              You're receiving this email because you signed up for The Product Report.
            </Text>
            <Text style={footerLinks}>
              <Link href={`${baseUrl}/api/email-preferences`} style={footerLink}>
                Manage Preferences
              </Link>
              {' · '}
              <Link href={`${baseUrl}/privacy`} style={footerLink}>
                Privacy Policy
              </Link>
              {' · '}
              <Link href={baseUrl} style={footerLink}>
                Visit Website
              </Link>
            </Text>
            <Text style={copyright}>
              © {new Date().getFullYear()} The Product Report. All rights reserved.
            </Text>
            <Text style={tagline}>
              Independent product testing powered by members.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

// Styles
const main = {
  backgroundColor: '#f8fafc',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
}

const container = {
  maxWidth: '600px',
  margin: '0 auto',
  padding: '20px 0',
}

const header = {
  backgroundColor: '#065f46',
  backgroundImage: 'linear-gradient(135deg, #065f46 0%, #047857 100%)',
  padding: '32px 24px',
  borderRadius: '16px 16px 0 0',
  textAlign: 'center' as const,
}

const logoLink = {
  textDecoration: 'none',
}

const logoText = {
  color: '#ffffff',
  fontSize: '24px',
  fontWeight: '800',
  letterSpacing: '-0.5px',
  margin: '0',
}

const content = {
  backgroundColor: '#ffffff',
  padding: '40px 32px',
}

const footer = {
  backgroundColor: '#f8fafc',
  padding: '24px 32px',
  borderRadius: '0 0 16px 16px',
  borderTop: '1px solid #e2e8f0',
}

const footerText = {
  color: '#64748b',
  fontSize: '12px',
  lineHeight: '20px',
  margin: '0 0 12px',
  textAlign: 'center' as const,
}

const footerLinks = {
  color: '#64748b',
  fontSize: '12px',
  margin: '0 0 12px',
  textAlign: 'center' as const,
}

const footerLink = {
  color: '#059669',
  textDecoration: 'none',
}

const copyright = {
  color: '#94a3b8',
  fontSize: '11px',
  margin: '0',
  textAlign: 'center' as const,
}

const tagline = {
  color: '#94a3b8',
  fontSize: '11px',
  margin: '4px 0 0',
  textAlign: 'center' as const,
}

export default EmailLayout
