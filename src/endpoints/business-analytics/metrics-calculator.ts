/**
 * Internal Metrics Calculator
 *
 * Calculates analytics metrics from Payload CMS collections:
 * - Churn by cohort (DeviceFingerprints)
 * - Referral attribution (Referrals, ReferralPayouts)
 * - MRR prediction (calculated from subscription data)
 */

import type { Payload } from 'payload'
import type {
    ChurnMetrics,
    CohortChurn,
    ReferralMetrics,
    ReferralSource,
    TopReferrer,
    MRRPrediction,
} from '../../components/BusinessAnalyticsDashboard/types'
import { analyticsCache, CACHE_TTL, CACHE_KEYS } from './cache'
import { getCurrentMRR, getSubscriptionCounts } from './revenuecat-service'

/**
 * Calculate churn metrics by cohort
 */
export async function calculateChurnByCohort(payload: Payload): Promise<ChurnMetrics> {
    // Check cache
    const cached = analyticsCache.get<ChurnMetrics>(CACHE_KEYS.CHURN)
    if (cached) {
        return cached
    }

    try {
        // Get subscription counts from RevenueCat
        const counts = await getSubscriptionCounts()

        // Query DeviceFingerprints grouped by cohort (month of first seen)
        const fingerprints = await payload.find({
            collection: 'device-fingerprints',
            limit: 10000,
            depth: 0,
        })

        // Group by cohort month
        const cohortMap = new Map<string, { total: number; churned: number }>()

        for (const fp of fingerprints.docs) {
            const firstSeen = (fp as any).firstSeen || (fp as any).createdAt
            if (!firstSeen) continue

            const cohortMonth = new Date(firstSeen).toISOString().slice(0, 7) // YYYY-MM
            const status = (fp as any).subscriptionStatus

            if (!cohortMap.has(cohortMonth)) {
                cohortMap.set(cohortMonth, { total: 0, churned: 0 })
            }

            const cohort = cohortMap.get(cohortMonth)!
            cohort.total++

            if (status === 'cancelled' || status === 'expired' || status === 'churned') {
                cohort.churned++
            }
        }

        // Convert to array and calculate rates
        const byCohort: CohortChurn[] = Array.from(cohortMap.entries())
            .map(([cohortMonth, { total, churned }]) => ({
                cohortMonth,
                totalUsers: total,
                churned,
                churnRate: total > 0 ? Math.round((churned / total) * 1000) / 1000 : 0,
                retained: total - churned,
            }))
            .sort((a, b) => b.cohortMonth.localeCompare(a.cohortMonth))
            .slice(0, 6) // Last 6 months

        // Calculate overall churn rate
        const totalUsers = byCohort.reduce((sum, c) => sum + c.totalUsers, 0)
        const totalChurned = byCohort.reduce((sum, c) => sum + c.churned, 0)
        const overall = totalUsers > 0 ? totalChurned / totalUsers : 0

        const result: ChurnMetrics = {
            overall: Math.round(overall * 1000) / 1000,
            byCohort,
        }

        analyticsCache.set(CACHE_KEYS.CHURN, result, CACHE_TTL.INTERNAL)
        return result

    } catch (error) {
        console.error('[MetricsCalculator] Error calculating churn:', error)
        return {
            overall: 0,
            byCohort: [],
        }
    }
}

/**
 * Calculate referral attribution metrics
 */
export async function calculateReferralAttribution(payload: Payload): Promise<ReferralMetrics> {
    // Check cache
    const cached = analyticsCache.get<ReferralMetrics>(CACHE_KEYS.REFERRALS)
    if (cached) {
        return cached
    }

    try {
        // Query all referrals
        const referrals = await payload.find({
            collection: 'referrals' as any,
            limit: 10000,
            depth: 0,
        })

        // Query payouts for commission totals
        const payouts = await payload.find({
            collection: 'referral-payouts' as any,
            limit: 1000,
            depth: 0,
        })

        // Count by status
        let totalReferrals = 0
        let activeReferrals = 0
        let pendingReferrals = 0

        // Group by source
        const sourceMap = new Map<string, { count: number; conversions: number }>()

        // Track top referrers
        const referrerMap = new Map<string, {
            referralCode: string
            total: number
            active: number
            commission: number
        }>()

        for (const ref of referrals.docs) {
            totalReferrals++

            const status = (ref as any).status
            const source = (ref as any).source || 'mobile'
            const referrerId = (ref as any).referrerId
            const referralCode = (ref as any).referralCode
            const commission = (ref as any).totalCommissionPaid || 0

            // Count by status
            if (status === 'active') {
                activeReferrals++
            } else if (status === 'pending') {
                pendingReferrals++
            }

            // Aggregate by source
            if (!sourceMap.has(source)) {
                sourceMap.set(source, { count: 0, conversions: 0 })
            }
            const sourceStats = sourceMap.get(source)!
            sourceStats.count++
            if (status === 'active') {
                sourceStats.conversions++
            }

            // Track top referrers
            if (referrerId) {
                if (!referrerMap.has(referrerId)) {
                    referrerMap.set(referrerId, {
                        referralCode: referralCode || '',
                        total: 0,
                        active: 0,
                        commission: 0,
                    })
                }
                const referrer = referrerMap.get(referrerId)!
                referrer.total++
                if (status === 'active') {
                    referrer.active++
                }
                referrer.commission += commission
            }
        }

        // Format by source
        const bySource: ReferralSource[] = Array.from(sourceMap.entries())
            .map(([source, { count, conversions }]) => ({
                source: source as 'mobile' | 'web' | 'link',
                count,
                conversions,
                conversionRate: count > 0 ? Math.round((conversions / count) * 1000) / 1000 : 0,
            }))

        // Get top 5 referrers
        const topReferrers: TopReferrer[] = Array.from(referrerMap.entries())
            .map(([referrerId, stats]) => ({
                referrerId,
                referralCode: stats.referralCode,
                totalReferrals: stats.total,
                activeReferrals: stats.active,
                totalCommission: stats.commission,
            }))
            .sort((a, b) => b.activeReferrals - a.activeReferrals)
            .slice(0, 5)

        // Calculate commission totals from payouts
        let commissionPaid = 0
        let commissionPending = 0

        for (const payout of payouts.docs) {
            const amount = (payout as any).amount || 0
            const status = (payout as any).status

            if (status === 'paid') {
                commissionPaid += amount
            } else if (status === 'pending' || status === 'processing') {
                commissionPending += amount
            }
        }

        const result: ReferralMetrics = {
            totalReferrals,
            activeReferrals,
            pendingReferrals,
            bySource,
            commissionPending,
            commissionPaid,
            topReferrers,
        }

        analyticsCache.set(CACHE_KEYS.REFERRALS, result, CACHE_TTL.INTERNAL)
        return result

    } catch (error) {
        console.error('[MetricsCalculator] Error calculating referrals:', error)
        return {
            totalReferrals: 0,
            activeReferrals: 0,
            pendingReferrals: 0,
            bySource: [],
            commissionPending: 0,
            commissionPaid: 0,
            topReferrers: [],
        }
    }
}

