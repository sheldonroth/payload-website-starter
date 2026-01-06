'use client'

import React from 'react'
import type { MRRPrediction } from './types'

interface PredictedMRRProps {
    data: MRRPrediction | null
    loading?: boolean
}

const PredictedMRR: React.FC<PredictedMRRProps> = ({ data, loading }) => {
    if (loading) {
        return (
            <div style={styles.container}>
                <h3 style={styles.title}>MRR Projection</h3>
                <div style={styles.skeleton}>
                    <div style={styles.skeletonCurrent} />
                    <div style={styles.skeletonPredictions}>
                        <div style={styles.skeletonBar} />
                        <div style={styles.skeletonBar} />
                        <div style={styles.skeletonBar} />
                    </div>
                </div>
            </div>
        )
    }

    if (!data) {
        return (
            <div style={styles.container}>
                <h3 style={styles.title}>MRR Projection</h3>
                <p style={styles.noData}>No MRR data available</p>
            </div>
        )
    }

    const trendEmoji = {
        up: '📈',
        down: '📉',
        stable: '➡️',
    }[data.trend]

    const trendColor = {
        up: '#10b981',
        down: '#ef4444',
        stable: '#6b7280',
    }[data.trend]

    const growthText = data.growthRate > 0
        ? `+${(data.growthRate * 100).toFixed(1)}%`
        : `${(data.growthRate * 100).toFixed(1)}%`

    const maxMRR = Math.max(data.current, data.predicted30Day, data.predicted90Day)

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <h3 style={styles.title}>MRR Projection</h3>
                <span style={styles.trend}>
                    {trendEmoji} <span style={{ color: trendColor }}>{growthText}/mo</span>
                </span>
            </div>

            {/* Current MRR */}
            <div style={styles.currentMRR}>
                <span style={styles.currentLabel}>Current MRR</span>
                <span style={styles.currentValue}>${data.current.toLocaleString()}</span>
            </div>

            {/* Predictions Chart */}
            <div style={styles.predictions}>
                <div style={styles.prediction}>
                    <div style={styles.predictionLabel}>Now</div>
                    <div style={styles.predictionBarWrapper}>
                        <div
                            style={{
                                ...styles.predictionBar,
                                height: `${(data.current / maxMRR) * 100}%`,
                                backgroundColor: '#3b82f6',
                            }}
                        />
                    </div>
                    <div style={styles.predictionValue}>${data.current.toLocaleString()}</div>
                </div>
                <div style={styles.prediction}>
                    <div style={styles.predictionLabel}>30 Days</div>
                    <div style={styles.predictionBarWrapper}>
                        <div
                            style={{
                                ...styles.predictionBar,
                                height: `${(data.predicted30Day / maxMRR) * 100}%`,
                                backgroundColor: data.predicted30Day >= data.current ? '#10b981' : '#ef4444',
                            }}
                        />
                    </div>
                    <div style={styles.predictionValue}>${data.predicted30Day.toLocaleString()}</div>
                </div>
                <div style={styles.prediction}>
                    <div style={styles.predictionLabel}>90 Days</div>
                    <div style={styles.predictionBarWrapper}>
                        <div
                            style={{
                                ...styles.predictionBar,
                                height: `${(data.predicted90Day / maxMRR) * 100}%`,
                                backgroundColor: data.predicted90Day >= data.current ? '#10b981' : '#ef4444',
                            }}
                        />
                    </div>
                    <div style={styles.predictionValue}>${data.predicted90Day.toLocaleString()}</div>
                </div>
            </div>

            {/* Confidence */}
            <div style={styles.confidence}>
                <span style={styles.confidenceLabel}>Confidence</span>
                <div style={styles.confidenceBar}>
                    <div
                        style={{
                            ...styles.confidenceBarFill,
                            width: `${data.confidence * 100}%`,
                        }}
                    />
                </div>
                <span style={styles.confidenceValue}>{(data.confidence * 100).toFixed(0)}%</span>
            </div>
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
        marginBottom: '16px',
    },
    title: {
        margin: 0,
        fontSize: '16px',
        fontWeight: 600,
        color: '#111827',
    },
    trend: {
        fontSize: '14px',
    },
    currentMRR: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '16px',
        backgroundColor: '#f9fafb',
        borderRadius: '8px',
        marginBottom: '20px',
    },
    currentLabel: {
        fontSize: '12px',
        color: '#6b7280',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
    },
    currentValue: {
        fontSize: '36px',
        fontWeight: 700,
        color: '#3b82f6',
        marginTop: '4px',
    },
    predictions: {
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'flex-end',
        height: '120px',
        marginBottom: '20px',
        padding: '0 10px',
    },
    prediction: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px',
        flex: 1,
    },
    predictionLabel: {
        fontSize: '12px',
        color: '#6b7280',
        fontWeight: 500,
    },
    predictionBarWrapper: {
        width: '40px',
        height: '80px',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
    },
    predictionBar: {
        width: '100%',
        borderRadius: '4px 4px 0 0',
        transition: 'height 0.3s ease',
        minHeight: '4px',
    },
    predictionValue: {
        fontSize: '12px',
        fontWeight: 600,
        color: '#111827',
    },
    confidence: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px',
        backgroundColor: '#f9fafb',
        borderRadius: '8px',
    },
    confidenceLabel: {
        fontSize: '12px',
        color: '#6b7280',
        minWidth: '80px',
    },
    confidenceBar: {
        flex: 1,
        height: '8px',
        backgroundColor: '#e5e7eb',
        borderRadius: '4px',
        overflow: 'hidden',
    },
    confidenceBarFill: {
        height: '100%',
        backgroundColor: '#3b82f6',
        borderRadius: '4px',
        transition: 'width 0.3s ease',
    },
    confidenceValue: {
        fontSize: '14px',
        fontWeight: 600,
        color: '#111827',
        minWidth: '40px',
        textAlign: 'right',
    },
    noData: {
        color: '#9ca3af',
        fontSize: '14px',
        textAlign: 'center',
        padding: '40px 0',
    },
    skeleton: {
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
    },
    skeletonCurrent: {
        height: '80px',
        backgroundColor: '#f3f4f6',
        borderRadius: '8px',
    },
    skeletonPredictions: {
        display: 'flex',
        justifyContent: 'space-around',
        height: '100px',
        alignItems: 'flex-end',
    },
    skeletonBar: {
        width: '40px',
        height: `${Math.random() * 60 + 40}%`,
        backgroundColor: '#f3f4f6',
        borderRadius: '4px',
    },
}

export default PredictedMRR
