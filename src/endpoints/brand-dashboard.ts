/**
 * Brand Dashboard API Endpoints
 *
 * Provides data for the Brand Intelligence Portal:
 * - Analytics: Historical brand performance data
 * - Products: Brand's product catalog with scores
 * - Competitors: Competitive benchmarking (Pro+)
 * - Demand Signals: Consumer interest signals (Pro+)
 */

import type { Endpoint } from 'payload'

/**
 * Middleware to verify brand user authentication and access
 */
async function verifyBrandAccess(
    req: any,
    brandId: string | number
): Promise<{ authorized: boolean; user?: any; error?: string }> {
    // Check authentication
    if (!req.user || req.user.collection !== 'brand-users') {
        return { authorized: false, error: 'Authentication required' }
    }

    const user = req.user as {
        id: number
        brand: any
        additionalBrands?: any[]
        role: string
        subscription: string
        features: {
            canViewCompetitors: boolean
            canExportData: boolean
            canAccessApi: boolean
            canViewDemandSignals: boolean
        }
        isVerified: boolean
    }

    // Check verification status
    if (!user.isVerified) {
        return { authorized: false, error: 'Account not verified' }
    }

    // Check brand access
    const userBrandId = typeof user.brand === 'object' ? user.brand.id : user.brand
    const additionalBrandIds = (user.additionalBrands || []).map((b: any) =>
        typeof b === 'object' ? b.id : b
    )

    const requestedBrandId = Number(brandId)
    const hasAccess = userBrandId === requestedBrandId ||
        additionalBrandIds.includes(requestedBrandId)

    if (!hasAccess) {
        return { authorized: false, error: 'Access denied to this brand' }
    }

    return { authorized: true, user }
}

/**
 * Get Brand Analytics
 * GET /api/brand/:brandId/analytics
 *
 * Returns historical brand performance data
 */
export const brandAnalyticsHandler: Endpoint = {
    path: '/brand/:brandId/analytics',
    method: 'get',
    handler: async (req) => {
        try {
            const brandId = (req.routeParams as Record<string, string>)?.brandId
            if (!brandId) {
                return Response.json({ error: 'Brand ID required' }, { status: 400 })
            }

            const access = await verifyBrandAccess(req, brandId)
            if (!access.authorized) {
                return Response.json({ error: access.error }, { status: access.error === 'Authentication required' ? 401 : 403 })
            }

            // Get query params for date range
            const url = new URL(req.url || '', 'http://localhost')
            const days = parseInt(url.searchParams.get('days') || '30')
            const startDate = new Date()
            startDate.setDate(startDate.getDate() - days)

            // Fetch brand analytics for date range
            const analytics = await req.payload.find({
                collection: 'brand-analytics',
                where: {
                    and: [
                        { brand: { equals: Number(brandId) } },
                        { date: { greater_than: startDate.toISOString().split('T')[0] } },
                    ],
                },
                sort: 'date',
                limit: days + 1,
            })

            // Get current brand data
            const brand = await req.payload.findByID({
                collection: 'brands',
                id: Number(brandId),
            })

            if (!brand) {
                return Response.json({ error: 'Brand not found' }, { status: 404 })
            }

            // Calculate summary metrics
            const docs = analytics.docs as any[]
            const summary = {
                currentTrustScore: brand.trustScore || 0,
                currentTrustGrade: brand.trustGrade || 'C',
                totalProducts: brand.productCount || 0,
                avgScanCount: docs.length > 0
                    ? Math.round(docs.reduce((sum, d) => sum + (d.scanCount || 0), 0) / docs.length)
                    : 0,
                trendDirection: docs.length >= 2
                    ? (docs[docs.length - 1]?.trustScore || 0) > (docs[0]?.trustScore || 0)
                        ? 'up'
                        : 'down'
                    : 'stable',
            }

            return Response.json({
                brand: {
                    id: brand.id,
                    name: brand.name,
                    slug: brand.slug,
                    trustScore: brand.trustScore,
                    trustGrade: brand.trustGrade,
                },
                summary,
                analytics: docs.map((d: any) => ({
                    date: d.date,
                    scanCount: d.scanCount,
                    searchCount: d.searchCount,
                    productViewCount: d.productViewCount,
                    uniqueUsers: d.uniqueUsers,
                    trustScore: d.trustScore,
                    trustGrade: d.trustGrade,
                    categoryRank: d.categoryRank,
                    verdictBreakdown: d.verdictBreakdown,
                    changes: d.changes,
                })),
                dateRange: {
                    start: startDate.toISOString().split('T')[0],
                    end: new Date().toISOString().split('T')[0],
                    days,
                },
            })
        } catch (error) {
            console.error('[BrandDashboard] Analytics error:', error)
            return Response.json({ error: 'Failed to fetch analytics' }, { status: 500 })
        }
    },
}

