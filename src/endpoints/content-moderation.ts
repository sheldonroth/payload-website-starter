/**
 * Content Moderation API Endpoint
 *
 * Provides a unified view of user submissions and feedback requiring moderation.
 * Supports filtering, stats, and bulk status updates.
 */

import type { PayloadHandler } from 'payload'

// Cache configuration
const CACHE_TTL = 60 * 1000 // 1 minute (shorter for moderation queue)
let cache: { data: ModerationResponse; timestamp: number } | null = null

interface ModerationItem {
  id: number
  type: 'submission' | 'feedback'
  subType: string
  status: string
  content: string
  submitterEmail?: string
  submitterName?: string
  product?: { id: number; name: string } | null
  hasImages: boolean
  createdAt: string
  priority: 'high' | 'medium' | 'low'
}

interface ModerationStats {
  pendingSubmissions: number
  pendingFeedback: number
  reviewedToday: number
  totalPending: number
  byType: { type: string; count: number }[]
  byPriority: { priority: string; count: number }[]
}

interface ModerationResponse {
  items: ModerationItem[]
  stats: ModerationStats
  cached: boolean
  generatedAt: string
}

function getPriority(item: {
  type?: string
  severity?: string
  feedbackType?: string
}): 'high' | 'medium' | 'low' {
  // High priority: reaction reports (especially severe), complaints
  if (item.type === 'reaction_report') {
    if (item.severity === 'severe' || item.severity === 'medical') return 'high'
    return 'medium'
  }
  if (item.feedbackType === 'complaint' || item.feedbackType === 'bug_report') return 'high'

  // Medium priority: product requests with votes, tips
  if (item.type === 'tip' || item.type === 'product_request') return 'medium'

  // Low priority: general feedback, scans
  return 'low'
}

export const contentModerationHandler: PayloadHandler = async (req) => {
  const url = new URL(req.url || '', 'http://localhost')
  const skipCache = url.searchParams.get('refresh') === 'true'

  // Check cache
  if (!skipCache && cache && Date.now() - cache.timestamp < CACHE_TTL) {
    return Response.json({
      ...cache.data,
      cached: true,
    })
  }

  try {
    const payload = req.payload

    // Fetch pending user submissions
    const submissions = await payload.find({
      collection: 'user-submissions',
      where: {
        status: {
          in: ['pending', 'reviewing'],
        },
      },
      limit: 100,
      depth: 1,
      sort: '-createdAt',
    })

    // Fetch new/unreviewed feedback
    const feedback = await payload.find({
      collection: 'feedback',
      where: {
        status: {
          equals: 'new',
        },
      },
      limit: 100,
      depth: 1,
      sort: '-createdAt',
    })

    // Get today's reviewed count
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const reviewedSubmissions = await payload.count({
      collection: 'user-submissions',
      where: {
        status: {
          in: ['verified', 'rejected', 'duplicate', 'spam'],
        },
        updatedAt: {
          greater_than: todayStart.toISOString(),
        },
      },
    })

    const reviewedFeedback = await payload.count({
      collection: 'feedback',
      where: {
        status: {
          in: ['reviewed', 'actioned', 'archived'],
        },
        updatedAt: {
          greater_than: todayStart.toISOString(),
        },
      },
    })

    // Transform submissions to moderation items
    const submissionItems: ModerationItem[] = (
      submissions.docs as Array<{
        id: number
        type: string
        status: string
        content?: string
        submitterEmail?: string
        submitterName?: string
        product?: { id: number; name?: string } | number | null
        images?: unknown[]
        reactionDetails?: { severity?: string }
        createdAt: string
      }>
    ).map((sub) => ({
      id: sub.id,
      type: 'submission',
      subType: sub.type,
      status: sub.status,
      content: sub.content || '',
      submitterEmail: sub.submitterEmail,
      submitterName: sub.submitterName,
      product:
        typeof sub.product === 'object' && sub.product
          ? { id: sub.product.id, name: sub.product.name || 'Unknown Product' }
          : null,
      hasImages: Array.isArray(sub.images) && sub.images.length > 0,
      createdAt: sub.createdAt,
      priority: getPriority({ type: sub.type, severity: sub.reactionDetails?.severity }),
    }))

    // Transform feedback to moderation items
    const feedbackItems: ModerationItem[] = (
      feedback.docs as Array<{
        id: number
        feedbackType?: string
        status: string
        message: string
        email?: string
        product?: { id: number; name?: string } | number | null
        createdAt: string
      }>
    ).map((fb) => ({
      id: fb.id,
      type: 'feedback',
      subType: fb.feedbackType || 'general',
      status: fb.status,
      content: fb.message,
      submitterEmail: fb.email,
      product:
        typeof fb.product === 'object' && fb.product
          ? { id: fb.product.id, name: fb.product.name || 'Unknown Product' }
          : null,
      hasImages: false,
      createdAt: fb.createdAt,
      priority: getPriority({ feedbackType: fb.feedbackType }),
    }))

    // Combine and sort by priority then date
    const allItems = [...submissionItems, ...feedbackItems].sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 }
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority]
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })

    // Calculate stats
    const byType: Record<string, number> = {}
    const byPriority: Record<string, number> = { high: 0, medium: 0, low: 0 }

    for (const item of allItems) {
      const typeKey = item.type === 'submission' ? item.subType : `feedback_${item.subType}`
      byType[typeKey] = (byType[typeKey] || 0) + 1
      byPriority[item.priority]++
    }

    const stats: ModerationStats = {
      pendingSubmissions: submissions.totalDocs,
      pendingFeedback: feedback.totalDocs,
      reviewedToday: reviewedSubmissions.totalDocs + reviewedFeedback.totalDocs,
      totalPending: submissions.totalDocs + feedback.totalDocs,
      byType: Object.entries(byType)
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count),
      byPriority: Object.entries(byPriority).map(([priority, count]) => ({ priority, count })),
    }

    const responseData: ModerationResponse = {
      items: allItems,
      stats,
      cached: false,
      generatedAt: new Date().toISOString(),
    }

    // Cache the response
    cache = { data: responseData, timestamp: Date.now() }

    return Response.json(responseData)
  } catch (error) {
    console.error('[ContentModeration] Error:', error)
    return Response.json(
      {
        error: 'Failed to load moderation queue',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

export default contentModerationHandler
