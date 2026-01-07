'use client'

import React, { useState, useEffect, useCallback } from 'react'

interface AuditEntry {
  id: number
  action: string
  sourceType?: string
  sourceUrl?: string
  targetCollection?: string
  targetId?: number
  targetName?: string
  performedBy?: { id: number; email?: string } | number | null
  success: boolean
  errorMessage?: string
  metadata?: Record<string, unknown>
  createdAt: string
}

interface ActivityStats {
  total: number
  today: number
  byAction: Record<string, number>
  bySource: Record<string, number>
  successRate: number
}

const ACTION_ICONS: Record<string, string> = {
  ai_product_created: '\u{1F916}',
  ai_ingredient_parsed: '\u{1F9EA}',
  ai_verdict_set: '\u{2696}',
  rule_applied: '\u{1F4CB}',
  ingredient_cascade: '\u{1F517}',
  manual_override: '\u{270B}',
  product_merged: '\u{1F504}',
  category_created: '\u{1F4C1}',
  image_enriched: '\u{1F5BC}',
  poll_closed: '\u{1F4CA}',
  article_generated: '\u{1F4F0}',
  conflict_detected: '\u{26A0}',
  freshness_check: '\u{1F50D}',
  ai_draft_created: '\u{1F4DD}',
  error: '\u{274C}',
  subscription_started: '\u{1F4B3}',
  subscription_renewed: '\u{1F504}',
  subscription_cancelled: '\u{274C}',
  trial_started: '\u{1F381}',
  trial_converted: '\u{2705}',
  points_awarded: '\u{2B50}',
}

const SOURCE_COLORS: Record<string, { bg: string; text: string }> = {
  youtube: { bg: '#fee2e2', text: '#991b1b' },
  tiktok: { bg: '#fce7f3', text: '#9d174d' },
  amazon: { bg: '#fef3c7', text: '#92400e' },
  web_url: { bg: '#dbeafe', text: '#1e40af' },
  barcode: { bg: '#d1fae5', text: '#065f46' },
  manual: { bg: '#e0e7ff', text: '#4338ca' },
  system: { bg: '#f3f4f6', text: '#374151' },
  rule: { bg: '#fef3c7', text: '#92400e' },
  revenuecat: { bg: '#dcfce7', text: '#166534' },
}

