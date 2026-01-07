'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { ExperimentCard } from './ExperimentCard'
import { FeatureGateCard } from './FeatureGateCard'
import type { StatsigExperiment, StatsigApiResponse, StatsigGate, StatsigGatesApiResponse } from './types'

type TabType = 'experiments' | 'gates'
type StatusFilter = 'all' | 'active' | 'setup' | 'decision_made' | 'abandoned'

/**
 * Statsig Dashboard - Mission Control Style
 *
 * Displays experiments and feature gates with a professional monitoring aesthetic.
 * Features tabs, search, filtering, and real-time status updates.
 */
const StatsigDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('experiments')
  const [experiments, setExperiments] = useState<StatsigExperiment[]>([])
  const [gates, setGates] = useState<StatsigGate[]>([])
  const [loading, setLoading] = useState(true)
  const [gatesLoading, setGatesLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [gatesError, setGatesError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [cached, setCached] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const fetchExperiments = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true)

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

  const fetchGates = useCallback(async () => {
    try {
      const res = await fetch('/api/statsig-gates')
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || `Failed to fetch (${res.status})`)
      }

      const data: StatsigGatesApiResponse = await res.json()
      setGates(data.data || [])
      setGatesError(null)
    } catch (err) {
      console.error('[StatsigDashboard] Gates fetch error:', err)
      setGatesError(err instanceof Error ? err.message : 'Failed to load gates')
    } finally {
      setGatesLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchExperiments()
    fetchGates()

    // Auto-refresh every 60 seconds
    const interval = setInterval(() => {
      fetchExperiments()
      fetchGates()
    }, 60000)
    return () => clearInterval(interval)
  }, [fetchExperiments, fetchGates])

  // Filter experiments
  const filteredExperiments = useMemo(() => {
    return experiments.filter((exp) => {
      const matchesSearch = searchQuery === '' ||
        exp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        exp.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        exp.hypothesis?.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesStatus = statusFilter === 'all' || exp.status === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [experiments, searchQuery, statusFilter])

  // Filter gates
  const filteredGates = useMemo(() => {
    return gates.filter((gate) => {
      return searchQuery === '' ||
        gate.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        gate.description?.toLowerCase().includes(searchQuery.toLowerCase())
    })
  }, [gates, searchQuery])

  // Group experiments by status
  const running = filteredExperiments.filter((e) => e.status === 'active')
  const setup = filteredExperiments.filter((e) => e.status === 'setup')
  const completed = filteredExperiments.filter((e) => e.status === 'decision_made')
  const abandoned = filteredExperiments.filter((e) => e.status === 'abandoned')

  // Gates stats
  const enabledGates = filteredGates.filter((g) => g.isEnabled || g.enabled)
  const disabledGates = filteredGates.filter((g) => !g.isEnabled && !g.enabled)

  if (loading && gatesLoading) {
    return (
      <div style={{ padding: '60px', textAlign: 'center' }}>
        <div
          style={{
            width: '48px',
            height: '48px',
            margin: '0 auto 20px',
            border: '3px solid #27272a',
            borderTopColor: '#a78bfa',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }}
        />
        <div style={{ fontSize: '18px', color: '#a1a1aa', marginBottom: '8px' }}>
          Connecting to Statsig...
        </div>
        <div style={{ fontSize: '14px', color: '#52525b' }}>
          Fetching experiments and feature gates
        </div>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    )
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header with gradient */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(59, 130, 246, 0.05) 100%)',
          borderRadius: '16px',
          padding: '24px',
          marginBottom: '24px',
          border: '1px solid rgba(139, 92, 246, 0.2)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Background pattern */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(139, 92, 246, 0.15) 1px, transparent 0)`,
            backgroundSize: '24px 24px',
            pointerEvents: 'none',
          }}
        />

        <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ margin: 0, color: '#fff', fontSize: '28px', fontWeight: 700, letterSpacing: '-0.5px' }}>
              Statsig Mission Control
            </h1>
            <p style={{ margin: '6px 0 0 0', color: '#a1a1aa', fontSize: '14px' }}>
              {experiments.length} experiments • {gates.length} feature gates
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ fontSize: '12px', color: '#71717a', textAlign: 'right' }}>
              {lastUpdated && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: '#22c55e',
                      animation: 'pulse 2s ease-in-out infinite',
                    }}
                  />
                  <span>{lastUpdated.toLocaleTimeString()}</span>
                  {cached && <span style={{ color: '#f59e0b' }}>(cached)</span>}
                </div>
              )}
            </div>
            <button
              onClick={() => {
                fetchExperiments(true)
                fetchGates()
              }}
              disabled={refreshing}
              style={{
                padding: '10px 20px',
                background: refreshing ? '#27272a' : 'linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(139, 92, 246, 0.1))',
                border: '1px solid rgba(139, 92, 246, 0.3)',
                borderRadius: '8px',
                color: refreshing ? '#71717a' : '#a78bfa',
                cursor: refreshing ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s ease',
              }}
            >
              <span style={{ transform: refreshing ? 'rotate(360deg)' : 'none', transition: 'transform 1s linear' }}>⟳</span>
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '12px', marginTop: '24px' }}>
          <StatCard label="Running" value={running.length} color="#22c55e" />
          <StatCard label="Not Started" value={setup.length} color="#f59e0b" />
          <StatCard label="Completed" value={completed.length} color="#3b82f6" />
          <StatCard label="Abandoned" value={abandoned.length} color="#ef4444" />
          <StatCard label="Gates On" value={enabledGates.length} color="#22c55e" />
          <StatCard label="Gates Off" value={disabledGates.length} color="#71717a" />
        </div>
      </div>

      {/* Tabs and Search */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
        {/* Tabs */}
        <div style={{ display: 'flex', background: '#18181b', borderRadius: '10px', padding: '4px', border: '1px solid #27272a' }}>
          <TabButton
            active={activeTab === 'experiments'}
            onClick={() => setActiveTab('experiments')}
            label="Experiments"
            count={experiments.length}
          />
          <TabButton
            active={activeTab === 'gates'}
            onClick={() => setActiveTab('gates')}
            label="Feature Gates"
            count={gates.length}
          />
        </div>

        {/* Search and Filter */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {/* Search */}
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                padding: '10px 16px 10px 40px',
                background: '#18181b',
                border: '1px solid #27272a',
                borderRadius: '8px',
                color: '#e4e4e7',
                fontSize: '14px',
                width: '240px',
                outline: 'none',
                transition: 'border-color 0.2s ease',
              }}
              onFocus={(e) => e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.5)'}
              onBlur={(e) => e.currentTarget.style.borderColor = '#27272a'}
            />
            <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#52525b', fontSize: '14px' }}>
              🔍
            </span>
          </div>

          {/* Status Filter (only for experiments) */}
          {activeTab === 'experiments' && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              style={{
                padding: '10px 16px',
                background: '#18181b',
                border: '1px solid #27272a',
                borderRadius: '8px',
                color: '#e4e4e7',
                fontSize: '14px',
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              <option value="all">All Status</option>
              <option value="active">Running</option>
              <option value="setup">Not Started</option>
              <option value="decision_made">Completed</option>
              <option value="abandoned">Abandoned</option>
            </select>
          )}
        </div>
      </div>

      {/* Error States */}
      {(error && activeTab === 'experiments') && (
        <ErrorBanner message={error} onRetry={() => fetchExperiments(true)} />
      )}
      {(gatesError && activeTab === 'gates') && (
        <ErrorBanner message={gatesError} onRetry={fetchGates} />
      )}

      {/* Content */}
      {activeTab === 'experiments' ? (
        <>
          {/* Running Experiments */}
          {running.length > 0 && (
            <Section title="Running" count={running.length} color="#22c55e">
              {running.map((exp) => <ExperimentCard key={exp.id} experiment={exp} />)}
            </Section>
          )}

          {/* Not Started */}
          {setup.length > 0 && (
            <Section title="Not Started" count={setup.length} color="#f59e0b">
              {setup.map((exp) => <ExperimentCard key={exp.id} experiment={exp} />)}
            </Section>
          )}

          {/* Completed */}
          {completed.length > 0 && (
            <Section title="Completed" count={completed.length} color="#3b82f6">
              {completed.map((exp) => <ExperimentCard key={exp.id} experiment={exp} />)}
            </Section>
          )}

          {/* Abandoned */}
          {abandoned.length > 0 && (
            <Section title="Abandoned" count={abandoned.length} color="#ef4444">
              {abandoned.map((exp) => <ExperimentCard key={exp.id} experiment={exp} />)}
            </Section>
          )}

          {/* Empty State */}
          {filteredExperiments.length === 0 && !error && (
            <EmptyState
              icon="🧪"
              title={searchQuery ? 'No matching experiments' : 'No Experiments Found'}
              description={searchQuery ? `No experiments match "${searchQuery}"` : 'Create your first experiment in the Statsig Console'}
            />
          )}
        </>
      ) : (
        <>
          {/* Enabled Gates */}
          {enabledGates.length > 0 && (
            <Section title="Enabled" count={enabledGates.length} color="#22c55e">
              {enabledGates.map((gate) => <FeatureGateCard key={gate.id} gate={gate} />)}
            </Section>
          )}

          {/* Disabled Gates */}
          {disabledGates.length > 0 && (
            <Section title="Disabled" count={disabledGates.length} color="#71717a">
              {disabledGates.map((gate) => <FeatureGateCard key={gate.id} gate={gate} />)}
            </Section>
          )}

          {/* Empty State */}
          {filteredGates.length === 0 && !gatesError && (
            <EmptyState
              icon="🚦"
              title={searchQuery ? 'No matching gates' : 'No Feature Gates Found'}
              description={searchQuery ? `No gates match "${searchQuery}"` : 'Create your first feature gate in the Statsig Console'}
            />
          )}
        </>
      )}

      {/* Keyframe animations */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  )
}

