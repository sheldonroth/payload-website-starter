'use client'

import React, { useState } from 'react'

interface UserExport {
    email: string
    name: string | null
    subscriptionStatus: string
    createdAt: string
    marketingOptIn?: boolean
}

const NewsletterExport: React.FC = () => {
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState('')
    const [stats, setStats] = useState<{ total: number; premium: number; free: number } | null>(null)

    const fetchAndExportUsers = async (filter: 'all' | 'premium' | 'free' | 'marketing') => {
        setLoading(true)
        setMessage('Fetching users...')

        try {
            // Build query based on filter
            let query = '/api/users?limit=1000&depth=0'
            if (filter === 'premium') {
                query += '&where[subscriptionStatus][equals]=premium'
            } else if (filter === 'free') {
                query += '&where[subscriptionStatus][equals]=free'
            } else if (filter === 'marketing') {
                query += '&where[marketingOptIn][equals]=true'
            }

            const res = await fetch(query)
            if (!res.ok) {
                throw new Error('Failed to fetch users')
            }

            const data = await res.json()
            const users: UserExport[] = (data.docs || []).map((u: any) => ({
                email: u.email,
                name: u.name || '',
                subscriptionStatus: u.subscriptionStatus || 'free',
                createdAt: u.createdAt ? new Date(u.createdAt).toISOString().split('T')[0] : '',
                marketingOptIn: u.marketingOptIn,
            }))

            // Update stats
            const premium = users.filter(u => u.subscriptionStatus === 'premium').length
            const free = users.filter(u => u.subscriptionStatus === 'free').length
            setStats({ total: users.length, premium, free })

            // Create CSV
            const headers = ['email', 'name', 'subscription_status', 'signup_date']
            const csvRows = [
                headers.join(','),
                ...users.map(u => [
                    `"${u.email}"`,
                    `"${u.name}"`,
                    u.subscriptionStatus,
                    u.createdAt,
                ].join(','))
            ]
            const csv = csvRows.join('\n')

            // Download
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
            const url = URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.setAttribute('href', url)
            link.setAttribute('download', `newsletter_${filter}_${new Date().toISOString().split('T')[0]}.csv`)
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)

            setMessage(`✅ Exported ${users.length} users`)
        } catch (error) {
            setMessage(`❌ Error: ${error instanceof Error ? error.message : 'Export failed'}`)
        } finally {
            setLoading(false)
        }
    }

    const refreshStats = async () => {
        try {
            const res = await fetch('/api/users?limit=1&depth=0')
            if (res.ok) {
                const data = await res.json()
                // Fetch counts
                const [premiumRes, freeRes] = await Promise.all([
                    fetch('/api/users?limit=1&where[subscriptionStatus][equals]=premium'),
                    fetch('/api/users?limit=1&where[subscriptionStatus][equals]=free'),
                ])
                const premiumData = premiumRes.ok ? await premiumRes.json() : { totalDocs: 0 }
                const freeData = freeRes.ok ? await freeRes.json() : { totalDocs: 0 }
                setStats({
                    total: data.totalDocs || 0,
                    premium: premiumData.totalDocs || 0,
                    free: freeData.totalDocs || 0,
                })
            }
        } catch {
            // Silent fail
        }
    }

    // Load stats on mount
    React.useEffect(() => {
        refreshStats()
    }, [])

    return (
        <div style={{
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: '12px',
            padding: '16px',
        }}>
            <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '12px', color: '#1f2937' }}>
                📧 Newsletter Export
            </h3>

            {/* Stats */}
            {stats && (
                <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
                    <div style={{
                        background: '#f3f4f6',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        fontSize: '13px',
                    }}>
                        <span style={{ color: '#6b7280' }}>Total: </span>
                        <span style={{ fontWeight: 600 }}>{stats.total}</span>
                    </div>
                    <div style={{
                        background: '#dcfce7',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        fontSize: '13px',
                    }}>
                        <span style={{ color: '#166534' }}>Premium: </span>
                        <span style={{ fontWeight: 600 }}>{stats.premium}</span>
                    </div>
                    <div style={{
                        background: '#f0f9ff',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        fontSize: '13px',
                    }}>
                        <span style={{ color: '#0369a1' }}>Free: </span>
                        <span style={{ fontWeight: 600 }}>{stats.free}</span>
                    </div>
                </div>
            )}

            {/* Export Buttons */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                    onClick={() => fetchAndExportUsers('all')}
                    disabled={loading}
                    style={{
                        padding: '8px 14px',
                        background: '#1f2937',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: loading ? 'not-allowed' : 'pointer',
                        opacity: loading ? 0.5 : 1,
                    }}
                >
                    📥 Export All
                </button>
                <button
                    onClick={() => fetchAndExportUsers('premium')}
                    disabled={loading}
                    style={{
                        padding: '8px 14px',
                        background: '#059669',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: loading ? 'not-allowed' : 'pointer',
                        opacity: loading ? 0.5 : 1,
                    }}
                >
                    💎 Premium Only
                </button>
                <button
                    onClick={() => fetchAndExportUsers('free')}
                    disabled={loading}
                    style={{
                        padding: '8px 14px',
                        background: '#0ea5e9',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: loading ? 'not-allowed' : 'pointer',
                        opacity: loading ? 0.5 : 1,
                    }}
                >
                    🆓 Free Only
                </button>
            </div>

            {/* Message */}
            {message && (
                <div style={{
                    marginTop: '12px',
                    padding: '8px 12px',
                    background: '#f9fafb',
                    borderRadius: '6px',
                    fontSize: '13px',
                    color: '#374151',
                }}>
                    {message}
                </div>
            )}

            <p style={{
                fontSize: '11px',
                color: '#9ca3af',
                marginTop: '12px',
                marginBottom: 0,
            }}>
                CSV export includes: email, name, subscription status, signup date
            </p>
        </div>
    )
}

export default NewsletterExport
