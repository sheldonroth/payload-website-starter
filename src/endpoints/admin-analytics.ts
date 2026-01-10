/**
 * Admin Analytics Dashboard API
 *
 * Comprehensive analytics endpoint for admin dashboard providing
 * unified metrics across all platform data sources.
 *
 * Features:
 * - User growth and engagement metrics
 * - Content performance metrics
 * - Revenue and subscription analytics
 * - System health indicators
 * - Time-series data for trends
 * - Export capabilities
 */

import type { PayloadHandler, PayloadRequest } from 'payload'

interface TimeSeriesPoint {
    date: string
    value: number
}

interface MetricWithTrend {
    current: number
    previous: number
    change: number
    changePercent: number
    trend: 'up' | 'down' | 'stable'
}

function calculateTrend(current: number, previous: number): MetricWithTrend {
    const change = current - previous
    const changePercent = previous > 0 ? Math.round((change / previous) * 100) : current > 0 ? 100 : 0
    const trend = change > 0 ? 'up' : change < 0 ? 'down' : 'stable'
    return { current, previous, change, changePercent, trend }
}

function getDateRanges(period: string): { current: Date; previous: Date; periodStart: Date } {
    const now = new Date()
    let periodDays = 7

    switch (period) {
        case 'day':
            periodDays = 1
            break
        case 'week':
            periodDays = 7
            break
        case 'month':
            periodDays = 30
            break
        case 'quarter':
            periodDays = 90
            break
        case 'year':
            periodDays = 365
            break
    }

    return {
        current: now,
        previous: new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000),
        periodStart: new Date(now.getTime() - periodDays * 2 * 24 * 60 * 60 * 1000),
    }
}

/**
 * GET /api/admin-analytics
 *
 * Get comprehensive admin analytics dashboard data
 */
