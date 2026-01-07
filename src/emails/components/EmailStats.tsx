/**
 * Email Stats Component
 *
 * Display metrics/stats in a nice grid for weekly digests.
 */

import { Column, Row, Section, Text } from '@react-email/components'
import * as React from 'react'

interface Stat {
  label: string
  value: string | number
  change?: string
  positive?: boolean
}

interface EmailStatsProps {
  stats: Stat[]
}

export const EmailStats: React.FC<EmailStatsProps> = ({ stats }) => {
  return (
    <Section style={container}>
      <Row>
        {stats.map((stat, index) => (
          <Column key={index} style={statColumn}>
            <Text style={valueText}>{stat.value}</Text>
            <Text style={labelText}>{stat.label}</Text>
            {stat.change && (
              <Text
                style={{
                  ...changeText,
                  color: stat.positive ? '#059669' : '#dc2626',
                }}
              >
                {stat.positive ? '↑' : '↓'} {stat.change}
              </Text>
            )}
          </Column>
        ))}
      </Row>
    </Section>
  )
}

// Styles
const container = {
  backgroundColor: '#f8fafc',
  borderRadius: '12px',
  padding: '20px',
  margin: '0 0 24px',
}

const statColumn = {
  textAlign: 'center' as const,
  padding: '0 8px',
}

const valueText = {
  color: '#0f172a',
  fontSize: '28px',
  fontWeight: '700',
  margin: '0',
  lineHeight: '32px',
}

const labelText = {
  color: '#64748b',
  fontSize: '13px',
  fontWeight: '500',
  margin: '4px 0 0',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
}

const changeText = {
  fontSize: '12px',
  fontWeight: '600',
  margin: '4px 0 0',
}

export default EmailStats
