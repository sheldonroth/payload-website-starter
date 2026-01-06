/**
 * Business Analytics Dashboard Types
 *
 * Type definitions for the real-time analytics dashboard
 * that aggregates data from RevenueCat, Mixpanel, Statsig,
 * and internal Payload collections.
 */

// Revenue metrics from RevenueCat
export interface RevenueMetrics {
    daily: number
    weekly: number
    dailyChange: number // percentage change from previous day
    weeklyChange: number // percentage change from previous week
    dailyHistory: DailyRevenue[]
    activeSubscribers: number // total active subscribers
}

export interface DailyRevenue {
    date: string // ISO date string
    amount: number
}

// Trial and conversion metrics from Mixpanel
export interface TrialMetrics {
    started: number
    active: number // currently active trials
    converted: number
    conversionRate: number // 0-1
    trialHistory: DailyTrials[]
}

export interface DailyTrials {
    date: string
    started: number
    converted: number
}

// Experiment results from Statsig
export interface ExperimentResults {
    name: string
    status: 'running' | 'completed' | 'paused'
    variants: ExperimentVariant[]
}

export interface ExperimentVariant {
    name: string
    conversionRate: number
    statisticalSignificance: number // 0-1
    isWinning: boolean
    sampleSize: number
}

// Churn metrics from internal data
export interface ChurnMetrics {
    overall: number // overall churn rate
    byCohort: CohortChurn[]
}

export interface CohortChurn {
    cohortMonth: string // e.g., "2025-10"
    totalUsers: number
    churned: number
    churnRate: number
    retained: number
}

// Referral metrics from Referrals collection
export interface ReferralMetrics {
    totalReferrals: number
    activeReferrals: number
    pendingReferrals: number
    bySource: ReferralSource[]
    commissionPending: number
    commissionPaid: number
    topReferrers: TopReferrer[]
}

export interface ReferralSource {
    source: 'mobile' | 'web' | 'link'
    count: number
    conversions: number
    conversionRate: number
}

export interface TopReferrer {
    referrerId: string
    referralCode: string
    totalReferrals: number
    activeReferrals: number
    totalCommission: number
}

// MRR prediction from calculations
export interface MRRPrediction {
    current: number
    predicted30Day: number
    predicted90Day: number
    confidence: number // 0-1
    trend: 'up' | 'down' | 'stable'
    growthRate: number // monthly growth rate
}

// Main response from the API endpoint
export interface BusinessAnalyticsResponse {
    revenue: RevenueMetrics | null
    trials: TrialMetrics | null
    experiments: ExperimentResults[]
    churn: ChurnMetrics | null
    referrals: ReferralMetrics | null
    predictedMRR: MRRPrediction | null
    lastUpdated: string
    cacheHit: boolean
    errors: DataSourceError[]
}

export interface DataSourceError {
    source: 'revenuecat' | 'mixpanel' | 'statsig' | 'internal'
    message: string
    timestamp: string
}

// Component props
export interface MetricCardProps {
    title: string
    value: string | number
    subtitle?: string
    change?: number
    changeLabel?: string
    color?: string
    loading?: boolean
    error?: string
}

export interface ChartDataPoint {
    label: string
    value: number
    color?: string
}

// Dashboard state
export interface DashboardState {
    data: BusinessAnalyticsResponse | null
    loading: boolean
    error: string | null
    lastFetch: Date | null
}