export const adminAnalyticsHandler: PayloadHandler = async (req: PayloadRequest) => {
    if (req.method !== 'GET') {
        return Response.json({ error: 'Method not allowed' }, { status: 405 })
    }

    // Admin only
    if (!req.user || (req.user as { role?: string })?.role !== 'admin') {
        return Response.json({ error: 'Admin access required' }, { status: 401 })
    }

    try {
        const url = new URL(req.url || '', 'http://localhost')
        const period = url.searchParams.get('period') || 'week'
        const { previous, periodStart } = getDateRanges(period)

        // Fetch all metrics in parallel for efficiency
        const [
            // User metrics
            totalDevices,
            currentPeriodDevices,
            previousPeriodDevices,
            subscribedDevices,

            // Content metrics
            totalProducts,
            publishedProducts,
            currentPeriodProducts,
            totalArticles,
            currentPeriodArticles,

            // Engagement metrics
            totalVotes,
            currentPeriodVotes,
            previousPeriodVotes,
            totalUnlocks,
            currentPeriodUnlocks,
            totalSubmissions,
            currentPeriodSubmissions,

            // Referral metrics
            totalReferrals,
            activeReferrals,
            currentPeriodReferrals,
            previousPeriodReferrals,

            // Push token metrics
            totalPushTokens,
            activePushTokens,

            // Feedback metrics
            totalFeedback,
            currentPeriodFeedback,
        ] = await Promise.all([
            // User metrics
            req.payload.count({ collection: 'device-fingerprints' as any }),
            req.payload.count({
                collection: 'device-fingerprints' as any,
                where: { createdAt: { greater_than: previous.toISOString() } },
            }),
            req.payload.count({
                collection: 'device-fingerprints' as any,
                where: {
                    and: [
                        { createdAt: { greater_than: periodStart.toISOString() } },
                        { createdAt: { less_than: previous.toISOString() } },
                    ],
                },
            }),
            req.payload.count({
                collection: 'device-fingerprints' as any,
                where: { isSubscribed: { equals: true } },
            }),

            // Content metrics
            req.payload.count({ collection: 'products' }),
            req.payload.count({
                collection: 'products',
                where: { _status: { equals: 'published' } },
            }),
            req.payload.count({
                collection: 'products',
                where: { createdAt: { greater_than: previous.toISOString() } },
            }),
            req.payload.count({ collection: 'articles' }),
            req.payload.count({
                collection: 'articles',
                where: { createdAt: { greater_than: previous.toISOString() } },
            }),

            // Engagement metrics
            req.payload.count({ collection: 'product-votes' as any }),
            req.payload.count({
                collection: 'product-votes' as any,
                where: { createdAt: { greater_than: previous.toISOString() } },
            }),
            req.payload.count({
                collection: 'product-votes' as any,
                where: {
                    and: [
                        { createdAt: { greater_than: periodStart.toISOString() } },
                        { createdAt: { less_than: previous.toISOString() } },
                    ],
                },
            }),
            req.payload.count({ collection: 'product-unlocks' as any }),
            req.payload.count({
                collection: 'product-unlocks' as any,
                where: { createdAt: { greater_than: previous.toISOString() } },
            }),
            req.payload.count({ collection: 'user-submissions' as any }),
            req.payload.count({
                collection: 'user-submissions' as any,
                where: { createdAt: { greater_than: previous.toISOString() } },
            }),

            // Referral metrics
            req.payload.count({ collection: 'referrals' as any }),
            req.payload.count({
                collection: 'referrals' as any,
                where: { status: { in: ['active', 'completed'] } },
            }),
            req.payload.count({
                collection: 'referrals' as any,
                where: { createdAt: { greater_than: previous.toISOString() } },
            }),
            req.payload.count({
                collection: 'referrals' as any,
                where: {
                    and: [
                        { createdAt: { greater_than: periodStart.toISOString() } },
                        { createdAt: { less_than: previous.toISOString() } },
                    ],
                },
            }),

            // Push token metrics
            req.payload.count({ collection: 'push-tokens' as any }),
            req.payload.count({
                collection: 'push-tokens' as any,
                where: { isActive: { equals: true } },
            }),

            // Feedback metrics
            req.payload.count({ collection: 'feedback' as any }),
            req.payload.count({
                collection: 'feedback' as any,
                where: { createdAt: { greater_than: previous.toISOString() } },
            }),
        ])

        // Calculate subscription rate
        const subscriptionRate = totalDevices.totalDocs > 0
            ? Math.round((subscribedDevices.totalDocs / totalDevices.totalDocs) * 100)
            : 0

        // Calculate trends
        const userGrowth = calculateTrend(currentPeriodDevices.totalDocs, previousPeriodDevices.totalDocs)
        const votingTrend = calculateTrend(currentPeriodVotes.totalDocs, previousPeriodVotes.totalDocs)
        const referralTrend = calculateTrend(currentPeriodReferrals.totalDocs, previousPeriodReferrals.totalDocs)

        // Build response
        const analytics = {
            period,
            generatedAt: new Date().toISOString(),

            // Summary KPIs
            kpis: {
                totalUsers: totalDevices.totalDocs,
                subscribers: subscribedDevices.totalDocs,
                subscriptionRate,
                totalProducts: totalProducts.totalDocs,
                publishedProducts: publishedProducts.totalDocs,
                totalVotes: totalVotes.totalDocs,
                totalReferrals: totalReferrals.totalDocs,
            },

            // User metrics with trends
            users: {
                total: totalDevices.totalDocs,
                subscribers: subscribedDevices.totalDocs,
                subscriptionRate,
                newThisPeriod: currentPeriodDevices.totalDocs,
                growth: userGrowth,
                pushTokens: {
                    total: totalPushTokens.totalDocs,
                    active: activePushTokens.totalDocs,
                    enablementRate: totalDevices.totalDocs > 0
                        ? Math.round((activePushTokens.totalDocs / totalDevices.totalDocs) * 100)
                        : 0,
                },
            },

            // Content metrics
            content: {
                products: {
                    total: totalProducts.totalDocs,
                    published: publishedProducts.totalDocs,
                    newThisPeriod: currentPeriodProducts.totalDocs,
                    publishRate: totalProducts.totalDocs > 0
                        ? Math.round((publishedProducts.totalDocs / totalProducts.totalDocs) * 100)
                        : 0,
                },
                articles: {
                    total: totalArticles.totalDocs,
                    newThisPeriod: currentPeriodArticles.totalDocs,
                },
            },

            // Engagement metrics
            engagement: {
                votes: {
                    total: totalVotes.totalDocs,
                    thisPeriod: currentPeriodVotes.totalDocs,
                    trend: votingTrend,
                },
                unlocks: {
                    total: totalUnlocks.totalDocs,
                    thisPeriod: currentPeriodUnlocks.totalDocs,
                },
                submissions: {
                    total: totalSubmissions.totalDocs,
                    thisPeriod: currentPeriodSubmissions.totalDocs,
                },
                feedback: {
                    total: totalFeedback.totalDocs,
                    thisPeriod: currentPeriodFeedback.totalDocs,
                },
            },

            // Referral program metrics
            referrals: {
                total: totalReferrals.totalDocs,
                active: activeReferrals.totalDocs,
                conversionRate: totalReferrals.totalDocs > 0
                    ? Math.round((activeReferrals.totalDocs / totalReferrals.totalDocs) * 100)
                    : 0,
                thisPeriod: currentPeriodReferrals.totalDocs,
                trend: referralTrend,
            },
        }

        return Response.json({
            success: true,
            ...analytics,
        })
    } catch (error) {
        console.error('[Admin Analytics] Error:', error)
        return Response.json({
            error: error instanceof Error ? error.message : 'Failed to fetch analytics',
        }, { status: 500 })
    }
}

