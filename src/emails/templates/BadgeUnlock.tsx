/**
 * Badge Unlock Email Template
 *
 * Sent when a user unlocks a new achievement badge.
 */

import * as React from 'react'
import {
  EmailLayout,
  EmailH1,
  EmailText,
  EmailButton,
  EmailDivider,
  Section,
  Img,
} from '../components'

interface BadgeUnlockProps {
  userName?: string
  badgeName: string
  badgeEmoji: string
  badgeDescription: string
  badgeImageUrl?: string
  totalBadges: number
  nextBadgeHint?: string
}

export const BadgeUnlock: React.FC<BadgeUnlockProps> = ({
  userName,
  badgeName,
  badgeEmoji,
  badgeDescription,
  badgeImageUrl,
  totalBadges,
  nextBadgeHint,
}) => {
  const greeting = userName ? `Congrats, ${userName.split(' ')[0]}!` : 'Congrats!'

  return (
    <EmailLayout previewText={`You just unlocked the ${badgeName} badge! ${badgeEmoji}`}>
      <Section style={celebrationHeader}>
        <span style={bigEmoji}>{badgeEmoji}</span>
      </Section>

      <EmailH1 align="center">{greeting}</EmailH1>

      <EmailText align="center">
        You just unlocked a new badge!
      </EmailText>

      <Section style={badgeCard}>
        {badgeImageUrl && (
          <Img
            src={badgeImageUrl}
            alt={badgeName}
            width={120}
            height={120}
            style={badgeImage}
          />
        )}
        <div style={badgeTitle}>{badgeName}</div>
        <div style={badgeDesc}>{badgeDescription}</div>
      </Section>

      <EmailText align="center" muted>
        You now have <strong>{totalBadges} badge{totalBadges > 1 ? 's' : ''}</strong> in your collection.
      </EmailText>

      {nextBadgeHint && (
        <>
          <EmailDivider />
          <EmailText align="center" small>
            <strong>Next up:</strong> {nextBadgeHint}
          </EmailText>
        </>
      )}

      <Section style={{ textAlign: 'center', margin: '24px 0' }}>
        <EmailButton href="https://www.theproductreport.org/profile/badges">
          View Your Badges
        </EmailButton>
      </Section>

      <EmailDivider />

      <EmailText muted small align="center">
        Keep scanning to unlock more achievements!
      </EmailText>
    </EmailLayout>
  )
}

// Styles
const celebrationHeader = {
  textAlign: 'center' as const,
  padding: '16px 0',
}

const bigEmoji = {
  fontSize: '64px',
  lineHeight: '1',
}

const badgeCard = {
  backgroundColor: '#f8fafc',
  border: '2px solid #e2e8f0',
  borderRadius: '16px',
  padding: '32px',
  margin: '24px 0',
  textAlign: 'center' as const,
}

const badgeImage = {
  margin: '0 auto 16px',
  display: 'block',
}

const badgeTitle = {
  color: '#0f172a',
  fontSize: '24px',
  fontWeight: '700',
  margin: '0 0 8px',
}

const badgeDesc = {
  color: '#64748b',
  fontSize: '15px',
  lineHeight: '22px',
}

export default BadgeUnlock
