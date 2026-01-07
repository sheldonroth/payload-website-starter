'use client'

/**
 * Mixpanel Analytics Dashboard
 *
 * Comprehensive analytics dashboard for business decision making.
 * Displays engagement metrics, funnels, cohorts, and user growth from Mixpanel.
 */

import React, { useState, useEffect, useCallback } from 'react'

// Types
interface EngagementMetrics {
  dau: number
  dauChange: number
  wau: number
  wauChange: number
  mau: number
  mauChange: number
  retentionRate: number
  retentionChange: number
  avgSessionDuration: number
  sessionsPerUser: number
}

interface FunnelStep {
  name: string
  count: number
  percentage: number
  dropOff: number
}

interface CohortRow {
  cohort: string
  size: number
  week1: number
  week2: number
  week3: number
  week4: number
}

interface TopEvent {
  name: string
  count: number
  uniqueUsers: number
  trend: number
}

interface UserGrowth {
  date: string
  newUsers: number
  totalUsers: number
}

interface FeatureUsage {
  feature: string
  usage: number
  uniqueUsers: number
}

interface RevenueMetrics {
  mrr: number
  mrrChange: number
  trialStarts: number
  trialConversionRate: number
  churnRate: number
  ltv: number
}

interface SurvivorshipBias {
  zeroActionSessions: number
  paywallBounces: number
  purchaseAbandoned: number
}

interface DashboardData {
  engagement: EngagementMetrics
  funnel: FunnelStep[]
  cohorts: CohortRow[]
  topEvents: TopEvent[]
  userGrowth: UserGrowth[]
  featureUsage: FeatureUsage[]
  revenue: RevenueMetrics
  survivorshipBias: SurvivorshipBias
  lastUpdated: string
  cacheHit: boolean
  errors: string[]
}

// Styles
const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '24px',
    maxWidth: '1600px',
    margin: '0 auto',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
    flexWrap: 'wrap',
    gap: '16px',
  },
  title: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#111827',
    margin: 0,
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  logo: {
    width: '36px',
    height: '36px',
    borderRadius: '8px',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  rangeSelector: {
    display: 'flex',
    gap: '4px',
    background: '#f3f4f6',
    padding: '4px',
    borderRadius: '8px',
  },
  rangeButton: {
    padding: '8px 16px',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'all 0.2s',
  },
  rangeButtonActive: {
    background: '#fff',
    color: '#111827',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  rangeButtonInactive: {
    background: 'transparent',
    color: '#6b7280',
  },
  refreshButton: {
    padding: '8px 16px',
    background: '#8b5cf6',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  lastUpdated: {
    fontSize: '13px',
    color: '#9ca3af',
  },
  metricsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
    marginBottom: '24px',
  },
  card: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '20px',
  },
  metricCard: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '20px',
    textAlign: 'center' as const,
  },
  metricValue: {
    fontSize: '32px',
    fontWeight: '700',
    color: '#111827',
    lineHeight: 1.2,
  },
  metricLabel: {
    fontSize: '14px',
    color: '#6b7280',
    marginTop: '4px',
  },
  metricChange: {
    fontSize: '13px',
    marginTop: '8px',
    fontWeight: '500',
  },
  changePositive: {
    color: '#10b981',
  },
  changeNegative: {
    color: '#ef4444',
  },
  sectionTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#111827',
    marginBottom: '16px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  grid2: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '24px',
    marginBottom: '24px',
  },
  grid3: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '24px',
    marginBottom: '24px',
  },
  funnel: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
  },
  funnelStep: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  funnelBar: {
    height: '40px',
    background: 'linear-gradient(135deg, #8b5cf6, #a78bfa)',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 16px',
    color: '#fff',
    fontWeight: '500',
    transition: 'width 0.5s ease',
  },
  funnelLabel: {
    width: '100px',
    fontSize: '14px',
    color: '#374151',
    fontWeight: '500',
  },
  funnelStats: {
    fontSize: '12px',
    color: '#6b7280',
    width: '80px',
    textAlign: 'right' as const,
  },
  dropOff: {
    color: '#ef4444',
    fontSize: '11px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: '14px',
  },
  th: {
    textAlign: 'left' as const,
    padding: '12px 16px',
    borderBottom: '2px solid #e5e7eb',
    color: '#6b7280',
    fontWeight: '600',
    fontSize: '12px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  td: {
    padding: '12px 16px',
    borderBottom: '1px solid #f3f4f6',
    color: '#374151',
  },
  cohortCell: {
    padding: '8px 12px',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: '500',
    textAlign: 'center' as const,
  },
  featureBar: {
    height: '24px',
    background: '#e0e7ff',
    borderRadius: '4px',
    position: 'relative' as const,
    overflow: 'hidden' as const,
  },
  featureBarFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
    borderRadius: '4px',
    transition: 'width 0.5s ease',
  },
  chartContainer: {
    height: '200px',
    display: 'flex',
    alignItems: 'flex-end',
    gap: '4px',
    padding: '16px 0',
  },
  chartBar: {
    flex: 1,
    background: 'linear-gradient(to top, #8b5cf6, #a78bfa)',
    borderRadius: '4px 4px 0 0',
    minWidth: '20px',
    transition: 'height 0.3s ease',
    position: 'relative' as const,
  },
  warningCard: {
    background: '#fef3c7',
    border: '1px solid #fcd34d',
    borderRadius: '12px',
    padding: '16px',
    marginBottom: '16px',
  },
  warningTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#92400e',
    marginBottom: '8px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  warningItem: {
    fontSize: '13px',
    color: '#a16207',
    marginBottom: '4px',
  },
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '400px',
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '3px solid #e5e7eb',
    borderTopColor: '#8b5cf6',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  errorContainer: {
    textAlign: 'center' as const,
    padding: '60px 24px',
    background: '#fef2f2',
    borderRadius: '12px',
    border: '1px solid #fecaca',
  },
  errorTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#dc2626',
    marginBottom: '8px',
  },
  errorMessage: {
    color: '#991b1b',
    marginBottom: '16px',
  },
  retryButton: {
    padding: '10px 24px',
    background: '#ef4444',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
  },
}

