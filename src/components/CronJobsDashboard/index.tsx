'use client'

import React, { useState, useCallback } from 'react'

interface CronJob {
  name: string
  path: string
  schedule: string
  description: string
  frequency: 'hourly' | 'every-6-hours' | 'daily' | 'weekly' | 'annual'
}

// Parse cron schedule to human-readable format
function formatSchedule(schedule: string): string {
  const parts = schedule.split(' ')
  if (parts.length !== 5) return schedule

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts

  // Hourly
  if (hour === '*' && minute !== '*') {
    return `Every hour at :${minute.padStart(2, '0')}`
  }

  // Every N hours
  if (hour.includes('/')) {
    const interval = hour.split('/')[1]
    return `Every ${interval} hours at :${minute.padStart(2, '0')}`
  }

  // Daily
  if (dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    return `Daily at ${hour.padStart(2, '0')}:${minute.padStart(2, '0')} UTC`
  }

  // Weekly
  if (dayOfWeek !== '*') {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const dayName = days[parseInt(dayOfWeek)] || dayOfWeek
    return `${dayName}s at ${hour.padStart(2, '0')}:${minute.padStart(2, '0')} UTC`
  }

  // Annual
  if (month !== '*' && dayOfMonth !== '*') {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const monthName = months[parseInt(month) - 1] || month
    return `${monthName} ${dayOfMonth} at ${hour.padStart(2, '0')}:${minute.padStart(2, '0')} UTC`
  }

  return schedule
}

// Get next run time (approximate)
function getNextRun(schedule: string): string {
  const now = new Date()
  const parts = schedule.split(' ')
  if (parts.length !== 5) return 'Unknown'

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts

  // Hourly jobs
  if (hour === '*' || hour.includes('/')) {
    const mins = parseInt(minute)
    const nextRun = new Date(now)
    nextRun.setMinutes(mins, 0, 0)
    if (nextRun <= now) {
      nextRun.setHours(nextRun.getHours() + (hour.includes('/') ? parseInt(hour.split('/')[1]!) : 1))
    }
    return nextRun.toISOString().replace('T', ' ').slice(0, 16) + ' UTC'
  }

  // Simple daily/weekly approximation
  return formatSchedule(schedule)
}

const CRON_JOBS: CronJob[] = [
  {
    name: 'Generate Embeddings',
    path: '/api/cron/generate-embeddings',
    schedule: '0 * * * *',
    description: 'Creates pgvector embeddings for semantic search',
    frequency: 'hourly',
  },
  {
    name: 'Trending Notifications',
    path: '/api/cron/trending-notifications',
    schedule: '0 */6 * * *',
    description: 'Sends push notifications for trending products',
    frequency: 'every-6-hours',
  },
  {
    name: 'Market Intelligence',
    path: '/api/cron/market-intel',
    schedule: '0 */6 * * *',
    description: 'Gathers competitive intelligence for brand portal',
    frequency: 'every-6-hours',
  },
  {
    name: 'Calculate Archetypes',
    path: '/api/cron/calculate-archetypes',
    schedule: '0 3 * * *',
    description: 'Classifies products (Best Value, Premium Pick, etc.)',
    frequency: 'daily',
  },
  {
    name: 'Brand Analytics',
    path: '/api/cron/brand-analytics',
    schedule: '0 3 * * *',
    description: 'Updates brand portal analytics dashboards',
    frequency: 'daily',
  },
  {
    name: 'Trending Products',
    path: '/api/cron/trending',
    schedule: '0 6 * * *',
    description: 'Calculates trending scores based on scan velocity',
    frequency: 'daily',
  },
  {
    name: 'Recall Check',
    path: '/api/cron/recall-check',
    schedule: '0 8 * * *',
    description: 'Monitors FDA/CPSC recall feeds',
    frequency: 'daily',
  },
  {
    name: 'Email: Week 1 Sequence',
    path: '/api/email-cron?job=week1_sequence',
    schedule: '0 15 * * *',
    description: 'Onboarding email sequence for new users',
    frequency: 'daily',
  },
  {
    name: 'Email: Weekly Digest',
    path: '/api/email-cron?job=weekly_digest',
    schedule: '0 16 * * 2',
    description: 'Weekly newsletter with product highlights',
    frequency: 'weekly',
  },
  {
    name: 'Email: Winback',
    path: '/api/email-cron?job=winback_sequence',
    schedule: '0 18 * * *',
    description: 'Re-engagement emails for churned users',
    frequency: 'daily',
  },
  {
    name: 'Regulatory Monitor',
    path: '/api/cron/regulatory',
    schedule: '0 7 * * 1',
    description: 'Monitors regulatory changes (EU, FDA, Prop 65)',
    frequency: 'weekly',
  },
  {
    name: 'Brand Trust Scores',
    path: '/api/cron/brand-trust',
    schedule: '0 9 * * 0',
    description: 'Recalculates brand-level trust scores',
    frequency: 'weekly',
  },
  {
    name: 'Weekly Digest (Data)',
    path: '/api/cron/weekly-digest',
    schedule: '0 10 * * 2',
    description: 'Compiles weekly product discoveries',
    frequency: 'weekly',
  },
  {
    name: 'Year in Clean',
    path: '/api/year-in-clean-cron',
    schedule: '0 9 20 12 *',
    description: 'Annual personalized user reports',
    frequency: 'annual',
  },
]

