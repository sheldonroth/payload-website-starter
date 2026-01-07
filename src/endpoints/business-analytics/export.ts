/**
 * Business Analytics Export Endpoint
 *
 * Exports analytics data in CSV or JSON format for download.
 *
 * GET /api/business-analytics/export?format=csv|json
 *
 * Requires admin authentication.
 */

import type { Endpoint } from 'payload'
import type { BusinessAnalyticsResponse } from '../../components/BusinessAnalyticsDashboard/types'
import { fetchRevenueCatData } from './revenuecat-service'
import { fetchMixpanelData } from './mixpanel-service'
import { fetchStatsigData } from './statsig-service'
import {
    calculateChurnByCohort,
    calculateReferralAttribution,
    predictMRR,
} from './metrics-calculator'

/**
 * Convert analytics data to CSV format
 */
function toCSV(data: BusinessAnalyticsResponse): string {
    const lines: string[] = []
    const timestamp = new Date().toISOString()

    // Header
    lines.push('Business Analytics Export')
    lines.push(`Generated: ${timestamp}`)
    lines.push('')

    // Revenue Metrics
    lines.push('=== REVENUE METRICS ===')
    lines.push('Metric,Value')
    if (data.revenue) {
        lines.push(`Daily Revenue,$${data.revenue.daily.toFixed(2)}`)
        lines.push(`Weekly Revenue,$${data.revenue.weekly.toFixed(2)}`)
        lines.push(`Daily Change,${data.revenue.dailyChange}%`)
        lines.push(`Weekly Change,${data.revenue.weeklyChange}%`)
        lines.push(`Active Subscribers,${data.revenue.activeSubscribers}`)
    }
    lines.push('')

    // Daily Revenue History
    lines.push('=== DAILY REVENUE HISTORY ===')
    lines.push('Date,Amount')
    if (data.revenue?.dailyHistory) {
        for (const day of data.revenue.dailyHistory) {
            lines.push(`${day.date},$${day.amount.toFixed(2)}`)
        }
    }
    lines.push('')

    // Trial Metrics
    lines.push('=== TRIAL METRICS ===')
    lines.push('Metric,Value')
    if (data.trials) {
        lines.push(`Active Trials,${data.trials.active}`)
        lines.push(`Trials Started (Week),${data.trials.started}`)
        lines.push(`Converted,${data.trials.converted}`)
        lines.push(`Conversion Rate,${(data.trials.conversionRate * 100).toFixed(1)}%`)
    }
    lines.push('')

    // Churn Metrics
    lines.push('=== CHURN BY COHORT ===')
    lines.push('Cohort Month,Total Users,Churned,Churn Rate,Retained')
    if (data.churn?.byCohort) {
        for (const cohort of data.churn.byCohort) {
            lines.push(`${cohort.cohortMonth},${cohort.totalUsers},${cohort.churned},${(cohort.churnRate * 100).toFixed(1)}%,${cohort.retained}`)
        }
    }
    lines.push('')

    // MRR Prediction
    lines.push('=== MRR PREDICTION ===')
    lines.push('Metric,Value')
    if (data.predictedMRR) {
        lines.push(`Current MRR,$${data.predictedMRR.current}`)
        lines.push(`30-Day Prediction,$${data.predictedMRR.predicted30Day}`)
        lines.push(`90-Day Prediction,$${data.predictedMRR.predicted90Day}`)
        lines.push(`Growth Rate,${(data.predictedMRR.growthRate * 100).toFixed(1)}%`)
        lines.push(`Confidence,${(data.predictedMRR.confidence * 100).toFixed(0)}%`)
        lines.push(`Trend,${data.predictedMRR.trend}`)
    }
    lines.push('')

    // Referral Metrics
    lines.push('=== REFERRAL METRICS ===')
    lines.push('Metric,Value')
    if (data.referrals) {
        lines.push(`Total Referrals,${data.referrals.totalReferrals}`)
        lines.push(`Active Referrals,${data.referrals.activeReferrals}`)
        lines.push(`Pending Referrals,${data.referrals.pendingReferrals}`)
        lines.push(`Commission Paid,$${data.referrals.commissionPaid.toFixed(2)}`)
        lines.push(`Commission Pending,$${data.referrals.commissionPending.toFixed(2)}`)
    }
    lines.push('')

    // Referral Sources
    lines.push('=== REFERRAL BY SOURCE ===')
    lines.push('Source,Count,Conversions,Conversion Rate')
    if (data.referrals?.bySource) {
        for (const source of data.referrals.bySource) {
            lines.push(`${source.source},${source.count},${source.conversions},${(source.conversionRate * 100).toFixed(1)}%`)
        }
    }
    lines.push('')

    // Experiments
    lines.push('=== EXPERIMENTS ===')
    lines.push('Experiment,Status,Variant,Conversion Rate,Sample Size,Winning')
    if (data.experiments) {
        for (const exp of data.experiments) {
            for (const variant of exp.variants) {
                lines.push(`${exp.name},${exp.status},${variant.name},${(variant.conversionRate * 100).toFixed(2)}%,${variant.sampleSize},${variant.isWinning ? 'Yes' : 'No'}`)
            }
        }
    }

    return lines.join('\n')
}

export const businessAnalyticsExportEndpoint: Endpoint = {
    path: '/business-analytics/export',
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

        // Get format from query params
        const url = new URL(req.url || '', 'http://localhost')
        const format = url.searchParams.get('format') || 'json'

        // Fetch all data
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

        const data: BusinessAnalyticsResponse = {
            revenue: revenueResult.status === 'fulfilled' ? revenueResult.value : null,
            trials: trialsResult.status === 'fulfilled' ? trialsResult.value : null,
            experiments: experimentsResult.status === 'fulfilled' ? experimentsResult.value : [],
            churn: churnResult.status === 'fulfilled' ? churnResult.value : null,
            referrals: referralsResult.status === 'fulfilled' ? referralsResult.value : null,
            predictedMRR: mrrResult.status === 'fulfilled' ? mrrResult.value : null,
            lastUpdated: new Date().toISOString(),
            cacheHit: false,
            errors: [],
        }

        const timestamp = new Date().toISOString().split('T')[0]

        if (format === 'csv') {
            const csv = toCSV(data)
            return new Response(csv, {
                headers: {
                    'Content-Type': 'text/csv',
                    'Content-Disposition': `attachment; filename="analytics-export-${timestamp}.csv"`,
                },
            })
        }

        // Default to JSON
        return new Response(JSON.stringify(data, null, 2), {
            headers: {
                'Content-Type': 'application/json',
                'Content-Disposition': `attachment; filename="analytics-export-${timestamp}.json"`,
            },
        })
    },
}

export default businessAnalyticsExportEndpoint
