/**
 * Email Analytics Endpoint
 *
 * Provides aggregated email performance metrics.
 */

import type { PayloadHandler } from 'payload'

interface EmailMetrics {
  total: number
  delivered: number
  opened: number
  clicked: number
  bounced: number
  complained: number
  openRate: number
  clickRate: number
  deliveryRate: number
}

interface TemplatePerformance {
  id: string
  subject: string
  sequence: string
  sent: number
  opened: number
  clicked: number
  openRate: number
  clickRate: number
  abWinner?: 'A' | 'B' | null
}

export const emailAnalyticsHandler: PayloadHandler = async (req) => {
  const { payload, user } = req

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const url = new URL(req.url || '', `http://${req.headers.get('host') || 'localhost'}`)
    const range = url.searchParams.get('range') || '30d'

    // Calculate date range
    const now = new Date()
    const daysBack = range === '7d' ? 7 : range === '90d' ? 90 : 30
    const startDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000)

    // Fetch all email sends in the range
    const emailSends = await payload.find({
      collection: 'email-sends',
      where: {
        sentAt: { greater_than: startDate.toISOString() },
      },
      limit: 10000,
      depth: 1,
    })

    const sends = emailSends.docs

    // Calculate overview metrics
    const overview = calculateMetrics(sends)

    // Calculate 7-day metrics
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const last7Days = calculateMetrics(
      sends.filter((s: any) => new Date(s.sentAt) >= sevenDaysAgo)
    )

    // Calculate 30-day metrics
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const last30Days = calculateMetrics(
      sends.filter((s: any) => new Date(s.sentAt) >= thirtyDaysAgo)
    )

    // Calculate template performance
    const templateStats = new Map<string, any>()

    for (const send of sends) {
      const rawTemplateId = typeof send.template === 'object' ? send.template?.id : send.template
      if (!rawTemplateId) continue
      const templateId = String(rawTemplateId)

      if (!templateStats.has(templateId)) {
        const template = typeof send.template === 'object' ? send.template : null
        templateStats.set(templateId, {
          id: templateId,
          subject: (template as any)?.subject || send.subject || 'Unknown',
          sequence: (template as any)?.sequence || 'unknown',
          sent: 0,
          opened: 0,
          clicked: 0,
          variantA: { sent: 0, opened: 0 },
          variantB: { sent: 0, opened: 0 },
        })
      }

      const stats = templateStats.get(templateId)
      const status = send.status || ''
      stats.sent++
      if (['opened', 'clicked'].includes(status)) stats.opened++
      if (status === 'clicked') stats.clicked++

      // Track A/B variants
      if (send.abVariant === 'A') {
        stats.variantA.sent++
        if (['opened', 'clicked'].includes(status)) stats.variantA.opened++
      } else if (send.abVariant === 'B') {
        stats.variantB.sent++
        if (['opened', 'clicked'].includes(status)) stats.variantB.opened++
      }
    }

    // Convert to array and calculate rates
    const topTemplates: TemplatePerformance[] = Array.from(templateStats.values())
      .map((t) => ({
        id: t.id,
        subject: t.subject,
        sequence: t.sequence,
        sent: t.sent,
        opened: t.opened,
        clicked: t.clicked,
        openRate: t.sent > 0 ? (t.opened / t.sent) * 100 : 0,
        clickRate: t.sent > 0 ? (t.clicked / t.sent) * 100 : 0,
        abWinner: determineABWinner(t.variantA, t.variantB),
      }))
      .sort((a, b) => b.openRate - a.openRate)
      .slice(0, 10)

    // Get A/B test results (templates with both variants)
    const abTestResults = Array.from(templateStats.values())
      .filter((t) => t.variantA.sent > 10 && t.variantB.sent > 10)
      .map((t) => ({
        id: t.id,
        subject: t.subject,
        sequence: t.sequence,
        sent: t.sent,
        opened: t.opened,
        clicked: t.clicked,
        openRate: t.sent > 0 ? (t.opened / t.sent) * 100 : 0,
        clickRate: t.sent > 0 ? (t.clicked / t.sent) * 100 : 0,
        abWinner: determineABWinner(t.variantA, t.variantB),
      }))
      .slice(0, 5)

    // Build time series data
    const timeSeries = buildTimeSeries(sends, daysBack)

    return Response.json({
      overview,
      last7Days,
      last30Days,
      topTemplates,
      abTestResults,
      timeSeries,
    })
  } catch (error) {
    console.error('[Email Analytics] Error:', error)
    return Response.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    )
  }
}

function calculateMetrics(sends: any[]): EmailMetrics {
  const total = sends.length
  const delivered = sends.filter((s) => s.status !== 'bounced').length
  const opened = sends.filter((s) => ['opened', 'clicked'].includes(s.status)).length
  const clicked = sends.filter((s) => s.status === 'clicked').length
  const bounced = sends.filter((s) => s.status === 'bounced').length
  const complained = sends.filter((s) => s.status === 'complained').length

  return {
    total,
    delivered,
    opened,
    clicked,
    bounced,
    complained,
    openRate: total > 0 ? (opened / total) * 100 : 0,
    clickRate: total > 0 ? (clicked / total) * 100 : 0,
    deliveryRate: total > 0 ? (delivered / total) * 100 : 0,
  }
}

function determineABWinner(
  variantA: { sent: number; opened: number },
  variantB: { sent: number; opened: number }
): 'A' | 'B' | null {
  if (variantA.sent < 10 || variantB.sent < 10) return null

  const rateA = variantA.opened / variantA.sent
  const rateB = variantB.opened / variantB.sent

  // Need at least 5% difference to declare winner
  const diff = Math.abs(rateA - rateB)
  if (diff < 0.05) return null

  return rateA > rateB ? 'A' : 'B'
}

function buildTimeSeries(sends: any[], days: number) {
  const now = new Date()
  const series = []

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
    const dateStr = date.toISOString().split('T')[0]

    const daySends = sends.filter((s) => {
      const sendDate = new Date(s.sentAt).toISOString().split('T')[0]
      return sendDate === dateStr
    })

    series.push({
      date: dateStr,
      sent: daySends.length,
      opened: daySends.filter((s: any) => ['opened', 'clicked'].includes(s.status)).length,
      clicked: daySends.filter((s: any) => s.status === 'clicked').length,
    })
  }

  return series
}

export const emailAnalyticsEndpoint = {
  path: '/email-analytics',
  method: 'get' as const,
  handler: emailAnalyticsHandler,
}

export default emailAnalyticsEndpoint
