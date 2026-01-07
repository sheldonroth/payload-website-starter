/**
 * Email Template Test Send Endpoint
 *
 * Sends a test email to a specified address using a template.
 */

import type { PayloadHandler } from 'payload'
import { render } from '@react-email/components'
import { Resend } from 'resend'
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

const resend = new Resend(process.env.RESEND_API_KEY)

interface PreviewVariables {
  userName?: string
  productName?: string
  brandName?: string
  weekNumber?: number
  [key: string]: any
}

/**
 * Build email HTML from template
 */
function buildEmailHtml(template: any, variables: PreviewVariables) {
  const { sequence, subject, headline, body, ctaText, ctaUrl } = template

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

  const emailContent = React.createElement(
    EmailLayout,
    { previewText: substituteVariables(subject, variables), children }
  )

  return emailContent
}

function getSequenceSpecificContent(sequence: string, variables: PreviewVariables): React.ReactNode {
  switch (sequence) {
    case 'weekly_digest':
      return React.createElement(
        React.Fragment,
        { key: 'weekly-content' },
        React.createElement(EmailDivider, { key: 'divider' }),
        React.createElement(EmailH2, { key: 'h2' }, 'This Week\'s Top Picks'),
        React.createElement(
          EmailProductCard,
          {
            key: 'product',
            name: variables.productName || 'Sample Product',
            brand: variables.brandName || 'Sample Brand',
            verdict: 'recommended' as const,
            href: 'https://www.theproductreport.org/products',
            reason: 'Clean ingredients, no concerns detected.',
          }
        )
      )
    case 'fomo_trigger':
      return React.createElement(
        EmailCallout,
        { key: 'fomo', variant: 'warning' as const, icon: '🔔', children: 'This product has been re-tested with new findings!' }
      )
    case 'badge_unlock':
      return React.createElement(
        EmailCallout,
        { key: 'badge', variant: 'success' as const, icon: '🏆', children: 'You\'ve unlocked a new achievement badge!' }
      )
    default:
      return null
  }
}

function substituteVariables(text: string, variables: PreviewVariables): string {
  if (!text) return ''
  return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return variables[key] !== undefined ? String(variables[key]) : match
  })
}

function extractTextFromRichText(richText: any): string {
  if (!richText?.root?.children) return ''
  function extractFromNode(node: any): string {
    if (node.text) return node.text
    if (node.children) return node.children.map(extractFromNode).join(' ')
    return ''
  }
  return richText.root.children.map(extractFromNode).join('\n\n')
}

export const emailTemplateTestHandler: PayloadHandler = async (req) => {
  const { payload, user } = req

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Only admins can send test emails
  const userData = user as { role?: string }
  if (userData.role !== 'admin') {
    return Response.json({ error: 'Admin access required' }, { status: 403 })
  }

  try {
    const body = await req.json?.()
    const { templateId, email, variables = {} } = body || {}

    if (!templateId || !email) {
      return Response.json(
        { error: 'Template ID and email required' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return Response.json({ error: 'Invalid email format' }, { status: 400 })
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
    const emailElement = buildEmailHtml(template, variables)
    const html = await render(emailElement)
    const subject = `[TEST] ${substituteVariables(template.subject, variables)}`

    // Send via Resend
    const { data, error } = await resend.emails.send({
      from: 'The Product Report <hello@theproductreport.org>',
      to: email,
      subject,
      html,
    })

    if (error) {
      console.error('[Email Test] Resend error:', error)
      return Response.json({ error: 'Failed to send email' }, { status: 500 })
    }

    // Log the test send
    console.log(`[Email Test] Sent test email to ${email}, messageId: ${data?.id}`)

    return Response.json({
      success: true,
      messageId: data?.id,
      message: `Test email sent to ${email}`,
    })
  } catch (error) {
    console.error('[Email Test] Error:', error)
    return Response.json(
      { error: 'Failed to send test email' },
      { status: 500 }
    )
  }
}

export const emailTemplateTestEndpoint = {
  path: '/email-template-test',
  method: 'post' as const,
  handler: emailTemplateTestHandler,
}

export default emailTemplateTestEndpoint
