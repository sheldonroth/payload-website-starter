'use client'

import React, { useState } from 'react'
import type { StatsigExperiment } from './types'

interface Props {
  experiment: StatsigExperiment
}

const statusColors: Record<string, { bg: string; text: string; border: string; glow: string }> = {
  active: { bg: 'rgba(34, 197, 94, 0.15)', text: '#22c55e', border: 'rgba(34, 197, 94, 0.3)', glow: 'rgba(34, 197, 94, 0.4)' },
  setup: { bg: 'rgba(245, 158, 11, 0.15)', text: '#f59e0b', border: 'rgba(245, 158, 11, 0.3)', glow: 'rgba(245, 158, 11, 0.4)' },
  decision_made: { bg: 'rgba(59, 130, 246, 0.15)', text: '#3b82f6', border: 'rgba(59, 130, 246, 0.3)', glow: 'rgba(59, 130, 246, 0.4)' },
  abandoned: { bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444', border: 'rgba(239, 68, 68, 0.3)', glow: 'rgba(239, 68, 68, 0.4)' },
}

const statusLabels: Record<string, string> = {
  active: 'Running',
  setup: 'Not Started',
  decision_made: 'Completed',
  abandoned: 'Abandoned',
}

// Donut chart colors for variants
const variantColors = [
  '#22c55e', // green
  '#3b82f6', // blue
  '#f59e0b', // amber
  '#a78bfa', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
  '#84cc16', // lime
]

export const ExperimentCard: React.FC<Props> = ({ experiment }) => {
  const [expandedVariant, setExpandedVariant] = useState<string | null>(null)
  const statusStyle = statusColors[experiment.status] || statusColors.setup
  const statusLabel = statusLabels[experiment.status] || experiment.status

  // Calculate total weight for donut chart
  const totalWeight = experiment.groups?.reduce((sum, g) => sum + (g.weight || 0), 0) || 100

  // Generate SVG donut chart
  const generateDonutChart = () => {
    if (!experiment.groups || experiment.groups.length === 0) return null

    const size = 80
    const strokeWidth = 12
    const radius = (size - strokeWidth) / 2
    const circumference = 2 * Math.PI * radius
    let cumulativeOffset = 0

    return (
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        {experiment.groups.map((variant, idx) => {
          const percentage = (variant.weight || 0) / totalWeight
          const dashLength = circumference * percentage
          const dashOffset = circumference * cumulativeOffset
          cumulativeOffset += percentage

          return (
            <circle
              key={variant.name || idx}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={variantColors[idx % variantColors.length]}
              strokeWidth={strokeWidth}
              strokeDasharray={`${dashLength} ${circumference - dashLength}`}
              strokeDashoffset={-dashOffset}
              style={{ transition: 'all 0.3s ease' }}
            />
          )
        })}
        {/* Center circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius - strokeWidth / 2 - 4}
          fill="#18181b"
        />
      </svg>
    )
  }

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #18181b 0%, #1f1f23 100%)',
        border: `1px solid ${statusStyle.border}`,
        borderRadius: '12px',
        padding: '20px',
        marginBottom: '12px',
        position: 'relative',
        overflow: 'hidden',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)'
        e.currentTarget.style.boxShadow = `0 8px 32px ${statusStyle.glow}`
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      {/* Top glow line */}
      {experiment.status === 'active' && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '2px',
            background: `linear-gradient(90deg, transparent, ${statusStyle.text}, transparent)`,
            animation: 'pulse 2s ease-in-out infinite',
          }}
        />
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            {/* Status indicator */}
            <div
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: statusStyle.text,
                boxShadow: experiment.status === 'active' ? `0 0 12px ${statusStyle.glow}` : 'none',
                animation: experiment.status === 'active' ? 'glow 2s ease-in-out infinite' : 'none',
              }}
            />
            <h3 style={{ margin: 0, color: '#fff', fontSize: '16px', fontWeight: 600 }}>
              {experiment.name}
            </h3>
          </div>
          {experiment.description && (
            <p style={{ margin: '4px 0 0 20px', color: '#71717a', fontSize: '13px', lineHeight: 1.5 }}>
              {experiment.description}
            </p>
          )}
        </div>
        <span
          style={{
            background: statusStyle.bg,
            color: statusStyle.text,
            border: `1px solid ${statusStyle.border}`,
            padding: '5px 12px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 600,
            whiteSpace: 'nowrap',
            letterSpacing: '0.3px',
          }}
        >
          {statusLabel}
        </span>
      </div>

      {/* Hypothesis */}
      {experiment.hypothesis && (
        <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', borderLeft: '3px solid #3b82f6' }}>
          <span style={{ fontSize: '10px', color: '#3b82f6', fontWeight: 700, display: 'block', marginBottom: '4px', letterSpacing: '0.5px' }}>
            HYPOTHESIS
          </span>
          <p style={{ margin: 0, color: '#a1a1aa', fontSize: '13px', lineHeight: 1.6, fontStyle: 'italic' }}>
            {experiment.hypothesis}
          </p>
        </div>
      )}

      {/* Main Content: Variants with Donut Chart */}
      <div style={{ display: 'grid', gridTemplateColumns: experiment.groups && experiment.groups.length > 0 ? '100px 1fr' : '1fr', gap: '20px', marginBottom: '16px' }}>
        {/* Donut Chart */}
        {experiment.groups && experiment.groups.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            {generateDonutChart()}
            <span style={{ fontSize: '11px', color: '#71717a', marginTop: '8px', textAlign: 'center' }}>
              {experiment.groups.length} variants
            </span>
          </div>
        )}

        {/* Variants List */}
        <div>
          <span style={{ fontSize: '10px', color: '#71717a', fontWeight: 700, display: 'block', marginBottom: '10px', letterSpacing: '0.5px' }}>
            VARIANTS & PARAMETERS
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {experiment.groups?.map((variant, idx) => (
              <div key={variant.name || idx}>
                <button
                  onClick={() => setExpandedVariant(expandedVariant === variant.name ? null : variant.name)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                    padding: '10px 12px',
                    background: expandedVariant === variant.name ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.15)',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.25)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = expandedVariant === variant.name ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.15)'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        width: '14px',
                        height: '14px',
                        borderRadius: '4px',
                        background: variantColors[idx % variantColors.length],
                      }}
                    />
                    <span style={{ color: '#e4e4e7', fontSize: '13px', fontWeight: 500 }}>{variant.name}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ color: '#71717a', fontSize: '12px', fontFamily: 'JetBrains Mono, monospace' }}>
                      {variant.weight}%
                    </span>
                    {variant.parameterValues && Object.keys(variant.parameterValues).length > 0 && (
                      <span
                        style={{
                          transform: expandedVariant === variant.name ? 'rotate(90deg)' : 'rotate(0)',
                          transition: 'transform 0.2s ease',
                          color: '#52525b',
                          fontSize: '10px',
                        }}
                      >
                        ▶
                      </span>
                    )}
                  </div>
                </button>

                {/* Parameter Values */}
                {expandedVariant === variant.name && variant.parameterValues && Object.keys(variant.parameterValues).length > 0 && (
                  <div
                    style={{
                      marginTop: '4px',
                      marginLeft: '24px',
                      padding: '10px 12px',
                      background: 'rgba(0,0,0,0.2)',
                      borderRadius: '6px',
                      borderLeft: `2px solid ${variantColors[idx % variantColors.length]}`,
                    }}
                  >
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '11px' }}>
                      {Object.entries(variant.parameterValues).map(([key, value]) => (
                        <div key={key} style={{ marginBottom: '4px', display: 'flex', gap: '8px' }}>
                          <span style={{ color: '#f59e0b' }}>{key}:</span>
                          <span style={{ color: typeof value === 'boolean' ? (value ? '#22c55e' : '#ef4444') : '#a78bfa' }}>
                            {typeof value === 'boolean' ? (value ? 'true' : 'false') : typeof value === 'string' ? `"${value}"` : String(value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Allocation Bar */}
      {experiment.allocation !== undefined && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '10px', color: '#71717a', fontWeight: 700, letterSpacing: '0.5px' }}>TRAFFIC ALLOCATION</span>
            <span style={{ fontSize: '12px', color: '#a1a1aa', fontFamily: 'JetBrains Mono, monospace' }}>{experiment.allocation}%</span>
          </div>
          <div style={{ height: '6px', background: 'rgba(0,0,0,0.3)', borderRadius: '3px', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${experiment.allocation}%`,
                background: `linear-gradient(90deg, ${statusStyle.text}, ${statusStyle.text}88)`,
                borderRadius: '3px',
                transition: 'width 0.5s ease',
              }}
            />
          </div>
        </div>
      )}

      {/* Tags */}
      {experiment.tags && experiment.tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
          {experiment.tags.map((tag, idx) => (
            <span
              key={idx}
              style={{
                padding: '3px 10px',
                background: 'rgba(139, 92, 246, 0.15)',
                border: '1px solid rgba(139, 92, 246, 0.3)',
                borderRadius: '4px',
                fontSize: '11px',
                color: '#a78bfa',
                fontWeight: 500,
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(39, 39, 42, 0.8)', paddingTop: '12px' }}>
        <div style={{ fontSize: '11px', color: '#52525b' }}>
          {experiment.startTime && (
            <span>Started: {new Date(experiment.startTime).toLocaleDateString()}</span>
          )}
          {!experiment.startTime && experiment.lastModifiedTime && (
            <span>Modified: {new Date(experiment.lastModifiedTime).toLocaleDateString()}</span>
          )}
          {experiment.creatorName && (
            <span style={{ marginLeft: '12px' }}>by {experiment.creatorName}</span>
          )}
        </div>
        <a
          href={`https://console.statsig.com/experiments/${experiment.id}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(139, 92, 246, 0.05))',
            border: '1px solid rgba(139, 92, 246, 0.3)',
            borderRadius: '6px',
            color: '#a78bfa',
            fontSize: '12px',
            textDecoration: 'none',
            fontWeight: 500,
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(139, 92, 246, 0.25)'
            e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.5)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(139, 92, 246, 0.05))'
            e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.3)'
          }}
        >
          Open in Console
          <span style={{ fontSize: '10px' }}>↗</span>
        </a>
      </div>

      {/* Keyframe animations */}
      <style>{`
        @keyframes glow {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  )
}

export default ExperimentCard
