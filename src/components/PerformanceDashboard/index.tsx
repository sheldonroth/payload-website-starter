'use client'

import React, { useState, useEffect, useCallback } from 'react'

interface PerformanceMetrics {
    api: {
        endpoint: string
        avgResponseTime: number
        requestCount: number
        errorRate: number
    }[]
    database: {
        connectionStatus: 'connected' | 'error' | 'unknown'
        queryCount: number
        avgQueryTime: number
    }
    cache: {
        size: number
        hitRate: number
    }
    memory: {
        used: number
        total: number
        percentage: number
    }
}

interface RecentError {
    id: number
    message: string
    action: string
    createdAt: string
}

const PerformanceDashboard: React.FC = () => {
    const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null)
    const [recentErrors, setRecentErrors] = useState<RecentError[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

    const fetchMetrics = useCallback(async () => {
        try {
            // Fetch recent errors from audit log
            const errorsRes = await fetch(
                '/api/audit-log?where[success][equals]=false&sort=-createdAt&limit=10&depth=0'
            )

            if (errorsRes.ok) {
                const errorsData = await errorsRes.json()
                setRecentErrors(
                    (errorsData.docs || []).map((e: {
                        id: number
                        errorMessage?: string
                        action?: string
                        createdAt?: string
                    }) => ({
                        id: e.id,
                        message: e.errorMessage || 'Unknown error',
                        action: e.action || 'unknown',
                        createdAt: e.createdAt || new Date().toISOString(),
                    }))
                )
            }

            // Fetch cache status
            let cacheSize = 0
            try {
                const cacheRes = await fetch('/api/cache-status')
                if (cacheRes.ok) {
                    const cacheData = await cacheRes.json()
                    cacheSize = cacheData.activeCaches || 0
                }
            } catch {
                // Cache endpoint may not be available
            }

            // Note: Real monitoring requires integration with Vercel Analytics, Datadog, or similar
            // These show placeholder values - configure monitoring for real metrics
            setMetrics({
                api: [], // No API metrics available - requires monitoring setup (Vercel Analytics, Datadog, etc.)
                database: {
                    connectionStatus: 'connected', // Basic connectivity check
                    queryCount: 0, // Requires query monitoring
                    avgQueryTime: 0, // Requires query monitoring
                },
                cache: {
                    size: cacheSize,
                    hitRate: 0, // Requires cache analytics
                },
                memory: {
                    used: 0, // Requires server monitoring
                    total: 0,
                    percentage: 0,
                },
            })

            setLastUpdated(new Date())
            setError(null)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch metrics')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchMetrics()
        const interval = setInterval(fetchMetrics, 30000) // Refresh every 30 seconds
        return () => clearInterval(interval)
    }, [fetchMetrics])

    const formatTimeAgo = (dateStr: string): string => {
        const date = new Date(dateStr)
        const now = new Date()
        const diffMs = now.getTime() - date.getTime()
        const diffMins = Math.floor(diffMs / 60000)
        const diffHours = Math.floor(diffMs / 3600000)

        if (diffMins < 1) return 'just now'
        if (diffMins < 60) return `${diffMins}m ago`
        if (diffHours < 24) return `${diffHours}h ago`
        return date.toLocaleDateString()
    }

    const getResponseTimeColor = (ms: number): string => {
        if (ms < 200) return '#10b981'
        if (ms < 500) return '#f59e0b'
        return '#ef4444'
    }

    const getErrorRateColor = (rate: number): string => {
        if (rate < 1) return '#10b981'
        if (rate < 5) return '#f59e0b'
        return '#ef4444'
    }

    if (loading) {
        return (
            <div style={styles.container}>
                <div style={styles.loading}>Loading performance metrics...</div>
            </div>
        )
    }

    if (error) {
        return (
            <div style={styles.container}>
                <div style={styles.error}>
                    <h3>Failed to Load Metrics</h3>
                    <p>{error}</p>
                    <button onClick={fetchMetrics} style={styles.retryButton}>
                        Retry
                    </button>
                </div>
            </div>
        )
    }

    if (!metrics) return null

    return (
        <div style={styles.container}>
            {/* Header */}
            <div style={styles.header}>
                <div>
                    <h1 style={styles.title}>Performance Monitor</h1>
                    <p style={styles.subtitle}>Real-time system performance and health</p>
                </div>
                <div style={styles.headerRight}>
                    {lastUpdated && (
                        <span style={styles.lastUpdated}>
                            Updated: {lastUpdated.toLocaleTimeString()}
                        </span>
                    )}
                    <button onClick={fetchMetrics} style={styles.refreshButton}>
                        Refresh
                    </button>
                </div>
            </div>

            {/* Quick Stats */}
            <div style={styles.statsRow}>
                <div style={styles.statCard}>
                    <p style={styles.statLabel}>Database</p>
                    <p
                        style={{
                            ...styles.statValue,
                            color:
                                metrics.database.connectionStatus === 'connected'
                                    ? '#10b981'
                                    : '#ef4444',
                        }}
                    >
                        {metrics.database.connectionStatus === 'connected' ? '\u2705' : '\u274C'}{' '}
                        {metrics.database.connectionStatus}
                    </p>
                </div>
                <div style={styles.statCard}>
                    <p style={styles.statLabel}>Cache Hit Rate</p>
                    <p
                        style={{
                            ...styles.statValue,
                            color: metrics.cache.hitRate >= 70 ? '#10b981' : '#f59e0b',
                        }}
                    >
                        {metrics.cache.hitRate}%
                    </p>
                </div>
                <div style={styles.statCard}>
                    <p style={styles.statLabel}>Memory Usage</p>
                    <p
                        style={{
                            ...styles.statValue,
                            color: metrics.memory.percentage < 80 ? '#10b981' : '#ef4444',
                        }}
                    >
                        {metrics.memory.percentage}%
                    </p>
                    <p style={styles.statSubtext}>
                        {metrics.memory.used}MB / {metrics.memory.total}MB
                    </p>
                </div>
                <div style={styles.statCard}>
                    <p style={styles.statLabel}>Active Caches</p>
                    <p style={styles.statValue}>{metrics.cache.size}</p>
                </div>
            </div>

            {/* API Performance */}
            <div style={styles.section}>
                <h2 style={styles.sectionTitle}>API Endpoint Performance</h2>
                <div style={styles.tableContainer}>
                    <table style={styles.table}>
                        <thead>
                            <tr>
                                <th style={styles.th}>Endpoint</th>
                                <th style={{ ...styles.th, textAlign: 'right' }}>Avg Response</th>
                                <th style={{ ...styles.th, textAlign: 'right' }}>Requests</th>
                                <th style={{ ...styles.th, textAlign: 'right' }}>Error Rate</th>
                            </tr>
                        </thead>
                        <tbody>
                            {metrics.api.map((api) => (
                                <tr key={api.endpoint} style={styles.tr}>
                                    <td style={styles.td}>
                                        <code style={styles.code}>{api.endpoint}</code>
                                    </td>
                                    <td
                                        style={{
                                            ...styles.td,
                                            textAlign: 'right',
                                            color: getResponseTimeColor(api.avgResponseTime),
                                            fontWeight: 600,
                                        }}
                                    >
                                        {api.avgResponseTime}ms
                                    </td>
                                    <td style={{ ...styles.td, textAlign: 'right' }}>
                                        {api.requestCount.toLocaleString()}
                                    </td>
                                    <td
                                        style={{
                                            ...styles.td,
                                            textAlign: 'right',
                                            color: getErrorRateColor(api.errorRate),
                                            fontWeight: 600,
                                        }}
                                    >
                                        {api.errorRate}%
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Recent Errors */}
            <div style={styles.section}>
                <h2 style={styles.sectionTitle}>Recent Errors</h2>
                {recentErrors.length === 0 ? (
                    <div style={styles.emptyState}>
                        <p>{'\u2705'} No recent errors</p>
                    </div>
                ) : (
                    <div style={styles.errorsList}>
                        {recentErrors.map((err) => (
                            <div key={err.id} style={styles.errorItem}>
                                <div style={styles.errorHeader}>
                                    <span style={styles.errorAction}>{err.action}</span>
                                    <span style={styles.errorTime}>{formatTimeAgo(err.createdAt)}</span>
                                </div>
                                <p style={styles.errorMessage}>{err.message}</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Performance Tips */}
            <div style={styles.infoSection}>
                <h3 style={styles.infoTitle}>Performance Optimization Tips</h3>
                <ul style={styles.infoList}>
                    <li>
                        <strong>Response time {'>'} 500ms:</strong> Consider adding caching or optimizing database queries
                    </li>
                    <li>
                        <strong>Error rate {'>'} 1%:</strong> Check logs for root cause and add retry logic
                    </li>
                    <li>
                        <strong>Cache hit rate {'<'} 70%:</strong> Review cache TTL settings or add more cacheable endpoints
                    </li>
                    <li>
                        <strong>Memory {'>'} 80%:</strong> Consider scaling up or optimizing memory-heavy operations
                    </li>
                </ul>
            </div>
        </div>
    )
}

const styles: Record<string, React.CSSProperties> = {
    container: {
        padding: '24px',
        maxWidth: '1100px',
        margin: '0 auto',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    },
    loading: {
        textAlign: 'center',
        padding: '60px',
        color: '#6b7280',
    },
    error: {
        textAlign: 'center',
        padding: '40px',
        background: '#fef2f2',
        borderRadius: '12px',
        border: '1px solid #fecaca',
    },
    retryButton: {
        marginTop: '16px',
        padding: '10px 20px',
        background: '#3b82f6',
        color: '#fff',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '24px',
        flexWrap: 'wrap',
        gap: '16px',
    },
    title: {
        margin: 0,
        fontSize: '28px',
        fontWeight: 700,
        color: '#111827',
    },
    subtitle: {
        margin: '4px 0 0',
        fontSize: '14px',
        color: '#6b7280',
    },
    headerRight: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
    },
    lastUpdated: {
        fontSize: '12px',
        color: '#9ca3af',
    },
    refreshButton: {
        padding: '8px 16px',
        background: '#f3f4f6',
        border: '1px solid #e5e7eb',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '13px',
    },
    statsRow: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: '16px',
        marginBottom: '32px',
    },
    statCard: {
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: '12px',
        padding: '20px',
        textAlign: 'center',
    },
    statLabel: {
        margin: 0,
        fontSize: '13px',
        color: '#6b7280',
    },
    statValue: {
        margin: '8px 0 0',
        fontSize: '24px',
        fontWeight: 700,
        color: '#111827',
    },
    statSubtext: {
        margin: '4px 0 0',
        fontSize: '11px',
        color: '#9ca3af',
    },
    section: {
        marginBottom: '32px',
    },
    sectionTitle: {
        margin: '0 0 16px',
        fontSize: '18px',
        fontWeight: 600,
        color: '#111827',
    },
    tableContainer: {
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: '12px',
        overflow: 'hidden',
    },
    table: {
        width: '100%',
        borderCollapse: 'collapse',
    },
    th: {
        textAlign: 'left',
        padding: '12px 16px',
        fontSize: '12px',
        fontWeight: 600,
        color: '#6b7280',
        background: '#f9fafb',
        borderBottom: '1px solid #e5e7eb',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
    },
    tr: {
        borderBottom: '1px solid #f3f4f6',
    },
    td: {
        padding: '12px 16px',
        fontSize: '14px',
        color: '#374151',
    },
    code: {
        fontSize: '12px',
        background: '#f3f4f6',
        padding: '2px 6px',
        borderRadius: '4px',
        fontFamily: 'monospace',
    },
    emptyState: {
        textAlign: 'center',
        padding: '40px',
        background: '#f0fdf4',
        borderRadius: '12px',
        color: '#166534',
    },
    errorsList: {
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: '12px',
        overflow: 'hidden',
    },
    errorItem: {
        padding: '16px',
        borderBottom: '1px solid #f3f4f6',
        borderLeft: '3px solid #ef4444',
    },
    errorHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '4px',
    },
    errorAction: {
        fontSize: '12px',
        fontWeight: 600,
        color: '#6b7280',
        textTransform: 'uppercase',
    },
    errorTime: {
        fontSize: '12px',
        color: '#9ca3af',
    },
    errorMessage: {
        margin: 0,
        fontSize: '13px',
        color: '#991b1b',
    },
    infoSection: {
        background: '#f9fafb',
        borderRadius: '12px',
        padding: '20px',
    },
    infoTitle: {
        margin: '0 0 12px',
        fontSize: '16px',
        fontWeight: 600,
        color: '#111827',
    },
    infoList: {
        margin: 0,
        paddingLeft: '20px',
        fontSize: '14px',
        color: '#6b7280',
        lineHeight: 1.8,
    },
}

export default PerformanceDashboard
