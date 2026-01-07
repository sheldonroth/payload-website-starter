/**
 * Email Template Preview Endpoint
 *
 * Generates an HTML preview of an email template with variable substitution.
 */

import type { PayloadHandler } from 'payload'
import { render } from '@react-email/components'
import React from 'react'
import {
  EmailLayout,
  EmailH1,
  EmailH2,
  EmailText,
  EmailButton,
  EmailProductCard,
  EmailDivider,
  EmailCallout,
  Section,
} from '@/emails/components'

interface PreviewVariables {
  userName?: string
  productName?: string
  brandName?: string
  weekNumber?: number
  [key: string]: any
}

/**
 * Build a preview email based on template data
 */
function buildPreviewEmail(template: any, variables: PreviewVariables) {
  const { sequence, subject, headline, body, ctaText, ctaUrl } = template

  // Variable substitution
  const substitutedSubject = substituteVariables(subject, variables)
  const substitutedHeadline = substituteVariables(headline || subject, variables)

  // Build children array
  const children: React.ReactNode[] = [
    React.createElement(EmailH1, { key: 'h1' }, substitutedHeadline),
  ]

  if (body?.root?.children?.length > 0) {
    children.push(React.createElement(EmailText, { key: 'body' }, extractTextFromRichText(body)))
  }

  if (ctaText && ctaUrl) {
    children.push(
      React.createElement(
        Section,
        { key: 'cta', style: { textAlign: 'center' as const, marginTop: '24px' } },
        React.createElement(EmailButton, { href: ctaUrl, key: 'btn' }, ctaText)
      )
    )
  }

  const sequenceContent = getSequenceSpecificContent(sequence, variables)
  if (sequenceContent) {
    children.push(sequenceContent)
  }

  // Build the email
  const emailContent = React.createElement(
    EmailLayout,
    { previewText: substitutedSubject, children }
  )

  return emailContent
}

/**
 * Get sequence-specific content
 */
function getSequenceSpecificContent(sequence: string, variables: PreviewVariables): React.ReactNode {
  switch (sequence) {
    case 'weekly_digest':
      return React.createElement(
        React.Fragment,
        { key: 'weekly-digest-content' },
        React.createElement(EmailDivider, { key: 'divider' }),
        React.createElement(EmailH2, { key: 'h2' }, 'This Week\'s Top Picks'),
        React.createElement(
          EmailProductCard,
          {
            key: 'product1',
            name: variables.productName || 'Sample Product',
            brand: variables.brandName || 'Sample Brand',
            verdict: 'recommended' as const,
            href: 'https://www.theproductreport.org/products',
            reason: 'Clean ingredients, no concerns detected.',
          }
        ),
        React.createElement(
          EmailProductCard,
          {
            key: 'product2',
            name: 'Another Great Product',
            brand: 'Clean Co',
            verdict: 'acceptable' as const,
            href: 'https://www.theproductreport.org/products',
            reason: 'Minor concerns, but overall safe.',
          }
        )
      )

    case 'fomo_trigger':
      return React.createElement(
        React.Fragment,
        { key: 'fomo-content' },
        React.createElement(EmailDivider, { key: 'divider' }),
        React.createElement(
          EmailCallout,
          { key: 'callout', variant: 'warning' as const, icon: '🔔', children: 'This product has been re-tested with new findings!' }
        )
      )

    case 'badge_unlock':
      return React.createElement(
        React.Fragment,
        { key: 'badge-content' },
        React.createElement(EmailDivider, { key: 'divider' }),
        React.createElement(
          EmailCallout,
          { key: 'callout', variant: 'success' as const, icon: '🏆', children: 'You\'ve unlocked a new achievement badge!' }
        )
      )

    default:
      return null
  }
}

/**
 * Substitute {{variable}} placeholders
 */
function substituteVariables(text: string, variables: PreviewVariables): string {
  if (!text) return ''

  return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return variables[key] !== undefined ? String(variables[key]) : match
  })
}

/**
 * Extract plain text from Lexical rich text
 */
function extractTextFromRichText(richText: any): string {
  if (!richText?.root?.children) return ''

  function extractFromNode(node: any): string {
    if (node.text) return node.text
    if (node.children) {
      return node.children.map(extractFromNode).join(' ')
    }
    return ''
  }

  return richText.root.children.map(extractFromNode).join('\n\n')
}

export const emailTemplatePreviewHandler: PayloadHandler = async (req) => {
  const { payload, user } = req

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const url = new URL(req.url || '', `http://${req.headers.get('host') || 'localhost'}`)
    const templateId = url.searchParams.get('id')

    if (!templateId) {
      return Response.json({ error: 'Template ID required' }, { status: 400 })
    }

    // Get variables from request body
    let variables: PreviewVariables = {}
    try {
      const body = await req.json?.()
      variables = body?.variables || {}
    } catch {
      // No body or invalid JSON
    }

    // Fetch the template
    const template = await payload.findByID({
      collection: 'email-templates',
      id: templateId,
    })

    if (!template) {
      return Response.json({ error: 'Template not found' }, { status: 404 })
    }

    // Build and render the email
    const emailElement = buildPreviewEmail(template, variables)
    const html = await render(emailElement)

    return Response.json({
      html,
      subject: substituteVariables(template.subject, variables),
    })
  } catch (error) {
    console.error('[Email Preview] Error:', error)
    return Response.json(
      { error: 'Failed to generate preview' },
      { status: 500 }
    )
  }
}

export const emailTemplatePreviewEndpoint = {
  path: '/email-template-preview',
  method: 'post' as const,
  handler: emailTemplatePreviewHandler,
}

export default emailTemplatePreviewEndpoint
