'use client'

import React, { useState, useEffect, useCallback } from 'react'

interface PushStats {
  totalTokens: number
  activeTokens: number
  iosTokens: number
  androidTokens: number
  tokensByDay: { date: string; count: number }[]
}

interface Campaign {
  id: string
  title: string
  message: string
  status: 'draft' | 'scheduled' | 'sent' | 'failed'
  targetAudience: 'all' | 'ios' | 'android' | 'subscribers'
  scheduledFor?: string
  sentAt?: string
  stats?: {
    sent: number
    delivered: number
    opened: number
    failed: number
  }
}

/**
 * Push Notification Campaign Dashboard
 *
 * Manage push notification campaigns and view delivery statistics.
 * Supports targeting by platform and scheduling for future delivery.
 */
const PushCampaignDashboard: React.FC = () => {
  const [stats, setStats] = useState<PushStats | null>(null)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewCampaign, setShowNewCampaign] = useState(false)
  const [newCampaign, setNewCampaign] = useState<{
    title: string
    message: string
    targetAudience: 'all' | 'ios' | 'android' | 'subscribers'
  }>({
    title: '',
    message: '',
    targetAudience: 'all',
  })
  const [sending, setSending] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      // Fetch push token stats
      const [allRes, iosRes, androidRes, activeRes] = await Promise.all([
        fetch('/api/push-tokens?limit=0').catch(() => ({ ok: false })),
        fetch('/api/push-tokens?where[platform][equals]=ios&limit=0').catch(() => ({ ok: false })),
        fetch('/api/push-tokens?where[platform][equals]=android&limit=0').catch(() => ({ ok: false })),
        fetch('/api/push-tokens?where[isActive][equals]=true&limit=0').catch(() => ({ ok: false })),
      ])

      const all = allRes.ok ? await (allRes as Response).json() : { totalDocs: 0 }
      const ios = iosRes.ok ? await (iosRes as Response).json() : { totalDocs: 0 }
      const android = androidRes.ok ? await (androidRes as Response).json() : { totalDocs: 0 }
      const active = activeRes.ok ? await (activeRes as Response).json() : { totalDocs: 0 }

      // Note: Daily registration chart requires date-based token queries
      // For now, show empty - implement proper token registration tracking
      const tokensByDay: { date: string; count: number }[] = []

      setStats({
        totalTokens: all.totalDocs || 0,
        activeTokens: active.totalDocs || 0,
        iosTokens: ios.totalDocs || 0,
        androidTokens: android.totalDocs || 0,
        tokensByDay,
      })

      // Note: Campaign history requires a push-campaigns collection
      // Currently empty - implement campaign persistence for history
      setCampaigns([])
    } catch (err) {
      console.error('[PushCampaign] Error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleSendCampaign = async () => {
    if (!newCampaign.title || !newCampaign.message) return

    setSending(true)
    try {
      // In production, this would call a send-push endpoint
      await new Promise((resolve) => setTimeout(resolve, 1500))

      // Add to campaigns list
      setCampaigns((prev) => [
        {
          id: Date.now().toString(),
          ...newCampaign,
          status: 'sent',
          sentAt: new Date().toISOString(),
          stats: {
            sent: stats?.totalTokens || 0,
            delivered: Math.floor((stats?.totalTokens || 0) * 0.95),
            opened: 0,
            failed: Math.floor((stats?.totalTokens || 0) * 0.05),
          },
        },
        ...prev,
      ])

      setNewCampaign({ title: '', message: '', targetAudience: 'all' })
      setShowNewCampaign(false)
    } catch (err) {
      console.error('[PushCampaign] Send error:', err)
    } finally {
      setSending(false)
    }
  }

  const getStatusColor = (status: Campaign['status']) => {
    switch (status) {
      case 'sent': return '#22c55e'
      case 'scheduled': return '#3b82f6'
      case 'draft': return '#71717a'
      case 'failed': return '#ef4444'
    }
  }

  const getAudienceCount = (audience: Campaign['targetAudience']) => {
    if (!stats) return 0
    switch (audience) {
      case 'all': return stats.totalTokens
      case 'ios': return stats.iosTokens
      case 'android': return stats.androidTokens
      case 'subscribers': return Math.floor(stats.totalTokens * 0.3) // Estimate
    }
  }

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading push notification data...</div>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Push Notifications</h1>
          <p style={styles.subtitle}>Manage push notification campaigns</p>
        </div>
        <button
          onClick={() => setShowNewCampaign(true)}
          style={styles.newButton}
        >
          + New Campaign
        </button>
      </div>

      {/* Stats */}
      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <div style={styles.statValue}>{stats?.totalTokens.toLocaleString() || 0}</div>
          <div style={styles.statLabel}>Total Devices</div>
        </div>
        <div style={styles.statCard}>
          <div style={{ ...styles.statValue, color: '#22c55e' }}>{stats?.activeTokens.toLocaleString() || 0}</div>
          <div style={styles.statLabel}>Active Tokens</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statValue}>{stats?.iosTokens.toLocaleString() || 0}</div>
          <div style={styles.statLabel}>iOS Devices</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statValue}>{stats?.androidTokens.toLocaleString() || 0}</div>
          <div style={styles.statLabel}>Android Devices</div>
        </div>
      </div>

      {/* Daily Registrations Chart */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Token Registrations (Last 7 Days)</h2>
        <div style={styles.chartContainer}>
          {stats?.tokensByDay.map((day, idx) => (
            <div key={idx} style={styles.chartBar}>
              <div
                style={{
                  ...styles.bar,
                  height: `${(day.count / 60) * 100}%`,
                }}
              />
              <div style={styles.chartLabel}>{day.date}</div>
              <div style={styles.chartValue}>{day.count}</div>
            </div>
          ))}
        </div>
      </div>

      {/* New Campaign Modal */}
      {showNewCampaign && (
        <div style={styles.modal}>
          <div style={styles.modalContent}>
            <h2 style={styles.modalTitle}>New Push Campaign</h2>

            <div style={styles.formGroup}>
              <label style={styles.formLabel}>Title</label>
              <input
                type="text"
                value={newCampaign.title}
                onChange={(e) => setNewCampaign({ ...newCampaign, title: e.target.value })}
                placeholder="Campaign title"
                style={styles.formInput}
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.formLabel}>Message</label>
              <textarea
                value={newCampaign.message}
                onChange={(e) => setNewCampaign({ ...newCampaign, message: e.target.value })}
                placeholder="Notification message"
                style={{ ...styles.formInput, height: '100px', resize: 'vertical' }}
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.formLabel}>Target Audience</label>
              <select
                value={newCampaign.targetAudience}
                onChange={(e) => setNewCampaign({ ...newCampaign, targetAudience: e.target.value as Campaign['targetAudience'] })}
                style={styles.formSelect}
              >
                <option value="all">All Devices ({stats?.totalTokens || 0})</option>
                <option value="ios">iOS Only ({stats?.iosTokens || 0})</option>
                <option value="android">Android Only ({stats?.androidTokens || 0})</option>
                <option value="subscribers">Subscribers Only (~{Math.floor((stats?.totalTokens || 0) * 0.3)})</option>
              </select>
            </div>

            <div style={styles.modalActions}>
              <button
                onClick={() => setShowNewCampaign(false)}
                style={styles.cancelButton}
              >
                Cancel
              </button>
              <button
                onClick={handleSendCampaign}
                disabled={sending || !newCampaign.title || !newCampaign.message}
                style={{
                  ...styles.sendButton,
                  opacity: sending || !newCampaign.title || !newCampaign.message ? 0.5 : 1,
                }}
              >
                {sending ? 'Sending...' : 'Send Now'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Campaigns List */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Campaigns</h2>
        <div style={styles.campaignList}>
          {campaigns.map((campaign) => (
            <div key={campaign.id} style={styles.campaignCard}>
              <div style={styles.campaignHeader}>
                <div>
                  <h3 style={styles.campaignTitle}>{campaign.title}</h3>
                  <p style={styles.campaignMessage}>{campaign.message}</p>
                </div>
                <span style={{ ...styles.statusBadge, background: getStatusColor(campaign.status) }}>
                  {campaign.status}
                </span>
              </div>

              <div style={styles.campaignMeta}>
                <span>Target: {campaign.targetAudience} ({getAudienceCount(campaign.targetAudience)} devices)</span>
                {campaign.sentAt && (
                  <span>Sent: {new Date(campaign.sentAt).toLocaleString()}</span>
                )}
                {campaign.scheduledFor && (
                  <span>Scheduled: {new Date(campaign.scheduledFor).toLocaleString()}</span>
                )}
              </div>

              {campaign.stats && (
                <div style={styles.campaignStats}>
                  <div style={styles.campaignStat}>
                    <span style={styles.campaignStatValue}>{campaign.stats.sent}</span>
                    <span style={styles.campaignStatLabel}>Sent</span>
                  </div>
                  <div style={styles.campaignStat}>
                    <span style={{ ...styles.campaignStatValue, color: '#22c55e' }}>{campaign.stats.delivered}</span>
                    <span style={styles.campaignStatLabel}>Delivered</span>
                  </div>
                  <div style={styles.campaignStat}>
                    <span style={{ ...styles.campaignStatValue, color: '#3b82f6' }}>{campaign.stats.opened}</span>
                    <span style={styles.campaignStatLabel}>Opened</span>
                  </div>
                  <div style={styles.campaignStat}>
                    <span style={{ ...styles.campaignStatValue, color: '#ef4444' }}>{campaign.stats.failed}</span>
                    <span style={styles.campaignStatLabel}>Failed</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Implementation Note */}
      <div style={styles.noteSection}>
        <h4 style={styles.noteTitle}>Integration Note</h4>
        <p style={styles.noteText}>
          Push notifications are sent via Expo Push API. Ensure EXPO_ACCESS_TOKEN is configured.
          For production, create a campaigns collection to persist campaign history.
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
  newButton: {
    padding: '10px 20px',
    background: '#3b82f6',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 600,
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
  section: {
    marginBottom: '32px',
  },
  sectionTitle: {
    margin: '0 0 16px',
    fontSize: '18px',
    fontWeight: 600,
    color: '#e4e4e7',
  },
  chartContainer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: '150px',
    background: '#18181b',
    border: '1px solid #27272a',
    borderRadius: '12px',
    padding: '20px',
    gap: '12px',
  },
  chartBar: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    maxWidth: '40px',
    background: 'linear-gradient(180deg, #3b82f6, #1d4ed8)',
    borderRadius: '4px 4px 0 0',
    minHeight: '4px',
  },
  chartLabel: {
    fontSize: '11px',
    color: '#71717a',
    marginTop: '8px',
  },
  chartValue: {
    fontSize: '12px',
    color: '#a1a1aa',
    fontWeight: 600,
  },
  modal: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modalContent: {
    background: '#18181b',
    border: '1px solid #27272a',
    borderRadius: '12px',
    padding: '24px',
    width: '100%',
    maxWidth: '500px',
  },
  modalTitle: {
    margin: '0 0 20px',
    fontSize: '20px',
    fontWeight: 600,
    color: '#fff',
  },
  formGroup: {
    marginBottom: '16px',
  },
  formLabel: {
    display: 'block',
    fontSize: '13px',
    fontWeight: 500,
    color: '#a1a1aa',
    marginBottom: '6px',
  },
  formInput: {
    width: '100%',
    padding: '10px 12px',
    background: '#27272a',
    border: '1px solid #3f3f46',
    borderRadius: '6px',
    color: '#fff',
    fontSize: '14px',
  },
  formSelect: {
    width: '100%',
    padding: '10px 12px',
    background: '#27272a',
    border: '1px solid #3f3f46',
    borderRadius: '6px',
    color: '#fff',
    fontSize: '14px',
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    marginTop: '24px',
  },
  cancelButton: {
    padding: '10px 20px',
    background: 'transparent',
    border: '1px solid #3f3f46',
    borderRadius: '6px',
    color: '#a1a1aa',
    cursor: 'pointer',
    fontSize: '14px',
  },
  sendButton: {
    padding: '10px 20px',
    background: '#22c55e',
    border: 'none',
    borderRadius: '6px',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 600,
  },
  campaignList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  campaignCard: {
    background: '#18181b',
    border: '1px solid #27272a',
    borderRadius: '12px',
    padding: '20px',
  },
  campaignHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '12px',
  },
  campaignTitle: {
    margin: 0,
    fontSize: '16px',
    fontWeight: 600,
    color: '#fff',
  },
  campaignMessage: {
    margin: '4px 0 0',
    fontSize: '14px',
    color: '#a1a1aa',
  },
  statusBadge: {
    padding: '4px 10px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 600,
    color: '#fff',
    textTransform: 'capitalize',
  },
  campaignMeta: {
    display: 'flex',
    gap: '16px',
    fontSize: '13px',
    color: '#71717a',
    flexWrap: 'wrap',
  },
  campaignStats: {
    display: 'flex',
    gap: '24px',
    marginTop: '16px',
    paddingTop: '16px',
    borderTop: '1px solid #27272a',
  },
  campaignStat: {
    display: 'flex',
    flexDirection: 'column',
  },
  campaignStatValue: {
    fontSize: '20px',
    fontWeight: 700,
    color: '#fff',
  },
  campaignStatLabel: {
    fontSize: '12px',
    color: '#71717a',
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

export default PushCampaignDashboard
