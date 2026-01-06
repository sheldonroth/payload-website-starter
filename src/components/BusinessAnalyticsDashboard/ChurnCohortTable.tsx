'use client'

import React from 'react'
import type { ChurnMetrics } from './types'

interface ChurnCohortTableProps {
    data: ChurnMetrics | null
    loading?: boolean
}

const ChurnCohortTable: React.FC<ChurnCohortTableProps> = ({ data, loading }) => {
    if (loading) {
        return (
            <div style={styles.container}>
                <h3 style={styles.title}>Churn by Cohort</h3>
                <div style={styles.tableSkeleton}>
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} style={styles.rowSkeleton} />
                    ))}
                </div>
            </div>
        )
    }

    if (!data || data.byCohort.length === 0) {
        return (
            <div style={styles.container}>
                <h3 style={styles.title}>Churn by Cohort</h3>
                <p style={styles.noData}>No cohort data available</p>
            </div>
        )
    }

    const getChurnColor = (rate: number): string => {
        if (rate < 0.03) return '#10b981' // Good - green
        if (rate < 0.07) return '#f59e0b' // Warning - yellow
        return '#ef4444' // Bad - red
    }

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <h3 style={styles.title}>Churn by Cohort</h3>
                <div style={styles.overallRate}>
                    <span style={styles.overallLabel}>Overall:</span>
                    <span style={{
                        ...styles.overallValue,
                        color: getChurnColor(data.overall),
                    }}>
                        {(data.overall * 100).toFixed(1)}%
                    </span>
                </div>
            </div>
            <div style={styles.tableWrapper}>
                <table style={styles.table}>
                    <thead>
                        <tr>
                            <th style={styles.th}>Cohort</th>
                            <th style={{ ...styles.th, textAlign: 'right' }}>Users</th>
                            <th style={{ ...styles.th, textAlign: 'right' }}>Churned</th>
                            <th style={{ ...styles.th, textAlign: 'right' }}>Retained</th>
                            <th style={{ ...styles.th, textAlign: 'right' }}>Rate</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.byCohort.map((cohort, index) => (
                            <tr key={index} style={styles.tr}>
                                <td style={styles.td}>
                                    <span style={styles.cohortMonth}>{cohort.cohortMonth}</span>
                                </td>
                                <td style={{ ...styles.td, textAlign: 'right' }}>
                                    {cohort.totalUsers.toLocaleString()}
                                </td>
                                <td style={{ ...styles.td, textAlign: 'right', color: '#ef4444' }}>
                                    -{cohort.churned.toLocaleString()}
                                </td>
                                <td style={{ ...styles.td, textAlign: 'right', color: '#10b981' }}>
                                    {cohort.retained.toLocaleString()}
                                </td>
                                <td style={{ ...styles.td, textAlign: 'right' }}>
                                    <div style={styles.rateCell}>
                                        <div style={styles.rateBar}>
                                            <div
                                                style={{
                                                    ...styles.rateBarFill,
                                                    width: `${Math.min(cohort.churnRate * 100 * 5, 100)}%`,
                                                    backgroundColor: getChurnColor(cohort.churnRate),
                                                }}
                                            />
                                        </div>
                                        <span style={{
                                            ...styles.rateValue,
                                            color: getChurnColor(cohort.churnRate),
                                        }}>
                                            {(cohort.churnRate * 100).toFixed(1)}%
                                        </span>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
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
    overallRate: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
    },
    overallLabel: {
        fontSize: '13px',
        color: '#6b7280',
    },
    overallValue: {
        fontSize: '16px',
        fontWeight: 700,
    },
    tableWrapper: {
        overflowX: 'auto',
    },
    table: {
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: '13px',
    },
    th: {
        padding: '10px 8px',
        borderBottom: '2px solid #e5e7eb',
        fontWeight: 600,
        color: '#6b7280',
        textAlign: 'left',
        whiteSpace: 'nowrap',
    },
    tr: {
        borderBottom: '1px solid #f3f4f6',
    },
    td: {
        padding: '10px 8px',
        color: '#111827',
        whiteSpace: 'nowrap',
    },
    cohortMonth: {
        fontWeight: 500,
    },
    rateCell: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        justifyContent: 'flex-end',
    },
    rateBar: {
        width: '60px',
        height: '6px',
        backgroundColor: '#f3f4f6',
        borderRadius: '3px',
        overflow: 'hidden',
    },
    rateBarFill: {
        height: '100%',
        borderRadius: '3px',
        transition: 'width 0.3s ease',
    },
    rateValue: {
        fontWeight: 600,
        minWidth: '45px',
        textAlign: 'right',
    },
    noData: {
        color: '#9ca3af',
        fontSize: '14px',
        textAlign: 'center',
        padding: '40px 0',
    },
    tableSkeleton: {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
    },
    rowSkeleton: {
        height: '40px',
        backgroundColor: '#f3f4f6',
        borderRadius: '4px',
    },
}

export default ChurnCohortTable
