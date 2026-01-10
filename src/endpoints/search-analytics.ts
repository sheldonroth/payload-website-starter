/**
 * Search Analytics Endpoint
 *
 * Provides real search analytics data from the SearchQueries collection.
 * Used by the Search Analytics Dashboard.
 *
 * @openapi
 * /api/search-analytics:
 *   get:
 *     summary: Get search analytics data
 *     description: Returns search metrics, top queries, and zero-result queries
 *     tags: [Analytics, Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: range
 *         schema:
 *           type: string
 *           enum: [24h, 7d, 30d]
 *           default: 7d
 *         description: Date range for metrics
 *     responses:
 *       200:
 *         description: Search analytics data
 *       401:
 *         description: Authentication required
 */

import type { Endpoint, PayloadRequest } from 'payload'

interface SearchQuery {
  query: string
  count: number
  avgResults: number
  lastSearched: string
  trend: 'up' | 'down' | 'stable'
}

interface SearchMetrics {
  totalSearches: number
  uniqueQueries: number
  avgResultsPerSearch: number
  zeroResultRate: number
  topQueries: SearchQuery[]
  recentQueries: SearchQuery[]
  noResultQueries: string[]
}

// Cache for search analytics
const cache: Map<string, { data: SearchMetrics; timestamp: number }> = new Map()
const CACHE_TTL = 60 * 1000 // 1 minute cache

/**
 * Calculate time ago string
 */
function timeAgo(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins} min ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
}

/**
 * Get date range for query
 */
function getDateRange(range: string): { from: Date; to: Date; prevFrom: Date; prevTo: Date } {
  const to = new Date()
  const from = new Date()
  const prevTo = new Date()
  const prevFrom = new Date()

  switch (range) {
    case '24h':
      from.setHours(from.getHours() - 24)
      prevTo.setHours(prevTo.getHours() - 24)
      prevFrom.setHours(prevFrom.getHours() - 48)
      break
    case '30d':
      from.setDate(from.getDate() - 30)
      prevTo.setDate(prevTo.getDate() - 30)
      prevFrom.setDate(prevFrom.getDate() - 60)
      break
    case '7d':
    default:
      from.setDate(from.getDate() - 7)
      prevTo.setDate(prevTo.getDate() - 7)
      prevFrom.setDate(prevFrom.getDate() - 14)
  }

  return { from, to, prevFrom, prevTo }
}

