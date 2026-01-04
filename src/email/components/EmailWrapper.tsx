import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import * as React from 'react'

interface EmailWrapperProps {
  preview: string
  children: React.ReactNode
}

// Brand colors
const colors = {
  forest: '#1A4D2E',
  forestLight: '#166534',
  accent: '#86EFAC',
  background: '#F8FAFC',
  text: '#1a1a1a',
  textSecondary: '#64748B',
  border: '#E2E8F0',
}

export function EmailWrapper({ preview, children }: EmailWrapperProps) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Heading style={headerTitle}>THE PRODUCT REPORT</Heading>
            <Text style={headerTagline}>Lab-Tested &bull; Member-Funded &bull; Brand-Free</Text>
          </Section>

          {/* Content */}
          <Section style={content}>{children}</Section>

          {/* Footer */}
          <Section style={footer}>
            <Section style={socialLinks}>
              <Link href="https://x.com/theproductreport" style={socialLink}>
                <Img
                  src="https://www.theproductreport.org/icons/x-logo.png"
                  alt="X"
                  width="24"
                  height="24"
                  style={socialIcon}
                />
              </Link>
              <Link href="https://instagram.com/theproductreport" style={socialLink}>
                <Img
                  src="https://www.theproductreport.org/icons/instagram.png"
                  alt="Instagram"
                  width="24"
                  height="24"
                  style={socialIcon}
                />
              </Link>
              <Link href="https://youtube.com/@theproductreport" style={socialLink}>
                <Img
                  src="https://www.theproductreport.org/icons/youtube.png"
                  alt="YouTube"
                  width="24"
                  height="24"
                  style={socialIcon}
                />
              </Link>
            </Section>
            <Text style={footerText}>
              &copy; {new Date().getFullYear()} The Product Report. All rights reserved.
            </Text>
            <Text style={footerLinks}>
              <Link href="https://www.theproductreport.org/account" style={footerLink}>
                Manage Preferences
              </Link>
              {' • '}
              <Link href="https://www.theproductreport.org/privacy" style={footerLink}>
                Privacy Policy
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

// Styles
const main = {
  backgroundColor: colors.background,
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
}

const container = {
  maxWidth: '600px',
  margin: '0 auto',
  backgroundColor: '#ffffff',
}

const header = {
  backgroundColor: colors.forest,
  padding: '24px',
  textAlign: 'center' as const,
}

const headerTitle = {
  margin: '0',
  color: '#ffffff',
  fontFamily: 'Georgia, serif',
  fontSize: '24px',
  fontWeight: 'bold' as const,
  letterSpacing: '1px',
}

const headerTagline = {
  margin: '8px 0 0 0',
  color: colors.accent,
  fontSize: '12px',
  textTransform: 'uppercase' as const,
  letterSpacing: '2px',
}

const content = {
  padding: '40px 32px',
}

const footer = {
  padding: '24px',
  backgroundColor: colors.background,
  borderTop: `1px solid ${colors.border}`,
}

const socialLinks = {
  textAlign: 'center' as const,
  marginBottom: '20px',
}

const socialLink = {
  display: 'inline-block',
  margin: '0 8px',
}

const socialIcon = {
  opacity: 0.6,
}

const footerText = {
  color: colors.textSecondary,
  fontSize: '12px',
  textAlign: 'center' as const,
  margin: '0 0 8px 0',
}

const footerLinks = {
  color: colors.textSecondary,
  fontSize: '12px',
  textAlign: 'center' as const,
  margin: '0',
}

const footerLink = {
  color: colors.textSecondary,
  textDecoration: 'none',
}

export default EmailWrapper