// Sub-components
const StatCard: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => (
  <div
    style={{
      background: 'rgba(0,0,0,0.2)',
      borderRadius: '10px',
      padding: '16px',
      textAlign: 'center',
      border: `1px solid ${color}22`,
    }}
  >
    <div style={{ fontSize: '32px', fontWeight: 700, color, fontFamily: 'JetBrains Mono, monospace' }}>
      {value}
    </div>
    <div style={{ fontSize: '12px', color: '#71717a', marginTop: '4px', fontWeight: 500 }}>{label}</div>
  </div>
)

const TabButton: React.FC<{ active: boolean; onClick: () => void; label: string; count: number }> = ({ active, onClick, label, count }) => (
  <button
    onClick={onClick}
    style={{
      padding: '10px 20px',
      background: active ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.3), rgba(139, 92, 246, 0.15))' : 'transparent',
      border: 'none',
      borderRadius: '8px',
      color: active ? '#fff' : '#71717a',
      cursor: 'pointer',
      fontSize: '14px',
      fontWeight: active ? 600 : 400,
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      transition: 'all 0.2s ease',
    }}
  >
    {label}
    <span
      style={{
        background: active ? 'rgba(255,255,255,0.2)' : 'rgba(113, 113, 122, 0.2)',
        padding: '2px 8px',
        borderRadius: '4px',
        fontSize: '12px',
        fontFamily: 'JetBrains Mono, monospace',
      }}
    >
      {count}
    </span>
  </button>
)

