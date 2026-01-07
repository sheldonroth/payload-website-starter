'use client'

import React, { useState, useEffect, useCallback } from 'react'

interface RateLimitConfig {
  name: string
  maxRequests: number
  windowMs: number
  category: 'ai' | 'mobile' | 'admin' | 'standard'
}

// Mirror the rate limit configs from src/utilities/rate-limiter.ts
const RATE_LIMITS: RateLimitConfig[] = [
  { name: 'AI Analysis', maxRequests: 10, windowMs: 60000, category: 'ai' },
  { name: 'AI Business Assistant', maxRequests: 5, windowMs: 60000, category: 'ai' },
  { name: 'Smart Scan', maxRequests: 5, windowMs: 60000, category: 'ai' },
  { name: 'Content Generation', maxRequests: 20, windowMs: 60000, category: 'ai' },
  { name: 'Batch Operations', maxRequests: 5, windowMs: 60000, category: 'admin' },
  { name: 'Background Removal', maxRequests: 50, windowMs: 60000, category: 'admin' },
  { name: 'Login/OAuth', maxRequests: 10, windowMs: 60000, category: 'standard' },
  { name: 'Standard API', maxRequests: 100, windowMs: 60000, category: 'standard' },
  { name: 'Mobile Scan', maxRequests: 30, windowMs: 60000, category: 'mobile' },
  { name: 'Mobile Photo Upload', maxRequests: 10, windowMs: 60000, category: 'mobile' },
  { name: 'Mobile Search', maxRequests: 60, windowMs: 60000, category: 'mobile' },
  { name: 'Mobile Feedback', maxRequests: 5, windowMs: 60000, category: 'mobile' },
  { name: 'Mobile Product Submit', maxRequests: 10, windowMs: 60000, category: 'mobile' },
]

interface EndpointStats {
  endpoint: string
  count: number
  errors: number
}

const CATEGORY_COLORS = {
  ai: { bg: '#e0e7ff', text: '#4338ca', label: 'AI' },
  mobile: { bg: '#dcfce7', text: '#166534', label: 'Mobile' },
  admin: { bg: '#fef3c7', text: '#92400e', label: 'Admin' },
  standard: { bg: '#f3f4f6', text: '#374151', label: 'Standard' },
}

const ApiStatusDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true)
  const [endpointStats, setEndpointStats] = useState<EndpointStats[]>([])
  const [rateLimitErrors, setRateLimitErrors] = useState(0)
  const [apiErrors, setApiErrors] = useState(0)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchStats = useCallback(async () => {
    try {
      // Fetch recent audit log entries for API stats
      const [auditRes] = await Promise.all([
        fetch('/api/audit-log?sort=-createdAt&limit=500&depth=0'),
      ])

      if (auditRes.ok) {
        const auditData = await auditRes.json()
        const docs = (auditData.docs || []) as Array<{
          action: string
          success: boolean
          metadata?: { statusCode?: number }
        }>

        // Count errors
        const errors = docs.filter((d) => d.action === 'error' || !d.success)
        setApiErrors(errors.length)

        // Count 429 rate limit errors (if tracked)
        const rateLimitErrs = docs.filter(
          (d) => d.metadata?.statusCode === 429 || d.action?.includes('rate_limit')
        )
        setRateLimitErrors(rateLimitErrs.length)
      }

      setLastUpdated(new Date())
    } catch (err) {
      console.error('Failed to fetch stats:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStats()
    const interval = setInterval(fetchStats, 60000)
    return () => clearInterval(interval)
  }, [fetchStats])

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading API status...</div>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>API Status</h1>
          <p style={styles.subtitle}>Rate limits, endpoint health, and configuration</p>
        </div>
        <div style={styles.headerRight}>
          {lastUpdated && (
            <span style={styles.lastUpdated}>
              Updated: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button onClick={() => fetchStats()} style={styles.refreshButton}>
            Refresh
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div style={styles.statsRow}>
        <div style={styles.statCard}>
          <p style={styles.statLabel}>Rate Limit Configs</p>
          <p style={styles.statValue}>{RATE_LIMITS.length}</p>
        </div>
        <div style={styles.statCard}>
          <p style={styles.statLabel}>API Errors (Recent)</p>
          <p style={{ ...styles.statValue, color: apiErrors > 0 ? '#ef4444' : '#10b981' }}>
            {apiErrors}
          </p>
        </div>
        <div style={styles.statCard}>
          <p style={styles.statLabel}>Rate Limit Hits</p>
          <p style={{ ...styles.statValue, color: rateLimitErrors > 0 ? '#f59e0b' : '#10b981' }}>
            {rateLimitErrors}
          </p>
        </div>
      </div>

      {/* Rate Limit Configurations */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Rate Limit Configurations</h2>
        <p style={styles.sectionSubtitle}>
          Current API rate limits per endpoint category (requests per minute)
        </p>

        <div style={styles.grid}>
          {RATE_LIMITS.map((limit) => {
            const cat = CATEGORY_COLORS[limit.category]
            const windowSecs = limit.windowMs / 1000

            return (
              <div key={limit.name} style={styles.limitCard}>
                <div style={styles.limitHeader}>
                  <span style={styles.limitName}>{limit.name}</span>
                  <span
                    style={{
                      ...styles.categoryBadge,
                      backgroundColor: cat.bg,
                      color: cat.text,
                    }}
                  >
                    {cat.label}
                  </span>
                </div>
                <div style={styles.limitStats}>
                  <div style={styles.limitStat}>
                    <span style={styles.limitValue}>{limit.maxRequests}</span>
                    <span style={styles.limitLabel}>requests</span>
                  </div>
                  <div style={styles.limitStat}>
                    <span style={styles.limitValue}>{windowSecs}s</span>
                    <span style={styles.limitLabel}>window</span>
                  </div>
                  <div style={styles.limitStat}>
                    <span style={styles.limitValue}>
                      {Math.round((limit.maxRequests / windowSecs) * 60)}
                    </span>
                    <span style={styles.limitLabel}>per min</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* API Health Info */}
      <div style={styles.infoSection}>
        <h3 style={styles.infoTitle}>How Rate Limiting Works</h3>
        <ul style={styles.infoList}>
          <li>Rate limits use in-memory storage (resets on server restart)</li>
          <li>Mobile apps are identified by device fingerprint (x-fingerprint header)</li>
          <li>Web requests are identified by IP address (x-forwarded-for)</li>
          <li>Authenticated users have user-based rate limiting</li>
          <li>When limited, API returns 429 with Retry-After header</li>
        </ul>
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
    color: '#6b7280',
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
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
    gap: '12px',
  },
  limitCard: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '10px',
    padding: '16px',
  },
  limitHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  limitName: {
    fontWeight: 600,
    fontSize: '14px',
    color: '#111827',
  },
  categoryBadge: {
    fontSize: '10px',
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: '4px',
    textTransform: 'uppercase',
  },
  limitStats: {
    display: 'flex',
    gap: '16px',
  },
  limitStat: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  limitValue: {
    fontSize: '18px',
    fontWeight: 700,
    color: '#3b82f6',
  },
  limitLabel: {
    fontSize: '11px',
    color: '#9ca3af',
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

export default ApiStatusDashboard
