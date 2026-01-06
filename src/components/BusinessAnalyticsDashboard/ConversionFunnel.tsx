'use client'

import React from 'react'
import type { TrialMetrics } from './types'

interface ConversionFunnelProps {
    data: TrialMetrics | null
    loading?: boolean
}

const ConversionFunnel: React.FC<ConversionFunnelProps> = ({ data, loading }) => {
    if (loading) {
        return (
            <div style={styles.container}>
                <h3 style={styles.title}>Trial Conversion Funnel</h3>
                <div style={styles.funnelSkeleton}>
                    <div style={{ ...styles.stepSkeleton, width: '100%' }} />
                    <div style={{ ...styles.stepSkeleton, width: '70%' }} />
                    <div style={{ ...styles.stepSkeleton, width: '40%' }} />
                </div>
            </div>
        )
    }

    if (!data) {
        return (
            <div style={styles.container}>
                <h3 style={styles.title}>Trial Conversion Funnel</h3>
                <p style={styles.noData}>No trial data available</p>
            </div>
        )
    }

    const steps = [
        { label: 'Trials Started', value: data.started, color: '#3b82f6' },
        { label: 'Active Trials', value: data.active, color: '#8b5cf6' },
        { label: 'Converted', value: data.converted, color: '#10b981' },
    ]

    const maxValue = Math.max(data.started, 1)

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <h3 style={styles.title}>Trial Conversion Funnel</h3>
                <span style={styles.rate}>
                    {(data.conversionRate * 100).toFixed(1)}% conversion
                </span>
            </div>
            <div style={styles.funnel}>
                {steps.map((step, index) => {
                    const width = Math.max((step.value / maxValue) * 100, 10)
                    return (
                        <div key={step.label} style={styles.step}>
                            <div style={styles.stepLabel}>
                                <span style={styles.stepName}>{step.label}</span>
                                <span style={styles.stepValue}>{step.value.toLocaleString()}</span>
                            </div>
                            <div style={styles.barContainer}>
                                <div
                                    style={{
                                        ...styles.bar,
                                        width: `${width}%`,
                                        backgroundColor: step.color,
                                    }}
                                />
                            </div>
                            {index < steps.length - 1 && (
                                <div style={styles.dropoff}>
                                    ↓ {((1 - steps[index + 1].value / step.value) * 100).toFixed(0)}% drop-off
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
            {data.trialHistory && data.trialHistory.length > 0 && (
                <div style={styles.history}>
                    <p style={styles.historyLabel}>Last 7 days trend</p>
                    <div style={styles.miniChart}>
                        {data.trialHistory.slice(-7).map((day, i) => {
                            const height = Math.max((day.started / Math.max(...data.trialHistory.map(d => d.started), 1)) * 100, 5)
                            return (
                                <div
                                    key={i}
                                    style={{
                                        ...styles.miniBar,
                                        height: `${height}%`,
                                    }}
                                    title={`${day.date}: ${day.started} started, ${day.converted} converted`}
                                />
                            )
                        })}
                    </div>
                </div>
            )}
        </div>
    )
}

const styles: Record<string, React.CSSProperties> = {
    container: {
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: '12px',
        padding: '20px',
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
    },
    title: {
        margin: 0,
        fontSize: '16px',
        fontWeight: 600,
        color: '#111827',
    },
    rate: {
        fontSize: '14px',
        fontWeight: 600,
        color: '#10b981',
        backgroundColor: '#dcfce7',
        padding: '4px 8px',
        borderRadius: '4px',
    },
    funnel: {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
    },
    step: {
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
    },
    stepLabel: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    stepName: {
        fontSize: '13px',
        color: '#6b7280',
    },
    stepValue: {
        fontSize: '14px',
        fontWeight: 600,
        color: '#111827',
    },
    barContainer: {
        height: '24px',
        backgroundColor: '#f3f4f6',
        borderRadius: '4px',
        overflow: 'hidden',
    },
    bar: {
        height: '100%',
        borderRadius: '4px',
        transition: 'width 0.3s ease',
    },
    dropoff: {
        fontSize: '11px',
        color: '#9ca3af',
        textAlign: 'center',
        padding: '4px 0',
    },
    history: {
        marginTop: '20px',
        paddingTop: '16px',
        borderTop: '1px solid #e5e7eb',
    },
    historyLabel: {
        margin: '0 0 8px 0',
        fontSize: '12px',
        color: '#6b7280',
    },
    miniChart: {
        display: 'flex',
        alignItems: 'flex-end',
        height: '40px',
        gap: '4px',
    },
    miniBar: {
        flex: 1,
        backgroundColor: '#3b82f6',
        borderRadius: '2px',
        minHeight: '4px',
    },
    noData: {
        color: '#9ca3af',
        fontSize: '14px',
        textAlign: 'center',
        padding: '40px 0',
    },
    funnelSkeleton: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '16px',
    },
    stepSkeleton: {
        height: '32px',
        backgroundColor: '#f3f4f6',
        borderRadius: '4px',
    },
}

export default ConversionFunnel
