/**
 * Product Engagement Analytics API Endpoint
 *
 * Provides metrics about product unlocks, scans, and engagement.
 * Data is calculated from the product-unlocks collection.
 *
 * @openapi
 * /product-engagement-analytics:
 *   get:
 *     summary: Get product engagement analytics
 *     description: |
 *       Returns comprehensive metrics about product unlocks, scans, and engagement.
 *       Data includes summary stats, daily breakdowns, top products, categories,
 *       unlock type breakdowns, and conversion funnel metrics.
 *       Results are cached for 5 minutes.
 *     tags: [Analytics, Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Analytics data retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 summary:
 *                   type: object
 *                   properties:
 *                     totalUnlocks:
 *                       type: integer
 *                     unlocksToday:
 *                       type: integer
 *                     unlocksThisWeek:
 *                       type: integer
 *                     unlocksThisMonth:
 *                       type: integer
 *                     uniqueProducts:
 *                       type: integer
 *                     uniqueUsers:
 *                       type: integer
 *                     conversionRate:
 *                       type: number
 *                 unlocksByDay:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       date:
 *                         type: string
 *                         format: date
 *                       count:
 *                         type: integer
 *                 topProducts:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       name:
 *                         type: string
 *                       unlocks:
 *                         type: integer
 *                       category:
 *                         type: string
 *                 topCategories:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       name:
 *                         type: string
 *                       unlocks:
 *                         type: integer
 *                 unlockTypeBreakdown:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       type:
 *                         type: string
 *                       count:
 *                         type: integer
 *                       percentage:
 *                         type: number
 *                 archetypeBreakdown:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       archetype:
 *                         type: string
 *                       count:
 *                         type: integer
 *                 conversionFunnel:
 *                   type: object
 *                   properties:
 *                     freeUnlocks:
 *                       type: integer
 *                     subscriptionUnlocks:
 *                       type: integer
 *                     convertedUsers:
 *                       type: integer
 *                     conversionRate:
 *                       type: number
 *                 cached:
 *                   type: boolean
 *                 generatedAt:
 *                   type: string
 *                   format: date-time
 *       500:
 *         description: Failed to generate analytics
 */

import type { PayloadHandler } from 'payload'

// Cache configuration
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes
let cache: { data: ProductEngagementResponse; timestamp: number } | null = null

interface ProductEngagementResponse {
  summary: {
    totalUnlocks: number
    unlocksToday: number
    unlocksThisWeek: number
    unlocksThisMonth: number
    uniqueProducts: number
    uniqueUsers: number
    conversionRate: number
  }
  unlocksByDay: { date: string; count: number }[]
  topProducts: { id: number; name: string; unlocks: number; category?: string }[]
  topCategories: { name: string; unlocks: number }[]
  unlockTypeBreakdown: { type: string; count: number; percentage: number }[]
  archetypeBreakdown: { archetype: string; count: number }[]
  conversionFunnel: {
    freeUnlocks: number
    subscriptionUnlocks: number
    convertedUsers: number
    conversionRate: number
  }
  cached: boolean
  generatedAt: string
}

