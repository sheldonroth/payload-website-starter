/**
 * Welcome Email Template
 *
 * Sent when a new user signs up.
 */

import * as React from 'react'
import {
  EmailLayout,
  EmailH1,
  EmailH2,
  EmailText,
  EmailButton,
  EmailDivider,
  EmailCallout,
  Section,
  Column,
  Row,
} from '../components'

interface WelcomeEmailProps {
  userName?: string
  freeUnlocks: number
}

export const WelcomeEmail: React.FC<WelcomeEmailProps> = ({
  userName,
  freeUnlocks = 1,
}) => {
  const greeting = userName ? `Welcome, ${userName.split(' ')[0]}!` : 'Welcome!'

  return (
    <EmailLayout previewText="You're in! Here's how to get the most out of The Product Report.">
      <EmailH1>{greeting}</EmailH1>

      <EmailText>
        You've just joined thousands of consumers who care about what's really in their products.
        We're excited to have you.
      </EmailText>

      <EmailCallout variant="success" icon="🎁">
        You have <strong>{freeUnlocks} free product unlock{freeUnlocks > 1 ? 's' : ''}</strong> waiting for you.
        Use it to see the full analysis of any product!
      </EmailCallout>

      <Section style={{ textAlign: 'center', margin: '24px 0' }}>
        <EmailButton href="https://www.theproductreport.org/products">
          Start Exploring Products
        </EmailButton>
      </Section>

      <EmailDivider />

      <EmailH2>Here's what you can do</EmailH2>

      <Section style={featureRow}>
        <Row>
          <Column style={featureIcon}>📱</Column>
          <Column style={featureContent}>
            <strong>Scan any barcode</strong>
            <br />
            Get instant insights on ingredients and safety.
          </Column>
        </Row>
      </Section>

      <Section style={featureRow}>
        <Row>
          <Column style={featureIcon}>⭐</Column>
          <Column style={featureContent}>
            <strong>Save your favorites</strong>
            <br />
            Build your clean shopping list.
          </Column>
        </Row>
      </Section>

      <Section style={featureRow}>
        <Row>
          <Column style={featureIcon}>🔔</Column>
          <Column style={featureContent}>
            <strong>Get alerts</strong>
            <br />
            We'll notify you when products you care about are re-tested.
          </Column>
        </Row>
      </Section>

      <Section style={featureRow}>
        <Row>
          <Column style={featureIcon}>🏆</Column>
          <Column style={featureContent}>
            <strong>Earn badges</strong>
            <br />
            Unlock achievements as you discover more products.
          </Column>
        </Row>
      </Section>

      <EmailDivider />

      <EmailText muted small align="center">
        Questions? Just reply to this email — we read every message.
      </EmailText>
    </EmailLayout>
  )
}

// Styles
const featureRow = {
  margin: '0 0 16px',
}

const featureIcon = {
  width: '40px',
  fontSize: '24px',
  verticalAlign: 'top' as const,
}

const featureContent = {
  paddingLeft: '8px',
  fontSize: '15px',
  lineHeight: '22px',
  color: '#334155',
}

export default WelcomeEmail