// Metric Card Component
const MetricCard: React.FC<{
  value: string | number
  label: string
  change?: number
  changeLabel?: string
  color?: string
}> = ({ value, label, change, changeLabel, color }) => (
  <div style={styles.metricCard}>
    <div style={{ ...styles.metricValue, color: color || '#111827' }}>{value}</div>
    <div style={styles.metricLabel}>{label}</div>
    {change !== undefined && (
      <div style={{
        ...styles.metricChange,
        ...(change >= 0 ? styles.changePositive : styles.changeNegative),
      }}>
        {change >= 0 ? '+' : ''}{change}% {changeLabel || 'vs prev period'}
      </div>
    )}
  </div>
)

// Funnel Chart Component
const FunnelChart: React.FC<{ steps: FunnelStep[] }> = ({ steps }) => {
  const maxCount = steps[0]?.count || 1

  return (
    <div style={styles.funnel}>
      {steps.map((step, i) => (
        <div key={step.name} style={styles.funnelStep}>
          <div style={styles.funnelLabel}>{step.name}</div>
          <div style={{ flex: 1 }}>
            <div
              style={{
                ...styles.funnelBar,
                width: `${Math.max(step.percentage, 10)}%`,
                opacity: 1 - (i * 0.12),
              }}
            >
              <span>{step.count.toLocaleString()}</span>
              <span>{step.percentage}%</span>
            </div>
          </div>
          <div style={styles.funnelStats}>
            {step.dropOff > 0 && (
              <div style={styles.dropOff}>-{step.dropOff}% drop</div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// Cohort Table Component
const CohortTable: React.FC<{ cohorts: CohortRow[] }> = ({ cohorts }) => {
  const getCellColor = (value: number): string => {
    if (value >= 40) return '#dcfce7'
    if (value >= 30) return '#d1fae5'
    if (value >= 20) return '#fef9c3'
    if (value >= 10) return '#fed7aa'
    return '#fecaca'
  }

  return (
    <table style={styles.table}>
      <thead>
        <tr>
          <th style={styles.th}>Cohort</th>
          <th style={styles.th}>Size</th>
          <th style={styles.th}>Week 1</th>
          <th style={styles.th}>Week 2</th>
          <th style={styles.th}>Week 3</th>
          <th style={styles.th}>Week 4</th>
        </tr>
      </thead>
      <tbody>
        {cohorts.map(row => (
          <tr key={row.cohort}>
            <td style={styles.td}>{row.cohort}</td>
            <td style={styles.td}>{row.size}</td>
            {[row.week1, row.week2, row.week3, row.week4].map((val, i) => (
              <td key={i} style={styles.td}>
                <div style={{ ...styles.cohortCell, background: getCellColor(val) }}>
                  {val}%
                </div>
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// Feature Usage Chart
const FeatureUsageChart: React.FC<{ features: FeatureUsage[] }> = ({ features }) => {
  const maxUsage = Math.max(...features.map(f => f.usage)) || 1

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {features.map(f => (
        <div key={f.feature} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '120px', fontSize: '13px', color: '#374151' }}>{f.feature}</div>
          <div style={{ ...styles.featureBar, flex: 1 }}>
            <div
              style={{
                ...styles.featureBarFill,
                width: `${(f.usage / maxUsage) * 100}%`,
              }}
            />
          </div>
          <div style={{ width: '80px', fontSize: '13px', color: '#6b7280', textAlign: 'right' }}>
            {f.usage.toLocaleString()}
          </div>
        </div>
      ))}
    </div>
  )
}

// User Growth Chart
const UserGrowthChart: React.FC<{ data: UserGrowth[] }> = ({ data }) => {
  const maxUsers = Math.max(...data.map(d => d.newUsers)) || 1

  return (
    <div style={styles.chartContainer}>
      {data.map((d, i) => (
        <div
          key={d.date}
          style={{
            ...styles.chartBar,
            height: `${(d.newUsers / maxUsers) * 100}%`,
            minHeight: '4px',
          }}
          title={`${d.date}: ${d.newUsers} new users`}
        />
      ))}
    </div>
  )
}

// Top Events Table
const TopEventsTable: React.FC<{ events: TopEvent[] }> = ({ events }) => (
  <table style={styles.table}>
    <thead>
      <tr>
        <th style={styles.th}>Event</th>
        <th style={{ ...styles.th, textAlign: 'right' }}>Count</th>
        <th style={{ ...styles.th, textAlign: 'right' }}>Users</th>
        <th style={{ ...styles.th, textAlign: 'right' }}>Trend</th>
      </tr>
    </thead>
    <tbody>
      {events.slice(0, 10).map(event => (
        <tr key={event.name}>
          <td style={styles.td}>
            <code style={{
              background: '#f3f4f6',
              padding: '2px 8px',
              borderRadius: '4px',
              fontSize: '13px'
            }}>
              {event.name}
            </code>
          </td>
          <td style={{ ...styles.td, textAlign: 'right', fontWeight: '600' }}>
            {event.count.toLocaleString()}
          </td>
          <td style={{ ...styles.td, textAlign: 'right', color: '#6b7280' }}>
            {event.uniqueUsers.toLocaleString()}
          </td>
          <td style={{
            ...styles.td,
            textAlign: 'right',
            color: event.trend >= 0 ? '#10b981' : '#ef4444',
            fontWeight: '500',
          }}>
            {event.trend >= 0 ? '+' : ''}{event.trend}%
          </td>
        </tr>
      ))}
    </tbody>
  </table>
)

// Survivorship Bias Warning
const SurvivorshipBiasWarning: React.FC<{ data: SurvivorshipBias }> = ({ data }) => {
  if (data.zeroActionSessions === 0 && data.paywallBounces === 0) return null

  return (
    <div style={styles.warningCard}>
      <div style={styles.warningTitle}>
        <span>Warning: Survivorship Bias Detected</span>
      </div>
      {data.zeroActionSessions > 0 && (
        <div style={styles.warningItem}>
          {data.zeroActionSessions.toLocaleString()} zero-action sessions (users who opened but did nothing)
        </div>
      )}
      {data.paywallBounces > 0 && (
        <div style={styles.warningItem}>
          {data.paywallBounces.toLocaleString()} paywall bounces (immediate exits from paywall)
        </div>
      )}
      {data.purchaseAbandoned > 0 && (
        <div style={styles.warningItem}>
          {data.purchaseAbandoned.toLocaleString()} abandoned purchases
        </div>
      )}
    </div>
  )
}

// Main Dashboard Component
const MixpanelDashboard: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [range, setRange] = useState<'7d' | '30d' | '90d'>('30d')

  const fetchData = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/mixpanel-dashboard?range=${range}`, {
        credentials: 'include',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      const result = await response.json()
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data')
    } finally {
      setLoading(false)
    }
  }, [range])

  useEffect(() => {
    fetchData(true)
    const interval = setInterval(() => fetchData(false), 30000)
    return () => clearInterval(interval)
  }, [fetchData])

  // Loading State
  if (loading && !data) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingContainer}>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          <div style={styles.spinner} />
        </div>
      </div>
    )
  }

  // Error State
  if (error && !data) {
    return (
      <div style={styles.container}>
        <div style={styles.errorContainer}>
          <div style={styles.errorTitle}>Failed to Load Dashboard</div>
          <div style={styles.errorMessage}>{error}</div>
          <button style={styles.retryButton} onClick={() => fetchData(true)}>
            Try Again
          </button>
        </div>
      </div>
    )
  }

  if (!data) return null

  return (
    <div style={styles.container}>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>

      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
            <rect width="36" height="36" rx="8" fill="#7C3AED"/>
            <path d="M18 8L26 13V23L18 28L10 23V13L18 8Z" fill="white"/>
          </svg>
          Mixpanel Analytics
        </h1>
        <div style={styles.headerRight}>
          <div style={styles.rangeSelector}>
            {(['7d', '30d', '90d'] as const).map(r => (
              <button
                key={r}
                onClick={() => setRange(r)}
                style={{
                  ...styles.rangeButton,
                  ...(range === r ? styles.rangeButtonActive : styles.rangeButtonInactive),
                }}
              >
                {r === '7d' ? '7 Days' : r === '30d' ? '30 Days' : '90 Days'}
              </button>
            ))}
          </div>
          <button style={styles.refreshButton} onClick={() => fetchData(true)}>
            Refresh
          </button>
          <span style={styles.lastUpdated}>
            {data.cacheHit && '(cached) '}
            Updated {new Date(data.lastUpdated).toLocaleTimeString()}
          </span>
        </div>
      </div>

      {/* Survivorship Bias Warning */}
      <SurvivorshipBiasWarning data={data.survivorshipBias} />

      {/* Errors Alert */}
      {data.errors.length > 0 && (
        <div style={{ ...styles.warningCard, background: '#fef2f2', borderColor: '#fecaca' }}>
          <div style={{ ...styles.warningTitle, color: '#dc2626' }}>
            Data Fetch Errors
          </div>
          {data.errors.map((err, i) => (
            <div key={i} style={{ ...styles.warningItem, color: '#991b1b' }}>{err}</div>
          ))}
        </div>
      )}

      {/* Key Metrics */}
      <div style={styles.metricsRow}>
        <MetricCard
          value={data.engagement.dau.toLocaleString()}
          label="Daily Active Users"
          change={data.engagement.dauChange}
          color="#3b82f6"
        />
        <MetricCard
          value={data.engagement.wau.toLocaleString()}
          label="Weekly Active Users"
          change={data.engagement.wauChange}
          color="#8b5cf6"
        />
        <MetricCard
          value={data.engagement.mau.toLocaleString()}
          label="Monthly Active Users"
          change={data.engagement.mauChange}
          color="#6366f1"
        />
        <MetricCard
          value={`${data.engagement.retentionRate}%`}
          label="7-Day Retention"
          change={data.engagement.retentionChange}
          color="#10b981"
        />
      </div>

      {/* Revenue Metrics */}
      <div style={styles.metricsRow}>
        <MetricCard
          value={`$${data.revenue.mrr.toLocaleString()}`}
          label="Monthly Recurring Revenue"
          change={data.revenue.mrrChange}
          color="#059669"
        />
        <MetricCard
          value={data.revenue.trialStarts}
          label="Trial Starts"
          color="#f59e0b"
        />
        <MetricCard
          value={`${data.revenue.trialConversionRate}%`}
          label="Trial Conversion Rate"
          color="#10b981"
        />
        <MetricCard
          value={`${data.revenue.churnRate}%`}
          label="Monthly Churn"
          color={data.revenue.churnRate > 5 ? '#ef4444' : '#6b7280'}
        />
      </div>

      {/* Conversion Funnel & User Growth */}
      <div style={styles.grid2}>
        <div style={styles.card}>
          <h3 style={styles.sectionTitle}>Conversion Funnel</h3>
          <FunnelChart steps={data.funnel} />
        </div>
        <div style={styles.card}>
          <h3 style={styles.sectionTitle}>New Users Over Time</h3>
          <UserGrowthChart data={data.userGrowth} />
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '12px',
            color: '#9ca3af',
            marginTop: '8px'
          }}>
            <span>{data.userGrowth[0]?.date}</span>
            <span>{data.userGrowth[data.userGrowth.length - 1]?.date}</span>
          </div>
        </div>
      </div>

      {/* Feature Usage & Cohorts */}
      <div style={styles.grid2}>
        <div style={styles.card}>
          <h3 style={styles.sectionTitle}>Feature Usage</h3>
          <FeatureUsageChart features={data.featureUsage} />
        </div>
        <div style={styles.card}>
          <h3 style={styles.sectionTitle}>Cohort Retention</h3>
          <CohortTable cohorts={data.cohorts} />
        </div>
      </div>

      {/* Top Events */}
      <div style={styles.card}>
        <h3 style={styles.sectionTitle}>Top Events</h3>
        <TopEventsTable events={data.topEvents} />
      </div>
    </div>
  )
}

export default MixpanelDashboard
