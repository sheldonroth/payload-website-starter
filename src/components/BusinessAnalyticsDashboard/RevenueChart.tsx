'use client'

import React from 'react'
import type { DailyRevenue } from './types'

interface RevenueChartProps {
    data: DailyRevenue[]
    loading?: boolean
}

const RevenueChart: React.FC<RevenueChartProps> = ({ data, loading }) => {
    if (loading) {
        return (
            <div style={styles.container}>
                <h3 style={styles.title}>Daily Revenue (Last 7 Days)</h3>
                <div style={styles.chartSkeleton}>
                    {[1, 2, 3, 4, 5, 6, 7].map(i => (
                        <div key={i} style={styles.barSkeleton} />
                    ))}
                </div>
            </div>
        )
    }

    if (!data || data.length === 0) {
        return (
            <div style={styles.container}>
                <h3 style={styles.title}>Daily Revenue (Last 7 Days)</h3>
                <p style={styles.noData}>No revenue data available</p>
            </div>
        )
    }

    const maxValue = Math.max(...data.map(d => d.amount), 1)
    const total = data.reduce((sum, d) => sum + d.amount, 0)

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <h3 style={styles.title}>Daily Revenue (Last 7 Days)</h3>
                <span style={styles.total}>${total.toLocaleString()}</span>
            </div>
            <div style={styles.chart}>
                {data.map((day, index) => {
                    const height = Math.max((day.amount / maxValue) * 100, 4)
                    const date = new Date(day.date)
                    const dayLabel = date.toLocaleDateString('en-US', { weekday: 'short' })

                    return (
                        <div key={index} style={styles.barContainer}>
                            <div style={styles.barWrapper}>
                                <div
                                    style={{
                                        ...styles.bar,
                                        height: `${height}%`,
                                        backgroundColor: day.amount > 0 ? '#3b82f6' : '#e5e7eb',
                                    }}
                                    title={`$${day.amount.toLocaleString()}`}
                                />
                            </div>
                            <span style={styles.label}>{dayLabel}</span>
                            <span style={styles.amount}>${day.amount.toLocaleString()}</span>
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
    total: {
        fontSize: '18px',
        fontWeight: 700,
        color: '#3b82f6',
    },
    chart: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        height: '150px',
        gap: '8px',
    },
    barContainer: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '4px',
    },
    barWrapper: {
        width: '100%',
        height: '120px',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
    },
    bar: {
        width: '80%',
        borderRadius: '4px 4px 0 0',
        transition: 'height 0.3s ease',
        minHeight: '4px',
    },
    label: {
        fontSize: '11px',
        color: '#6b7280',
        fontWeight: 500,
    },
    amount: {
        fontSize: '10px',
        color: '#9ca3af',
    },
    noData: {
        color: '#9ca3af',
        fontSize: '14px',
        textAlign: 'center',
        padding: '40px 0',
    },
    chartSkeleton: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        height: '150px',
        gap: '8px',
    },
    barSkeleton: {
        flex: 1,
        backgroundColor: '#f3f4f6',
        borderRadius: '4px',
        height: `${Math.random() * 60 + 40}%`,
    },
}

export default RevenueChart
