'use client'

import React, { useState, useEffect, useCallback } from 'react'

interface CacheEntry {
    key: string
    category: string
    ttlMs: number
    ttlLabel: string
    cached: boolean
}

interface CategoryStats {
    total: number
    cached: number
}

interface CacheStats {
    totalEntries: number
    configuredCaches: number
    activeCaches: number
    entries: CacheEntry[]
    byCategory: Record<string, CategoryStats>
    dynamicKeys: string[]
    ttlConfig: Record<string, string>
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
    RevenueCat: { bg: '#dcfce7', text: '#166534' },
    Statsig: { bg: '#e0e7ff', text: '#4338ca' },
    Mixpanel: { bg: '#fef3c7', text: '#92400e' },
    Internal: { bg: '#f3f4f6', text: '#374151' },
    Aggregated: { bg: '#dbeafe', text: '#1e40af' },
}

const CacheStatusDashboard: React.FC = () => {
    const [stats, setStats] = useState<CacheStats | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [clearing, setClearing] = useState(false)
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

    const fetchStats = useCallback(async () => {
        try {
            const response = await fetch('/api/cache-status')
            if (!response.ok) throw new Error('Failed to fetch cache status')
            const data = await response.json()
            setStats(data)
            setLastUpdated(new Date())
            setError(null)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load')
        } finally {
            setLoading(false)
        }
    }, [])

    const handleClearCache = async () => {
        if (!confirm('Are you sure you want to clear all cached data?')) return

        setClearing(true)
        try {
            const response = await fetch('/api/cache-status', { method: 'DELETE' })
            if (!response.ok) throw new Error('Failed to clear cache')
            await fetchStats()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to clear')
        } finally {
            setClearing(false)
        }
    }

    useEffect(() => {
        fetchStats()
        const interval = setInterval(fetchStats, 10000) // Refresh every 10 seconds
        return () => clearInterval(interval)
    }, [fetchStats])

    if (loading) {
        return (
            <div style={styles.container}>
                <div style={styles.loading}>Loading cache status...</div>
            </div>
        )
    }

    if (error) {
        return (
            <div style={styles.container}>
                <div style={styles.error}>
                    <h3>Failed to Load Cache Status</h3>
                    <p>{error}</p>
                    <button onClick={fetchStats} style={styles.retryButton}>
                        Retry
                    </button>
                </div>
            </div>
        )
    }

    if (!stats) return null

    const hitRate =
        stats.configuredCaches > 0
            ? Math.round((stats.activeCaches / stats.configuredCaches) * 100)
            : 0

    return (
        <div style={styles.container}>
            {/* Header */}
            <div style={styles.header}>
                <div>
                    <h1 style={styles.title}>Cache Status</h1>
                    <p style={styles.subtitle}>In-memory cache monitoring and management</p>
                </div>
                <div style={styles.headerActions}>
                    {lastUpdated && (
                        <span style={styles.lastUpdated}>
                            Updated: {lastUpdated.toLocaleTimeString()}
                        </span>
                    )}
                    <button onClick={fetchStats} style={styles.refreshButton}>
                        Refresh
                    </button>
                    <button
                        onClick={handleClearCache}
                        disabled={clearing}
                        style={{
                            ...styles.clearButton,
                            opacity: clearing ? 0.6 : 1,
                            cursor: clearing ? 'not-allowed' : 'pointer',
                        }}
                    >
                        {clearing ? 'Clearing...' : 'Clear All'}
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div style={styles.statsRow}>
                <div style={styles.statCard}>
                    <p style={styles.statLabel}>Active Caches</p>
                    <p style={{ ...styles.statValue, color: '#3b82f6' }}>{stats.activeCaches}</p>
                </div>
                <div style={styles.statCard}>
                    <p style={styles.statLabel}>Configured</p>
                    <p style={styles.statValue}>{stats.configuredCaches}</p>
                </div>
                <div style={styles.statCard}>
                    <p style={styles.statLabel}>Hit Rate</p>
                    <p
                        style={{
                            ...styles.statValue,
                            color: hitRate >= 70 ? '#10b981' : hitRate >= 40 ? '#f59e0b' : '#6b7280',
                        }}
                    >
                        {hitRate}%
                    </p>
                </div>
                <div style={styles.statCard}>
                    <p style={styles.statLabel}>Dynamic Keys</p>
                    <p style={styles.statValue}>{stats.dynamicKeys.length}</p>
                </div>
            </div>

            {/* Category Breakdown */}
            <div style={styles.section}>
                <h2 style={styles.sectionTitle}>Cache by Category</h2>
                <div style={styles.categoryGrid}>
                    {Object.entries(stats.byCategory).map(([category, catStats]) => {
                        const colors = CATEGORY_COLORS[category] || CATEGORY_COLORS.Internal
                        const percentage =
                            catStats.total > 0
                                ? Math.round((catStats.cached / catStats.total) * 100)
                                : 0

                        return (
                            <div key={category} style={styles.categoryCard}>
                                <div style={styles.categoryHeader}>
                                    <span
                                        style={{
                                            ...styles.categoryBadge,
                                            backgroundColor: colors.bg,
                                            color: colors.text,
                                        }}
                                    >
                                        {category}
                                    </span>
                                </div>
                                <div style={styles.categoryStats}>
                                    <span style={styles.categoryCount}>
                                        {catStats.cached}/{catStats.total}
                                    </span>
                                    <span style={styles.categoryPercent}>{percentage}% cached</span>
                                </div>
                                <div style={styles.progressBar}>
                                    <div
                                        style={{
                                            ...styles.progressFill,
                                            width: `${percentage}%`,
                                            backgroundColor: colors.text,
                                        }}
                                    />
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Cache Entries Table */}
            <div style={styles.section}>
                <h2 style={styles.sectionTitle}>Cache Entries</h2>
                <div style={styles.tableContainer}>
                    <table style={styles.table}>
                        <thead>
                            <tr>
                                <th style={styles.th}>Key</th>
                                <th style={styles.th}>Category</th>
                                <th style={styles.th}>TTL</th>
                                <th style={styles.th}>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {stats.entries.map((entry) => {
                                const colors =
                                    CATEGORY_COLORS[entry.category] || CATEGORY_COLORS.Internal

                                return (
                                    <tr key={entry.key} style={styles.tr}>
                                        <td style={styles.td}>
                                            <code style={styles.code}>{entry.key}</code>
                                        </td>
                                        <td style={styles.td}>
                                            <span
                                                style={{
                                                    ...styles.smallBadge,
                                                    backgroundColor: colors.bg,
                                                    color: colors.text,
                                                }}
                                            >
                                                {entry.category}
                                            </span>
                                        </td>
                                        <td style={styles.td}>{entry.ttlLabel}</td>
                                        <td style={styles.td}>
                                            {entry.cached ? (
                                                <span style={styles.statusActive}>Active</span>
                                            ) : (
                                                <span style={styles.statusEmpty}>Empty</span>
                                            )}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Dynamic Keys */}
            {stats.dynamicKeys.length > 0 && (
                <div style={styles.section}>
                    <h2 style={styles.sectionTitle}>Dynamic Cache Keys</h2>
                    <p style={styles.sectionSubtitle}>
                        Additional cached entries not in the standard configuration
                    </p>
                    <div style={styles.dynamicKeysList}>
                        {stats.dynamicKeys.map((key) => (
                            <code key={key} style={styles.dynamicKey}>
                                {key}
                            </code>
                        ))}
                    </div>
                </div>
            )}

            {/* TTL Info */}
            <div style={styles.infoSection}>
                <h3 style={styles.infoTitle}>Cache TTL Configuration</h3>
                <div style={styles.ttlGrid}>
                    {Object.entries(stats.ttlConfig).map(([key, value]) => (
                        <div key={key} style={styles.ttlItem}>
                            <span style={styles.ttlKey}>{key}</span>
                            <span style={styles.ttlValue}>{value}</span>
                        </div>
                    ))}
                </div>
                <p style={styles.infoText}>
                    Cache is cleared automatically on server restart. Use &quot;Clear All&quot; to
                    force fresh data from external APIs.
                </p>
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
    headerActions: {
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
    clearButton: {
        padding: '8px 16px',
        background: '#ef4444',
        color: '#fff',
        border: 'none',
        borderRadius: '6px',
        fontSize: '13px',
    },
    statsRow: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
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
        fontSize: '32px',
        fontWeight: 700,
        color: '#111827',
    },
    section: {
        marginBottom: '32px',
    },
    sectionTitle: {
        margin: '0 0 4px',
        fontSize: '18px',
        fontWeight: 600,
        color: '#111827',
    },
    sectionSubtitle: {
        margin: '0 0 16px',
        fontSize: '14px',
        color: '#6b7280',
    },
    categoryGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: '12px',
    },
    categoryCard: {
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: '10px',
        padding: '16px',
    },
    categoryHeader: {
        marginBottom: '8px',
    },
    categoryBadge: {
        fontSize: '11px',
        fontWeight: 600,
        padding: '3px 8px',
        borderRadius: '4px',
        textTransform: 'uppercase',
    },
    categoryStats: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        marginBottom: '8px',
    },
    categoryCount: {
        fontSize: '20px',
        fontWeight: 700,
        color: '#111827',
    },
    categoryPercent: {
        fontSize: '12px',
        color: '#6b7280',
    },
    progressBar: {
        height: '4px',
        background: '#e5e7eb',
        borderRadius: '2px',
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        transition: 'width 0.3s ease',
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
    smallBadge: {
        fontSize: '10px',
        fontWeight: 600,
        padding: '2px 6px',
        borderRadius: '3px',
    },
    statusActive: {
        color: '#10b981',
        fontWeight: 600,
        fontSize: '13px',
    },
    statusEmpty: {
        color: '#9ca3af',
        fontSize: '13px',
    },
    dynamicKeysList: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: '8px',
    },
    dynamicKey: {
        fontSize: '12px',
        background: '#fef3c7',
        color: '#92400e',
        padding: '4px 8px',
        borderRadius: '4px',
        fontFamily: 'monospace',
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
    ttlGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
        gap: '8px',
        marginBottom: '16px',
    },
    ttlItem: {
        display: 'flex',
        justifyContent: 'space-between',
        padding: '8px 12px',
        background: '#fff',
        borderRadius: '6px',
        border: '1px solid #e5e7eb',
    },
    ttlKey: {
        fontSize: '12px',
        fontWeight: 600,
        color: '#374151',
    },
    ttlValue: {
        fontSize: '12px',
        color: '#6b7280',
    },
    infoText: {
        margin: 0,
        fontSize: '13px',
        color: '#6b7280',
    },
}

export default CacheStatusDashboard