/**
 * GET /api/admin-analytics/time-series
 *
 * Get time-series data for charts
 */
export const adminAnalyticsTimeSeriesHandler: PayloadHandler = async (req: PayloadRequest) => {
    if (req.method !== 'GET') {
        return Response.json({ error: 'Method not allowed' }, { status: 405 })
    }

    // Admin only
    if (!req.user || (req.user as { role?: string })?.role !== 'admin') {
        return Response.json({ error: 'Admin access required' }, { status: 401 })
    }

    try {
        const url = new URL(req.url || '', 'http://localhost')
        const metric = url.searchParams.get('metric') || 'users'
        const period = url.searchParams.get('period') || 'month'
        const granularity = url.searchParams.get('granularity') || 'day'

        let periodDays = 30
        switch (period) {
            case 'week':
                periodDays = 7
                break
            case 'month':
                periodDays = 30
                break
            case 'quarter':
                periodDays = 90
                break
            case 'year':
                periodDays = 365
                break
        }

        const now = new Date()
        const startDate = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000)

        // Determine collection based on metric
        let collection: string
        switch (metric) {
            case 'users':
                collection = 'device-fingerprints'
                break
            case 'votes':
                collection = 'product-votes'
                break
            case 'unlocks':
                collection = 'product-unlocks'
                break
            case 'referrals':
                collection = 'referrals'
                break
            case 'products':
                collection = 'products'
                break
            case 'submissions':
                collection = 'user-submissions'
                break
            default:
                collection = 'device-fingerprints'
        }

        // Fetch data for the period
        const { docs } = await req.payload.find({
            collection: collection as any,
            where: { createdAt: { greater_than: startDate.toISOString() } },
            limit: 10000,
            select: { createdAt: true },
        })

        // Group by date
        const dateCounts = new Map<string, number>()
        const formatDate = (date: Date): string => {
            if (granularity === 'hour') {
                return date.toISOString().slice(0, 13) + ':00:00Z'
            } else if (granularity === 'week') {
                const weekStart = new Date(date)
                weekStart.setDate(date.getDate() - date.getDay())
                return weekStart.toISOString().slice(0, 10)
            }
            return date.toISOString().slice(0, 10)
        }

        // Initialize all dates in range
        let current = new Date(startDate)
        while (current <= now) {
            dateCounts.set(formatDate(current), 0)
            if (granularity === 'hour') {
                current = new Date(current.getTime() + 60 * 60 * 1000)
            } else if (granularity === 'week') {
                current = new Date(current.getTime() + 7 * 24 * 60 * 60 * 1000)
            } else {
                current = new Date(current.getTime() + 24 * 60 * 60 * 1000)
            }
        }

        // Count by date
        for (const doc of docs as Array<{ createdAt: string }>) {
            const dateKey = formatDate(new Date(doc.createdAt))
            dateCounts.set(dateKey, (dateCounts.get(dateKey) || 0) + 1)
        }

        // Convert to array and sort
        const timeSeries: TimeSeriesPoint[] = Array.from(dateCounts.entries())
            .map(([date, value]) => ({ date, value }))
            .sort((a, b) => a.date.localeCompare(b.date))

        // Calculate cumulative if requested
        const cumulative = url.searchParams.get('cumulative') === 'true'
        if (cumulative) {
            let runningTotal = 0
            for (const point of timeSeries) {
                runningTotal += point.value
                point.value = runningTotal
            }
        }

        return Response.json({
            success: true,
            metric,
            period,
            granularity,
            cumulative,
            startDate: startDate.toISOString(),
            endDate: now.toISOString(),
            dataPoints: timeSeries.length,
            timeSeries,
        })
    } catch (error) {
        console.error('[Admin Analytics Time Series] Error:', error)
        return Response.json({
            error: error instanceof Error ? error.message : 'Failed to fetch time series',
        }, { status: 500 })
    }
}

