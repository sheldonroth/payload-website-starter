'use client'

import React, { useState, useEffect, useCallback } from 'react'

interface ContributorProfile {
    id: number
    displayName: string
    contributorNumber: number
    contributorLevel: 'new' | 'builder' | 'veteran' | 'champion'
    avatar: string
    documentsSubmitted: number
    productsTestedFromSubmissions: number
    peopleHelped: number
    firstCases: number
    isPublic: boolean
    createdAt: string
}

interface LeaderboardStats {
    totalContributors: number
    totalDocuments: number
    totalPeopleHelped: number
    levelBreakdown: Record<string, number>
}

const LEVEL_STYLES: Record<string, { bg: string; text: string; label: string; emoji: string }> = {
    new: { bg: '#f3f4f6', text: '#374151', label: 'New', emoji: '\uD83D\uDD2C' },
    builder: { bg: '#dbeafe', text: '#1e40af', label: 'Builder', emoji: '\uD83E\uDDED' },
    veteran: { bg: '#dcfce7', text: '#166534', label: 'Veteran', emoji: '\uD83D\uDDFA\uFE0F' },
    champion: { bg: '#fef3c7', text: '#92400e', label: 'Champion', emoji: '\u2B50' },
}

type SortBy = 'documentsSubmitted' | 'peopleHelped' | 'firstCases' | 'productsTestedFromSubmissions'

