'use client'

import React, { useEffect, useState, useCallback } from 'react'
import type { BusinessAnalyticsResponse } from './types'
import MetricCard from './MetricCard'
import RevenueChart from './RevenueChart'
import ConversionFunnel from './ConversionFunnel'
import ExperimentResults from './ExperimentResults'
import ChurnCohortTable from './ChurnCohortTable'
import ReferralAttribution from './ReferralAttribution'
import PredictedMRR from './PredictedMRR'

const POLL_INTERVAL = 30000 // 30 seconds

const BusinessAnalyticsDashboard: React.FC = () => {
    const [data, setData] = useState<BusinessAnalyticsResponse | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

    const fetchAnalytics = useCallback(async (isInitial = false) => {
        if (isInitial) {
            setLoading(true)
        }
        setError(null)

        try {
            const response = await fetch('/api/business-analytics', {
                credentials: 'include',
            })

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                throw new Error(errorData.error || `HTTP ${response.status}`)
            }

            const analyticsData: BusinessAnalyticsResponse = await response.json()
            setData(analyticsData)
            setLastUpdated(new Date())
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to fetch analytics'
            setError(message)
            console.error('[BusinessAnalytics] Error:', err)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchAnalytics(true)

        const interval = setInterval(() => fetchAnalytics(false), POLL_INTERVAL)
        return () => clearInterval(interval)
    }, [fetchAnalytics])

    const handleRetry = () => {
        fetchAnalytics(true)
    }

    const handleExport = async (format: 'csv' | 'json') => {
        try {
            const response = await fetch(`/api/business-analytics/export?format=${format}`, {
                credentials: 'include',
            })

            if (!response.ok) {
                throw new Error(`Export failed: ${response.status}`)
            }

            // Get the blob and download it
            const blob = await response.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `analytics-export-${new Date().toISOString().split('T')[0]}.${format}`
            document.body.appendChild(a)
            a.click()
            window.URL.revokeObjectURL(url)
            document.body.removeChild(a)
        } catch (err) {
            console.error('[BusinessAnalytics] Export error:', err)
            setError(err instanceof Error ? err.message : 'Export failed')
        }
    }

    if (error && !data) {
        return (
            <div style={styles.container}>
                <div style={styles.errorContainer}>
                    <h2 style={styles.errorTitle}>Unable to Load Analytics</h2>
                    <p style={styles.errorMessage}>{error}</p>
                    <button style={styles.retryButton} onClick={handleRetry}>
                        Try Again
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div style={styles.container}>
            {/* Header */}
            <div style={styles.header}>
                <div>
                    <h1 style={styles.title}>Business Analytics</h1>
                    <p style={styles.subtitle}>Real-time metrics from RevenueCat, Mixpanel, and Statsig</p>
                </div>
                <div style={styles.headerRight}>
                    <div style={styles.exportButtons}>
                        <button
                            style={styles.exportButton}
                            onClick={() => handleExport('csv')}
                            title="Export as CSV"
                        >
                            📊 CSV
                        </button>
                        <button
                            style={styles.exportButton}
                            onClick={() => handleExport('json')}
                            title="Export as JSON"
                        >
                            📄 JSON
                        </button>
                    </div>
                    {lastUpdated && (
                        <span style={styles.lastUpdated}>
                            Last updated: {lastUpdated.toLocaleTimeString()}
                            {data?.cacheHit && ' (cached)'}
                        </span>
                    )}
                    {error && (
                        <span style={styles.warningBadge}>
                            ⚠️ Partial data
                        </span>
                    )}
                </div>
            </div>

            {/* Error alerts */}
            {data?.errors && data.errors.length > 0 && (
                <div style={styles.errorAlerts}>
                    {data.errors.map((err, index) => (
                        <div key={index} style={styles.errorAlert}>
                            <span style={styles.errorSource}>{err.source}:</span>
                            {err.message}
                        </div>
                    ))}
                </div>
            )}

            {/* Key Metrics Row */}
            <div style={styles.metricsRow}>
                <MetricCard
                    title="Daily Revenue"
                    value={data?.revenue ? `$${data.revenue.daily.toLocaleString()}` : '$0'}
                    change={data?.revenue?.dailyChange}
                    changeLabel="vs yesterday"
                    color="#3b82f6"
                    loading={loading}
                />
                <MetricCard
                    title="Weekly Revenue"
                    value={data?.revenue ? `$${data.revenue.weekly.toLocaleString()}` : '$0'}
                    change={data?.revenue?.weeklyChange}
                    changeLabel="vs last week"
                    color="#8b5cf6"
                    loading={loading}
                />
                <MetricCard
                    title="Active Trials"
                    value={data?.trials?.active?.toString() || '0'}
                    subtitle={data?.trials ? `${data.trials.started} started this week` : undefined}
                    color="#f59e0b"
                    loading={loading}
                />
                <MetricCard
                    title="Active Subscribers"
                    value={data?.revenue?.activeSubscribers?.toLocaleString() || '0'}
                    color="#10b981"
                    loading={loading}
                />
            </div>

            {/* Main Grid */}
            <div style={styles.grid}>
                {/* Left Column */}
                <div style={styles.column}>
                    <RevenueChart
                        data={data?.revenue?.dailyHistory || []}
                        loading={loading}
                    />
                    <ConversionFunnel
                        data={data?.trials || null}
                        loading={loading}
                    />
                    <ChurnCohortTable
                        data={data?.churn || null}
                        loading={loading}
                    />
                </div>

                {/* Right Column */}
                <div style={styles.column}>
                    <PredictedMRR
                        data={data?.predictedMRR || null}
                        loading={loading}
                    />
                    <ExperimentResults
                        data={data?.experiments || []}
                        loading={loading}
                    />
                    <ReferralAttribution
                        data={data?.referrals || null}
                        loading={loading}
                    />
                </div>
            </div>
        </div>
    )
}

const styles: Record<string, React.CSSProperties> = {
    container: {
        padding: '24px',
        maxWidth: '1400px',
        margin: '0 auto',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '24px',
    },
    title: {
        margin: 0,
        fontSize: '28px',
        fontWeight: 700,
        color: '#111827',
    },
    subtitle: {
        margin: '4px 0 0 0',
        fontSize: '14px',
        color: '#6b7280',
    },
    headerRight: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: '8px',
    },
    exportButtons: {
        display: 'flex',
        gap: '8px',
        marginBottom: '4px',
    },
    exportButton: {
        padding: '6px 12px',
        backgroundColor: '#f3f4f6',
        border: '1px solid #e5e7eb',
        borderRadius: '6px',
        fontSize: '12px',
        fontWeight: 500,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        transition: 'background-color 0.2s',
    },
    lastUpdated: {
        fontSize: '12px',
        color: '#9ca3af',
    },
    warningBadge: {
        fontSize: '12px',
        color: '#f59e0b',
        backgroundColor: '#fef3c7',
        padding: '4px 8px',
        borderRadius: '4px',
    },
    errorAlerts: {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        marginBottom: '16px',
    },
    errorAlert: {
        padding: '10px 14px',
        backgroundColor: '#fef2f2',
        border: '1px solid #fecaca',
        borderRadius: '6px',
        fontSize: '13px',
        color: '#991b1b',
    },
    errorSource: {
        fontWeight: 600,
        marginRight: '6px',
        textTransform: 'uppercase',
    },
    metricsRow: {
        display: 'flex',
        gap: '16px',
        marginBottom: '24px',
        flexWrap: 'wrap',
    },
    grid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '24px',
    },
    column: {
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
    },
    errorContainer: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '400px',
        textAlign: 'center',
    },
    errorTitle: {
        margin: '0 0 8px 0',
        fontSize: '20px',
        fontWeight: 600,
        color: '#111827',
    },
    errorMessage: {
        margin: '0 0 16px 0',
        fontSize: '14px',
        color: '#6b7280',
    },
    retryButton: {
        padding: '10px 20px',
        backgroundColor: '#3b82f6',
        color: '#fff',
        border: 'none',
        borderRadius: '6px',
        fontSize: '14px',
        fontWeight: 500,
        cursor: 'pointer',
    },
}

// Add responsive styles via media query workaround
if (typeof window !== 'undefined') {
    const mediaQuery = window.matchMedia('(max-width: 1024px)')
    if (mediaQuery.matches) {
        styles.grid = { ...styles.grid, gridTemplateColumns: '1fr' }
    }
}

export default BusinessAnalyticsDashboard