/**
 * GET /api/admin-analytics/top-content
 *
 * Get top performing content
 */
export const adminAnalyticsTopContentHandler: PayloadHandler = async (req: PayloadRequest) => {
    if (req.method !== 'GET') {
        return Response.json({ error: 'Method not allowed' }, { status: 405 })
    }

    // Admin only
    if (!req.user || (req.user as { role?: string })?.role !== 'admin') {
        return Response.json({ error: 'Admin access required' }, { status: 401 })
    }

    try {
        const url = new URL(req.url || '', 'http://localhost')
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '10', 10), 50)
        const period = url.searchParams.get('period') || 'month'

        let periodDays = 30
        switch (period) {
            case 'week':
                periodDays = 7
                break
            case 'month':
                periodDays = 30
                break
            case 'quarter':
                periodDays = 90
                break
        }

        const startDate = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000)

        // Get most voted products
        const { docs: recentVotes } = await req.payload.find({
            collection: 'product-votes' as any,
            where: { createdAt: { greater_than: startDate.toISOString() } },
            limit: 10000,
            select: { barcode: true },
        })

        // Count votes per product
        const productVoteCounts = new Map<string, number>()
        for (const vote of recentVotes as Array<{ barcode: string }>) {
            productVoteCounts.set(vote.barcode, (productVoteCounts.get(vote.barcode) || 0) + 1)
        }

        // Sort by votes and get top N barcodes
        const topBarcodes = Array.from(productVoteCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit)

        // Fetch product details for top voted
        const topProducts = []
        for (const [barcode, voteCount] of topBarcodes) {
            const { docs: products } = await req.payload.find({
                collection: 'products',
                where: { barcode: { equals: barcode } },
                limit: 1,
                select: { id: true, title: true, barcode: true, brand: true, verdictScore: true },
            })

            if (products[0]) {
                topProducts.push({
                    ...(products[0] as object),
                    periodVotes: voteCount,
                })
            }
        }

        // Get most unlocked products
        const { docs: recentUnlocks } = await req.payload.find({
            collection: 'product-unlocks' as any,
            where: { createdAt: { greater_than: startDate.toISOString() } },
            limit: 10000,
            select: { productBarcode: true },
        })

        const unlockCounts = new Map<string, number>()
        for (const unlock of recentUnlocks as Array<{ productBarcode: string }>) {
            unlockCounts.set(unlock.productBarcode, (unlockCounts.get(unlock.productBarcode) || 0) + 1)
        }

        const topUnlockedBarcodes = Array.from(unlockCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit)

        const topUnlocked = []
        for (const [barcode, unlockCount] of topUnlockedBarcodes) {
            const { docs: products } = await req.payload.find({
                collection: 'products',
                where: { barcode: { equals: barcode } },
                limit: 1,
                select: { id: true, title: true, barcode: true, brand: true, verdictScore: true },
            })

            if (products[0]) {
                topUnlocked.push({
                    ...(products[0] as object),
                    periodUnlocks: unlockCount,
                })
            }
        }

        return Response.json({
            success: true,
            period,
            topVoted: topProducts,
            topUnlocked,
        })
    } catch (error) {
        console.error('[Admin Analytics Top Content] Error:', error)
        return Response.json({
            error: error instanceof Error ? error.message : 'Failed to fetch top content',
        }, { status: 500 })
    }
}

