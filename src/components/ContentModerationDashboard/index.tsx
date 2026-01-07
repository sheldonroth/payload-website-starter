'use client'

import React, { useState, useEffect, useCallback } from 'react'

interface ModerationItem {
  id: number
  type: 'submission' | 'feedback'
  subType: string
  status: string
  content: string
  submitterEmail?: string
  submitterName?: string
  product?: { id: number; name: string } | null
  hasImages: boolean
  createdAt: string
  priority: 'high' | 'medium' | 'low'
}

interface ModerationStats {
  pendingSubmissions: number
  pendingFeedback: number
  reviewedToday: number
  totalPending: number
  byType: { type: string; count: number }[]
  byPriority: { priority: string; count: number }[]
}

interface ModerationData {
  items: ModerationItem[]
  stats: ModerationStats
  cached: boolean
  generatedAt: string
}

const ContentModerationDashboard: React.FC = () => {
  const [data, setData] = useState<ModerationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'submission' | 'feedback'>('all')
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all')

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setLoading(true)
    try {
      const res = await fetch(`/api/content-moderation${isRefresh ? '?refresh=true' : ''}`)
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || `HTTP ${res.status}`)
      }
      const modData: ModerationData = await res.json()
      setData(modData)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(() => fetchData(), 30000) // Refresh every 30 seconds
    return () => clearInterval(interval)
  }, [fetchData])

  const filteredItems =
    data?.items.filter((item) => {
      if (filter !== 'all' && item.type !== filter) return false
      if (priorityFilter !== 'all' && item.priority !== priorityFilter) return false
      return true
    }) || []

  if (loading && !data) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading moderation queue...</div>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div style={styles.container}>
        <div style={styles.error}>
          <h3>Failed to Load Queue</h3>
          <p>{error}</p>
          <button onClick={() => fetchData(true)} style={styles.retryButton}>
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!data) return null

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Content Moderation</h1>
          <p style={styles.subtitle}>Review user submissions and feedback</p>
        </div>
        <button onClick={() => fetchData(true)} style={styles.refreshButton}>
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div style={styles.statsRow}>
        <StatCard
          label="Pending"
          value={data.stats.totalPending}
          color={data.stats.totalPending > 10 ? '#ef4444' : '#f59e0b'}
        />
        <StatCard label="Submissions" value={data.stats.pendingSubmissions} color="#3b82f6" />
        <StatCard label="Feedback" value={data.stats.pendingFeedback} color="#8b5cf6" />
        <StatCard label="Reviewed Today" value={data.stats.reviewedToday} color="#10b981" />
      </div>

      {/* Priority Breakdown */}
      <div style={styles.priorityRow}>
        {data.stats.byPriority.map((p) => (
          <div
            key={p.priority}
            style={{
              ...styles.priorityBadge,
              backgroundColor: priorityColors[p.priority as keyof typeof priorityColors] + '20',
              borderColor: priorityColors[p.priority as keyof typeof priorityColors],
            }}
          >
            <span style={{ textTransform: 'capitalize' }}>{p.priority}</span>
            <span style={{ fontWeight: 700 }}>{p.count}</span>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={styles.filters}>
        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>Type:</label>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as 'all' | 'submission' | 'feedback')}
            style={styles.select}
          >
            <option value="all">All</option>
            <option value="submission">Submissions</option>
            <option value="feedback">Feedback</option>
          </select>
        </div>
        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>Priority:</label>
          <select
            value={priorityFilter}
            onChange={(e) =>
              setPriorityFilter(e.target.value as 'all' | 'high' | 'medium' | 'low')
            }
            style={styles.select}
          >
            <option value="all">All</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
        <span style={styles.itemCount}>{filteredItems.length} items</span>
      </div>

      {/* Queue List */}
      <div style={styles.queueList}>
        {filteredItems.length === 0 ? (
          <div style={styles.emptyState}>
            <span style={{ fontSize: '48px' }}>&#10003;</span>
            <h3>All caught up!</h3>
            <p>No items pending moderation.</p>
          </div>
        ) : (
          filteredItems.map((item) => <ModerationCard key={`${item.type}-${item.id}`} item={item} />)
        )}
      </div>
    </div>
  )
}