const FREQUENCY_COLORS: Record<string, { bg: string; text: string }> = {
  hourly: { bg: '#dbeafe', text: '#1e40af' },
  'every-6-hours': { bg: '#e0e7ff', text: '#4338ca' },
  daily: { bg: '#dcfce7', text: '#166534' },
  weekly: { bg: '#fef3c7', text: '#92400e' },
  annual: { bg: '#fce7f3', text: '#9d174d' },
}

const CronJobsDashboard: React.FC = () => {
  const [runningJobs, setRunningJobs] = useState<Set<string>>(new Set())
  const [jobResults, setJobResults] = useState<Record<string, { status: 'success' | 'error'; message: string; timestamp: string }>>({})

  const handleRunJob = useCallback(async (job: CronJob) => {
    setRunningJobs((prev) => new Set(prev).add(job.path))

    try {
      // Trigger the cron job manually
      const response = await fetch(job.path, {
        method: 'GET',
        headers: {
          'x-api-key': process.env.NEXT_PUBLIC_PAYLOAD_API_SECRET || '',
        },
      })

      const data = await response.json().catch(() => ({}))

      setJobResults((prev) => ({
        ...prev,
        [job.path]: {
          status: response.ok ? 'success' : 'error',
          message: data.message || data.error || (response.ok ? 'Completed' : 'Failed'),
          timestamp: new Date().toISOString(),
        },
      }))
    } catch (err) {
      setJobResults((prev) => ({
        ...prev,
        [job.path]: {
          status: 'error',
          message: err instanceof Error ? err.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        },
      }))
    } finally {
      setRunningJobs((prev) => {
        const next = new Set(prev)
        next.delete(job.path)
        return next
      })
    }
  }, [])

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)

    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    return `${Math.floor(diffHours / 24)}d ago`
  }

  // Group jobs by frequency
  const groupedJobs = CRON_JOBS.reduce(
    (acc, job) => {
      if (!acc[job.frequency]) acc[job.frequency] = []
      acc[job.frequency]!.push(job)
      return acc
    },
    {} as Record<string, CronJob[]>
  )

  const frequencyOrder: Array<keyof typeof FREQUENCY_COLORS> = ['hourly', 'every-6-hours', 'daily', 'weekly', 'annual']

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: '8px',
        border: '1px solid #e5e5e5',
        padding: '24px',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px',
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Cron Jobs</h2>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#6b7280' }}>
            {CRON_JOBS.length} scheduled jobs
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {frequencyOrder.map((freq) => {
            const colors = FREQUENCY_COLORS[freq]
            const count = groupedJobs[freq]?.length || 0
            if (count === 0) return null
            return (
              <span
                key={freq}
                style={{
                  background: colors!.bg,
                  color: colors!.text,
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: 500,
                }}
              >
                {freq.replace('-', ' ')}: {count}
              </span>
            )
          })}
        </div>
      </div>

      {frequencyOrder.map((frequency) => {
        const jobs = groupedJobs[frequency]
        if (!jobs || jobs.length === 0) return null

        const colors = FREQUENCY_COLORS[frequency]!

        return (
          <div key={frequency} style={{ marginBottom: '24px' }}>
            <h3
              style={{
                margin: '0 0 12px',
                fontSize: '14px',
                fontWeight: 600,
                color: colors.text,
                textTransform: 'capitalize',
              }}
            >
              {frequency.replace('-', ' ')} Jobs
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {jobs.map((job) => {
                const isRunning = runningJobs.has(job.path)
                const result = jobResults[job.path]

                return (
                  <div
                    key={job.path}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      background: colors.bg,
                      borderRadius: '6px',
                      border: `1px solid ${colors.text}20`,
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 500, fontSize: '14px', color: '#1f2937' }}>
                          {job.name}
                        </span>
                        {result && (
                          <span
                            style={{
                              background: result.status === 'success' ? '#dcfce7' : '#fee2e2',
                              color: result.status === 'success' ? '#166534' : '#991b1b',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '10px',
                              fontWeight: 500,
                            }}
                          >
                            {result.status === 'success' ? 'OK' : 'ERR'} {getTimeAgo(result.timestamp)}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                        {job.description}
                      </div>
                      <div style={{ fontSize: '11px', color: colors.text, marginTop: '4px', fontFamily: 'monospace' }}>
                        {formatSchedule(job.schedule)}
                      </div>
                    </div>

                    <button
                      onClick={() => handleRunJob(job)}
                      disabled={isRunning}
                      style={{
                        background: isRunning ? '#9ca3af' : colors.text,
                        color: '#fff',
                        border: 'none',
                        padding: '8px 16px',
                        borderRadius: '4px',
                        cursor: isRunning ? 'not-allowed' : 'pointer',
                        fontSize: '12px',
                        fontWeight: 500,
                        minWidth: '80px',
                        transition: 'opacity 0.2s',
                      }}
                      onMouseOver={(e) => {
                        if (!isRunning) e.currentTarget.style.opacity = '0.9'
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.opacity = '1'
                      }}
                    >
                      {isRunning ? 'Running...' : 'Run Now'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      <div style={{ marginTop: '24px', padding: '16px', background: '#f9fafb', borderRadius: '6px' }}>
        <h4 style={{ margin: '0 0 8px', fontSize: '13px', fontWeight: 600, color: '#374151' }}>
          Notes
        </h4>
        <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '12px', color: '#6b7280' }}>
          <li>Jobs are scheduled in Vercel Cron (UTC timezone)</li>
          <li>Manual runs bypass rate limiting but use the same endpoints</li>
          <li>Check Vercel logs for detailed execution history</li>
          <li>All jobs require CRON_SECRET or API key authentication</li>
        </ul>
      </div>
    </div>
  )
}

export default CronJobsDashboard