/**
 * GET /api/admin-analytics/funnel
 *
 * Get conversion funnel data
 */
export const adminAnalyticsFunnelHandler: PayloadHandler = async (req: PayloadRequest) => {
    if (req.method !== 'GET') {
        return Response.json({ error: 'Method not allowed' }, { status: 405 })
    }

    // Admin only
    if (!req.user || (req.user as { role?: string })?.role !== 'admin') {
        return Response.json({ error: 'Admin access required' }, { status: 401 })
    }

    try {
        const url = new URL(req.url || '', 'http://localhost')
        const period = url.searchParams.get('period') || 'month'

        let periodDays = 30
        switch (period) {
            case 'week':
                periodDays = 7
                break
            case 'month':
                periodDays = 30
                break
            case 'quarter':
                periodDays = 90
                break
        }

        const startDate = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000)

        // Fetch funnel stage counts
        const [
            newUsers,
            usersWithUnlocks,
            usersWithVotes,
            subscribedUsers,
            referringUsers,
        ] = await Promise.all([
            // Stage 1: New users this period
            req.payload.count({
                collection: 'device-fingerprints' as any,
                where: { createdAt: { greater_than: startDate.toISOString() } },
            }),
            // Stage 2: Users who unlocked at least one product
            req.payload.count({
                collection: 'device-fingerprints' as any,
                where: {
                    and: [
                        { createdAt: { greater_than: startDate.toISOString() } },
                        { totalUnlocks: { greater_than: 0 } },
                    ],
                },
            }),
            // Stage 3: Users who voted on products
            req.payload.count({
                collection: 'device-fingerprints' as any,
                where: {
                    and: [
                        { createdAt: { greater_than: startDate.toISOString() } },
                        { totalVotesSubmitted: { greater_than: 0 } },
                    ],
                },
            }),
            // Stage 4: Users who subscribed
            req.payload.count({
                collection: 'device-fingerprints' as any,
                where: {
                    and: [
                        { createdAt: { greater_than: startDate.toISOString() } },
                        { isSubscribed: { equals: true } },
                    ],
                },
            }),
            // Stage 5: Users who made referrals
            req.payload.count({
                collection: 'device-fingerprints' as any,
                where: {
                    and: [
                        { createdAt: { greater_than: startDate.toISOString() } },
                        { totalReferrals: { greater_than: 0 } },
                    ],
                },
            }),
        ])

        const funnel = [
            {
                stage: 1,
                name: 'New Users',
                count: newUsers.totalDocs,
                percentage: 100,
            },
            {
                stage: 2,
                name: 'Unlocked Product',
                count: usersWithUnlocks.totalDocs,
                percentage: newUsers.totalDocs > 0
                    ? Math.round((usersWithUnlocks.totalDocs / newUsers.totalDocs) * 100)
                    : 0,
            },
            {
                stage: 3,
                name: 'Voted on Product',
                count: usersWithVotes.totalDocs,
                percentage: newUsers.totalDocs > 0
                    ? Math.round((usersWithVotes.totalDocs / newUsers.totalDocs) * 100)
                    : 0,
            },
            {
                stage: 4,
                name: 'Subscribed',
                count: subscribedUsers.totalDocs,
                percentage: newUsers.totalDocs > 0
                    ? Math.round((subscribedUsers.totalDocs / newUsers.totalDocs) * 100)
                    : 0,
            },
            {
                stage: 5,
                name: 'Made Referrals',
                count: referringUsers.totalDocs,
                percentage: newUsers.totalDocs > 0
                    ? Math.round((referringUsers.totalDocs / newUsers.totalDocs) * 100)
                    : 0,
            },
        ]

        // Calculate drop-off rates between stages
        const dropoffs = []
        for (let i = 1; i < funnel.length; i++) {
            const prev = funnel[i - 1]
            const curr = funnel[i]
            dropoffs.push({
                from: prev.name,
                to: curr.name,
                dropoff: prev.count > 0
                    ? Math.round(((prev.count - curr.count) / prev.count) * 100)
                    : 0,
            })
        }

        return Response.json({
            success: true,
            period,
            funnel,
            dropoffs,
        })
    } catch (error) {
        console.error('[Admin Analytics Funnel] Error:', error)
        return Response.json({
            error: error instanceof Error ? error.message : 'Failed to fetch funnel data',
        }, { status: 500 })
    }
}