const ContributorLeaderboard: React.FC = () => {
    const [contributors, setContributors] = useState<ContributorProfile[]>([])
    const [stats, setStats] = useState<LeaderboardStats | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [sortBy, setSortBy] = useState<SortBy>('documentsSubmitted')
    const [limit, setLimit] = useState(25)

    const fetchData = useCallback(async () => {
        try {
            const response = await fetch(
                `/api/contributor-profiles?sort=-${sortBy}&limit=${limit}&depth=0`
            )
            if (!response.ok) throw new Error('Failed to fetch contributors')
            const data = await response.json()
            setContributors(data.docs || [])

            // Calculate stats
            const allContributors = data.docs as ContributorProfile[]
            const levelBreakdown: Record<string, number> = {
                new: 0,
                builder: 0,
                veteran: 0,
                champion: 0,
            }
            let totalDocs = 0
            let totalHelped = 0

            for (const contributor of allContributors) {
                levelBreakdown[contributor.contributorLevel] = (levelBreakdown[contributor.contributorLevel] || 0) + 1
                totalDocs += contributor.documentsSubmitted
                totalHelped += contributor.peopleHelped
            }

            setStats({
                totalContributors: data.totalDocs || allContributors.length,
                totalDocuments: totalDocs,
                totalPeopleHelped: totalHelped,
                levelBreakdown,
            })

            setError(null)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load')
        } finally {
            setLoading(false)
        }
    }, [sortBy, limit])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    const getRankEmoji = (index: number): string => {
        switch (index) {
            case 0:
                return '\uD83E\uDD47'
            case 1:
                return '\uD83E\uDD48'
            case 2:
                return '\uD83E\uDD49'
            default:
                return `#${index + 1}`
        }
    }

    if (loading) {
        return (
            <div style={styles.container}>
                <div style={styles.loading}>Loading leaderboard...</div>
            </div>
        )
    }

    if (error) {
        return (
            <div style={styles.container}>
                <div style={styles.error}>
                    <h3>Failed to Load Leaderboard</h3>
                    <p>{error}</p>
                    <button onClick={fetchData} style={styles.retryButton}>
                        Retry
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div style={styles.container}>
            {/* Header */}
            <div style={styles.header}>
                <div>
                    <h1 style={styles.title}>Contributor Leaderboard</h1>
                    <p style={styles.subtitle}>Our community of contributors helping test consumer products</p>
                </div>
                <button onClick={fetchData} style={styles.refreshButton}>
                    Refresh
                </button>
            </div>

            {/* Stats Summary */}
            {stats && (
                <div style={styles.statsRow}>
                    <div style={styles.statCard}>
                        <p style={styles.statLabel}>Total Contributors</p>
                        <p style={styles.statValue}>{stats.totalContributors.toLocaleString()}</p>
                    </div>
                    <div style={styles.statCard}>
                        <p style={styles.statLabel}>Cases Opened</p>
                        <p style={{ ...styles.statValue, color: '#3b82f6' }}>
                            {stats.totalDocuments.toLocaleString()}
                        </p>
                    </div>
                    <div style={styles.statCard}>
                        <p style={styles.statLabel}>People Helped</p>
                        <p style={{ ...styles.statValue, color: '#10b981' }}>
                            {stats.totalPeopleHelped.toLocaleString()}
                        </p>
                    </div>
                </div>
            )}

            {/* Level Distribution */}
            {stats && (
                <div style={styles.section}>
                    <h2 style={styles.sectionTitle}>Contributor Level Distribution</h2>
                    <div style={styles.levelGrid}>
                        {Object.entries(stats.levelBreakdown).map(([level, count]) => {
                            const levelStyle = LEVEL_STYLES[level]
                            const percentage = stats.totalContributors > 0
                                ? Math.round((count / stats.totalContributors) * 100)
                                : 0

                            return (
                                <div key={level} style={styles.levelCard}>
                                    <div style={styles.levelHeader}>
                                        <span style={{ fontSize: '24px' }}>{levelStyle.emoji}</span>
                                        <span
                                            style={{
                                                ...styles.levelBadge,
                                                backgroundColor: levelStyle.bg,
                                                color: levelStyle.text,
                                            }}
                                        >
                                            {levelStyle.label}
                                        </span>
                                    </div>
                                    <div style={styles.levelCount}>{count}</div>
                                    <div style={styles.levelPercent}>{percentage}%</div>
                                    <div style={styles.progressBar}>
                                        <div
                                            style={{
                                                ...styles.progressFill,
                                                width: `${percentage}%`,
                                                backgroundColor: levelStyle.text,
                                            }}
                                        />
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* Leaderboard Controls */}
            <div style={styles.controls}>
                <div style={styles.controlGroup}>
                    <label style={styles.controlLabel}>Sort by:</label>
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as SortBy)}
                        style={styles.select}
                    >
                        <option value="documentsSubmitted">Cases Opened</option>
                        <option value="peopleHelped">People Helped</option>
                        <option value="firstCases">First Discoveries</option>
                        <option value="productsTestedFromSubmissions">Products Tested</option>
                    </select>
                </div>
                <div style={styles.controlGroup}>
                    <label style={styles.controlLabel}>Show:</label>
                    <select
                        value={limit}
                        onChange={(e) => setLimit(Number(e.target.value))}
                        style={styles.select}
                    >
                        <option value={10}>Top 10</option>
                        <option value={25}>Top 25</option>
                        <option value={50}>Top 50</option>
                        <option value={100}>Top 100</option>
                    </select>
                </div>
            </div>

            {/* Leaderboard Table */}
            <div style={styles.section}>
                <h2 style={styles.sectionTitle}>
                    Top Contributors by{' '}
                    {sortBy === 'documentsSubmitted'
                        ? 'Cases Opened'
                        : sortBy === 'peopleHelped'
                          ? 'People Helped'
                          : sortBy === 'firstCases'
                            ? 'First Discoveries'
                            : 'Products Tested'}
                </h2>
                <div style={styles.tableContainer}>
                    <table style={styles.table}>
                        <thead>
                            <tr>
                                <th style={{ ...styles.th, width: '60px' }}>Rank</th>
                                <th style={styles.th}>Contributor</th>
                                <th style={{ ...styles.th, width: '100px' }}>Level</th>
                                <th style={{ ...styles.th, textAlign: 'right' }}>Cases</th>
                                <th style={{ ...styles.th, textAlign: 'right' }}>Helped</th>
                                <th style={{ ...styles.th, textAlign: 'right' }}>1st Disc.</th>
                                <th style={{ ...styles.th, textAlign: 'right' }}>Tested</th>
                            </tr>
                        </thead>
                        <tbody>
                            {contributors.length === 0 ? (
                                <tr>
                                    <td colSpan={7} style={{ ...styles.td, textAlign: 'center', color: '#9ca3af' }}>
                                        No contributors found
                                    </td>
                                </tr>
                            ) : (
                                contributors.map((contributor, index) => {
                                    const levelStyle = LEVEL_STYLES[contributor.contributorLevel]
                                    const isTop3 = index < 3

                                    return (
                                        <tr
                                            key={contributor.id}
                                            style={{
                                                ...styles.tr,
                                                backgroundColor: isTop3 ? '#fefce8' : 'transparent',
                                            }}
                                        >
                                            <td style={{ ...styles.td, textAlign: 'center', fontWeight: 700 }}>
                                                {getRankEmoji(index)}
                                            </td>
                                            <td style={styles.td}>
                                                <div style={styles.contributorCell}>
                                                    <span style={styles.avatar}>{contributor.avatar}</span>
                                                    <div>
                                                        <div style={styles.contributorName}>{contributor.displayName}</div>
                                                        <div style={styles.contributorNumber}>
                                                            Contributor #{contributor.contributorNumber}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td style={styles.td}>
                                                <span
                                                    style={{
                                                        ...styles.smallBadge,
                                                        backgroundColor: levelStyle.bg,
                                                        color: levelStyle.text,
                                                    }}
                                                >
                                                    {levelStyle.emoji} {levelStyle.label}
                                                </span>
                                            </td>
                                            <td style={{ ...styles.td, textAlign: 'right', fontWeight: 600 }}>
                                                {contributor.documentsSubmitted}
                                            </td>
                                            <td style={{ ...styles.td, textAlign: 'right' }}>
                                                {contributor.peopleHelped.toLocaleString()}
                                            </td>
                                            <td style={{ ...styles.td, textAlign: 'right' }}>
                                                {contributor.firstCases}
                                            </td>
                                            <td style={{ ...styles.td, textAlign: 'right' }}>
                                                {contributor.productsTestedFromSubmissions}
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* View All Link */}
            <div style={styles.footer}>
                <a href="/admin/collections/contributor-profiles" style={styles.footerLink}>
                    View all contributor profiles {'\u2192'}
                </a>
            </div>
        </div>
    )
}

const styles: Record<string, React.CSSProperties> = {
    container: {
        padding: '24px',
        maxWidth: '1200px',
        margin: '0 auto',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    },
    loading: {
        textAlign: 'center',
        padding: '60px',
        color: '#6b7280',
    },
    error: {
        textAlign: 'center',
        padding: '40px',
        background: '#fef2f2',
        borderRadius: '12px',
        border: '1px solid #fecaca',
    },
    retryButton: {
        marginTop: '16px',
        padding: '10px 20px',
        background: '#3b82f6',
        color: '#fff',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '24px',
    },
    title: {
        margin: 0,
        fontSize: '28px',
        fontWeight: 700,
        color: '#111827',
    },
    subtitle: {
        margin: '4px 0 0',
        fontSize: '14px',
        color: '#6b7280',
    },
    refreshButton: {
        padding: '8px 16px',
        background: '#f3f4f6',
        border: '1px solid #e5e7eb',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '13px',
    },
    statsRow: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: '16px',
        marginBottom: '32px',
    },
    statCard: {
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: '12px',
        padding: '20px',
        textAlign: 'center',
    },
    statLabel: {
        margin: 0,
        fontSize: '13px',
        color: '#6b7280',
    },
    statValue: {
        margin: '8px 0 0',
        fontSize: '32px',
        fontWeight: 700,
        color: '#111827',
    },
    section: {
        marginBottom: '32px',
    },
    sectionTitle: {
        margin: '0 0 16px',
        fontSize: '18px',
        fontWeight: 600,
        color: '#111827',
    },
    levelGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: '12px',
    },
    levelCard: {
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: '10px',
        padding: '16px',
        textAlign: 'center',
    },
    levelHeader: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        marginBottom: '8px',
    },
    levelBadge: {
        fontSize: '11px',
        fontWeight: 600,
        padding: '2px 8px',
        borderRadius: '4px',
    },
    levelCount: {
        fontSize: '28px',
        fontWeight: 700,
        color: '#111827',
    },
    levelPercent: {
        fontSize: '12px',
        color: '#6b7280',
        marginBottom: '8px',
    },
    progressBar: {
        height: '4px',
        background: '#e5e7eb',
        borderRadius: '2px',
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        transition: 'width 0.3s ease',
    },
    controls: {
        display: 'flex',
        gap: '24px',
        marginBottom: '16px',
        flexWrap: 'wrap',
    },
    controlGroup: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
    },
    controlLabel: {
        fontSize: '14px',
        color: '#6b7280',
    },
    select: {
        padding: '8px 12px',
        borderRadius: '6px',
        border: '1px solid #d1d5db',
        fontSize: '14px',
        background: '#fff',
    },
    tableContainer: {
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: '12px',
        overflow: 'hidden',
    },
    table: {
        width: '100%',
        borderCollapse: 'collapse',
    },
    th: {
        textAlign: 'left',
        padding: '12px 16px',
        fontSize: '12px',
        fontWeight: 600,
        color: '#6b7280',
        background: '#f9fafb',
        borderBottom: '1px solid #e5e7eb',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
    },
    tr: {
        borderBottom: '1px solid #f3f4f6',
    },
    td: {
        padding: '12px 16px',
        fontSize: '14px',
        color: '#374151',
    },
    contributorCell: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
    },
    avatar: {
        fontSize: '24px',
        width: '40px',
        height: '40px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f3f4f6',
        borderRadius: '8px',
    },
    contributorName: {
        fontWeight: 600,
        color: '#111827',
    },
    contributorNumber: {
        fontSize: '12px',
        color: '#9ca3af',
    },
    smallBadge: {
        fontSize: '10px',
        fontWeight: 600,
        padding: '3px 8px',
        borderRadius: '4px',
        whiteSpace: 'nowrap',
    },
    footer: {
        textAlign: 'center',
        paddingTop: '16px',
    },
    footerLink: {
        fontSize: '14px',
        color: '#6366f1',
        textDecoration: 'none',
    },
}

export default ContributorLeaderboard
