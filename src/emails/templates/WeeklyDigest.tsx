/**
 * Weekly Digest Email Template
 *
 * Sent every week with product updates, new tests, and highlights.
 */

import * as React from 'react'
import {
  EmailLayout,
  EmailH1,
  EmailH2,
  EmailText,
  EmailButton,
  EmailProductCard,
  EmailStats,
  EmailDivider,
  EmailCallout,
  Section,
} from '../components'

interface WeeklyDigestProps {
  userName?: string
  weekNumber: number
  stats: {
    productsScanned: number
    newTests: number
    savedProducts: number
  }
  featuredProducts: Array<{
    name: string
    brand: string
    imageUrl?: string
    verdict: 'recommended' | 'acceptable' | 'not-recommended' | 'pending'
    href: string
    reason?: string
  }>
  topPick?: {
    name: string
    brand: string
    imageUrl?: string
    href: string
    reason: string
  }
  unsubscribeUrl?: string
}

export const WeeklyDigest: React.FC<WeeklyDigestProps> = ({
  userName,
  weekNumber,
  stats,
  featuredProducts,
  topPick,
}) => {
  const greeting = userName ? `Hey ${userName.split(' ')[0]}` : 'Hey there'

  return (
    <EmailLayout previewText={`Week ${weekNumber}: ${stats.newTests} new product tests + your personalized picks`}>
      <EmailH1>{greeting}, here's your weekly digest</EmailH1>

      <EmailText>
        Here's what happened in the world of clean products this week.
        We've been busy testing so you can shop with confidence.
      </EmailText>

      <EmailStats
        stats={[
          { label: 'New Tests', value: stats.newTests, change: 'this week', positive: true },
          { label: 'Products Scanned', value: stats.productsScanned.toLocaleString() },
          { label: 'Your Saves', value: stats.savedProducts },
        ]}
      />

      {topPick && (
        <>
          <EmailDivider />
          <EmailH2>Top Pick of the Week</EmailH2>
          <EmailCallout variant="success" icon="⭐">
            Our testers loved this one: {topPick.reason}
          </EmailCallout>
          <EmailProductCard
            name={topPick.name}
            brand={topPick.brand}
            imageUrl={topPick.imageUrl}
            verdict="recommended"
            href={topPick.href}
          />
        </>
      )}

      <EmailDivider />

      <EmailH2>Recently Tested Products</EmailH2>
      <EmailText muted>
        Fresh from our lab — see how these products scored.
      </EmailText>

      {featuredProducts.slice(0, 5).map((product, index) => (
        <EmailProductCard key={index} {...product} />
      ))}

      <Section style={{ textAlign: 'center', marginTop: '24px' }}>
        <EmailButton href="https://www.theproductreport.org/products">
          View All Products
        </EmailButton>
      </Section>

      <EmailDivider />

      <EmailText muted small align="center">
        See you next week! Keep scanning, keep discovering.
      </EmailText>
    </EmailLayout>
  )
}

export default WeeklyDigest
