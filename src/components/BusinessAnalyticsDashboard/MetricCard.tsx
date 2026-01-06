'use client'

import React from 'react'
import type { MetricCardProps } from './types'

const MetricCard: React.FC<MetricCardProps> = ({
    title,
    value,
    subtitle,
    change,
    changeLabel,
    color = '#3b82f6',
    loading = false,
    error,
}) => {
    const isPositiveChange = change !== undefined && change >= 0

    if (loading) {
        return (
            <div style={styles.card}>
                <div style={styles.skeleton} />
                <div style={{ ...styles.skeleton, width: '60%', height: '32px', marginTop: '8px' }} />
            </div>
        )
    }

    if (error) {
        return (
            <div style={{ ...styles.card, borderColor: '#fecaca' }}>
                <p style={styles.title}>{title}</p>
                <p style={{ ...styles.value, color: '#ef4444', fontSize: '16px' }}>Error</p>
                <p style={styles.subtitle}>{error}</p>
            </div>
        )
    }

    return (
        <div style={styles.card}>
            <p style={styles.title}>{title}</p>
            <p style={{ ...styles.value, color }}>{value}</p>
            {change !== undefined && (
                <div style={styles.changeContainer}>
                    <span style={{
                        ...styles.changeBadge,
                        backgroundColor: isPositiveChange ? '#dcfce7' : '#fef2f2',
                        color: isPositiveChange ? '#166534' : '#991b1b',
                    }}>
                        {isPositiveChange ? '↑' : '↓'} {Math.abs(change).toFixed(1)}%
                    </span>
                    {changeLabel && <span style={styles.changeLabel}>{changeLabel}</span>}
                </div>
            )}
            {subtitle && <p style={styles.subtitle}>{subtitle}</p>}
        </div>
    )
}

const styles: Record<string, React.CSSProperties> = {
    card: {
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: '12px',
        padding: '20px',
        flex: 1,
        minWidth: '180px',
    },
    title: {
        margin: 0,
        fontSize: '13px',
        fontWeight: 500,
        color: '#6b7280',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
    },
    value: {
        margin: '8px 0 0',
        fontSize: '32px',
        fontWeight: 700,
        lineHeight: 1.2,
    },
    subtitle: {
        margin: '8px 0 0',
        fontSize: '12px',
        color: '#9ca3af',
    },
    changeContainer: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginTop: '8px',
    },
    changeBadge: {
        padding: '2px 8px',
        borderRadius: '4px',
        fontSize: '12px',
        fontWeight: 600,
    },
    changeLabel: {
        fontSize: '12px',
        color: '#6b7280',
    },
    skeleton: {
        backgroundColor: '#f3f4f6',
        borderRadius: '4px',
        height: '16px',
        width: '80%',
        animation: 'pulse 1.5s infinite',
    },
}

export default MetricCard
