import { Button, Heading, Section, Text } from '@react-email/components'
import * as React from 'react'
import { EmailWrapper } from '../components/EmailWrapper'

interface OneShotReceiptProps {
  userName: string
  productName: string
  productSlug: string
}

export function OneShotReceipt({
  userName = 'there',
  productName = 'Product',
  productSlug = 'product',
}: OneShotReceiptProps) {
  return (
    <EmailWrapper preview={`Your free report: ${productName}`}>
      <Text style={paragraph}>Hi {userName},</Text>

      <Text style={paragraph}>
        You just unlocked <strong>{productName}</strong>. This was your one free report.
      </Text>

      <Section style={accessBox}>
        <Text style={accessBoxTitle}>What you now have access to:</Text>
        <Text style={accessBoxItem}>&bull; Full lab test results</Text>
        <Text style={accessBoxItem}>&bull; Complete ingredient analysis</Text>
        <Text style={accessBoxItem}>&bull; Safety verdict with explanation</Text>
      </Section>

      <Button href={`https://www.theproductreport.org/products/${productSlug}`} style={button}>
        VIEW YOUR REPORT
      </Button>

      <Heading as="h3" style={subheading}>
        Want unlimited access?
      </Heading>

      <Text style={paragraphSecondary}>
        Members get full access to every product report, lab certificate, and ingredient analysis.
        Join thousands who trust The Product Report.
      </Text>

      <Button href="https://www.theproductreport.org/subscribe" style={buttonSecondary}>
        BECOME A MEMBER
      </Button>
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

const paragraphSecondary = {
  fontFamily: 'Georgia, serif',
  fontSize: '16px',
  lineHeight: '1.6',
  color: '#666666',
  marginBottom: '24px',
}

const accessBox = {
  backgroundColor: '#f0fdf4',
  borderLeft: '4px solid #1A4D2E',
  padding: '20px',
  marginBottom: '32px',
}

const accessBoxTitle = {
  fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
  fontSize: '16px',
  fontWeight: 'bold' as const,
  color: '#166534',
  margin: '0 0 12px 0',
}

const accessBoxItem = {
  fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
  fontSize: '15px',
  color: '#166534',
  margin: '0 0 8px 0',
  paddingLeft: '8px',
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
  marginBottom: '40px',
}

const buttonSecondary = {
  display: 'inline-block',
  backgroundColor: '#ffffff',
  color: '#1A4D2E',
  padding: '14px 28px',
  fontSize: '14px',
  fontWeight: '600' as const,
  borderRadius: '8px',
  border: '2px solid #1A4D2E',
  textDecoration: 'none',
  textAlign: 'center' as const,
}

const subheading = {
  fontFamily: 'Georgia, serif',
  fontSize: '18px',
  fontWeight: 'bold' as const,
  color: '#1a1a1a',
  marginTop: '32px',
  marginBottom: '12px',
}

export default OneShotReceipt
