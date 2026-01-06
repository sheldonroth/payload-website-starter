'use client'

import React from 'react'
import type { ReferralMetrics } from './types'

interface ReferralAttributionProps {
    data: ReferralMetrics | null
    loading?: boolean
}

const ReferralAttribution: React.FC<ReferralAttributionProps> = ({ data, loading }) => {
    if (loading) {
        return (
            <div style={styles.container}>
                <h3 style={styles.title}>Referral Attribution</h3>
                <div style={styles.skeleton}>
                    <div style={styles.skeletonRow} />
                    <div style={styles.skeletonRow} />
                    <div style={styles.skeletonRow} />
                </div>
            </div>
        )
    }

    if (!data) {
        return (
            <div style={styles.container}>
                <h3 style={styles.title}>Referral Attribution</h3>
                <p style={styles.noData}>No referral data available</p>
            </div>
        )
    }

    const sourceIcons: Record<string, string> = {
        mobile: '📱',
        web: '🌐',
        link: '🔗',
    }

    return (
        <div style={styles.container}>
            <h3 style={styles.title}>Referral Attribution</h3>

            {/* Summary Stats */}
            <div style={styles.stats}>
                <div style={styles.stat}>
                    <span style={styles.statValue}>{data.totalReferrals.toLocaleString()}</span>
                    <span style={styles.statLabel}>Total</span>
                </div>
                <div style={styles.stat}>
                    <span style={{ ...styles.statValue, color: '#10b981' }}>
                        {data.activeReferrals.toLocaleString()}
                    </span>
                    <span style={styles.statLabel}>Active</span>
                </div>
                <div style={styles.stat}>
                    <span style={{ ...styles.statValue, color: '#f59e0b' }}>
                        {data.pendingReferrals.toLocaleString()}
                    </span>
                    <span style={styles.statLabel}>Pending</span>
                </div>
            </div>

            {/* Source Breakdown */}
            {data.bySource.length > 0 && (
                <div style={styles.section}>
                    <h4 style={styles.sectionTitle}>By Source</h4>
                    <div style={styles.sources}>
                        {data.bySource.map((source, index) => (
                            <div key={index} style={styles.source}>
                                <div style={styles.sourceHeader}>
                                    <span style={styles.sourceIcon}>
                                        {sourceIcons[source.source] || '📊'}
                                    </span>
                                    <span style={styles.sourceName}>{source.source}</span>
                                </div>
                                <div style={styles.sourceStats}>
                                    <div style={styles.sourceBar}>
                                        <div
                                            style={{
                                                ...styles.sourceBarFill,
                                                width: `${(source.conversions / Math.max(source.count, 1)) * 100}%`,
                                            }}
                                        />
                                    </div>
                                    <div style={styles.sourceNumbers}>
                                        <span style={styles.sourceCount}>{source.count}</span>
                                        <span style={styles.sourceConversions}>
                                            {source.conversions} converted ({(source.conversionRate * 100).toFixed(0)}%)
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Commission Summary */}
            <div style={styles.section}>
                <h4 style={styles.sectionTitle}>Commissions</h4>
                <div style={styles.commissions}>
                    <div style={styles.commission}>
                        <span style={styles.commissionLabel}>Paid</span>
                        <span style={{ ...styles.commissionValue, color: '#10b981' }}>
                            ${data.commissionPaid.toLocaleString()}
                        </span>
                    </div>
                    <div style={styles.commission}>
                        <span style={styles.commissionLabel}>Pending</span>
                        <span style={{ ...styles.commissionValue, color: '#f59e0b' }}>
                            ${data.commissionPending.toLocaleString()}
                        </span>
                    </div>
                </div>
            </div>

            {/* Top Referrers */}
            {data.topReferrers.length > 0 && (
                <div style={styles.section}>
                    <h4 style={styles.sectionTitle}>Top Referrers</h4>
                    <div style={styles.topReferrers}>
                        {data.topReferrers.slice(0, 3).map((referrer, index) => (
                            <div key={index} style={styles.referrer}>
                                <div style={styles.referrerRank}>{index + 1}</div>
                                <div style={styles.referrerInfo}>
                                    <span style={styles.referrerCode}>{referrer.referralCode}</span>
                                    <span style={styles.referrerStats}>
                                        {referrer.activeReferrals}/{referrer.totalReferrals} active
                                        {referrer.totalCommission > 0 && (
                                            <> · ${referrer.totalCommission.toLocaleString()}</>
                                        )}
                                    </span>
                                </div>
                            </div>
                        ))}
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
    title: {
        margin: '0 0 16px 0',
        fontSize: '16px',
        fontWeight: 600,
        color: '#111827',
    },
    stats: {
        display: 'flex',
        gap: '16px',
        marginBottom: '20px',
    },
    stat: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '12px',
        backgroundColor: '#f9fafb',
        borderRadius: '8px',
    },
    statValue: {
        fontSize: '24px',
        fontWeight: 700,
        color: '#111827',
    },
    statLabel: {
        fontSize: '12px',
        color: '#6b7280',
        marginTop: '4px',
    },
    section: {
        marginTop: '16px',
        paddingTop: '16px',
        borderTop: '1px solid #e5e7eb',
    },
    sectionTitle: {
        margin: '0 0 12px 0',
        fontSize: '13px',
        fontWeight: 600,
        color: '#6b7280',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
    },
    sources: {
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
    },
    source: {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
    },
    sourceHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
    },
    sourceIcon: {
        fontSize: '16px',
    },
    sourceName: {
        fontSize: '14px',
        fontWeight: 500,
        color: '#111827',
        textTransform: 'capitalize',
    },
    sourceStats: {
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
    },
    sourceBar: {
        height: '8px',
        backgroundColor: '#e5e7eb',
        borderRadius: '4px',
        overflow: 'hidden',
    },
    sourceBarFill: {
        height: '100%',
        backgroundColor: '#3b82f6',
        borderRadius: '4px',
        transition: 'width 0.3s ease',
    },
    sourceNumbers: {
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '12px',
    },
    sourceCount: {
        fontWeight: 600,
        color: '#111827',
    },
    sourceConversions: {
        color: '#6b7280',
    },
    commissions: {
        display: 'flex',
        gap: '16px',
    },
    commission: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        padding: '12px',
        backgroundColor: '#f9fafb',
        borderRadius: '8px',
    },
    commissionLabel: {
        fontSize: '12px',
        color: '#6b7280',
    },
    commissionValue: {
        fontSize: '20px',
        fontWeight: 700,
        marginTop: '4px',
    },
    topReferrers: {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
    },
    referrer: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '8px',
        backgroundColor: '#f9fafb',
        borderRadius: '6px',
    },
    referrerRank: {
        width: '24px',
        height: '24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#3b82f6',
        color: '#fff',
        borderRadius: '50%',
        fontSize: '12px',
        fontWeight: 600,
    },
    referrerInfo: {
        display: 'flex',
        flexDirection: 'column',
    },
    referrerCode: {
        fontSize: '14px',
        fontWeight: 600,
        color: '#111827',
    },
    referrerStats: {
        fontSize: '12px',
        color: '#6b7280',
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
        gap: '12px',
    },
    skeletonRow: {
        height: '60px',
        backgroundColor: '#f3f4f6',
        borderRadius: '8px',
    },
}

export default ReferralAttribution
