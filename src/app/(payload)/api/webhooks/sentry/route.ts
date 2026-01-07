import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { createAuditLog } from '@/collections/AuditLog'

/**
 * Sentry Webhook Endpoint
 *
 * Receives webhook events from Sentry for:
 *
 * Issue Lifecycle:
 * - created: New issue detected
 * - resolved: Issue marked as resolved
 * - assigned: Issue assigned to a team member
 * - archived: Issue archived
 * - unresolved: Issue reopened
 *
 * Alert Rules:
 * - triggered: An alert rule was triggered (spike, regression, threshold, etc.)
 *
 * Configure this URL in Sentry:
 * https://theproductreport.org/api/webhooks/sentry
 *
 * Recommended Alert Rules to configure in Sentry:
 * 1. "First Error" - When a new issue is created
 * 2. "Spike Alert" - When error frequency increases 3x from baseline
 * 3. "Regression Alert" - When a resolved issue reappears
 * 4. "Critical Error" - When fatal/error level issues occur
 * 5. "High Volume" - When >100 events in 1 hour
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

interface SentryAlert {
  id: string
  title: string
  alertRuleId?: string
  alertRuleName?: string
  alertType?: 'spike' | 'regression' | 'threshold' | 'new_issue' | 'metric' | 'custom'
}

interface SentryWebhookPayload {
  action: string
  installation: {
    uuid: string
  }
  data: {
    issue?: SentryIssue
    event?: SentryEvent
    alert?: SentryAlert
    triggered_rule?: string
    metric_alert?: {
      title: string
      status: 'critical' | 'warning' | 'resolved'
      alertRule: {
        id: string
        name: string
      }
    }
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

/**
 * Send email notification for critical Sentry alerts
 */
async function sendCriticalAlertEmail(
  payloadCMS: Awaited<ReturnType<typeof getPayload>>,
  issue: SentryIssue,
  alertType: string
): Promise<void> {
  try {
    // Find admin users to notify
    const admins = await payloadCMS.find({
      collection: 'users',
      where: { role: { equals: 'admin' } },
      limit: 10,
    })

    if (admins.docs.length === 0) {
      console.log(`${LOG_PREFIX} No admin users to notify`)
      return
    }

    const adminEmails = admins.docs
      .filter((admin: { email?: string }) => admin.email)
      .map((admin: { email: string }) => admin.email)

    if (adminEmails.length === 0) {
      return
    }

    // Send email using Payload's email adapter
    await payloadCMS.sendEmail({
      to: adminEmails[0], // Primary admin
      subject: `[CRITICAL] ${alertType}: ${issue.title}`,
      html: `
        <h2 style="color: #dc2626;">Critical Sentry Alert</h2>
        <p><strong>Type:</strong> ${alertType}</p>
        <p><strong>Issue:</strong> ${issue.title}</p>
        <p><strong>Level:</strong> ${issue.level}</p>
        <p><strong>Occurrences:</strong> ${issue.count}</p>
        <p><strong>Project:</strong> ${issue.project?.name || 'Unknown'}</p>
        <p><strong>First Seen:</strong> ${issue.firstSeen}</p>
        <p><strong>Last Seen:</strong> ${issue.lastSeen}</p>
        <p><strong>Affected Users:</strong> ${issue.userCount}</p>
        <br/>
        <a href="${issue.permalink}" style="background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
          View in Sentry
        </a>
        <br/><br/>
        <p style="color: #666; font-size: 12px;">
          This is an automated alert from The Product Report error monitoring.
        </p>
      `,
    })

    console.log(`${LOG_PREFIX} Critical alert email sent to ${adminEmails[0]}`)
  } catch (error) {
    console.error(`${LOG_PREFIX} Failed to send alert email:`, error)
  }
}

/**
 * Determine if an issue is critical and needs immediate attention
 */