/**
 * Calculate actual trial-to-premium conversion rate from Users collection
 */
async function calculateActualConversionRate(payload: Payload): Promise<number> {
    try {
        // Count users who have ever been on trial (have trialStartDate set)
        const trialUsers = await payload.find({
            collection: 'users',
            where: {
                trialStartDate: { exists: true },
            },
            limit: 0,
        })

        // Count users who converted to premium
        const premiumUsers = await payload.find({
            collection: 'users',
            where: {
                subscriptionStatus: { equals: 'premium' },
                trialStartDate: { exists: true },
            },
            limit: 0,
        })

        const totalTrials = trialUsers.totalDocs
        const converted = premiumUsers.totalDocs

        if (totalTrials === 0) {
            return 0.3 // Default fallback if no trial data
        }

        const conversionRate = converted / totalTrials
        console.log(`[MetricsCalculator] Actual conversion rate: ${(conversionRate * 100).toFixed(1)}% (${converted}/${totalTrials})`)

        return conversionRate
    } catch (error) {
        console.error('[MetricsCalculator] Error calculating conversion rate:', error)
        return 0.3 // Fallback to 30%
    }
}

/**
 * Predict MRR based on current trends
 */
export async function predictMRR(payload: Payload): Promise<MRRPrediction> {
    // Check cache
    const cached = analyticsCache.get<MRRPrediction>(CACHE_KEYS.MRR)
    if (cached) {
        return cached
    }

    try {
        // Get current MRR from RevenueCat
        const currentMRR = await getCurrentMRR()

        // Get subscription counts for growth calculation
        const counts = await getSubscriptionCounts()

        // Calculate actual conversion rate from historical data
        const actualConversionRate = await calculateActualConversionRate(payload)

        // Calculate monthly growth rate using actual conversion rate
        const newSubscribersPerWeek = counts.trials * actualConversionRate
        const monthlyGrowth = (newSubscribersPerWeek * 4) / Math.max(counts.active, 1)

        // Calculate churn impact
        const monthlyChurn = (counts.churned7d * 4) / Math.max(counts.active, 1)

        // Net growth rate
        const netGrowthRate = monthlyGrowth - monthlyChurn

        // Project MRR
        const predicted30Day = currentMRR * (1 + netGrowthRate)
        const predicted90Day = currentMRR * Math.pow(1 + netGrowthRate, 3)

        // Determine trend
        let trend: 'up' | 'down' | 'stable' = 'stable'
        if (netGrowthRate > 0.02) trend = 'up'
        else if (netGrowthRate < -0.02) trend = 'down'

        // Confidence based on data quality
        // Higher confidence with more active subscribers and actual conversion data
        const hasActualData = actualConversionRate !== 0.3
        const baseConfidence = hasActualData ? 0.6 : 0.4
        const confidence = Math.min(0.95, baseConfidence + (counts.active / 1000) * 0.3)

        const result: MRRPrediction = {
            current: Math.round(currentMRR),
            predicted30Day: Math.round(predicted30Day),
            predicted90Day: Math.round(predicted90Day),
            confidence: Math.round(confidence * 100) / 100,
            trend,
            growthRate: Math.round(netGrowthRate * 1000) / 1000,
        }

        analyticsCache.set(CACHE_KEYS.MRR, result, CACHE_TTL.INTERNAL)
        return result

    } catch (error) {
        console.error('[MetricsCalculator] Error predicting MRR:', error)
        return {
            current: 0,
            predicted30Day: 0,
            predicted90Day: 0,
            confidence: 0,
            trend: 'stable',
            growthRate: 0,
        }
    }
}
