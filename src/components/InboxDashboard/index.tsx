'use client'

import React, { useEffect, useState } from 'react'

interface InboxCounts {
    aiDrafts: number
    pendingVideos: number
    draftProducts: number
}

interface RecentProduct {
    id: number
    name: string
    brand?: string
    verdict?: 'recommend' | 'avoid'
    status: string
    imageUrl?: string
    completeness?: number
}

const InboxDashboard: React.FC = () => {
    const [counts, setCounts] = useState<InboxCounts>({ aiDrafts: 0, pendingVideos: 0, draftProducts: 0 })
    const [recentProducts, setRecentProducts] = useState<RecentProduct[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch AI drafts count
                const aiRes = await fetch('/api/products?where[status][equals]=ai_draft&limit=0')
                const aiData = await aiRes.json()

                // Fetch draft products count
                const draftRes = await fetch('/api/products?where[status][equals]=draft&limit=0')
                const draftData = await draftRes.json()

                // Fetch pending videos count
                const videoRes = await fetch('/api/videos?where[status][equals]=pending&limit=0')
                const videoData = await videoRes.json()

                // Fetch recent products (exclude ai_draft)
                const recentRes = await fetch('/api/products?limit=6&sort=-updatedAt&depth=0&where[status][not_equals]=ai_draft')
                const recentData = await recentRes.json()

                setCounts({
                    aiDrafts: aiData.totalDocs || 0,
                    pendingVideos: videoData.totalDocs || 0,
                    draftProducts: draftData.totalDocs || 0,
                })
                setRecentProducts(recentData.docs || [])
            } catch (error) {
                console.error('Failed to fetch inbox data:', error)
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [])

    const getVerdictBadge = (verdict?: string) => {
        switch (verdict) {
            case 'recommend':
                return { bg: '#dcfce7', color: '#16a34a', icon: '✓', label: 'RECOMMEND' }
            case 'avoid':
                return { bg: '#fee2e2', color: '#dc2626', icon: '✕', label: 'AVOID' }
            default:
                return { bg: '#fef3c7', color: '#d97706', icon: '?', label: 'PENDING' }
        }
    }

    if (loading) {
        return <div style={{ padding: '24px', color: '#6b7280' }}>Loading inbox...</div>
    }

    return (
        <div style={{ padding: '0 24px' }}>
            {/* Inbox Header */}
            <div style={{ marginBottom: '24px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#1f2937', marginBottom: '4px' }}>
                    📥 Today's Inbox
                </h2>
                <p style={{ color: '#6b7280', fontSize: '14px' }}>
                    Items needing your attention
                </p>
            </div>

            {/* Task Widgets */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '32px' }}>
                {/* AI Drafts */}
                <a
                    href="/admin/ai-suggestions"
                    style={{
                        display: 'block',
                        padding: '20px',
                        background: counts.aiDrafts > 0 ? 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)' : '#f9fafb',
                        borderRadius: '12px',
                        textDecoration: 'none',
                        border: '1px solid #e5e7eb',
                        transition: 'transform 0.1s',
                    }}
                >
                    <div style={{ fontSize: '32px', fontWeight: 700, color: counts.aiDrafts > 0 ? '#d97706' : '#9ca3af' }}>
                        {counts.aiDrafts}
                    </div>
                    <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>
                        🤖 AI Drafts
                    </div>
                    <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '8px' }}>
                        need review
                    </div>
                </a>

                {/* Draft Products */}
                <a
                    href="/admin/collections/products?where[status][equals]=draft"
                    style={{
                        display: 'block',
                        padding: '20px',
                        background: counts.draftProducts > 0 ? 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)' : '#f9fafb',
                        borderRadius: '12px',
                        textDecoration: 'none',
                        border: '1px solid #e5e7eb',
                    }}
                >
                    <div style={{ fontSize: '32px', fontWeight: 700, color: counts.draftProducts > 0 ? '#3b82f6' : '#9ca3af' }}>
                        {counts.draftProducts}
                    </div>
                    <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>
                        📝 Drafts
                    </div>
                    <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '8px' }}>
                        ready to publish
                    </div>
                </a>

                {/* Pending Videos */}
                <a
                    href="/admin/collections/videos?where[status][equals]=pending"
                    style={{
                        display: 'block',
                        padding: '20px',
                        background: counts.pendingVideos > 0 ? 'linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)' : '#f9fafb',
                        borderRadius: '12px',
                        textDecoration: 'none',
                        border: '1px solid #e5e7eb',
                    }}
                >
                    <div style={{ fontSize: '32px', fontWeight: 700, color: counts.pendingVideos > 0 ? '#8b5cf6' : '#9ca3af' }}>
                        {counts.pendingVideos}
                    </div>
                    <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>
                        📹 Videos
                    </div>
                    <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '8px' }}>
                        to analyze
                    </div>
                </a>
            </div>

            {/* Recent Products */}
            <div style={{ marginBottom: '32px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#1f2937' }}>
                        📦 Recent Products
                    </h3>
                    <a
                        href="/admin/collections/products"
                        style={{ fontSize: '13px', color: '#3b82f6', textDecoration: 'none' }}
                    >
                        View All →
                    </a>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
                    {recentProducts.map((product) => {
                        const badge = getVerdictBadge(product.verdict)
                        return (
                            <a
                                key={product.id}
                                href={`/admin/collections/products/${product.id}`}
                                style={{
                                    display: 'block',
                                    padding: '16px',
                                    background: '#fff',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '10px',
                                    textDecoration: 'none',
                                }}
                            >
                                {/* Product Image */}
                                <div
                                    style={{
                                        width: '100%',
                                        height: '80px',
                                        background: '#f3f4f6',
                                        borderRadius: '6px',
                                        marginBottom: '12px',
                                        overflow: 'hidden',
                                    }}
                                >
                                    {product.imageUrl && (
                                        <img
                                            src={product.imageUrl}
                                            alt={product.name}
                                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                        />
                                    )}
                                </div>

                                {/* Product Name */}
                                <div
                                    style={{
                                        fontSize: '14px',
                                        fontWeight: 600,
                                        color: '#1f2937',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                        marginBottom: '4px',
                                    }}
                                >
                                    {product.name}
                                </div>

                                {/* Brand */}
                                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>
                                    {product.brand || 'No brand'}
                                </div>

                                {/* Verdict Badge */}
                                <div
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        padding: '4px 8px',
                                        background: badge.bg,
                                        color: badge.color,
                                        borderRadius: '4px',
                                        fontSize: '11px',
                                        fontWeight: 600,
                                    }}
                                >
                                    {badge.icon} {badge.label}
                                </div>
                            </a>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}

export default InboxDashboard
