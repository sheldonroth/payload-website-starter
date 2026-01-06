/**
 * Statsig Console API Service
 *
 * Fetches experiment results and feature gate status from Statsig.
 * Uses the Console API for analytics data.
 *
 * API Docs: https://docs.statsig.com/console-api/experiments
 */

import type { ExperimentResults, ExperimentVariant } from '../../components/BusinessAnalyticsDashboard/types'
import { analyticsCache, CACHE_TTL, CACHE_KEYS } from './cache'

const STATSIG_API_BASE = 'https://statsigapi.net/console/v1'

interface StatsigExperiment {
    id: string
    name: string
    status: 'active' | 'setup' | 'decision_made' | 'abandoned'
    hypothesis?: string
    groups: StatsigGroup[]
    results?: StatsigResults
}

interface StatsigGroup {
    name: string
    size: number
    parameterValues: Record<string, unknown>
}

interface StatsigResults {
    groups: StatsigGroupResult[]
    metrics: StatsigMetricResult[]
}

interface StatsigGroupResult {
    name: string
    users: number
    conversion_rate?: number
}

interface StatsigMetricResult {
    name: string
    values: {
        group_name: string
        value: number
        confidence_interval?: [number, number]
        is_statistically_significant?: boolean
    }[]
}

interface StatsigExperimentsResponse {
    data: StatsigExperiment[]
    has_more: boolean
}

/**
 * Fetch experiment results from Statsig
 */
export async function fetchStatsigData(): Promise<ExperimentResults[]> {
    // Check cache first
    const cached = analyticsCache.get<ExperimentResults[]>(CACHE_KEYS.EXPERIMENTS)
    if (cached) {
        return cached
    }

    const apiKey = process.env.STATSIG_CONSOLE_API_KEY
    if (!apiKey) {
        console.warn('[Statsig] STATSIG_CONSOLE_API_KEY not configured')
        return []
    }

    try {
        // Fetch all experiments
        const response = await fetch(`${STATSIG_API_BASE}/experiments`, {
            headers: {
                'STATSIG-API-KEY': apiKey,
                'Content-Type': 'application/json',
            },
        })

        if (!response.ok) {
            console.error(`[Statsig] API error: ${response.status}`)
            return []
        }

        const data: StatsigExperimentsResponse = await response.json()

        // Filter to active experiments and format results
        const experiments = await Promise.all(
            data.data
                .filter(exp => exp.status === 'active' || exp.status === 'decision_made')
                .slice(0, 5) // Limit to 5 most relevant
                .map(exp => formatExperiment(exp, apiKey))
        )

        analyticsCache.set(CACHE_KEYS.EXPERIMENTS, experiments, CACHE_TTL.STATSIG)
        return experiments

    } catch (error) {
        console.error('[Statsig] Error fetching experiments:', error)
        return []
    }
}

/**
 * Format a Statsig experiment into our standard format
 */
async function formatExperiment(
    experiment: StatsigExperiment,
    apiKey: string
): Promise<ExperimentResults> {
    // Fetch detailed results if available
    let results: StatsigResults | null = null
    try {
        const resultsResponse = await fetch(
            `${STATSIG_API_BASE}/experiments/${experiment.id}/results`,
            {
                headers: {
                    'STATSIG-API-KEY': apiKey,
                    'Content-Type': 'application/json',
                },
            }
        )

        if (resultsResponse.ok) {
            results = await resultsResponse.json()
        }
    } catch (error) {
        console.error(`[Statsig] Error fetching results for ${experiment.name}:`, error)
    }

    // Map status to our format
    const statusMap: Record<string, 'running' | 'completed' | 'paused'> = {
        'active': 'running',
        'decision_made': 'completed',
        'setup': 'paused',
        'abandoned': 'paused',
    }

    // Build variants from groups and results
    const variants: ExperimentVariant[] = experiment.groups.map(group => {
        const groupResult = results?.groups?.find(g => g.name === group.name)
        const primaryMetric = results?.metrics?.[0]
        const metricValue = primaryMetric?.values?.find(v => v.group_name === group.name)

        return {
            name: group.name,
            conversionRate: groupResult?.conversion_rate ?? metricValue?.value ?? 0,
            statisticalSignificance: metricValue?.is_statistically_significant ? 0.95 : 0,
            isWinning: false, // Will be calculated below
            sampleSize: groupResult?.users ?? 0,
        }
    })

    // Determine winner (highest conversion rate with statistical significance)
    if (variants.length > 1) {
        const significantVariants = variants.filter(v => v.statisticalSignificance >= 0.95)
        if (significantVariants.length > 0) {
            const winner = significantVariants.reduce((a, b) =>
                a.conversionRate > b.conversionRate ? a : b
            )
            winner.isWinning = true
        } else {
            // If no significant results, mark the control as baseline
            const control = variants.find(v =>
                v.name.toLowerCase().includes('control') ||
                v.name.toLowerCase() === 'control'
            )
            if (control) {
                // Find variant with highest lift over control
                const best = variants
                    .filter(v => v !== control)
                    .reduce((a, b) =>
                        (a.conversionRate - control.conversionRate) >
                            (b.conversionRate - control.conversionRate) ? a : b
                        , variants[0]
                    )
                if (best && best.conversionRate > control.conversionRate) {
                    best.isWinning = true
                }
            }
        }
    }

    return {
        name: experiment.name,
        status: statusMap[experiment.status] || 'paused',
        variants,
    }
}

/**
 * Get a specific experiment by name
 */
export async function getExperiment(experimentName: string): Promise<ExperimentResults | null> {
    const experiments = await fetchStatsigData()
    return experiments.find(exp =>
        exp.name.toLowerCase() === experimentName.toLowerCase()
    ) || null
}

/**
 * Get list of active experiment names
 */
export async function getActiveExperimentNames(): Promise<string[]> {
    const apiKey = process.env.STATSIG_CONSOLE_API_KEY
    if (!apiKey) {
        return []
    }

    try {
        const response = await fetch(`${STATSIG_API_BASE}/experiments`, {
            headers: {
                'STATSIG-API-KEY': apiKey,
                'Content-Type': 'application/json',
            },
        })

        if (!response.ok) {
            return []
        }

        const data: StatsigExperimentsResponse = await response.json()
        return data.data
            .filter(exp => exp.status === 'active')
            .map(exp => exp.name)

    } catch (error) {
        console.error('[Statsig] Error fetching experiment names:', error)
        return []
    }
}
