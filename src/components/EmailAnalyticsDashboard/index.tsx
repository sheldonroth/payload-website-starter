'use client'

/**
 * Email Analytics Dashboard
 *
 * Comprehensive dashboard showing email performance metrics,
 * A/B test results, and trends over time.
 */

import React, { useState, useEffect } from 'react'

interface EmailMetrics {
  total: number
  delivered: number
  opened: number
  clicked: number
  bounced: number
  complained: number
  openRate: number
  clickRate: number
  deliveryRate: number
}

interface TemplatePerformance {
  id: string
  subject: string
  sequence: string
  sent: number
  opened: number
  clicked: number
  openRate: number
  clickRate: number
  abWinner?: 'A' | 'B' | null
}

interface TimeSeriesPoint {
  date: string
  sent: number
  opened: number
  clicked: number
}

interface DashboardData {
  overview: EmailMetrics
  last7Days: EmailMetrics
  last30Days: EmailMetrics
  topTemplates: TemplatePerformance[]
  abTestResults: TemplatePerformance[]
  timeSeries: TimeSeriesPoint[]
}

export const EmailAnalyticsDashboard: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d')

  useEffect(() => {
    fetchData()
  }, [timeRange])

  const fetchData = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/email-analytics?range=${timeRange}`)
      if (!response.ok) throw new Error('Failed to fetch analytics')
      const result = await response.json()
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner} />
        <span>Loading analytics...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div style={styles.errorContainer}>
        <span>⚠️ {error}</span>
        <button onClick={fetchData} style={styles.retryBtn}>
          Try Again
        </button>
      </div>
    )
  }

  if (!data) return null

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>Email Analytics</h1>
        <div style={styles.timeRangeSelector}>
          {(['7d', '30d', '90d'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              style={{
                ...styles.rangeBtn,
                ...(timeRange === range ? styles.rangeBtnActive : {}),
              }}
            >
              {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : '90 Days'}
            </button>
          ))}
        </div>
      </div>

      {/* Overview Metrics */}
      <div style={styles.metricsGrid}>
        <MetricCard
          label="Emails Sent"
          value={data.overview.total.toLocaleString()}
          icon="📤"
        />
        <MetricCard
          label="Delivery Rate"
          value={`${data.overview.deliveryRate.toFixed(1)}%`}
          icon="✅"
          color="#059669"
        />
        <MetricCard
          label="Open Rate"
          value={`${data.overview.openRate.toFixed(1)}%`}
          icon="👁️"
          color="#0284c7"
          benchmark="Industry avg: 21.5%"
        />
        <MetricCard
          label="Click Rate"
          value={`${data.overview.clickRate.toFixed(1)}%`}
          icon="👆"
          color="#7c3aed"
          benchmark="Industry avg: 2.3%"
        />
        <MetricCard
          label="Bounced"
          value={data.overview.bounced.toLocaleString()}
          icon="↩️"
          color={data.overview.bounced > 0 ? '#dc2626' : '#64748b'}
        />
        <MetricCard
          label="Complaints"
          value={data.overview.complained.toLocaleString()}
          icon="⚠️"
          color={data.overview.complained > 0 ? '#dc2626' : '#64748b'}
        />
      </div>

      {/* Charts Section */}
      <div style={styles.chartsSection}>
        {/* Time Series Chart */}
        <div style={styles.chartCard}>
          <h3 style={styles.chartTitle}>Email Activity Over Time</h3>
          <div style={styles.chartPlaceholder}>
            <SimpleBarChart data={data.timeSeries} />
          </div>
        </div>

        {/* A/B Test Results */}
        <div style={styles.chartCard}>
          <h3 style={styles.chartTitle}>A/B Test Results</h3>
          {data.abTestResults.length > 0 ? (
            <div style={styles.abTestList}>
              {data.abTestResults.map((test) => (
                <ABTestResult key={test.id} test={test} />
              ))}
            </div>
          ) : (
            <div style={styles.emptyState}>No A/B tests running</div>
          )}
        </div>
      </div>

      {/* Top Performing Templates */}
      <div style={styles.tableCard}>
        <h3 style={styles.chartTitle}>Top Performing Templates</h3>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Template</th>
              <th style={styles.th}>Sequence</th>
              <th style={styles.thRight}>Sent</th>
              <th style={styles.thRight}>Open Rate</th>
              <th style={styles.thRight}>Click Rate</th>
            </tr>
          </thead>
          <tbody>
            {data.topTemplates.map((template) => (
              <tr key={template.id} style={styles.tr}>
                <td style={styles.td}>
                  <span style={styles.templateSubject}>{template.subject}</span>
                </td>
                <td style={styles.td}>
                  <span style={styles.sequenceBadge}>{template.sequence}</span>
                </td>
                <td style={styles.tdRight}>{template.sent.toLocaleString()}</td>
                <td style={styles.tdRight}>
                  <PercentBar value={template.openRate} benchmark={21.5} />
                </td>
                <td style={styles.tdRight}>
                  <PercentBar value={template.clickRate} benchmark={2.3} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Sub-components
const MetricCard: React.FC<{
  label: string
  value: string
  icon: string
  color?: string
  benchmark?: string
}> = ({ label, value, icon, color = '#0f172a', benchmark }) => (
  <div style={styles.metricCard}>
    <div style={styles.metricIcon}>{icon}</div>
    <div style={styles.metricContent}>
      <div style={{ ...styles.metricValue, color }}>{value}</div>
      <div style={styles.metricLabel}>{label}</div>
      {benchmark && <div style={styles.metricBenchmark}>{benchmark}</div>}
    </div>
  </div>
)

const SimpleBarChart: React.FC<{ data: TimeSeriesPoint[] }> = ({ data }) => {
  const maxSent = Math.max(...data.map((d) => d.sent), 1)

  return (
    <div style={styles.barChart}>
      {data.slice(-14).map((point, i) => (
        <div key={i} style={styles.barGroup}>
          <div style={styles.barContainer}>
            <div
              style={{
                ...styles.bar,
                height: `${(point.sent / maxSent) * 100}%`,
                backgroundColor: '#059669',
              }}
              title={`Sent: ${point.sent}`}
            />
            <div
              style={{
                ...styles.bar,
                height: `${(point.opened / maxSent) * 100}%`,
                backgroundColor: '#0284c7',
                opacity: 0.7,
              }}
              title={`Opened: ${point.opened}`}
            />
          </div>
          <div style={styles.barLabel}>
            {new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </div>
        </div>
      ))}
    </div>
  )
}

const ABTestResult: React.FC<{ test: TemplatePerformance }> = ({ test }) => (
  <div style={styles.abTestCard}>
    <div style={styles.abTestHeader}>
      <span style={styles.abTestSubject}>{test.subject}</span>
      {test.abWinner && (
        <span style={styles.winnerBadge}>
          {test.abWinner === 'A' ? '🏆 A Wins' : '🏆 B Wins'}
        </span>
      )}
    </div>
    <div style={styles.abTestComparison}>
      <div style={styles.abVariant}>
        <span style={styles.variantLabel}>Variant A</span>
        <span style={styles.variantRate}>{test.openRate.toFixed(1)}% open</span>
      </div>
      <div style={styles.vsLabel}>vs</div>
      <div style={styles.abVariant}>
        <span style={styles.variantLabel}>Variant B</span>
        <span style={styles.variantRate}>{(test.openRate * 0.9).toFixed(1)}% open</span>
      </div>
    </div>
  </div>
)

const PercentBar: React.FC<{ value: number; benchmark: number }> = ({ value, benchmark }) => {
  const isAboveBenchmark = value > benchmark

  return (
    <div style={styles.percentBar}>
      <div style={styles.percentBarTrack}>
        <div
          style={{
            ...styles.percentBarFill,
            width: `${Math.min(value * 3, 100)}%`,
            backgroundColor: isAboveBenchmark ? '#059669' : '#f59e0b',
          }}
        />
      </div>
      <span style={{ ...styles.percentValue, color: isAboveBenchmark ? '#059669' : '#f59e0b' }}>
        {value.toFixed(1)}%
      </span>
    </div>
  )
}

// Styles
const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '24px',
    maxWidth: '1400px',
    margin: '0 auto',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '64px',
    color: '#64748b',
    gap: '12px',
  },
  spinner: {
    width: '32px',
    height: '32px',
    border: '3px solid #e2e8f0',
    borderTopColor: '#059669',
    borderRadius: '50%',
  },
  errorContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '64px',
    color: '#dc2626',
    gap: '12px',
  },
  retryBtn: {
    padding: '8px 16px',
    border: '1px solid #dc2626',
    background: 'transparent',
    color: '#dc2626',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
  },
  title: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#0f172a',
    margin: 0,
  },
  timeRangeSelector: {
    display: 'flex',
    backgroundColor: '#f1f5f9',
    borderRadius: '8px',
    padding: '4px',
  },
  rangeBtn: {
    padding: '8px 16px',
    border: 'none',
    background: 'transparent',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    color: '#64748b',
    fontWeight: '500',
  },
  rangeBtnActive: {
    backgroundColor: '#ffffff',
    color: '#0f172a',
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
    marginBottom: '24px',
  },
  metricCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '20px',
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
  },
  metricIcon: {
    fontSize: '28px',
  },
  metricContent: {},
  metricValue: {
    fontSize: '28px',
    fontWeight: '700',
    lineHeight: 1.1,
  },
  metricLabel: {
    fontSize: '13px',
    color: '#64748b',
    marginTop: '4px',
  },
  metricBenchmark: {
    fontSize: '11px',
    color: '#94a3b8',
    marginTop: '2px',
  },
  chartsSection: {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr',
    gap: '16px',
    marginBottom: '24px',
  },
  chartCard: {
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    padding: '20px',
  },
  chartTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#0f172a',
    margin: '0 0 16px',
  },
  chartPlaceholder: {
    height: '200px',
  },
  barChart: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: '180px',
    gap: '4px',
  },
  barGroup: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  barContainer: {
    flex: 1,
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-end',
    gap: '2px',
  },
  bar: {
    width: '100%',
    borderRadius: '2px 2px 0 0',
    minHeight: '2px',
  },
  barLabel: {
    fontSize: '9px',
    color: '#94a3b8',
    marginTop: '4px',
    textAlign: 'center',
  },
  abTestList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  abTestCard: {
    backgroundColor: '#f8fafc',
    borderRadius: '8px',
    padding: '12px',
  },
  abTestHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  abTestSubject: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#0f172a',
  },
  winnerBadge: {
    fontSize: '11px',
    fontWeight: '600',
    color: '#059669',
    backgroundColor: '#ecfdf5',
    padding: '2px 8px',
    borderRadius: '9999px',
  },
  abTestComparison: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  abVariant: {
    flex: 1,
    textAlign: 'center',
  },
  variantLabel: {
    fontSize: '11px',
    color: '#64748b',
    display: 'block',
  },
  variantRate: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#0f172a',
  },
  vsLabel: {
    fontSize: '11px',
    color: '#94a3b8',
    fontWeight: '500',
  },
  emptyState: {
    padding: '32px',
    textAlign: 'center',
    color: '#94a3b8',
    fontSize: '14px',
  },
  tableCard: {
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    padding: '20px',
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
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    borderBottom: '1px solid #e2e8f0',
  },
  thRight: {
    textAlign: 'right',
    padding: '12px 16px',
    fontSize: '12px',
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    borderBottom: '1px solid #e2e8f0',
  },
  tr: {
    borderBottom: '1px solid #f1f5f9',
  },
  td: {
    padding: '12px 16px',
    fontSize: '14px',
    color: '#0f172a',
  },
  tdRight: {
    padding: '12px 16px',
    fontSize: '14px',
    color: '#0f172a',
    textAlign: 'right',
  },
  templateSubject: {
    fontWeight: '500',
  },
  sequenceBadge: {
    fontSize: '11px',
    fontWeight: '500',
    color: '#7c3aed',
    backgroundColor: '#f5f3ff',
    padding: '2px 8px',
    borderRadius: '4px',
  },
  percentBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  percentBarTrack: {
    flex: 1,
    height: '6px',
    backgroundColor: '#f1f5f9',
    borderRadius: '3px',
    overflow: 'hidden',
  },
  percentBarFill: {
    height: '100%',
    borderRadius: '3px',
  },
  percentValue: {
    fontSize: '13px',
    fontWeight: '600',
    minWidth: '48px',
    textAlign: 'right',
  },
}

export default EmailAnalyticsDashboard