function isCriticalIssue(issue: SentryIssue): boolean {
  // Fatal or error level
  if (issue.level === 'fatal' || issue.level === 'error') {
    // High impact: 10+ occurrences or 5+ affected users
    const count = parseInt(issue.count) || 0
    if (count >= 10 || issue.userCount >= 5) {
      return true
    }
    // Unhandled exceptions are always critical
    if (issue.isUnhandled) {
      return true
    }
  }
  return false
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
      alertRule: data.triggered_rule || data.metric_alert?.alertRule?.name,
      actorType: actor.type,
    })

    const payloadCMS = await getPayload({ config: configPromise })

    switch (action) {
      case 'created':
        // New issue created
        if (data.issue) {
          console.log(`${LOG_PREFIX} New issue: ${data.issue.title}`, {
            level: data.issue.level,
            count: data.issue.count,
            permalink: data.issue.permalink,
          })

          await createAuditLog(payloadCMS, {
            action: 'sentry_issue_created',
            sourceType: 'sentry',
            sourceId: data.issue.id,
            sourceUrl: data.issue.permalink,
            metadata: {
              shortId: data.issue.shortId,
              title: data.issue.title,
              level: data.issue.level,
              project: data.issue.project?.name,
              isUnhandled: data.issue.isUnhandled,
              count: data.issue.count,
              userCount: data.issue.userCount,
            },
          })

          // Send email for critical issues
          if (isCriticalIssue(data.issue)) {
            await sendCriticalAlertEmail(payloadCMS, data.issue, 'New Critical Issue')
          }
        }
        break

      case 'resolved':
        // Issue was resolved
        if (data.issue) {
          console.log(`${LOG_PREFIX} Issue resolved: ${data.issue.shortId}`)

          await createAuditLog(payloadCMS, {
            action: 'sentry_issue_resolved',
            sourceType: 'sentry',
            sourceId: data.issue.id,
            sourceUrl: data.issue.permalink,
            metadata: {
              shortId: data.issue.shortId,
              title: data.issue.title,
              resolvedBy: actor.name,
            },
          })
        }
        break

      case 'triggered':
        // Alert rule triggered (spike, regression, threshold, etc.)
        console.log(`${LOG_PREFIX} Alert triggered:`, {
          rule: data.triggered_rule || data.metric_alert?.alertRule?.name,
          issue: data.issue?.shortId,
        })

        if (data.issue) {
          // Determine alert type from rule name
          const ruleName = data.triggered_rule || data.metric_alert?.alertRule?.name || 'Unknown'
          let auditAction: 'sentry_spike_alert' | 'sentry_regression_alert' | 'sentry_critical_alert' = 'sentry_critical_alert'

          if (ruleName.toLowerCase().includes('spike') || ruleName.toLowerCase().includes('volume')) {
            auditAction = 'sentry_spike_alert'
          } else if (ruleName.toLowerCase().includes('regression') || ruleName.toLowerCase().includes('reappear')) {
            auditAction = 'sentry_regression_alert'
          }

          await createAuditLog(payloadCMS, {
            action: auditAction,
            sourceType: 'sentry',
            sourceId: data.issue.id,
            sourceUrl: data.issue.permalink,
            metadata: {
              shortId: data.issue.shortId,
              title: data.issue.title,
              level: data.issue.level,
              ruleName,
              ruleId: data.metric_alert?.alertRule?.id || data.alert?.alertRuleId,
              count: data.issue.count,
              userCount: data.issue.userCount,
            },
          })

          // Always send email for triggered alerts (they're configured to be important)
          await sendCriticalAlertEmail(payloadCMS, data.issue, `Alert: ${ruleName}`)
        }
        break

      case 'assigned':
        console.log(`${LOG_PREFIX} Issue assigned: ${data.issue?.shortId}`, {
          assignee: actor.name,
        })
        break

      case 'archived':
      case 'ignored':
        console.log(`${LOG_PREFIX} Issue archived/ignored: ${data.issue?.shortId}`)
        break

      case 'unresolved':
        // Regression - issue was reopened
        if (data.issue) {
          console.log(`${LOG_PREFIX} Issue reopened (regression): ${data.issue.shortId}`)

          await createAuditLog(payloadCMS, {
            action: 'sentry_regression_alert',
            sourceType: 'sentry',
            sourceId: data.issue.id,
            sourceUrl: data.issue.permalink,
            metadata: {
              shortId: data.issue.shortId,
              title: data.issue.title,
              level: data.issue.level,
              reason: 'Issue reopened after being resolved',
            },
          })

          // Regressions are always concerning
          await sendCriticalAlertEmail(payloadCMS, data.issue, 'Regression Detected')
        }
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
