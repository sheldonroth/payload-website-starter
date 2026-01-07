'use client'

import React from 'react'
import type { StatsigExperiment } from './types'

interface Props {
  experiment: StatsigExperiment
}

const statusColors: Record<string, { bg: string; text: string; border: string }> = {
  active: { bg: 'rgba(34, 197, 94, 0.15)', text: '#22c55e', border: 'rgba(34, 197, 94, 0.3)' },
  setup: { bg: 'rgba(245, 158, 11, 0.15)', text: '#f59e0b', border: 'rgba(245, 158, 11, 0.3)' },
  decision_made: { bg: 'rgba(107, 114, 128, 0.15)', text: '#6b7280', border: 'rgba(107, 114, 128, 0.3)' },
  abandoned: { bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444', border: 'rgba(239, 68, 68, 0.3)' },
}

const statusLabels: Record<string, string> = {
  active: 'Running',
  setup: 'Not Started',
  decision_made: 'Completed',
  abandoned: 'Abandoned',
}

export const ExperimentCard: React.FC<Props> = ({ experiment }) => {
  const statusStyle = statusColors[experiment.status] || statusColors.setup
  const statusLabel = statusLabels[experiment.status] || experiment.status

  return (
    <div
      style={{
        background: '#18181b',
        border: '1px solid #27272a',
        borderRadius: '8px',
        padding: '16px',
        marginBottom: '12px',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
        <div>
          <h3 style={{ margin: 0, color: '#fff', fontSize: '16px', fontWeight: 600 }}>
            {experiment.name}
          </h3>
          {experiment.description && (
            <p style={{ margin: '4px 0 0 0', color: '#71717a', fontSize: '13px' }}>
              {experiment.description}
            </p>
          )}
        </div>
        <span
          style={{
            background: statusStyle.bg,
            color: statusStyle.text,
            border: `1px solid ${statusStyle.border}`,
            padding: '4px 10px',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: 500,
            whiteSpace: 'nowrap',
          }}
        >
          {statusLabel}
        </span>
      </div>

      {/* Hypothesis */}
      {experiment.hypothesis && (
        <div style={{ marginBottom: '12px', padding: '10px', background: '#27272a', borderRadius: '6px' }}>
          <span style={{ fontSize: '11px', color: '#71717a', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
            HYPOTHESIS
          </span>
          <p style={{ margin: 0, color: '#a1a1aa', fontSize: '13px', lineHeight: 1.5 }}>
            {experiment.hypothesis}
          </p>
        </div>
      )}

      {/* Variants */}
      <div style={{ marginBottom: '12px' }}>
        <span style={{ fontSize: '11px', color: '#71717a', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
          VARIANTS ({experiment.groups?.length || 0})
        </span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {experiment.groups?.map((variant, idx) => (
            <div
              key={variant.name || idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 10px',
                background: '#27272a',
                borderRadius: '4px',
                fontSize: '13px',
              }}
            >
              <span style={{ color: '#e4e4e7' }}>{variant.name}</span>
              <span style={{ color: '#71717a' }}>({variant.weight}%)</span>
            </div>
          ))}
        </div>
      </div>

      {/* Allocation Bar */}
      {experiment.allocation !== undefined && (
        <div style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontSize: '11px', color: '#71717a', fontWeight: 600 }}>ALLOCATION</span>
            <span style={{ fontSize: '12px', color: '#a1a1aa' }}>{experiment.allocation}%</span>
          </div>
          <div style={{ height: '4px', background: '#27272a', borderRadius: '2px', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${experiment.allocation}%`,
                background: statusStyle.text,
                borderRadius: '2px',
              }}
            />
          </div>
        </div>
      )}

      {/* Tags */}
      {experiment.tags && experiment.tags.length > 0 && (
        <div style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {experiment.tags.map((tag, idx) => (
              <span
                key={idx}
                style={{
                  padding: '2px 8px',
                  background: 'rgba(59, 130, 246, 0.15)',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  borderRadius: '3px',
                  fontSize: '11px',
                  color: '#3b82f6',
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Footer Info */}
      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #27272a', paddingTop: '12px', marginTop: '4px' }}>
        <div style={{ fontSize: '12px', color: '#71717a' }}>
          {experiment.startTime && (
            <span>Started: {new Date(experiment.startTime).toLocaleDateString()}</span>
          )}
          {!experiment.startTime && experiment.lastModifiedTime && (
            <span>Modified: {new Date(experiment.lastModifiedTime).toLocaleDateString()}</span>
          )}
        </div>
        {experiment.creatorName && (
          <div style={{ fontSize: '12px', color: '#71717a' }}>
            by {experiment.creatorName}
          </div>
        )}
      </div>

      {/* Link to Statsig Console */}
      <a
        href={`https://console.statsig.com/experiments/${experiment.id}`}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'inline-block',
          marginTop: '12px',
          padding: '6px 12px',
          background: 'rgba(59, 130, 246, 0.15)',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          borderRadius: '4px',
          color: '#3b82f6',
          fontSize: '12px',
          textDecoration: 'none',
        }}
      >
        View in Statsig Console
      </a>
    </div>
  )
}

export default ExperimentCard