export const productEngagementAnalyticsHandler: PayloadHandler = async (req) => {
  // Check cache
  if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
    return Response.json({
      ...cache.data,
      cached: true,
    })
  }

  try {
    const payload = req.payload

    // Get all unlocks with product data
    const allUnlocks = await payload.find({
      collection: 'product-unlocks',
      limit: 10000,
      depth: 1,
      select: {
        product: true,
        user: true,
        unlockType: true,
        archetypeShown: true,
        unlockedAt: true,
        convertedToSubscription: true,
        createdAt: true,
      },
    })

    const unlocks = allUnlocks.docs as Array<{
      id: number
      product: { id: number; name?: string; category?: { name?: string } } | number | null
      user: { id: number } | number | null
      unlockType?: string
      archetypeShown?: string
      unlockedAt?: string
      convertedToSubscription?: boolean
      createdAt: string
    }>

    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    // Summary metrics
    const totalUnlocks = unlocks.length
    const unlocksToday = unlocks.filter((u) => new Date(u.createdAt) >= todayStart).length
    const unlocksThisWeek = unlocks.filter((u) => new Date(u.createdAt) >= weekAgo).length
    const unlocksThisMonth = unlocks.filter((u) => new Date(u.createdAt) >= monthAgo).length

    // Unique products and users
    const uniqueProductIds = new Set(
      unlocks.map((u) => (typeof u.product === 'object' ? u.product?.id : u.product)).filter(Boolean)
    )
    const uniqueUserIds = new Set(
      unlocks.map((u) => (typeof u.user === 'object' ? u.user?.id : u.user)).filter(Boolean)
    )

    // Conversion metrics
    const freeUnlocks = unlocks.filter((u) => u.unlockType === 'free_credit').length
    const subscriptionUnlocks = unlocks.filter((u) => u.unlockType === 'subscription').length
    const convertedUsers = unlocks.filter((u) => u.convertedToSubscription).length
    const conversionRate = freeUnlocks > 0 ? Math.round((convertedUsers / freeUnlocks) * 100) : 0

    // Unlocks by day (last 30 days)
    const unlocksByDay: { date: string; count: number }[] = []
    for (let i = 29; i >= 0; i--) {
      const dayStart = new Date(now)
      dayStart.setDate(dayStart.getDate() - i)
      dayStart.setHours(0, 0, 0, 0)

      const dayEnd = new Date(dayStart)
      dayEnd.setDate(dayEnd.getDate() + 1)

      const count = unlocks.filter((u) => {
        const created = new Date(u.createdAt)
        return created >= dayStart && created < dayEnd
      }).length

      unlocksByDay.push({
        date: dayStart.toISOString().split('T')[0],
        count,
      })
    }

    // Top products by unlocks
    const productCounts: Record<number, { name: string; count: number; category?: string }> = {}
    for (const unlock of unlocks) {
      const product = typeof unlock.product === 'object' ? unlock.product : null
      if (product && product.id) {
        if (!productCounts[product.id]) {
          productCounts[product.id] = {
            name: product.name || `Product ${product.id}`,
            count: 0,
            category:
              typeof product.category === 'object' ? product.category?.name : undefined,
          }
        }
        productCounts[product.id].count++
      }
    }

    const topProducts = Object.entries(productCounts)
      .map(([id, data]) => ({
        id: parseInt(id),
        name: data.name,
        unlocks: data.count,
        category: data.category,
      }))
      .sort((a, b) => b.unlocks - a.unlocks)
      .slice(0, 10)

    // Top categories by unlocks
    const categoryCounts: Record<string, number> = {}
    for (const unlock of unlocks) {
      const product = typeof unlock.product === 'object' ? unlock.product : null
      const categoryName =
        typeof product?.category === 'object' ? product.category?.name : 'Uncategorized'
      if (categoryName) {
        categoryCounts[categoryName] = (categoryCounts[categoryName] || 0) + 1
      }
    }

    const topCategories = Object.entries(categoryCounts)
      .map(([name, unlocks]) => ({ name, unlocks }))
      .sort((a, b) => b.unlocks - a.unlocks)
      .slice(0, 10)

    // Unlock type breakdown
    const typeCounts: Record<string, number> = {}
    for (const unlock of unlocks) {
      const type = unlock.unlockType || 'unknown'
      typeCounts[type] = (typeCounts[type] || 0) + 1
    }

    const unlockTypeBreakdown = Object.entries(typeCounts).map(([type, count]) => ({
      type: type.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      count,
      percentage: totalUnlocks > 0 ? Math.round((count / totalUnlocks) * 100) : 0,
    }))

    // Archetype breakdown
    const archetypeCounts: Record<string, number> = {}
    for (const unlock of unlocks) {
      if (unlock.archetypeShown) {
        archetypeCounts[unlock.archetypeShown] =
          (archetypeCounts[unlock.archetypeShown] || 0) + 1
      }
    }

    const archetypeBreakdown = Object.entries(archetypeCounts).map(([archetype, count]) => ({
      archetype: archetype.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      count,
    }))

    const responseData: ProductEngagementResponse = {
      summary: {
        totalUnlocks,
        unlocksToday,
        unlocksThisWeek,
        unlocksThisMonth,
        uniqueProducts: uniqueProductIds.size,
        uniqueUsers: uniqueUserIds.size,
        conversionRate,
      },
      unlocksByDay,
      topProducts,
      topCategories,
      unlockTypeBreakdown,
      archetypeBreakdown,
      conversionFunnel: {
        freeUnlocks,
        subscriptionUnlocks,
        convertedUsers,
        conversionRate,
      },
      cached: false,
      generatedAt: new Date().toISOString(),
    }

    // Cache the response
    cache = { data: responseData, timestamp: Date.now() }

    return Response.json(responseData)
  } catch (error) {
    console.error('[ProductEngagementAnalytics] Error:', error)
    return Response.json(
      {
        error: 'Failed to generate product engagement analytics',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

export default productEngagementAnalyticsHandler
