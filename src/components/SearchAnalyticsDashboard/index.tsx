'use client'

import React, { useState, useEffect, useCallback } from 'react'

interface SearchQuery {
  query: string
  count: number
  avgResults: number
  lastSearched: string
  trend: 'up' | 'down' | 'stable'
}

interface SearchMetrics {
  totalSearches: number
  uniqueQueries: number
  avgResultsPerSearch: number
  zeroResultRate: number
  topQueries: SearchQuery[]
  recentQueries: SearchQuery[]
  noResultQueries: string[]
}

/**
 * Search Analytics Dashboard
 *
 * Tracks and displays search behavior across the platform.
 * Shows top queries, zero-result searches, and search trends.
 */
const SearchAnalyticsDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<SearchMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('7d')

  const fetchMetrics = useCallback(async () => {
    setLoading(true)
    try {
      // In production, this would fetch from a search analytics endpoint
      // For now, we'll simulate realistic search data

      // Simulated top queries based on typical product search behavior
      const topQueries: SearchQuery[] = [
        { query: 'sunscreen', count: 1245, avgResults: 42, lastSearched: '2 min ago', trend: 'up' },
        { query: 'moisturizer', count: 987, avgResults: 156, lastSearched: '5 min ago', trend: 'stable' },
        { query: 'shampoo organic', count: 756, avgResults: 89, lastSearched: '8 min ago', trend: 'up' },
        { query: 'clean beauty', count: 654, avgResults: 234, lastSearched: '12 min ago', trend: 'up' },
        { query: 'vitamin c serum', count: 543, avgResults: 67, lastSearched: '15 min ago', trend: 'stable' },
        { query: 'paraben free', count: 432, avgResults: 321, lastSearched: '20 min ago', trend: 'down' },
        { query: 'baby lotion', count: 387, avgResults: 45, lastSearched: '25 min ago', trend: 'stable' },
        { query: 'deodorant natural', count: 298, avgResults: 78, lastSearched: '30 min ago', trend: 'up' },
      ]

      const recentQueries: SearchQuery[] = [
        { query: 'cerave cleanser', count: 1, avgResults: 12, lastSearched: '1 min ago', trend: 'stable' },
        { query: 'olaplex shampoo', count: 1, avgResults: 8, lastSearched: '2 min ago', trend: 'stable' },
        { query: 'drunk elephant', count: 1, avgResults: 34, lastSearched: '3 min ago', trend: 'stable' },
        { query: 'elta md sunscreen', count: 1, avgResults: 6, lastSearched: '4 min ago', trend: 'stable' },
        { query: 'the ordinary niacinamide', count: 1, avgResults: 3, lastSearched: '5 min ago', trend: 'stable' },
      ]

      const noResultQueries = [
        'xyz brand sunblock',
        'organic mascara vegan',
        'sulfate free color safe',
        'baby safe nail polish',
        'biodegradable wipes',
      ]

      setMetrics({
        totalSearches: timeRange === '24h' ? 2456 : timeRange === '7d' ? 15234 : 45678,
        uniqueQueries: timeRange === '24h' ? 876 : timeRange === '7d' ? 4532 : 12345,
        avgResultsPerSearch: 78.5,
        zeroResultRate: 4.2,
        topQueries,
        recentQueries,
        noResultQueries,
      })
    } catch (err) {
      console.error('[SearchAnalytics] Error:', err)
    } finally {
      setLoading(false)
    }
  }, [timeRange])

  useEffect(() => {
    fetchMetrics()
  }, [fetchMetrics])

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up': return { icon: '\u2191', color: '#22c55e' }
      case 'down': return { icon: '\u2193', color: '#ef4444' }
      case 'stable': return { icon: '\u2192', color: '#71717a' }
    }
  }

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading search analytics...</div>
      </div>
    )
  }

  if (!metrics) return null

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Search Analytics</h1>
          <p style={styles.subtitle}>Track search behavior and optimize discovery</p>
        </div>
        <div style={styles.timeRangeSelector}>
          {(['24h', '7d', '30d'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              style={{
                ...styles.timeButton,
                background: timeRange === range ? '#3b82f6' : '#27272a',
                color: timeRange === range ? '#fff' : '#a1a1aa',
              }}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Stats */}
      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <div style={styles.statValue}>{metrics.totalSearches.toLocaleString()}</div>
          <div style={styles.statLabel}>Total Searches</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statValue}>{metrics.uniqueQueries.toLocaleString()}</div>
          <div style={styles.statLabel}>Unique Queries</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statValue}>{metrics.avgResultsPerSearch}</div>
          <div style={styles.statLabel}>Avg Results/Search</div>
        </div>
        <div style={styles.statCard}>
          <div style={{ ...styles.statValue, color: metrics.zeroResultRate > 5 ? '#ef4444' : '#22c55e' }}>
            {metrics.zeroResultRate}%
          </div>
          <div style={styles.statLabel}>Zero Result Rate</div>
        </div>
      </div>

      {/* Two Column Layout */}
      <div style={styles.twoColumns}>
        {/* Top Queries */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Top Queries</h2>
          <div style={styles.tableContainer}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Query</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Searches</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Results</th>
                  <th style={{ ...styles.th, textAlign: 'center' }}>Trend</th>
                </tr>
              </thead>
              <tbody>
                {metrics.topQueries.map((q, idx) => {
                  const trend = getTrendIcon(q.trend)
                  return (
                    <tr key={idx} style={styles.tr}>
                      <td style={styles.td}>
                        <span style={styles.rank}>#{idx + 1}</span>
                        <code style={styles.queryCode}>{q.query}</code>
                      </td>
                      <td style={{ ...styles.td, textAlign: 'right', fontWeight: 600 }}>
                        {q.count.toLocaleString()}
                      </td>
                      <td style={{ ...styles.td, textAlign: 'right', color: '#71717a' }}>
                        {q.avgResults}
                      </td>
                      <td style={{ ...styles.td, textAlign: 'center', color: trend.color, fontSize: '16px' }}>
                        {trend.icon}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Queries */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Recent Queries</h2>
          <div style={styles.recentList}>
            {metrics.recentQueries.map((q, idx) => (
              <div key={idx} style={styles.recentItem}>
                <code style={styles.queryCode}>{q.query}</code>
                <div style={styles.recentMeta}>
                  <span>{q.avgResults} results</span>
                  <span style={styles.recentTime}>{q.lastSearched}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Zero Result Queries */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Zero Result Queries</h2>
        <p style={styles.sectionDesc}>
          These searches returned no results - consider adding content or synonyms.
        </p>
        <div style={styles.zeroResultGrid}>
          {metrics.noResultQueries.map((query, idx) => (
            <div key={idx} style={styles.zeroResultCard}>
              <code style={styles.zeroResultQuery}>{query}</code>
              <button style={styles.addButton}>Add Product</button>
            </div>
          ))}
        </div>
      </div>

      {/* Recommendations */}
      <div style={styles.infoSection}>
        <h3 style={styles.infoTitle}>Optimization Recommendations</h3>
        <ul style={styles.infoList}>
          <li>
            <strong>High-volume queries:</strong> Ensure top queries have relevant, high-quality results
          </li>
          <li>
            <strong>Zero-result queries:</strong> Add products or create synonyms to capture this traffic
          </li>
          <li>
            <strong>Trending queries:</strong> Monitor {'\u2191'} trends to anticipate demand
          </li>
          <li>
            <strong>Search refinement:</strong> Consider adding filters for common query modifiers (organic, natural, etc.)
          </li>
        </ul>
      </div>

      {/* Implementation Note */}
      <div style={styles.noteSection}>
        <h4 style={styles.noteTitle}>Implementation Note</h4>
        <p style={styles.noteText}>
          To enable real search tracking, add a search analytics collection and log queries in the search endpoint.
          This dashboard currently shows simulated data for demonstration.
        </p>
      </div>
    </div>
  )
}

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
    color: '#71717a',
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
    color: '#fff',
  },
  subtitle: {
    margin: '4px 0 0',
    fontSize: '14px',
    color: '#71717a',
  },
  timeRangeSelector: {
    display: 'flex',
    gap: '4px',
    background: '#18181b',
    padding: '4px',
    borderRadius: '8px',
  },
  timeButton: {
    padding: '8px 16px',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500,
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '12px',
    marginBottom: '32px',
  },
  statCard: {
    background: '#18181b',
    border: '1px solid #27272a',
    borderRadius: '12px',
    padding: '20px',
    textAlign: 'center',
  },
  statValue: {
    fontSize: '28px',
    fontWeight: 700,
    color: '#fff',
  },
  statLabel: {
    fontSize: '13px',
    color: '#71717a',
    marginTop: '4px',
  },
  twoColumns: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
    gap: '24px',
    marginBottom: '32px',
  },
  section: {
    marginBottom: '32px',
  },
  sectionTitle: {
    margin: '0 0 16px',
    fontSize: '18px',
    fontWeight: 600,
    color: '#e4e4e7',
  },
  sectionDesc: {
    margin: '0 0 16px',
    fontSize: '14px',
    color: '#71717a',
  },
  tableContainer: {
    background: '#18181b',
    border: '1px solid #27272a',
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
    color: '#71717a',
    background: '#27272a',
    borderBottom: '1px solid #3f3f46',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  tr: {
    borderBottom: '1px solid #27272a',
  },
  td: {
    padding: '12px 16px',
    fontSize: '14px',
    color: '#e4e4e7',
  },
  rank: {
    display: 'inline-block',
    width: '24px',
    color: '#71717a',
    fontSize: '12px',
  },
  queryCode: {
    background: '#27272a',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '13px',
    fontFamily: 'Monaco, Consolas, monospace',
  },
  recentList: {
    background: '#18181b',
    border: '1px solid #27272a',
    borderRadius: '12px',
    overflow: 'hidden',
  },
  recentItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    borderBottom: '1px solid #27272a',
  },
  recentMeta: {
    display: 'flex',
    gap: '16px',
    fontSize: '13px',
    color: '#71717a',
  },
  recentTime: {
    color: '#52525b',
  },
  zeroResultGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '12px',
  },
  zeroResultCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: '8px',
  },
  zeroResultQuery: {
    background: 'rgba(239, 68, 68, 0.2)',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '13px',
    fontFamily: 'Monaco, Consolas, monospace',
    color: '#fca5a5',
  },
  addButton: {
    padding: '6px 12px',
    background: 'transparent',
    border: '1px solid rgba(239, 68, 68, 0.5)',
    borderRadius: '4px',
    color: '#fca5a5',
    cursor: 'pointer',
    fontSize: '12px',
  },
  infoSection: {
    background: '#18181b',
    border: '1px solid #27272a',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '24px',
  },
  infoTitle: {
    margin: '0 0 12px',
    fontSize: '16px',
    fontWeight: 600,
    color: '#e4e4e7',
  },
  infoList: {
    margin: 0,
    paddingLeft: '20px',
    fontSize: '14px',
    color: '#a1a1aa',
    lineHeight: 1.8,
  },
  noteSection: {
    background: 'rgba(59, 130, 246, 0.1)',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    borderRadius: '8px',
    padding: '16px',
  },
  noteTitle: {
    margin: '0 0 8px',
    fontSize: '14px',
    fontWeight: 600,
    color: '#60a5fa',
  },
  noteText: {
    margin: 0,
    fontSize: '13px',
    color: '#93c5fd',
  },
}

export default SearchAnalyticsDashboard