/**
 * GET /api/admin-analytics/export
 *
 * Export analytics data as CSV
 */
export const adminAnalyticsExportHandler: PayloadHandler = async (req: PayloadRequest) => {
    if (req.method !== 'GET') {
        return Response.json({ error: 'Method not allowed' }, { status: 405 })
    }

    // Admin only
    if (!req.user || (req.user as { role?: string })?.role !== 'admin') {
        return Response.json({ error: 'Admin access required' }, { status: 401 })
    }

    try {
        const url = new URL(req.url || '', 'http://localhost')
        const exportType = url.searchParams.get('type') || 'summary'
        const period = url.searchParams.get('period') || 'month'

        let periodDays = 30
        switch (period) {
            case 'week':
                periodDays = 7
                break
            case 'month':
                periodDays = 30
                break
            case 'quarter':
                periodDays = 90
                break
        }

        const startDate = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000)

        let csvContent = ''
        let filename = ''

        if (exportType === 'users') {
            filename = `users-export-${new Date().toISOString().slice(0, 10)}.csv`
            csvContent = 'ID,Created At,Is Subscribed,Total Unlocks,Total Votes,Has Referral Code\n'

            const { docs } = await req.payload.find({
                collection: 'device-fingerprints' as any,
                where: { createdAt: { greater_than: startDate.toISOString() } },
                limit: 10000,
                select: {
                    id: true,
                    createdAt: true,
                    isSubscribed: true,
                    totalUnlocks: true,
                    totalVotesSubmitted: true,
                    referralCode: true,
                },
            })

            for (const doc of docs as Array<{
                id: string
                createdAt: string
                isSubscribed: boolean
                totalUnlocks: number
                totalVotesSubmitted: number
                referralCode: string
            }>) {
                csvContent += `${doc.id},${doc.createdAt},${doc.isSubscribed || false},${doc.totalUnlocks || 0},${doc.totalVotesSubmitted || 0},${!!doc.referralCode}\n`
            }
        } else if (exportType === 'votes') {
            filename = `votes-export-${new Date().toISOString().slice(0, 10)}.csv`
            csvContent = 'ID,Barcode,Vote Value,Created At\n'

            const { docs } = await req.payload.find({
                collection: 'product-votes' as any,
                where: { createdAt: { greater_than: startDate.toISOString() } },
                limit: 10000,
                select: { id: true, barcode: true, voteValue: true, createdAt: true },
            })

            for (const doc of docs as Array<{
                id: string
                barcode: string
                voteValue: number
                createdAt: string
            }>) {
                csvContent += `${doc.id},${doc.barcode},${doc.voteValue},${doc.createdAt}\n`
            }
        } else {
            // Summary export
            filename = `analytics-summary-${new Date().toISOString().slice(0, 10)}.csv`

            const [totalUsers, subscribers, totalProducts, totalVotes, totalReferrals] = await Promise.all([
                req.payload.count({ collection: 'device-fingerprints' as any }),
                req.payload.count({
                    collection: 'device-fingerprints' as any,
                    where: { isSubscribed: { equals: true } },
                }),
                req.payload.count({ collection: 'products' }),
                req.payload.count({ collection: 'product-votes' as any }),
                req.payload.count({ collection: 'referrals' as any }),
            ])

            csvContent = 'Metric,Value\n'
            csvContent += `Total Users,${totalUsers.totalDocs}\n`
            csvContent += `Subscribers,${subscribers.totalDocs}\n`
            csvContent += `Subscription Rate,${totalUsers.totalDocs > 0 ? Math.round((subscribers.totalDocs / totalUsers.totalDocs) * 100) : 0}%\n`
            csvContent += `Total Products,${totalProducts.totalDocs}\n`
            csvContent += `Total Votes,${totalVotes.totalDocs}\n`
            csvContent += `Total Referrals,${totalReferrals.totalDocs}\n`
            csvContent += `Export Date,${new Date().toISOString()}\n`
            csvContent += `Period,${period}\n`
        }

        return new Response(csvContent, {
            status: 200,
            headers: {
                'Content-Type': 'text/csv',
                'Content-Disposition': `attachment; filename="${filename}"`,
            },
        })
    } catch (error) {
        console.error('[Admin Analytics Export] Error:', error)
        return Response.json({
            error: error instanceof Error ? error.message : 'Failed to export analytics',
        }, { status: 500 })
    }
}

