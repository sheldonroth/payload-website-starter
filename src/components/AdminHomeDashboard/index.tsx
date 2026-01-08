'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

interface SystemMetrics {
  content: {
    products: number
    categories: number
    brands: number
    posts: number
    articles: number
  }
  users: {
    total: number
    activeToday: number
    newThisWeek: number
    admins: number
  }
  engagement: {
    scansToday: number
    feedbackPending: number
    submissionsToReview: number
    aiDrafts: number
  }
  system: {
    cacheHitRate: number
    errorsToday: number
    uptime: string
    lastDeployment: string
  }
}

interface QuickAction {
  label: string
  href: string
  icon: string
  color: string
  description: string
}

const quickActions: QuickAction[] = [
  { label: 'Content Queue', href: '/admin/content-moderation', icon: '📋', color: '#3b82f6', description: 'Review pending submissions' },
  { label: 'AI Drafts', href: '/admin/ai-draft-inbox', icon: '🤖', color: '#8b5cf6', description: 'Review AI-generated content' },
  { label: 'Analytics', href: '/admin/analytics', icon: '📊', color: '#22c55e', description: 'View performance metrics' },
  { label: 'Email', href: '/admin/email-analytics', icon: '📧', color: '#f59e0b', description: 'Email campaign stats' },
  { label: 'Products', href: '/admin/collections/products', icon: '📦', color: '#ef4444', description: 'Manage products' },
  { label: 'API Docs', href: '/admin/api-docs', icon: '📚', color: '#06b6d4', description: 'API documentation' },
]

const AdminHomeDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchMetrics = useCallback(async () => {
    try {
      // Fetch multiple data points in parallel
      const [
        productsRes,
        categoriesRes,
        brandsRes,
        postsRes,
        articlesRes,
        usersRes,
        feedbackRes,
        submissionsRes,
        errorsRes,
        cacheRes,
      ] = await Promise.all([
        fetch('/api/products?limit=0').catch(() => ({ ok: false })),
        fetch('/api/categories?limit=0').catch(() => ({ ok: false })),
        fetch('/api/brands?limit=0').catch(() => ({ ok: false })),
        fetch('/api/posts?limit=0').catch(() => ({ ok: false })),
        fetch('/api/articles?limit=0').catch(() => ({ ok: false })),
        fetch('/api/users?limit=0').catch(() => ({ ok: false })),
        fetch('/api/feedback?where[status][equals]=pending&limit=0').catch(() => ({ ok: false })),
        fetch('/api/user-submissions?where[status][equals]=pending&limit=0').catch(() => ({ ok: false })),
        fetch('/api/audit-log?where[success][equals]=false&limit=0').catch(() => ({ ok: false })),
        fetch('/api/cache-status').catch(() => ({ ok: false })),
      ])

      // Parse responses
      const products = productsRes.ok ? await (productsRes as Response).json() : { totalDocs: 0 }
      const categories = categoriesRes.ok ? await (categoriesRes as Response).json() : { totalDocs: 0 }
      const brands = brandsRes.ok ? await (brandsRes as Response).json() : { totalDocs: 0 }
      const posts = postsRes.ok ? await (postsRes as Response).json() : { totalDocs: 0 }
      const articles = articlesRes.ok ? await (articlesRes as Response).json() : { totalDocs: 0 }
      const users = usersRes.ok ? await (usersRes as Response).json() : { totalDocs: 0 }
      const feedback = feedbackRes.ok ? await (feedbackRes as Response).json() : { totalDocs: 0 }
      const submissions = submissionsRes.ok ? await (submissionsRes as Response).json() : { totalDocs: 0 }
      const errors = errorsRes.ok ? await (errorsRes as Response).json() : { totalDocs: 0 }
      const cache = cacheRes.ok ? await (cacheRes as Response).json() : { hitRate: 0 }

      setMetrics({
        content: {
          products: products.totalDocs || 0,
          categories: categories.totalDocs || 0,
          brands: brands.totalDocs || 0,
          posts: posts.totalDocs || 0,
          articles: articles.totalDocs || 0,
        },
        users: {
          total: users.totalDocs || 0,
          activeToday: 0, // Requires session/activity tracking
          newThisWeek: 0, // Requires date-based user query
          admins: 0, // Requires role-based query
        },
        engagement: {
          scansToday: 0, // Requires barcode scan tracking
          feedbackPending: feedback.totalDocs || 0,
          submissionsToReview: submissions.totalDocs || 0,
          aiDrafts: 0, // Would need separate endpoint
        },
        system: {
          cacheHitRate: cache.hitRate || 0,
          errorsToday: errors.totalDocs || 0,
          uptime: '-', // Requires uptime monitoring
          lastDeployment: '-', // Requires deployment tracking
        },
      })

      setLastUpdated(new Date())
      setError(null)
    } catch (err) {
      setError('Failed to load metrics')
      console.error('[AdminHome] Error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMetrics()
    const interval = setInterval(fetchMetrics, 60000) // Refresh every minute
    return () => clearInterval(interval)
  }, [fetchMetrics])

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading dashboard...</div>
      </div>
    )
  }

  if (error || !metrics) {
    return (
      <div style={styles.container}>
        <div style={styles.error}>
          <h3>Failed to load dashboard</h3>
          <p>{error}</p>
          <button onClick={fetchMetrics} style={styles.retryButton}>Retry</button>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Admin Dashboard</h1>
          <p style={styles.subtitle}>System overview and quick actions</p>
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

      {/* Quick Actions */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Quick Actions</h2>
        <div style={styles.quickActionsGrid}>
          {quickActions.map((action) => (
            <Link key={action.href} href={action.href} style={styles.quickAction}>
              <span style={styles.quickActionIcon}>{action.icon}</span>
              <div>
                <div style={styles.quickActionLabel}>{action.label}</div>
                <div style={styles.quickActionDesc}>{action.description}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Content Stats */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Content Overview</h2>
        <div style={styles.statsGrid}>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{metrics.content.products.toLocaleString()}</div>
            <div style={styles.statLabel}>Products</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{metrics.content.categories}</div>
            <div style={styles.statLabel}>Categories</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{metrics.content.brands}</div>
            <div style={styles.statLabel}>Brands</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{metrics.content.posts}</div>
            <div style={styles.statLabel}>Posts</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{metrics.content.articles}</div>
            <div style={styles.statLabel}>Articles</div>
          </div>
        </div>
      </div>

      {/* Two Column Layout */}
      <div style={styles.twoColumns}>
        {/* User Stats */}
        <div style={styles.column}>
          <h2 style={styles.sectionTitle}>Users</h2>
          <div style={styles.card}>
            <div style={styles.cardRow}>
              <span>Total Users</span>
              <span style={styles.cardValue}>{metrics.users.total.toLocaleString()}</span>
            </div>
            <div style={styles.cardRow}>
              <span>Active Today</span>
              <span style={{ ...styles.cardValue, color: '#22c55e' }}>{metrics.users.activeToday}</span>
            </div>
            <div style={styles.cardRow}>
              <span>New This Week</span>
              <span style={{ ...styles.cardValue, color: '#3b82f6' }}>{metrics.users.newThisWeek}</span>
            </div>
            <div style={styles.cardRow}>
              <span>Admin Users</span>
              <span style={styles.cardValue}>{metrics.users.admins}</span>
            </div>
          </div>
        </div>

        {/* Engagement Stats */}
        <div style={styles.column}>
          <h2 style={styles.sectionTitle}>Engagement</h2>
          <div style={styles.card}>
            <div style={styles.cardRow}>
              <span>Scans Today</span>
              <span style={styles.cardValue}>{metrics.engagement.scansToday}</span>
            </div>
            <div style={styles.cardRow}>
              <span>Pending Feedback</span>
              <span style={{ ...styles.cardValue, color: metrics.engagement.feedbackPending > 0 ? '#f59e0b' : '#22c55e' }}>
                {metrics.engagement.feedbackPending}
              </span>
            </div>
            <div style={styles.cardRow}>
              <span>Submissions to Review</span>
              <span style={{ ...styles.cardValue, color: metrics.engagement.submissionsToReview > 0 ? '#f59e0b' : '#22c55e' }}>
                {metrics.engagement.submissionsToReview}
              </span>
            </div>
            <div style={styles.cardRow}>
              <span>AI Drafts</span>
              <span style={styles.cardValue}>{metrics.engagement.aiDrafts}</span>
            </div>
          </div>
        </div>
      </div>

      {/* System Health */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>System Health</h2>
        <div style={styles.healthGrid}>
          <div style={styles.healthCard}>
            <div style={{ ...styles.healthIndicator, background: '#22c55e' }} />
            <div>
              <div style={styles.healthLabel}>Uptime</div>
              <div style={styles.healthValue}>{metrics.system.uptime}</div>
            </div>
          </div>
          <div style={styles.healthCard}>
            <div style={{ ...styles.healthIndicator, background: metrics.system.cacheHitRate >= 70 ? '#22c55e' : '#f59e0b' }} />
            <div>
              <div style={styles.healthLabel}>Cache Hit Rate</div>
              <div style={styles.healthValue}>{metrics.system.cacheHitRate}%</div>
            </div>
          </div>
          <div style={styles.healthCard}>
            <div style={{ ...styles.healthIndicator, background: metrics.system.errorsToday === 0 ? '#22c55e' : '#ef4444' }} />
            <div>
              <div style={styles.healthLabel}>Errors Today</div>
              <div style={styles.healthValue}>{metrics.system.errorsToday}</div>
            </div>
          </div>
          <div style={styles.healthCard}>
            <div style={{ ...styles.healthIndicator, background: '#3b82f6' }} />
            <div>
              <div style={styles.healthLabel}>Last Deploy</div>
              <div style={styles.healthValue}>{metrics.system.lastDeployment}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div style={styles.infoSection}>
        <h3 style={styles.infoTitle}>Admin Sections</h3>
        <div style={styles.linkGrid}>
          <Link href="/admin/collections/products" style={styles.linkItem}>Products</Link>
          <Link href="/admin/collections/categories" style={styles.linkItem}>Categories</Link>
          <Link href="/admin/collections/brands" style={styles.linkItem}>Brands</Link>
          <Link href="/admin/collections/users" style={styles.linkItem}>Users</Link>
          <Link href="/admin/collections/posts" style={styles.linkItem}>Posts</Link>
          <Link href="/admin/collections/email-templates" style={styles.linkItem}>Email Templates</Link>
          <Link href="/admin/statsig-experiments" style={styles.linkItem}>Experiments</Link>
          <Link href="/admin/security" style={styles.linkItem}>Security</Link>
        </div>
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
  error: {
    textAlign: 'center',
    padding: '40px',
    background: 'rgba(239, 68, 68, 0.1)',
    borderRadius: '12px',
    border: '1px solid rgba(239, 68, 68, 0.3)',
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
    color: '#fff',
  },
  subtitle: {
    margin: '4px 0 0',
    fontSize: '14px',
    color: '#71717a',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  lastUpdated: {
    fontSize: '12px',
    color: '#71717a',
  },
  refreshButton: {
    padding: '8px 16px',
    background: '#27272a',
    border: '1px solid #3f3f46',
    borderRadius: '6px',
    color: '#e4e4e7',
    cursor: 'pointer',
    fontSize: '13px',
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
  quickActionsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '12px',
  },
  quickAction: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '16px',
    background: '#18181b',
    border: '1px solid #27272a',
    borderRadius: '8px',
    textDecoration: 'none',
    transition: 'border-color 0.2s',
  },
  quickActionIcon: {
    fontSize: '24px',
  },
  quickActionLabel: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#e4e4e7',
  },
  quickActionDesc: {
    fontSize: '12px',
    color: '#71717a',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
    gap: '12px',
  },
  statCard: {
    background: '#18181b',
    border: '1px solid #27272a',
    borderRadius: '8px',
    padding: '16px',
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
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '24px',
    marginBottom: '32px',
  },
  column: {},
  card: {
    background: '#18181b',
    border: '1px solid #27272a',
    borderRadius: '8px',
    padding: '16px',
  },
  cardRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px 0',
    borderBottom: '1px solid #27272a',
    color: '#a1a1aa',
    fontSize: '14px',
  },
  cardValue: {
    fontWeight: 600,
    color: '#e4e4e7',
  },
  healthGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '12px',
  },
  healthCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    background: '#18181b',
    border: '1px solid #27272a',
    borderRadius: '8px',
    padding: '16px',
  },
  healthIndicator: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  healthLabel: {
    fontSize: '13px',
    color: '#71717a',
  },
  healthValue: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#e4e4e7',
  },
  infoSection: {
    background: '#18181b',
    border: '1px solid #27272a',
    borderRadius: '12px',
    padding: '20px',
  },
  infoTitle: {
    margin: '0 0 16px',
    fontSize: '16px',
    fontWeight: 600,
    color: '#e4e4e7',
  },
  linkGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
    gap: '8px',
  },
  linkItem: {
    padding: '8px 12px',
    background: '#27272a',
    borderRadius: '4px',
    color: '#a1a1aa',
    textDecoration: 'none',
    fontSize: '13px',
    textAlign: 'center',
  },
}

export default AdminHomeDashboard