/**
 * Get Brand Products
 * GET /api/brand/:brandId/products
 *
 * Returns products for this brand with scores and verdicts
 */
export const brandProductsHandler: Endpoint = {
    path: '/brand/:brandId/products',
    method: 'get',
    handler: async (req) => {
        try {
            const brandId = (req.routeParams as Record<string, string>)?.brandId
            if (!brandId) {
                return Response.json({ error: 'Brand ID required' }, { status: 400 })
            }

            const access = await verifyBrandAccess(req, brandId)
            if (!access.authorized) {
                return Response.json({ error: access.error }, { status: access.error === 'Authentication required' ? 401 : 403 })
            }

            // Get query params for pagination and filtering
            const url = new URL(req.url || '', 'http://localhost')
            const page = parseInt(url.searchParams.get('page') || '1')
            const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100)
            const verdict = url.searchParams.get('verdict')
            const sort = url.searchParams.get('sort') || '-score'

            // Get brand name for product lookup
            const brand = await req.payload.findByID({
                collection: 'brands',
                id: Number(brandId),
            })

            if (!brand) {
                return Response.json({ error: 'Brand not found' }, { status: 404 })
            }

            // Build where clause
            const where: any = {
                brand: { equals: brand.name },
            }

            if (verdict) {
                where.verdict = { equals: verdict }
            }

            // Fetch products
            const products = await req.payload.find({
                collection: 'products',
                where,
                sort,
                page,
                limit,
                depth: 1,
            })

            return Response.json({
                brand: {
                    id: brand.id,
                    name: brand.name,
                },
                products: products.docs.map((p: any) => ({
                    id: p.id,
                    name: p.name,
                    slug: p.slug,
                    upc: p.upc,
                    score: p.score,
                    verdict: p.verdict,
                    categories: p.categories?.map((c: any) => ({
                        id: typeof c === 'object' ? c.id : c,
                        title: typeof c === 'object' ? c.title : null,
                    })),
                    image: p.image?.url || null,
                    status: p.status,
                    updatedAt: p.updatedAt,
                })),
                pagination: {
                    page: products.page,
                    limit: products.limit,
                    totalPages: products.totalPages,
                    totalDocs: products.totalDocs,
                    hasNextPage: products.hasNextPage,
                    hasPrevPage: products.hasPrevPage,
                },
                filters: {
                    verdict,
                    sort,
                },
            })
        } catch (error) {
            console.error('[BrandDashboard] Products error:', error)
            return Response.json({ error: 'Failed to fetch products' }, { status: 500 })
        }
    },
}

/**
 * Get Competitor Analysis
 * GET /api/brand/:brandId/competitors
 *
 * Returns competitor benchmarking data (Pro+ only)
 */
