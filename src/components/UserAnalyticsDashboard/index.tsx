'use client'

import React, { useState, useEffect, useCallback } from 'react'

interface UserAnalyticsData {
  summary: {
    totalUsers: number
    totalPremium: number
    totalTrial: number
    totalFree: number
    newUsersToday: number
    newUsersThisWeek: number
    newUsersThisMonth: number
  }
  signupsByDay: { date: string; count: number }[]
  usersBySubscriptionStatus: { status: string; count: number }[]
  usersByMemberState: { state: string; count: number }[]
  usersByAuthProvider: { provider: string; count: number }[]
  retentionMetrics: {
    day1Retention: number
    day7Retention: number
    day30Retention: number
  }
  growthRate: {
    weekOverWeek: number
    monthOverMonth: number
  }
  cached: boolean
  generatedAt: string
}

const UserAnalyticsDashboard: React.FC = () => {
  const [data, setData] = useState<UserAnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setLoading(true)
    try {
      const res = await fetch('/api/user-analytics')
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || `HTTP ${res.status}`)
      }
      const analytics: UserAnalyticsData = await res.json()
      setData(analytics)
      setLastUpdated(new Date())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(() => fetchData(), 60000)
    return () => clearInterval(interval)
  }, [fetchData])

  if (loading && !data) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading user analytics...</div>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div style={styles.container}>
        <div style={styles.error}>
          <h3>Failed to Load Analytics</h3>
          <p>{error}</p>
          <button onClick={() => fetchData(true)} style={styles.retryButton}>
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!data) return null

  const maxSignups = Math.max(...data.signupsByDay.map((d) => d.count), 1)

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>User Analytics</h1>
          <p style={styles.subtitle}>Signups, retention, and user engagement metrics</p>
        </div>
        <div style={styles.headerRight}>
          {lastUpdated && (
            <span style={styles.lastUpdated}>
              Updated: {lastUpdated.toLocaleTimeString()}
              {data.cached && ' (cached)'}
            </span>
          )}
          <button onClick={() => fetchData(true)} style={styles.refreshButton}>
            Refresh
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={styles.cardsRow}>
        <MetricCard
          label="Total Users"
          value={data.summary.totalUsers.toLocaleString()}
          color="#3b82f6"
        />
        <MetricCard
          label="Premium"
          value={data.summary.totalPremium.toLocaleString()}
          color="#10b981"
        />
        <MetricCard label="Trial" value={data.summary.totalTrial.toLocaleString()} color="#f59e0b" />
        <MetricCard label="Free" value={data.summary.totalFree.toLocaleString()} color="#6b7280" />
      </div>

      {/* Growth Cards */}
      <div style={styles.cardsRow}>
        <MetricCard
          label="New Today"
          value={data.summary.newUsersToday.toLocaleString()}
          color="#8b5cf6"
        />
        <MetricCard
          label="New This Week"
          value={data.summary.newUsersThisWeek.toLocaleString()}
          subtitle={`${data.growthRate.weekOverWeek >= 0 ? '+' : ''}${data.growthRate.weekOverWeek}% WoW`}
          color="#ec4899"
        />
        <MetricCard
          label="New This Month"
          value={data.summary.newUsersThisMonth.toLocaleString()}
          subtitle={`${data.growthRate.monthOverMonth >= 0 ? '+' : ''}${data.growthRate.monthOverMonth}% MoM`}
          color="#14b8a6"
        />
      </div>

      {/* Signups Chart */}
      <div style={styles.chartCard}>
        <h3 style={styles.chartTitle}>Daily Signups (Last 30 Days)</h3>
        <div style={styles.chartContainer}>
          {data.signupsByDay.map((day, i) => (
            <div key={day.date} style={styles.barContainer}>
              <div
                style={{
                  ...styles.bar,
                  height: `${(day.count / maxSignups) * 100}%`,
                  backgroundColor: i === data.signupsByDay.length - 1 ? '#3b82f6' : '#93c5fd',
                }}
                title={`${day.date}: ${day.count} signups`}
              />
              {i % 7 === 0 && (
                <span style={styles.barLabel}>{new Date(day.date).getDate()}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div style={styles.grid}>
        {/* Retention */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Retention</h3>
          <div style={styles.retentionList}>
            <RetentionRow label="Day 1" value={data.retentionMetrics.day1Retention} />
            <RetentionRow label="Day 7" value={data.retentionMetrics.day7Retention} />
            <RetentionRow label="Day 30" value={data.retentionMetrics.day30Retention} />
          </div>
        </div>

        {/* Auth Providers */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Auth Providers</h3>
          {data.usersByAuthProvider.map((p) => (
            <div key={p.provider} style={styles.listItem}>
              <span>{p.provider}</span>
              <span style={styles.listValue}>{p.count.toLocaleString()}</span>
            </div>
          ))}
        </div>

        {/* Subscription Status */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Subscription Status</h3>
          {data.usersBySubscriptionStatus.map((s) => (
            <div key={s.status} style={styles.listItem}>
              <span style={{ textTransform: 'capitalize' }}>{s.status}</span>
              <span style={styles.listValue}>{s.count.toLocaleString()}</span>
            </div>
          ))}
        </div>

        {/* Member State (PLG Funnel) */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>PLG Funnel</h3>
          {data.usersByMemberState.map((s) => (
            <div key={s.state} style={styles.listItem}>
              <span style={{ textTransform: 'capitalize' }}>{s.state}</span>
              <span style={styles.listValue}>{s.count.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const MetricCard: React.FC<{
  label: string
  value: string
  subtitle?: string
  color: string
}> = ({ label, value, subtitle, color }) => (
  <div style={styles.metricCard}>
    <p style={styles.metricLabel}>{label}</p>
    <p style={{ ...styles.metricValue, color }}>{value}</p>
    {subtitle && <p style={styles.metricSubtitle}>{subtitle}</p>}
  </div>
)

const RetentionRow: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div style={styles.retentionRow}>
    <span>{label}</span>
    <div style={styles.retentionBarContainer}>
      <div
        style={{
          ...styles.retentionBar,
          width: `${value}%`,
          backgroundColor: value >= 50 ? '#10b981' : value >= 25 ? '#f59e0b' : '#ef4444',
        }}
      />
    </div>
    <span style={styles.retentionValue}>{value}%</span>
  </div>
)

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '24px',
    maxWidth: '1200px',
    margin: '0 auto',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  loading: {
    textAlign: 'center',
    padding: '60px',
    color: '#6b7280',
    fontSize: '16px',
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
    fontSize: '14px',
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
  cardsRow: {
    display: 'flex',
    gap: '16px',
    marginBottom: '24px',
    flexWrap: 'wrap',
  },
  metricCard: {
    flex: '1 1 150px',
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '20px',
    minWidth: '140px',
  },
  metricLabel: {
    margin: 0,
    fontSize: '13px',
    color: '#6b7280',
    fontWeight: 500,
  },
  metricValue: {
    margin: '8px 0 0',
    fontSize: '32px',
    fontWeight: 700,
  },
  metricSubtitle: {
    margin: '4px 0 0',
    fontSize: '12px',
    color: '#9ca3af',
  },
  chartCard: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '24px',
  },
  chartTitle: {
    margin: '0 0 16px',
    fontSize: '16px',
    fontWeight: 600,
    color: '#111827',
  },
  chartContainer: {
    display: 'flex',
    alignItems: 'flex-end',
    height: '150px',
    gap: '2px',
  },
  barContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    height: '100%',
    position: 'relative',
  },
  bar: {
    width: '100%',
    borderRadius: '2px 2px 0 0',
    minHeight: '2px',
    transition: 'height 0.3s ease',
  },
  barLabel: {
    position: 'absolute',
    bottom: '-20px',
    fontSize: '10px',
    color: '#9ca3af',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '16px',
  },
  card: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '20px',
  },
  cardTitle: {
    margin: '0 0 16px',
    fontSize: '16px',
    fontWeight: 600,
    color: '#111827',
  },
  listItem: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px 0',
    borderBottom: '1px solid #f3f4f6',
    fontSize: '14px',
    color: '#374151',
  },
  listValue: {
    fontWeight: 600,
    color: '#111827',
  },
  retentionList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  retentionRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    fontSize: '14px',
  },
  retentionBarContainer: {
    flex: 1,
    height: '8px',
    background: '#e5e7eb',
    borderRadius: '4px',
    overflow: 'hidden',
  },
  retentionBar: {
    height: '100%',
    borderRadius: '4px',
    transition: 'width 0.3s ease',
  },
  retentionValue: {
    width: '40px',
    textAlign: 'right',
    fontWeight: 600,
    color: '#111827',
  },
}

export default UserAnalyticsDashboard
