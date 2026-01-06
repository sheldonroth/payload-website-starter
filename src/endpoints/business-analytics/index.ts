/**
 * Business Analytics API Endpoint
 *
 * Aggregates metrics from RevenueCat, Mixpanel, Statsig, and
 * internal Payload collections into a single dashboard response.
 *
 * GET /api/business-analytics
 *
 * Requires admin authentication.
 */

import type { Endpoint } from 'payload'
import type {
    BusinessAnalyticsResponse,
    DataSourceError,
} from '../../components/BusinessAnalyticsDashboard/types'
import { fetchRevenueCatData } from './revenuecat-service'
import { fetchMixpanelData } from './mixpanel-service'
import { fetchStatsigData } from './statsig-service'
import {
    calculateChurnByCohort,
    calculateReferralAttribution,
    predictMRR,
} from './metrics-calculator'
import { analyticsCache, CACHE_TTL, CACHE_KEYS } from './cache'

export const businessAnalyticsEndpoint: Endpoint = {
    path: '/business-analytics',
    method: 'get',
    handler: async (req) => {
        const payload = req.payload

        // Check authentication
        if (!req.user) {
            return Response.json(
                { error: 'Unauthorized - Login required' },
                { status: 401 }
            )
        }

        // Check admin role
        const role = (req.user as { role?: string }).role
        const isAdmin = (req.user as { isAdmin?: boolean }).isAdmin
        if (role !== 'admin' && !isAdmin) {
            return Response.json(
                { error: 'Forbidden - Admin access required' },
                { status: 403 }
            )
        }

        // Check full response cache first
        const cachedResponse = analyticsCache.get<BusinessAnalyticsResponse>(CACHE_KEYS.FULL_RESPONSE)
        if (cachedResponse) {
            return Response.json({
                ...cachedResponse,
                cacheHit: true,
            })
        }

        const errors: DataSourceError[] = []
        const startTime = Date.now()

        // Fetch all data sources in parallel with graceful error handling
        const [
            revenueResult,
            trialsResult,
            experimentsResult,
            churnResult,
            referralsResult,
            mrrResult,
        ] = await Promise.allSettled([
            fetchRevenueCatData(),
            fetchMixpanelData(),
            fetchStatsigData(),
            calculateChurnByCohort(payload),
            calculateReferralAttribution(payload),
            predictMRR(payload),
        ])

        // Process results with error tracking
        const revenue = revenueResult.status === 'fulfilled'
            ? revenueResult.value
            : (errors.push({
                source: 'revenuecat',
                message: revenueResult.reason?.message || 'Failed to fetch revenue data',
                timestamp: new Date().toISOString(),
            }), null)

        const trials = trialsResult.status === 'fulfilled'
            ? trialsResult.value
            : (errors.push({
                source: 'mixpanel',
                message: trialsResult.reason?.message || 'Failed to fetch trial data',
                timestamp: new Date().toISOString(),
            }), null)

        const experiments = experimentsResult.status === 'fulfilled'
            ? experimentsResult.value
            : (errors.push({
                source: 'statsig',
                message: experimentsResult.reason?.message || 'Failed to fetch experiments',
                timestamp: new Date().toISOString(),
            }), [])

        const churn = churnResult.status === 'fulfilled'
            ? churnResult.value
            : (errors.push({
                source: 'internal',
                message: churnResult.reason?.message || 'Failed to calculate churn',
                timestamp: new Date().toISOString(),
            }), null)

        const referrals = referralsResult.status === 'fulfilled'
            ? referralsResult.value
            : (errors.push({
                source: 'internal',
                message: referralsResult.reason?.message || 'Failed to calculate referrals',
                timestamp: new Date().toISOString(),
            }), null)

        const predictedMRR = mrrResult.status === 'fulfilled'
            ? mrrResult.value
            : (errors.push({
                source: 'internal',
                message: mrrResult.reason?.message || 'Failed to predict MRR',
                timestamp: new Date().toISOString(),
            }), null)

        const response: BusinessAnalyticsResponse = {
            revenue,
            trials,
            experiments,
            churn,
            referrals,
            predictedMRR,
            lastUpdated: new Date().toISOString(),
            cacheHit: false,
            errors,
        }

        // Cache the full response
        analyticsCache.set(CACHE_KEYS.FULL_RESPONSE, response, CACHE_TTL.AGGREGATED)

        const duration = Date.now() - startTime
        console.log(`[BusinessAnalytics] Generated response in ${duration}ms with ${errors.length} errors`)

        return Response.json(response)
    },
}

export default businessAnalyticsEndpoint