const Section: React.FC<{ title: string; count: number; color: string; children: React.ReactNode }> = ({ title, count, color, children }) => (
  <section style={{ marginBottom: '32px' }}>
    <h2 style={{ color, fontSize: '18px', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
      <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: color, display: 'inline-block', boxShadow: `0 0 12px ${color}66` }} />
      {title}
      <span style={{ fontSize: '14px', color: '#71717a', fontWeight: 400 }}>({count})</span>
    </h2>
    {children}
  </section>
)

const ErrorBanner: React.FC<{ message: string; onRetry: () => void }> = ({ message, onRetry }) => (
  <div
    style={{
      background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(239, 68, 68, 0.05))',
      border: '1px solid rgba(239, 68, 68, 0.3)',
      borderRadius: '12px',
      padding: '20px',
      marginBottom: '24px',
    }}
  >
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <h3 style={{ color: '#ef4444', margin: '0 0 4px 0', fontSize: '16px' }}>Connection Error</h3>
        <p style={{ color: '#fca5a5', margin: 0, fontSize: '14px' }}>{message}</p>
      </div>
      <button
        onClick={onRetry}
        style={{
          padding: '8px 16px',
          background: 'rgba(239, 68, 68, 0.2)',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          borderRadius: '6px',
          color: '#ef4444',
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: 500,
        }}
      >
        Retry
      </button>
    </div>
  </div>
)

const EmptyState: React.FC<{ icon: string; title: string; description: string }> = ({ icon, title, description }) => (
  <div style={{ textAlign: 'center', padding: '60px 20px' }}>
    <div style={{ fontSize: '56px', marginBottom: '16px' }}>{icon}</div>
    <h3 style={{ color: '#e4e4e7', margin: '0 0 8px 0', fontSize: '18px' }}>{title}</h3>
    <p style={{ color: '#71717a', margin: 0, fontSize: '14px' }}>
      {description}
      {!description.includes('match') && (
        <>
          {' '}
          <a
            href="https://console.statsig.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#a78bfa', textDecoration: 'none' }}
          >
            Open Console ↗
          </a>
        </>
      )}
    </p>
  </div>
)

export default StatsigDashboard