export const brandCompetitorsHandler: Endpoint = {
    path: '/brand/:brandId/competitors',
    method: 'get',
    handler: async (req) => {
        try {
            const brandId = (req.routeParams as Record<string, string>)?.brandId
            if (!brandId) {
                return Response.json({ error: 'Brand ID required' }, { status: 400 })
            }

            const access = await verifyBrandAccess(req, brandId)
            if (!access.authorized) {
                return Response.json({ error: access.error }, { status: access.error === 'Authentication required' ? 401 : 403 })
            }

            // Check feature access
            if (!access.user?.features?.canViewCompetitors) {
                return Response.json({
                    error: 'Competitor analysis requires Pro subscription or higher',
                    code: 'FEATURE_LOCKED',
                    requiredTier: 'pro',
                }, { status: 403 })
            }

            // Get the brand and its category
            const brand = await req.payload.findByID({
                collection: 'brands',
                id: Number(brandId),
            }) as any

            if (!brand) {
                return Response.json({ error: 'Brand not found' }, { status: 404 })
            }

            // Find products to determine primary category
            const brandProducts = await req.payload.find({
                collection: 'products',
                where: { brand: { equals: brand.name } },
                limit: 50,
                depth: 1,
            })

            // Count categories
            const categoryCounts: Record<string, { id: number; title: string; count: number }> = {}
            for (const product of brandProducts.docs) {
                const p = product as any
                for (const cat of p.categories || []) {
                    const catId = typeof cat === 'object' ? cat.id : cat
                    const catTitle = typeof cat === 'object' ? cat.title : 'Unknown'
                    if (!categoryCounts[catId]) {
                        categoryCounts[catId] = { id: catId, title: catTitle, count: 0 }
                    }
                    categoryCounts[catId].count++
                }
            }

            // Get primary category
            const primaryCategory = Object.values(categoryCounts)
                .sort((a, b) => b.count - a.count)[0]

            if (!primaryCategory) {
                return Response.json({
                    brand: { id: brand.id, name: brand.name },
                    competitors: [],
                    message: 'No category data available for competitor analysis',
                })
            }

            // Find competitors (other brands in same category)
            const categoryProducts = await req.payload.find({
                collection: 'products',
                where: {
                    and: [
                        { categories: { contains: primaryCategory.id } },
                        { brand: { not_equals: brand.name } },
                    ],
                },
                limit: 200,
            })

            // Aggregate by brand
            const competitorData: Record<string, {
                name: string
                productCount: number
                avgScore: number
                verdictCounts: Record<string, number>
            }> = {}

            for (const product of categoryProducts.docs) {
                const p = product as any
                const brandName = p.brand
                if (!brandName) continue

                if (!competitorData[brandName]) {
                    competitorData[brandName] = {
                        name: brandName,
                        productCount: 0,
                        avgScore: 0,
                        verdictCounts: { recommend: 0, consider: 0, caution: 0, avoid: 0 },
                    }
                }

                competitorData[brandName].productCount++
                competitorData[brandName].avgScore += p.score || 0
                if (p.verdict) {
                    competitorData[brandName].verdictCounts[p.verdict] =
                        (competitorData[brandName].verdictCounts[p.verdict] || 0) + 1
                }
            }

            // Calculate averages and sort
            const competitors = Object.values(competitorData)
                .map(c => ({
                    ...c,
                    avgScore: c.productCount > 0 ? Math.round(c.avgScore / c.productCount) : 0,
                }))
                .sort((a, b) => b.avgScore - a.avgScore)
                .slice(0, 10)

            // Calculate brand's position
            const allBrands = [
                {
                    name: brand.name,
                    avgScore: brand.trustScore || 0,
                    productCount: brandProducts.totalDocs,
                    isSelf: true,
                },
                ...competitors.map(c => ({ ...c, isSelf: false })),
            ].sort((a, b) => b.avgScore - a.avgScore)

            const brandRank = allBrands.findIndex(b => b.isSelf) + 1

            return Response.json({
                brand: {
                    id: brand.id,
                    name: brand.name,
                    trustScore: brand.trustScore,
                    rank: brandRank,
                    totalCompetitors: competitors.length,
                },
                category: primaryCategory,
                competitors: competitors.map((c, i) => ({
                    rank: i + 1 + (brandRank <= i + 1 ? 1 : 0),
                    name: c.name,
                    avgScore: c.avgScore,
                    productCount: c.productCount,
                    verdictBreakdown: c.verdictCounts,
                })),
                benchmark: {
                    avgCategoryScore: Math.round(
                        competitors.reduce((sum, c) => sum + c.avgScore, 0) / (competitors.length || 1)
                    ),
                    yourScore: brand.trustScore || 0,
                    percentile: Math.round((1 - (brandRank - 1) / (allBrands.length || 1)) * 100),
                },
            })
        } catch (error) {
            console.error('[BrandDashboard] Competitors error:', error)
            return Response.json({ error: 'Failed to fetch competitor data' }, { status: 500 })
        }
    },
}

