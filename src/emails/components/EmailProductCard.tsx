/**
 * Email Product Card Component
 *
 * Display a product with verdict badge in emails.
 */

import { Column, Img, Link, Row, Section, Text } from '@react-email/components'
import * as React from 'react'

interface ProductCardProps {
  name: string
  brand: string
  imageUrl?: string
  verdict?: 'recommended' | 'acceptable' | 'not-recommended' | 'pending'
  href: string
  reason?: string
}

const verdictConfig = {
  'recommended': { label: 'Recommended', color: '#059669', bg: '#ecfdf5' },
  'acceptable': { label: 'Acceptable', color: '#d97706', bg: '#fffbeb' },
  'not-recommended': { label: 'Not Recommended', color: '#dc2626', bg: '#fef2f2' },
  'pending': { label: 'Under Review', color: '#6b7280', bg: '#f3f4f6' },
}

export const EmailProductCard: React.FC<ProductCardProps> = ({
  name,
  brand,
  imageUrl,
  verdict = 'pending',
  href,
  reason,
}) => {
  const config = verdictConfig[verdict]

  return (
    <Section style={cardContainer}>
      <Link href={href} style={cardLink}>
        <Row>
          {imageUrl && (
            <Column style={imageColumn}>
              <Img
                src={imageUrl}
                alt={name}
                width={80}
                height={80}
                style={productImage}
              />
            </Column>
          )}
          <Column style={contentColumn}>
            <Text style={brandText}>{brand}</Text>
            <Text style={nameText}>{name}</Text>
            <Text
              style={{
                ...verdictBadge,
                color: config.color,
                backgroundColor: config.bg,
              }}
            >
              {config.label}
            </Text>
            {reason && <Text style={reasonText}>{reason}</Text>}
          </Column>
        </Row>
      </Link>
    </Section>
  )
}

// Styles
const cardContainer = {
  backgroundColor: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: '12px',
  padding: '16px',
  margin: '0 0 12px',
}

const cardLink = {
  textDecoration: 'none',
}

const imageColumn = {
  width: '80px',
  verticalAlign: 'top' as const,
}

const contentColumn = {
  paddingLeft: '16px',
  verticalAlign: 'top' as const,
}

const productImage = {
  borderRadius: '8px',
  objectFit: 'cover' as const,
}

const brandText = {
  color: '#64748b',
  fontSize: '12px',
  fontWeight: '500',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
  margin: '0 0 4px',
}

const nameText = {
  color: '#0f172a',
  fontSize: '16px',
  fontWeight: '600',
  margin: '0 0 8px',
  lineHeight: '20px',
}

const verdictBadge = {
  display: 'inline-block',
  fontSize: '12px',
  fontWeight: '600',
  padding: '4px 10px',
  borderRadius: '9999px',
  margin: '0',
}

const reasonText = {
  color: '#64748b',
  fontSize: '13px',
  margin: '8px 0 0',
  lineHeight: '18px',
}

export default EmailProductCard