export const searchAnalyticsEndpoint: Endpoint = {
  path: '/search-analytics',
  method: 'get',
  handler: async (req: PayloadRequest) => {
    // Check authentication
    if (!req.user) {
      return Response.json(
        { error: 'Unauthorized - Login required' },
        { status: 401 }
      )
    }

    try {
      const url = new URL(req.url || '', `http://${req.headers.get('host') || 'localhost'}`)
      const range = url.searchParams.get('range') || '7d'

      // Check cache
      const cacheKey = `search-analytics-${range}`
      const cached = cache.get(cacheKey)
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return Response.json(cached.data)
      }

      const { from, prevFrom, prevTo } = getDateRange(range)

      // Fetch all search queries in the date range
      // Note: Using high limit for aggregation - consider streaming for very large datasets
      const currentQueries = await req.payload.find({
        collection: 'search-queries' as any,
        where: {
          createdAt: {
            greater_than_equal: from.toISOString(),
          },
        },
        limit: 10000,
        depth: 0,
        select: {
          query: true,
          resultsCount: true,
          createdAt: true,
        },
      })

      // Fetch previous period for trend comparison
      const prevQueries = await req.payload.find({
        collection: 'search-queries' as any,
        where: {
          and: [
            { createdAt: { greater_than_equal: prevFrom.toISOString() } },
            { createdAt: { less_than: prevTo.toISOString() } },
          ],
        },
        limit: 10000,
        depth: 0,
        select: {
          query: true,
          resultsCount: true,
          createdAt: true,
        },
      })

      // Aggregate current period data
      const queryMap = new Map<string, { count: number; totalResults: number; lastSearched: Date }>()
      let totalResults = 0
      let zeroResultCount = 0

      for (const doc of currentQueries.docs) {
        const query = (doc as any).query?.toLowerCase().trim()
        const resultsCount = (doc as any).resultsCount || 0
        const createdAt = new Date((doc as any).createdAt)

        if (!query) continue

        totalResults += resultsCount
        if (resultsCount === 0) zeroResultCount++

        const existing = queryMap.get(query)
        if (existing) {
          existing.count++
          existing.totalResults += resultsCount
          if (createdAt > existing.lastSearched) {
            existing.lastSearched = createdAt
          }
        } else {
          queryMap.set(query, {
            count: 1,
            totalResults: resultsCount,
            lastSearched: createdAt,
          })
        }
      }

      // Aggregate previous period for trends
      const prevQueryMap = new Map<string, number>()
      for (const doc of prevQueries.docs) {
        const query = (doc as any).query?.toLowerCase().trim()
        if (!query) continue
        prevQueryMap.set(query, (prevQueryMap.get(query) || 0) + 1)
      }

      // Calculate trends and build top queries list
      const topQueriesArray: SearchQuery[] = []
      for (const [query, data] of queryMap.entries()) {
        const prevCount = prevQueryMap.get(query) || 0
        let trend: 'up' | 'down' | 'stable' = 'stable'

        if (data.count > prevCount * 1.1) trend = 'up'
        else if (data.count < prevCount * 0.9) trend = 'down'

        topQueriesArray.push({
          query,
          count: data.count,
          avgResults: data.count > 0 ? Math.round(data.totalResults / data.count) : 0,
          lastSearched: timeAgo(data.lastSearched),
          trend,
        })
      }

      // Sort by count and take top 20
      topQueriesArray.sort((a, b) => b.count - a.count)
      const topQueries = topQueriesArray.slice(0, 20)

      // Get recent queries (most recent 10 unique queries)
      const recentQueriesSet = new Set<string>()
      const recentQueries: SearchQuery[] = []
      const sortedDocs = [...currentQueries.docs].sort((a, b) =>
        new Date((b as any).createdAt).getTime() - new Date((a as any).createdAt).getTime()
      )

      for (const doc of sortedDocs) {
        const query = (doc as any).query?.toLowerCase().trim()
        if (!query || recentQueriesSet.has(query)) continue

        recentQueriesSet.add(query)
        const data = queryMap.get(query)
        if (data) {
          recentQueries.push({
            query,
            count: 1,
            avgResults: (doc as any).resultsCount || 0,
            lastSearched: timeAgo(new Date((doc as any).createdAt)),
            trend: 'stable',
          })
        }

        if (recentQueries.length >= 10) break
      }

      // Get zero-result queries
      const noResultQueries = topQueriesArray
        .filter((q) => q.avgResults === 0)
        .slice(0, 10)
        .map((q) => q.query)

      const totalSearches = currentQueries.totalDocs
      const uniqueQueries = queryMap.size
      const avgResultsPerSearch = totalSearches > 0 ? Math.round(totalResults / totalSearches * 10) / 10 : 0
      const zeroResultRate = totalSearches > 0 ? Math.round((zeroResultCount / totalSearches) * 1000) / 10 : 0

      const metrics: SearchMetrics = {
        totalSearches,
        uniqueQueries,
        avgResultsPerSearch,
        zeroResultRate,
        topQueries,
        recentQueries,
        noResultQueries,
      }

      // Cache the result
      cache.set(cacheKey, { data: metrics, timestamp: Date.now() })

      return Response.json(metrics)
    } catch (error) {
      console.error('[SearchAnalytics] Error:', error)
      return Response.json(
        { error: 'Failed to fetch search analytics' },
        { status: 500 }
      )
    }
  },
}

/**
 * Endpoint to log a search query
 * Called from the search API
 */
export const logSearchQueryEndpoint: Endpoint = {
  path: '/search-analytics/log',
  method: 'post',
  handler: async (req: PayloadRequest) => {
    try {
      const body = await req.json?.() || {}
      const { query, resultsCount, source, userId, deviceFingerprint, sessionId } = body

      if (!query || typeof query !== 'string') {
        return Response.json(
          { error: 'Query is required' },
          { status: 400 }
        )
      }

      await req.payload.create({
        collection: 'search-queries' as any,
        data: {
          query: query.trim(),
          resultsCount: resultsCount || 0,
          source: source || 'web',
          userId: userId || null,
          deviceFingerprint: deviceFingerprint || null,
          sessionId: sessionId || null,
        },
      })

      return Response.json({ success: true })
    } catch (error) {
      console.error('[SearchAnalytics] Log error:', error)
      return Response.json(
        { error: 'Failed to log search query' },
        { status: 500 }
      )
    }
  },
}

export default searchAnalyticsEndpoint