const priorityColors = {
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#6b7280',
}

const typeLabels: Record<string, string> = {
  product_scan: 'Product Scan',
  tip: 'Tip',
  reaction_report: 'Reaction Report',
  correction: 'Correction',
  product_request: 'Product Request',
  general: 'General Feedback',
  bug_report: 'Bug Report',
  feature_request: 'Feature Request',
  complaint: 'Complaint',
  praise: 'Praise',
  product_question: 'Product Question',
}

const StatCard: React.FC<{ label: string; value: number; color: string }> = ({
  label,
  value,
  color,
}) => (
  <div style={styles.statCard}>
    <p style={styles.statLabel}>{label}</p>
    <p style={{ ...styles.statValue, color }}>{value}</p>
  </div>
)

const ModerationCard: React.FC<{ item: ModerationItem }> = ({ item }) => {
  const openItem = () => {
    const collection = item.type === 'submission' ? 'user-submissions' : 'feedback'
    window.open(`/admin/collections/${collection}/${item.id}`, '_blank')
  }

  return (
    <div style={styles.card} onClick={openItem}>
      <div style={styles.cardHeader}>
        <div style={styles.cardMeta}>
          <span
            style={{
              ...styles.priorityIndicator,
              backgroundColor: priorityColors[item.priority],
            }}
          />
          <span style={styles.typeTag}>
            {item.type === 'submission' ? 'SUB' : 'FB'}: {typeLabels[item.subType] || item.subType}
          </span>
          {item.hasImages && <span style={styles.imageTag}>HAS IMAGES</span>}
        </div>
        <span style={styles.timestamp}>{formatTimeAgo(item.createdAt)}</span>
      </div>

      <p style={styles.cardContent}>
        {item.content ? item.content.slice(0, 200) + (item.content.length > 200 ? '...' : '') :
         <em style={{ color: '#9ca3af' }}>No content provided</em>}
      </p>

      <div style={styles.cardFooter}>
        {item.submitterEmail && (
          <span style={styles.submitterEmail}>{item.submitterEmail}</span>
        )}
        {item.product && (
          <span style={styles.productLink}>Product: {item.product.name}</span>
        )}
      </div>
    </div>
  )
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '24px',
    maxWidth: '1000px',
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
    marginBottom: '20px',
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
  },
  priorityRow: {
    display: 'flex',
    gap: '12px',
    marginBottom: '20px',
  },
  priorityBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    borderRadius: '8px',
    border: '1px solid',
    fontSize: '13px',
  },
  filters: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '20px',
    flexWrap: 'wrap',
  },
  filterGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  filterLabel: {
    fontSize: '13px',
    color: '#6b7280',
  },
  select: {
    padding: '6px 10px',
    borderRadius: '6px',
    border: '1px solid #d1d5db',
    fontSize: '13px',
    background: '#fff',
  },
  itemCount: {
    marginLeft: 'auto',
    fontSize: '13px',
    color: '#9ca3af',
  },
  queueList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  emptyState: {
    textAlign: 'center',
    padding: '60px 20px',
    background: '#f0fdf4',
    borderRadius: '12px',
    color: '#166534',
  },
  card: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '16px',
    cursor: 'pointer',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px',
  },
  cardMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  priorityIndicator: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
  },
  typeTag: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  imageTag: {
    fontSize: '10px',
    fontWeight: 600,
    color: '#3b82f6',
    background: '#dbeafe',
    padding: '2px 6px',
    borderRadius: '4px',
  },
  timestamp: {
    fontSize: '12px',
    color: '#9ca3af',
  },
  cardContent: {
    margin: 0,
    fontSize: '14px',
    color: '#374151',
    lineHeight: 1.5,
  },
  cardFooter: {
    display: 'flex',
    gap: '12px',
    marginTop: '12px',
    fontSize: '12px',
    color: '#6b7280',
  },
  submitterEmail: {
    color: '#6b7280',
  },
  productLink: {
    color: '#3b82f6',
  },
}

export default ContentModerationDashboard
