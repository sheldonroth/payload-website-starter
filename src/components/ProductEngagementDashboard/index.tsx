'use client'

import React, { useState, useEffect, useCallback } from 'react'

interface EngagementData {
  summary: {
    totalUnlocks: number
    unlocksToday: number
    unlocksThisWeek: number
    unlocksThisMonth: number
    uniqueProducts: number
    uniqueUsers: number
    conversionRate: number
  }
  unlocksByDay: { date: string; count: number }[]
  topProducts: { id: number; name: string; unlocks: number; category?: string }[]
  topCategories: { name: string; unlocks: number }[]
  unlockTypeBreakdown: { type: string; count: number; percentage: number }[]
  archetypeBreakdown: { archetype: string; count: number }[]
  conversionFunnel: {
    freeUnlocks: number
    subscriptionUnlocks: number
    convertedUsers: number
    conversionRate: number
  }
  cached: boolean
  generatedAt: string
}

const ProductEngagementDashboard: React.FC = () => {
  const [data, setData] = useState<EngagementData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setLoading(true)
    try {
      const res = await fetch('/api/product-engagement-analytics')
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || `HTTP ${res.status}`)
      }
      const analytics: EngagementData = await res.json()
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
        <div style={styles.loading}>Loading product engagement analytics...</div>
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

  const maxUnlocks = Math.max(...data.unlocksByDay.map((d) => d.count), 1)

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Product Engagement</h1>
          <p style={styles.subtitle}>Unlocks, scans, and conversion metrics</p>
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
          label="Total Unlocks"
          value={data.summary.totalUnlocks.toLocaleString()}
          color="#3b82f6"
        />
        <MetricCard
          label="Today"
          value={data.summary.unlocksToday.toLocaleString()}
          color="#10b981"
        />
        <MetricCard
          label="This Week"
          value={data.summary.unlocksThisWeek.toLocaleString()}
          color="#8b5cf6"
        />
        <MetricCard
          label="This Month"
          value={data.summary.unlocksThisMonth.toLocaleString()}
          color="#f59e0b"
        />
      </div>

      {/* Unique Stats */}
      <div style={styles.cardsRow}>
        <MetricCard
          label="Unique Products"
          value={data.summary.uniqueProducts.toLocaleString()}
          subtitle="products unlocked"
          color="#ec4899"
        />
        <MetricCard
          label="Unique Users"
          value={data.summary.uniqueUsers.toLocaleString()}
          subtitle="who unlocked"
          color="#14b8a6"
        />
        <MetricCard
          label="Conversion Rate"
          value={`${data.summary.conversionRate}%`}
          subtitle="free → paid"
          color="#22c55e"
        />
      </div>

      {/* Unlocks Chart */}
      <div style={styles.chartCard}>
        <h3 style={styles.chartTitle}>Daily Unlocks (Last 30 Days)</h3>
        <div style={styles.chartContainer}>
          {data.unlocksByDay.map((day, i) => (
            <div key={day.date} style={styles.barContainer}>
              <div
                style={{
                  ...styles.bar,
                  height: `${(day.count / maxUnlocks) * 100}%`,
                  backgroundColor: i === data.unlocksByDay.length - 1 ? '#8b5cf6' : '#c4b5fd',
                }}
                title={`${day.date}: ${day.count} unlocks`}
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
        {/* Top Products */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Top Products</h3>
          {data.topProducts.length === 0 ? (
            <p style={styles.emptyText}>No unlock data yet</p>
          ) : (
            data.topProducts.map((product, i) => (
              <div key={product.id} style={styles.listItem}>
                <div style={styles.listItemLeft}>
                  <span style={styles.rank}>{i + 1}</span>
                  <div>
                    <div style={styles.productName}>{product.name}</div>
                    {product.category && (
                      <div style={styles.productCategory}>{product.category}</div>
                    )}
                  </div>
                </div>
                <span style={styles.listValue}>{product.unlocks}</span>
              </div>
            ))
          )}
        </div>

        {/* Top Categories */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Top Categories</h3>
          {data.topCategories.length === 0 ? (
            <p style={styles.emptyText}>No category data yet</p>
          ) : (
            data.topCategories.map((category) => (
              <div key={category.name} style={styles.listItem}>
                <span>{category.name}</span>
                <span style={styles.listValue}>{category.unlocks}</span>
              </div>
            ))
          )}
        </div>

        {/* Unlock Type Breakdown */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Unlock Types</h3>
          {data.unlockTypeBreakdown.map((item) => (
            <div key={item.type} style={styles.typeItem}>
              <div style={styles.typeHeader}>
                <span>{item.type}</span>
                <span>{item.count.toLocaleString()} ({item.percentage}%)</span>
              </div>
              <div style={styles.progressBar}>
                <div
                  style={{
                    ...styles.progressFill,
                    width: `${item.percentage}%`,
                    backgroundColor:
                      item.type === 'Free Credit'
                        ? '#f59e0b'
                        : item.type === 'Subscription'
                          ? '#10b981'
                          : '#6b7280',
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Conversion Funnel */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Conversion Funnel</h3>
          <div style={styles.funnelContainer}>
            <div style={styles.funnelStep}>
              <div style={{ ...styles.funnelBar, width: '100%', backgroundColor: '#f59e0b' }} />
              <span>Free Unlocks: {data.conversionFunnel.freeUnlocks}</span>
            </div>
            <div style={styles.funnelStep}>
              <div
                style={{
                  ...styles.funnelBar,
                  width: `${data.conversionFunnel.freeUnlocks > 0 ? (data.conversionFunnel.convertedUsers / data.conversionFunnel.freeUnlocks) * 100 : 0}%`,
                  backgroundColor: '#10b981',
                }}
              />
              <span>Converted: {data.conversionFunnel.convertedUsers}</span>
            </div>
            <div style={styles.conversionRate}>
              <span style={styles.conversionLabel}>Conversion Rate</span>
              <span style={styles.conversionValue}>{data.conversionFunnel.conversionRate}%</span>
            </div>
          </div>
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
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
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
  emptyText: {
    color: '#9ca3af',
    fontSize: '14px',
    textAlign: 'center',
    padding: '20px 0',
  },
  listItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 0',
    borderBottom: '1px solid #f3f4f6',
    fontSize: '14px',
    color: '#374151',
  },
  listItemLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  rank: {
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    background: '#f3f4f6',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    fontWeight: 600,
    color: '#6b7280',
  },
  productName: {
    fontWeight: 500,
  },
  productCategory: {
    fontSize: '12px',
    color: '#9ca3af',
  },
  listValue: {
    fontWeight: 600,
    color: '#111827',
  },
  typeItem: {
    marginBottom: '12px',
  },
  typeHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '13px',
    marginBottom: '4px',
  },
  progressBar: {
    height: '8px',
    background: '#e5e7eb',
    borderRadius: '4px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: '4px',
    transition: 'width 0.3s ease',
  },
  funnelContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  funnelStep: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    fontSize: '13px',
  },
  funnelBar: {
    height: '24px',
    borderRadius: '4px',
    minWidth: '4px',
  },
  conversionRate: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px',
    background: '#f0fdf4',
    borderRadius: '8px',
    marginTop: '8px',
  },
  conversionLabel: {
    fontSize: '14px',
    fontWeight: 500,
    color: '#166534',
  },
  conversionValue: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#16a34a',
  },
}

export default ProductEngagementDashboard