/**
 * GET /api/admin-analytics/revenue
 *
 * Get revenue metrics from RevenueCat integration.
 * Provides MRR, subscription counts, churn rate, and daily revenue.
 */
export const adminAnalyticsRevenueHandler: PayloadHandler = async (req: PayloadRequest) => {
    if (req.method !== 'GET') {
        return Response.json({ error: 'Method not allowed' }, { status: 405 })
    }

    // Admin only
    if (!req.user || (req.user as { role?: string })?.role !== 'admin') {
        return Response.json({ error: 'Admin access required' }, { status: 401 })
    }

    try {
        const url = new URL(req.url || '', 'http://localhost')
        const period = url.searchParams.get('period') || 'week'
        const { previous } = getDateRanges(period)

        // Get subscriber counts
        const [
            totalSubscribers,
            newSubscribers,
            churnedSubscribers,
            trialUsers,
            activeReferrals,
        ] = await Promise.all([
            req.payload.count({
                collection: 'device-fingerprints' as any,
                where: { isSubscribed: { equals: true } },
            }),
            req.payload.count({
                collection: 'device-fingerprints' as any,
                where: {
                    and: [
                        { isSubscribed: { equals: true } },
                        { subscribedAt: { greater_than: previous.toISOString() } },
                    ],
                },
            }),
            req.payload.count({
                collection: 'device-fingerprints' as any,
                where: {
                    and: [
                        { isSubscribed: { equals: false } },
                        { subscriptionExpiredAt: { greater_than: previous.toISOString() } },
                    ],
                },
            }),
            req.payload.count({
                collection: 'device-fingerprints' as any,
                where: { subscriptionStatus: { equals: 'trial' } },
            }),
            req.payload.count({
                collection: 'referrals' as any,
                where: { status: { in: ['active', 'completed'] } },
            }),
        ])

        // Estimate revenue (assumes $49.99/year subscription)
        const annualPrice = 49.99
        const monthlyEquivalent = annualPrice / 12
        const estimatedMRR = totalSubscribers.totalDocs * monthlyEquivalent

        // Calculate churn rate
        const churnRate = totalSubscribers.totalDocs > 0
            ? (churnedSubscribers.totalDocs / totalSubscribers.totalDocs) * 100
            : 0

        // Get referral commission estimates
        const referralCommission = activeReferrals.totalDocs * 25 // $25/year per referral

        return Response.json({
            success: true,
            period,
            revenue: {
                estimatedMRR: Math.round(estimatedMRR * 100) / 100,
                estimatedARR: Math.round(estimatedMRR * 12 * 100) / 100,
                subscriberCount: totalSubscribers.totalDocs,
                newSubscribers: newSubscribers.totalDocs,
                churnedSubscribers: churnedSubscribers.totalDocs,
                churnRate: Math.round(churnRate * 100) / 100,
                trialUsers: trialUsers.totalDocs,
            },
            referrals: {
                activeReferrals: activeReferrals.totalDocs,
                estimatedAnnualCommission: referralCommission,
            },
            pricing: {
                annualPrice,
                monthlyEquivalent: Math.round(monthlyEquivalent * 100) / 100,
            },
            note: 'Revenue estimates based on $49.99/year subscription. For accurate data, integrate with RevenueCat API.',
            calculatedAt: new Date().toISOString(),
        })
    } catch (error) {
        console.error('[Admin Analytics Revenue] Error:', error)
        return Response.json({
            error: error instanceof Error ? error.message : 'Failed to get revenue metrics',
        }, { status: 500 })
    }
}
