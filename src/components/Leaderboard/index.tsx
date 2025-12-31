'use client'

import React, { useState, useEffect } from 'react'

interface LeaderboardEntry {
    name: string
    points: number
    submissions: number
    email: string
}

interface LeaderboardData {
    success: boolean
    leaderboard: LeaderboardEntry[]
    totalContributors: number
    totalSubmissions: number
}

const Leaderboard: React.FC = () => {
    const [data, setData] = useState<LeaderboardData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        fetch('/api/crowdsource/leaderboard')
            .then((res) => res.json())
            .then((result) => {
                setData(result)
                setLoading(false)
            })
            .catch(() => {
                setError('Failed to load leaderboard')
                setLoading(false)
            })
    }, [])

    if (loading) {
        return (
            <div style={{ padding: '20px', textAlign: 'center' }}>
                <div style={{ fontSize: '24px' }}>Loading...</div>
            </div>
        )
    }

    if (error || !data?.success) {
        return (
            <div style={{ padding: '20px', textAlign: 'center', color: '#ef4444' }}>
                {error || 'Failed to load leaderboard'}
            </div>
        )
    }

    const medals = ['gold', 'silver', 'bronze']
    const medalColors = { gold: '#FFD700', silver: '#C0C0C0', bronze: '#CD7F32' }

    return (
        <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>
                    Community Leaderboard
                </h3>
                <div style={{ display: 'flex', gap: '16px', fontSize: '14px', color: '#6b7280' }}>
                    <span>{data.totalContributors} contributors</span>
                    <span>{data.totalSubmissions} submissions</span>
                </div>
            </div>

            {data.leaderboard.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>&#x1F3C6;</div>
                    <p style={{ margin: 0 }}>No verified submissions yet. Be the first!</p>
                </div>
            ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                            <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 600 }}>Rank</th>
                            <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 600 }}>Contributor</th>
                            <th style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 600 }}>Submissions</th>
                            <th style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 600 }}>Points</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.leaderboard.slice(0, 10).map((entry, index) => (
                            <tr key={index} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                <td style={{ padding: '12px 8px' }}>
                                    {index < 3 ? (
                                        <span style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            width: '28px',
                                            height: '28px',
                                            borderRadius: '50%',
                                            background: medalColors[medals[index] as keyof typeof medalColors],
                                            color: index === 0 ? '#000' : '#fff',
                                            fontWeight: 700,
                                            fontSize: '14px',
                                        }}>
                                            {index + 1}
                                        </span>
                                    ) : (
                                        <span style={{ paddingLeft: '8px', fontWeight: 500 }}>{index + 1}</span>
                                    )}
                                </td>
                                <td style={{ padding: '12px 8px' }}>
                                    <div style={{ fontWeight: 500 }}>{entry.name}</div>
                                    <div style={{ fontSize: '12px', color: '#9ca3af' }}>{entry.email}</div>
                                </td>
                                <td style={{ padding: '12px 8px', textAlign: 'right', color: '#6b7280' }}>
                                    {entry.submissions}
                                </td>
                                <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                                    <span style={{
                                        fontWeight: 700,
                                        color: '#10b981',
                                        fontSize: '16px',
                                    }}>
                                        {entry.points}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    )
}

export default Leaderboard