const ActivityFeedDashboard: React.FC = () => {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>('all')
  const [stats, setStats] = useState<ActivityStats | null>(null)

  const fetchData = useCallback(async () => {
    try {
      let url = '/api/audit-log?sort=-createdAt&limit=100&depth=1'
      if (filter !== 'all') {
        url += `&where[action][equals]=${filter}`
      }

      const response = await fetch(url)
      if (!response.ok) throw new Error('Failed to fetch')
      const data = await response.json()
      setEntries(data.docs || [])

      // Calculate stats
      const all = data.docs as AuditEntry[]
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const todayEntries = all.filter((e) => new Date(e.createdAt) >= today)
      const byAction: Record<string, number> = {}
      const bySource: Record<string, number> = {}
      let successCount = 0

      for (const entry of all) {
        byAction[entry.action] = (byAction[entry.action] || 0) + 1
        if (entry.sourceType) {
          bySource[entry.sourceType] = (bySource[entry.sourceType] || 0) + 1
        }
        if (entry.success) successCount++
      }

      setStats({
        total: all.length,
        today: todayEntries.length,
        byAction,
        bySource,
        successRate: all.length > 0 ? Math.round((successCount / all.length) * 100) : 100,
      })

      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [fetchData])

  const formatTimeAgo = (dateStr: string): string => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  const formatAction = (action: string): string => {
    return action
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
  }

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading activity feed...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.error}>
          <h3>Failed to Load Activity</h3>
          <p>{error}</p>
          <button onClick={fetchData} style={styles.retryButton}>
            Retry
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
          <h1 style={styles.title}>Activity Feed</h1>
          <p style={styles.subtitle}>Recent system and admin actions</p>
        </div>
        <button onClick={fetchData} style={styles.refreshButton}>
          Refresh
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div style={styles.statsRow}>
          <div style={styles.statCard}>
            <p style={styles.statLabel}>Total Events</p>
            <p style={styles.statValue}>{stats.total}</p>
          </div>
          <div style={styles.statCard}>
            <p style={styles.statLabel}>Today</p>
            <p style={{ ...styles.statValue, color: '#3b82f6' }}>{stats.today}</p>
          </div>
          <div style={styles.statCard}>
            <p style={styles.statLabel}>Success Rate</p>
            <p
              style={{
                ...styles.statValue,
                color: stats.successRate >= 95 ? '#10b981' : stats.successRate >= 80 ? '#f59e0b' : '#ef4444',
              }}
            >
              {stats.successRate}%
            </p>
          </div>
        </div>
      )}

      {/* Filter */}
      <div style={styles.filterRow}>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} style={styles.select}>
          <option value="all">All Actions</option>
          <option value="ai_product_created">AI Products Created</option>
          <option value="ai_verdict_set">AI Verdicts Set</option>
          <option value="manual_override">Manual Overrides</option>
          <option value="subscription_started">Subscriptions Started</option>
          <option value="error">Errors</option>
        </select>
        <span style={styles.countLabel}>{entries.length} events</span>
      </div>

      {/* Feed */}
      <div style={styles.feed}>
        {entries.length === 0 ? (
          <div style={styles.emptyState}>
            <p>No activity found</p>
          </div>
        ) : (
          entries.map((entry) => {
            const icon = ACTION_ICONS[entry.action] || '\u{1F4CB}'
            const sourceColors = SOURCE_COLORS[entry.sourceType || 'system'] || SOURCE_COLORS.system
            const userEmail =
              typeof entry.performedBy === 'object' && entry.performedBy
                ? entry.performedBy.email
                : null

            return (
              <div
                key={entry.id}
                style={{
                  ...styles.feedItem,
                  borderLeftColor: entry.success ? '#10b981' : '#ef4444',
                }}
              >
                <div style={styles.feedIcon}>{icon}</div>
                <div style={styles.feedContent}>
                  <div style={styles.feedHeader}>
                    <span style={styles.feedAction}>{formatAction(entry.action)}</span>
                    {entry.sourceType && (
                      <span
                        style={{
                          ...styles.sourceTag,
                          backgroundColor: sourceColors.bg,
                          color: sourceColors.text,
                        }}
                      >
                        {entry.sourceType}
                      </span>
                    )}
                    <span style={styles.feedTime}>{formatTimeAgo(entry.createdAt)}</span>
                  </div>
                  {entry.targetName && (
                    <p style={styles.feedTarget}>
                      {entry.targetCollection && (
                        <a
                          href={`/admin/collections/${entry.targetCollection}/${entry.targetId}`}
                          style={styles.targetLink}
                        >
                          {entry.targetName}
                        </a>
                      )}
                      {!entry.targetCollection && entry.targetName}
                    </p>
                  )}
                  {!entry.success && entry.errorMessage && (
                    <p style={styles.errorText}>{entry.errorMessage}</p>
                  )}
                  {userEmail && <p style={styles.userText}>by {userEmail}</p>}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Footer */}
      <div style={styles.footer}>
        <a href="/admin/collections/audit-log" style={styles.footerLink}>
          View all in Audit Log &rarr;
        </a>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '24px',
    maxWidth: '900px',
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
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: '16px',
    marginBottom: '24px',
  },
  statCard: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '16px',
    textAlign: 'center',
  },
  statLabel: {
    margin: 0,
    fontSize: '13px',
    color: '#6b7280',
  },
  statValue: {
    margin: '8px 0 0',
    fontSize: '28px',
    fontWeight: 700,
    color: '#111827',
  },
  filterRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '16px',
  },
  select: {
    padding: '8px 12px',
    borderRadius: '6px',
    border: '1px solid #d1d5db',
    fontSize: '14px',
    background: '#fff',
  },
  countLabel: {
    fontSize: '13px',
    color: '#9ca3af',
  },
  feed: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    overflow: 'hidden',
  },
  emptyState: {
    padding: '40px',
    textAlign: 'center',
    color: '#9ca3af',
  },
  feedItem: {
    display: 'flex',
    gap: '12px',
    padding: '16px',
    borderBottom: '1px solid #f3f4f6',
    borderLeft: '3px solid',
  },
  feedIcon: {
    fontSize: '20px',
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f3f4f6',
    borderRadius: '8px',
    flexShrink: 0,
  },
  feedContent: {
    flex: 1,
    minWidth: 0,
  },
  feedHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  },
  feedAction: {
    fontWeight: 600,
    fontSize: '14px',
    color: '#111827',
  },
  sourceTag: {
    fontSize: '10px',
    fontWeight: 600,
    padding: '2px 6px',
    borderRadius: '4px',
    textTransform: 'uppercase',
  },
  feedTime: {
    fontSize: '12px',
    color: '#9ca3af',
    marginLeft: 'auto',
  },
  feedTarget: {
    margin: '4px 0 0',
    fontSize: '13px',
    color: '#6b7280',
  },
  targetLink: {
    color: '#3b82f6',
    textDecoration: 'none',
  },
  errorText: {
    margin: '4px 0 0',
    fontSize: '12px',
    color: '#ef4444',
  },
  userText: {
    margin: '4px 0 0',
    fontSize: '11px',
    color: '#9ca3af',
  },
  footer: {
    padding: '16px',
    textAlign: 'center',
    background: '#fafafa',
    borderTop: '1px solid #e5e7eb',
  },
  footerLink: {
    fontSize: '13px',
    color: '#6366f1',
    textDecoration: 'none',
  },
}

export default ActivityFeedDashboard
