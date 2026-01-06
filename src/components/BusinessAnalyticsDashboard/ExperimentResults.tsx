'use client'

import React from 'react'
import type { ExperimentResults as ExperimentResultsType } from './types'

interface ExperimentResultsProps {
    data: ExperimentResultsType[]
    loading?: boolean
}

const ExperimentResults: React.FC<ExperimentResultsProps> = ({ data, loading }) => {
    if (loading) {
        return (
            <div style={styles.container}>
                <h3 style={styles.title}>Active Experiments</h3>
                <div style={styles.skeletonList}>
                    {[1, 2, 3].map(i => (
                        <div key={i} style={styles.skeletonItem}>
                            <div style={styles.skeletonName} />
                            <div style={styles.skeletonBadge} />
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    if (!data || data.length === 0) {
        return (
            <div style={styles.container}>
                <h3 style={styles.title}>Active Experiments</h3>
                <p style={styles.noData}>No active experiments</p>
            </div>
        )
    }

    return (
        <div style={styles.container}>
            <h3 style={styles.title}>Active Experiments</h3>
            <div style={styles.list}>
                {data.map((experiment, index) => {
                    const winner = experiment.variants.find(v => v.isWinning)
                    const statusColor = {
                        running: '#3b82f6',
                        completed: '#10b981',
                        paused: '#9ca3af',
                    }[experiment.status]

                    return (
                        <div key={index} style={styles.experiment}>
                            <div style={styles.experimentHeader}>
                                <span style={styles.experimentName}>{experiment.name}</span>
                                <span style={{
                                    ...styles.statusBadge,
                                    backgroundColor: statusColor + '20',
                                    color: statusColor,
                                }}>
                                    {experiment.status}
                                </span>
                            </div>
                            <div style={styles.variants}>
                                {experiment.variants.map((variant, vi) => (
                                    <div
                                        key={vi}
                                        style={{
                                            ...styles.variant,
                                            backgroundColor: variant.isWinning ? '#dcfce7' : '#f9fafb',
                                            borderColor: variant.isWinning ? '#10b981' : '#e5e7eb',
                                        }}
                                    >
                                        <div style={styles.variantHeader}>
                                            <span style={styles.variantName}>
                                                {variant.name}
                                                {variant.isWinning && ' 🏆'}
                                            </span>
                                            {variant.statisticalSignificance > 0 && (
                                                <span style={styles.significance}>
                                                    {(variant.statisticalSignificance * 100).toFixed(0)}% sig
                                                </span>
                                            )}
                                        </div>
                                        <div style={styles.variantStats}>
                                            <span style={styles.conversionRate}>
                                                {(variant.conversionRate * 100).toFixed(1)}%
                                            </span>
                                            {variant.sampleSize > 0 && (
                                                <span style={styles.sampleSize}>
                                                    n={variant.sampleSize.toLocaleString()}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )
                })}
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
    title: {
        margin: '0 0 16px 0',
        fontSize: '16px',
        fontWeight: 600,
        color: '#111827',
    },
    list: {
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
    },
    experiment: {
        padding: '12px',
        backgroundColor: '#f9fafb',
        borderRadius: '8px',
    },
    experimentHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '12px',
    },
    experimentName: {
        fontSize: '14px',
        fontWeight: 600,
        color: '#111827',
    },
    statusBadge: {
        fontSize: '11px',
        fontWeight: 600,
        padding: '2px 8px',
        borderRadius: '4px',
        textTransform: 'uppercase',
    },
    variants: {
        display: 'flex',
        gap: '8px',
        flexWrap: 'wrap',
    },
    variant: {
        flex: '1 1 calc(50% - 4px)',
        minWidth: '120px',
        padding: '10px',
        borderRadius: '6px',
        border: '1px solid',
    },
    variantHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '4px',
    },
    variantName: {
        fontSize: '12px',
        fontWeight: 500,
        color: '#374151',
    },
    significance: {
        fontSize: '10px',
        color: '#6b7280',
    },
    variantStats: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
    },
    conversionRate: {
        fontSize: '18px',
        fontWeight: 700,
        color: '#111827',
    },
    sampleSize: {
        fontSize: '11px',
        color: '#9ca3af',
    },
    noData: {
        color: '#9ca3af',
        fontSize: '14px',
        textAlign: 'center',
        padding: '40px 0',
    },
    skeletonList: {
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
    },
    skeletonItem: {
        display: 'flex',
        justifyContent: 'space-between',
        padding: '12px',
        backgroundColor: '#f9fafb',
        borderRadius: '8px',
    },
    skeletonName: {
        width: '60%',
        height: '16px',
        backgroundColor: '#e5e7eb',
        borderRadius: '4px',
    },
    skeletonBadge: {
        width: '60px',
        height: '20px',
        backgroundColor: '#e5e7eb',
        borderRadius: '4px',
    },
}

export default ExperimentResults
