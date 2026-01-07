'use client'

import React, { useState } from 'react'
import type { StatsigGate } from './types'

interface Props {
  gate: StatsigGate
}

export const FeatureGateCard: React.FC<Props> = ({ gate }) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const isEnabled = gate.isEnabled || gate.enabled

  // Calculate effective pass rate from rules
  const effectivePassRate = gate.rules?.length
    ? gate.rules.reduce((sum, rule) => sum + (rule.passPercentage || 0), 0) / gate.rules.length
    : 0

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #18181b 0%, #1f1f23 100%)',
        border: `1px solid ${isEnabled ? 'rgba(34, 197, 94, 0.3)' : 'rgba(113, 113, 122, 0.3)'}`,
        borderRadius: '12px',
        padding: '20px',
        marginBottom: '12px',
        position: 'relative',
        overflow: 'hidden',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)'
        e.currentTarget.style.boxShadow = isEnabled
          ? '0 8px 32px rgba(34, 197, 94, 0.15)'
          : '0 8px 32px rgba(0, 0, 0, 0.3)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      {/* Glow effect for enabled gates */}
      {isEnabled && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '2px',
            background: 'linear-gradient(90deg, transparent, #22c55e, transparent)',
            animation: 'pulse 2s ease-in-out infinite',
          }}
        />
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            {/* Status indicator with pulse */}
            <div
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: isEnabled ? '#22c55e' : '#71717a',
                boxShadow: isEnabled ? '0 0 12px rgba(34, 197, 94, 0.6)' : 'none',
                animation: isEnabled ? 'glow 2s ease-in-out infinite' : 'none',
              }}
            />
            <h3 style={{ margin: 0, color: '#fff', fontSize: '16px', fontWeight: 600, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
              {gate.name}
            </h3>
          </div>
          {gate.description && (
            <p style={{ margin: '4px 0 0 20px', color: '#71717a', fontSize: '13px', lineHeight: 1.5 }}>
              {gate.description}
            </p>
          )}
        </div>

        {/* Toggle Visual */}
        <div
          style={{
            width: '52px',
            height: '28px',
            borderRadius: '14px',
            background: isEnabled
              ? 'linear-gradient(135deg, #22c55e, #16a34a)'
              : 'linear-gradient(135deg, #3f3f46, #27272a)',
            padding: '2px',
            cursor: 'default',
            transition: 'all 0.3s ease',
            boxShadow: isEnabled ? '0 0 16px rgba(34, 197, 94, 0.3)' : 'inset 0 2px 4px rgba(0,0,0,0.3)',
          }}
        >
          <div
            style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              background: '#fff',
              transform: isEnabled ? 'translateX(24px)' : 'translateX(0)',
              transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
            }}
          />
        </div>
      </div>

      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' }}>
        {/* Pass Rate */}
        <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '12px' }}>
          <div style={{ fontSize: '11px', color: '#71717a', fontWeight: 600, marginBottom: '4px', letterSpacing: '0.5px' }}>
            PASS RATE
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
            <span style={{ fontSize: '24px', fontWeight: 700, color: isEnabled ? '#22c55e' : '#a1a1aa', fontFamily: 'JetBrains Mono, monospace' }}>
              {effectivePassRate.toFixed(0)}
            </span>
            <span style={{ fontSize: '14px', color: '#71717a' }}>%</span>
          </div>
        </div>

        {/* Rules Count */}
        <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '12px' }}>
          <div style={{ fontSize: '11px', color: '#71717a', fontWeight: 600, marginBottom: '4px', letterSpacing: '0.5px' }}>
            RULES
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#e4e4e7', fontFamily: 'JetBrains Mono, monospace' }}>
            {gate.rules?.length || 0}
          </div>
        </div>

        {/* Status */}
        <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '12px' }}>
          <div style={{ fontSize: '11px', color: '#71717a', fontWeight: 600, marginBottom: '4px', letterSpacing: '0.5px' }}>
            STATUS
          </div>
          <div
            style={{
              fontSize: '13px',
              fontWeight: 600,
              color: isEnabled ? '#22c55e' : '#f59e0b',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            {isEnabled ? 'Enabled' : 'Disabled'}
          </div>
        </div>
      </div>

      {/* Rules Summary */}
      {gate.rules && gate.rules.length > 0 && (
        <div style={{ marginBottom: '12px' }}>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              color: '#a1a1aa',
              cursor: 'pointer',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: 500,
            }}
          >
            <span style={{
              display: 'inline-block',
              transform: isExpanded ? 'rotate(90deg)' : 'rotate(0)',
              transition: 'transform 0.2s ease',
            }}>
              ▶
            </span>
            Targeting Rules
          </button>

          {isExpanded && (
            <div style={{ marginTop: '12px', paddingLeft: '16px', borderLeft: '2px solid #27272a' }}>
              {gate.rules.map((rule, idx) => (
                <div
                  key={rule.id || idx}
                  style={{
                    background: 'rgba(0,0,0,0.15)',
                    borderRadius: '6px',
                    padding: '10px 12px',
                    marginBottom: '8px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ color: '#e4e4e7', fontSize: '13px', fontWeight: 500 }}>
                      {rule.name || `Rule ${idx + 1}`}
                    </span>
                    <span
                      style={{
                        background: 'rgba(34, 197, 94, 0.15)',
                        color: '#22c55e',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 600,
                        fontFamily: 'JetBrains Mono, monospace',
                      }}
                    >
                      {rule.passPercentage}% pass
                    </span>
                  </div>
                  {rule.conditions && rule.conditions.length > 0 && (
                    <div style={{ fontSize: '12px', color: '#71717a', fontFamily: 'JetBrains Mono, monospace' }}>
                      {rule.conditions.map((cond, i) => (
                        <span key={i}>
                          {i > 0 && <span style={{ color: '#a1a1aa' }}> AND </span>}
                          <span style={{ color: '#f59e0b' }}>{cond.field}</span>
                          <span style={{ color: '#71717a' }}> {cond.operator} </span>
                          <span style={{ color: '#3b82f6' }}>
                            {Array.isArray(cond.targetValue) ? cond.targetValue.join(', ') : String(cond.targetValue)}
                          </span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tags */}
      {gate.tags && gate.tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
          {gate.tags.map((tag, idx) => (
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
          {gate.lastModifiedTime && (
            <span>Modified: {new Date(gate.lastModifiedTime).toLocaleDateString()}</span>
          )}
        </div>
        <a
          href={`https://console.statsig.com/gates/${gate.id}`}
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

export default FeatureGateCard
