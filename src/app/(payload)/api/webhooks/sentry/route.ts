import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

/**
 * Sentry Webhook Endpoint
 *
 * Receives webhook events from Sentry when issues are:
 * - created: New issue detected
 * - resolved: Issue marked as resolved
 * - assigned: Issue assigned to a team member
 * - archived: Issue archived
 * - unresolved: Issue reopened
 *
 * Configure this URL in Sentry:
 * https://payload-website-starter-smoky-sigma.vercel.app/api/webhooks/sentry
 */

interface SentryIssue {
  id: string
  shortId: string
  title: string
  culprit: string
  permalink: string
  firstSeen: string
  lastSeen: string
  count: string
  userCount: number
  level: 'fatal' | 'error' | 'warning' | 'info' | 'debug'
  status: 'resolved' | 'unresolved' | 'ignored'
  isUnhandled: boolean
  metadata: {
    type?: string
    value?: string
    filename?: string
    function?: string
  }
  project: {
    id: string
    name: string
    slug: string
  }
}

interface SentryEvent {
  eventID: string
  context: Record<string, unknown>
  dateCreated: string
  user: {
    id?: string
    email?: string
    username?: string
    ip_address?: string
  } | null
  tags: Array<{ key: string; value: string }>
  platform: string
  message?: string
}

interface SentryWebhookPayload {
  action: string
  installation: {
    uuid: string
  }
  data: {
    issue?: SentryIssue
    event?: SentryEvent
  }
  actor: {
    type: string
    id?: string
    name?: string
  }
}

const LOG_PREFIX = '[Sentry Webhook]'

/**
 * Verify the webhook signature (optional but recommended)
 * The signature is sent in the 'sentry-hook-signature' header
 */
function verifySignature(payload: string, signature: string | null, secret: string): boolean {
  if (!signature || !secret) {
    return true // Skip verification if not configured
  }

  // Sentry uses HMAC-SHA256 for webhook signatures
  const crypto = require('crypto')
  const expectedSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex')

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text()
    const signature = request.headers.get('sentry-hook-signature')
    const secret = process.env.SENTRY_WEBHOOK_SECRET

    // Verify webhook signature
    if (secret && !verifySignature(rawBody, signature, secret)) {
      console.error(`${LOG_PREFIX} Invalid webhook signature`)
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const payload: SentryWebhookPayload = JSON.parse(rawBody)
    const { action, data, actor } = payload

    console.log(`${LOG_PREFIX} Received ${action} event`, {
      issueId: data.issue?.shortId,
      issueTitle: data.issue?.title,
      actorType: actor.type,
    })

    const payloadCMS = await getPayload({ config: configPromise })

    switch (action) {
      case 'created':
        // New issue created - potentially alert admin or log to audit
        if (data.issue) {
          console.log(`${LOG_PREFIX} New issue: ${data.issue.title}`, {
            level: data.issue.level,
            count: data.issue.count,
            permalink: data.issue.permalink,
          })

          // Log to audit collection if it exists
          try {
            await payloadCMS.create({
              collection: 'audit-log' as any,
              data: {
                action: 'sentry_issue_created',
                resource: 'sentry',
                resourceId: data.issue.id,
                details: {
                  shortId: data.issue.shortId,
                  title: data.issue.title,
                  level: data.issue.level,
                  project: data.issue.project?.name,
                  permalink: data.issue.permalink,
                },
                timestamp: new Date().toISOString(),
              } as any,
            })
          } catch (auditError) {
            // Audit log collection may not exist, that's okay
            console.log(`${LOG_PREFIX} Audit log skipped (collection may not exist)`)
          }
        }
        break

      case 'resolved':
        // Issue was resolved
        console.log(`${LOG_PREFIX} Issue resolved: ${data.issue?.shortId}`)
        break

      case 'assigned':
        // Issue was assigned
        console.log(`${LOG_PREFIX} Issue assigned: ${data.issue?.shortId}`, {
          assignee: actor.name,
        })
        break

      case 'archived':
        // Issue was archived
        console.log(`${LOG_PREFIX} Issue archived: ${data.issue?.shortId}`)
        break

      case 'unresolved':
        // Issue was reopened
        console.log(`${LOG_PREFIX} Issue reopened: ${data.issue?.shortId}`)
        break

      default:
        console.log(`${LOG_PREFIX} Unhandled action: ${action}`)
    }

    return NextResponse.json({ success: true, action })
  } catch (error) {
    console.error(`${LOG_PREFIX} Error processing webhook:`, error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Sentry may send a GET request to verify the endpoint exists
export async function GET() {
  return NextResponse.json({
    status: 'Sentry webhook endpoint active',
    timestamp: new Date().toISOString(),
  })
}