/**
 * Get Consumer Demand Signals
 * GET /api/brand/:brandId/demand-signals
 *
 * Returns consumer interest signals from MarketIntelligence (Pro+ only)
 */
export const brandDemandSignalsHandler: Endpoint = {
    path: '/brand/:brandId/demand-signals',
    method: 'get',
    handler: async (req) => {
        try {
            const brandId = (req.routeParams as Record<string, string>)?.brandId
            if (!brandId) {
                return Response.json({ error: 'Brand ID required' }, { status: 400 })
            }

            const access = await verifyBrandAccess(req, brandId)
            if (!access.authorized) {
                return Response.json({ error: access.error }, { status: access.error === 'Authentication required' ? 401 : 403 })
            }

            // Check feature access
            if (!access.user?.features?.canViewDemandSignals) {
                return Response.json({
                    error: 'Demand signals require Pro subscription or higher',
                    code: 'FEATURE_LOCKED',
                    requiredTier: 'pro',
                }, { status: 403 })
            }

            // Get the brand
            const brand = await req.payload.findByID({
                collection: 'brands',
                id: Number(brandId),
            }) as any

            if (!brand) {
                return Response.json({ error: 'Brand not found' }, { status: 404 })
            }

            // Get market intelligence for this brand
            const marketIntel = await req.payload.find({
                collection: 'market-intelligence',
                where: {
                    or: [
                        { brand: { equals: brand.name } },
                        { productName: { contains: brand.name } },
                    ],
                },
                sort: '-trendScore',
                limit: 20,
            })

            // Get product votes (user requests) for brand's products
            const productVotes = await req.payload.find({
                collection: 'product-votes',
                where: {
                    or: [
                        { brand: { equals: brand.name } },
                        { productName: { contains: brand.name } },
                    ],
                },
                sort: '-totalWeightedVotes',
                limit: 20,
            })

            // Get recent search trends for brand
            const searchSignals = await req.payload.find({
                collection: 'audit-log',
                where: {
                    and: [
                        { action: { equals: 'search' } },
                        {
                            or: [
                                { 'metadata.query': { contains: brand.name } },
                                { targetName: { contains: brand.name } },
                            ],
                        },
                        { createdAt: { greater_than: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() } },
                    ],
                },
                limit: 100,
            })

            // Aggregate search patterns
            const searchPatterns: Record<string, number> = {}
            for (const log of searchSignals.docs) {
                const query = (log as any).metadata?.query?.toLowerCase() || ''
                if (query && query.length > 2) {
                    searchPatterns[query] = (searchPatterns[query] || 0) + 1
                }
            }

            const topSearches = Object.entries(searchPatterns)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .map(([query, count]) => ({ query, count }))

            return Response.json({
                brand: {
                    id: brand.id,
                    name: brand.name,
                },
                marketIntelligence: marketIntel.docs.map((m: any) => ({
                    id: m.id,
                    productName: m.productName,
                    source: m.source,
                    trendScore: m.trendScore,
                    status: m.status,
                    upc: m.upc,
                    detectedAt: m.createdAt,
                })),
                productRequests: productVotes.docs.map((v: any) => ({
                    id: v.id,
                    productName: v.productName,
                    barcode: v.barcode,
                    totalVotes: v.totalWeightedVotes,
                    scanCount: v.scanCount,
                    searchCount: v.searchCount,
                    urgencyFlag: v.urgencyFlag,
                })),
                searchTrends: {
                    topSearches,
                    totalSearches: searchSignals.totalDocs,
                    period: '30 days',
                },
                summary: {
                    trendingProducts: marketIntel.docs.filter((m: any) => m.trendScore >= 50).length,
                    pendingRequests: productVotes.docs.filter((v: any) => v.urgencyFlag === 'urgent').length,
                    totalDemandSignals: marketIntel.totalDocs + productVotes.totalDocs,
                },
            })
        } catch (error) {
            console.error('[BrandDashboard] Demand signals error:', error)
            return Response.json({ error: 'Failed to fetch demand signals' }, { status: 500 })
        }
    },
}

