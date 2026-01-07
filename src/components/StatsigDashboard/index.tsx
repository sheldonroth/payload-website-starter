'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { ExperimentCard } from './ExperimentCard'
import type { StatsigExperiment, StatsigApiResponse } from './types'

/**
 * Statsig Experiments Dashboard
 *
 * Displays all Statsig experiments with their current status, variants, and allocation.
 * Data is fetched from the Statsig Console API via our server-side endpoint.
 *
 * Features:
 * - Auto-refreshes every 60 seconds
 * - 5-minute server-side cache to avoid rate limits
 * - Groups experiments by status (Running, Not Started, Completed)
 */
const StatsigDashboard: React.FC = () => {
  const [experiments, setExperiments] = useState<StatsigExperiment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [cached, setCached] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const fetchExperiments = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setRefreshing(true)
    }

    try {
      const res = await fetch('/api/statsig-experiments')
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || `Failed to fetch (${res.status})`)
      }

      const data: StatsigApiResponse = await res.json()
      setExperiments(data.data || [])
      setCached(data.cached || false)
      setLastUpdated(new Date())
      setError(null)
    } catch (err) {
      console.error('[StatsigDashboard] Fetch error:', err)
      setError(err instanceof Error ? err.message : 'Failed to load experiments')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchExperiments()

    // Auto-refresh every 60 seconds
    const interval = setInterval(() => fetchExperiments(), 60000)
    return () => clearInterval(interval)
  }, [fetchExperiments])

  // Group experiments by status
  const running = experiments.filter((e) => e.status === 'active')
  const setup = experiments.filter((e) => e.status === 'setup')
  const completed = experiments.filter((e) => e.status === 'decision_made')
  const abandoned = experiments.filter((e) => e.status === 'abandoned')

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ fontSize: '18px', color: '#a1a1aa', marginBottom: '8px' }}>
          Loading Statsig experiments...
        </div>
        <div style={{ fontSize: '14px', color: '#71717a' }}>
          Fetching data from Statsig Console API
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: '40px' }}>
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '8px',
            padding: '20px',
          }}
        >
          <h3 style={{ color: '#ef4444', margin: '0 0 8px 0' }}>Failed to Load Experiments</h3>
          <p style={{ color: '#fca5a5', margin: '0 0 16px 0' }}>{error}</p>
          <button
            onClick={() => fetchExperiments(true)}
            style={{
              padding: '8px 16px',
              background: 'rgba(239, 68, 68, 0.2)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              borderRadius: '4px',
              color: '#ef4444',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            Try Again
          </button>
        </div>
        <div style={{ marginTop: '16px', padding: '16px', background: '#27272a', borderRadius: '8px' }}>
          <h4 style={{ color: '#e4e4e7', margin: '0 0 8px 0' }}>Troubleshooting</h4>
          <ul style={{ color: '#a1a1aa', margin: 0, paddingLeft: '20px', fontSize: '13px' }}>
            <li>Ensure <code>STATSIG_CONSOLE_API_KEY</code> is set in environment variables</li>
            <li>The key should start with <code>console-</code> (not <code>secret-</code> or <code>client-</code>)</li>
            <li>Check that the key has read permissions for experiments</li>
          </ul>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1200px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ margin: 0, color: '#fff', fontSize: '24px' }}>Statsig Experiments</h1>
          <p style={{ margin: '4px 0 0 0', color: '#71717a', fontSize: '14px' }}>
            {experiments.length} experiment{experiments.length !== 1 ? 's' : ''} total
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ fontSize: '12px', color: '#71717a', textAlign: 'right' }}>
            {lastUpdated && (
              <div>
                Updated: {lastUpdated.toLocaleTimeString()}
                {cached && <span style={{ marginLeft: '6px', color: '#f59e0b' }}>(cached)</span>}
              </div>
            )}
          </div>
          <button
            onClick={() => fetchExperiments(true)}
            disabled={refreshing}
            style={{
              padding: '8px 16px',
              background: refreshing ? '#27272a' : 'rgba(59, 130, 246, 0.15)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              borderRadius: '6px',
              color: refreshing ? '#71717a' : '#3b82f6',
              cursor: refreshing ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
        <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '8px', padding: '16px' }}>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#22c55e' }}>{running.length}</div>
          <div style={{ fontSize: '13px', color: '#71717a' }}>Running</div>
        </div>
        <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '8px', padding: '16px' }}>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#f59e0b' }}>{setup.length}</div>
          <div style={{ fontSize: '13px', color: '#71717a' }}>Not Started</div>
        </div>
        <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '8px', padding: '16px' }}>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#6b7280' }}>{completed.length}</div>
          <div style={{ fontSize: '13px', color: '#71717a' }}>Completed</div>
        </div>
        <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '8px', padding: '16px' }}>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#ef4444' }}>{abandoned.length}</div>
          <div style={{ fontSize: '13px', color: '#71717a' }}>Abandoned</div>
        </div>
      </div>

      {/* Running Experiments */}
      {running.length > 0 && (
        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ color: '#22c55e', fontSize: '18px', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
            Running ({running.length})
          </h2>
          {running.map((exp) => (
            <ExperimentCard key={exp.id} experiment={exp} />
          ))}
        </section>
      )}

      {/* Not Started */}
      {setup.length > 0 && (
        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ color: '#f59e0b', fontSize: '18px', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />
            Not Started ({setup.length})
          </h2>
          {setup.map((exp) => (
            <ExperimentCard key={exp.id} experiment={exp} />
          ))}
        </section>
      )}

      {/* Completed */}
      {completed.length > 0 && (
        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ color: '#6b7280', fontSize: '18px', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#6b7280', display: 'inline-block' }} />
            Completed ({completed.length})
          </h2>
          {completed.map((exp) => (
            <ExperimentCard key={exp.id} experiment={exp} />
          ))}
        </section>
      )}

      {/* Abandoned */}
      {abandoned.length > 0 && (
        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ color: '#ef4444', fontSize: '18px', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
            Abandoned ({abandoned.length})
          </h2>
          {abandoned.map((exp) => (
            <ExperimentCard key={exp.id} experiment={exp} />
          ))}
        </section>
      )}

      {/* Empty State */}
      {experiments.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🧪</div>
          <h3 style={{ color: '#e4e4e7', margin: '0 0 8px 0' }}>No Experiments Found</h3>
          <p style={{ color: '#71717a', margin: 0 }}>
            Create your first experiment in the{' '}
            <a href="https://console.statsig.com" target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6' }}>
              Statsig Console
            </a>
          </p>
        </div>
      )}
    </div>
  )
}

export default StatsigDashboard