/**
 * Get Brand Overview (Quick Stats)
 * GET /api/brand/:brandId/overview
 *
 * Returns a quick overview for dashboard cards
 */
export const brandOverviewHandler: Endpoint = {
    path: '/brand/:brandId/overview',
    method: 'get',
    handler: async (req) => {
        try {
            const brandId = (req.routeParams as Record<string, string>)?.brandId
            if (!brandId) {
                return Response.json({ error: 'Brand ID required' }, { status: 400 })
            }

            const access = await verifyBrandAccess(req, brandId)
            if (!access.authorized) {
                return Response.json({ error: access.error }, { status: access.error === 'Authentication required' ? 401 : 403 })
            }

            // Get brand
            const brand = await req.payload.findByID({
                collection: 'brands',
                id: Number(brandId),
            }) as any

            if (!brand) {
                return Response.json({ error: 'Brand not found' }, { status: 404 })
            }

            // Get latest analytics
            const latestAnalytics = await req.payload.find({
                collection: 'brand-analytics',
                where: { brand: { equals: Number(brandId) } },
                sort: '-date',
                limit: 2,
            })

            const today = latestAnalytics.docs[0] as any
            const yesterday = latestAnalytics.docs[1] as any

            // Get product counts by verdict
            const products = await req.payload.find({
                collection: 'products',
                where: { brand: { equals: brand.name } },
                limit: 0, // Just get count
            })

            // Get verdict breakdown
            const verdictBreakdown = today?.verdictBreakdown || {
                recommendCount: 0,
                cautionCount: 0,
                avoidCount: 0,
            }

            return Response.json({
                brand: {
                    id: brand.id,
                    name: brand.name,
                    slug: brand.slug,
                    logo: brand.logo?.url || null,
                },
                metrics: {
                    trustScore: {
                        current: brand.trustScore || 0,
                        change: today && yesterday
                            ? (today.trustScore || 0) - (yesterday.trustScore || 0)
                            : 0,
                        grade: brand.trustGrade || 'C',
                    },
                    products: {
                        total: products.totalDocs,
                        recommend: verdictBreakdown.recommendCount || 0,
                        caution: verdictBreakdown.cautionCount || 0,
                        avoid: verdictBreakdown.avoidCount || 0,
                    },
                    engagement: {
                        scansToday: today?.scanCount || 0,
                        scansYesterday: yesterday?.scanCount || 0,
                        uniqueUsers: today?.uniqueUsers || 0,
                    },
                    ranking: {
                        category: today?.categoryRank || null,
                        overall: today?.overallRank || null,
                    },
                },
                subscription: access.user?.subscription || 'free',
                features: access.user?.features || {},
            })
        } catch (error) {
            console.error('[BrandDashboard] Overview error:', error)
            return Response.json({ error: 'Failed to fetch overview' }, { status: 500 })
        }
    },
}

// Export all handlers
export const brandDashboardEndpoints = [
    brandAnalyticsHandler,
    brandProductsHandler,
    brandCompetitorsHandler,
    brandDemandSignalsHandler,
    brandOverviewHandler,
]
