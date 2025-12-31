'use client'

import React, { useEffect, useState } from 'react'

interface Stats {
    products: {
        total: number
        published: number
        draft: number
        aiDraft: number
        byCategory: { name: string; count: number }[]
        byVerdict: { verdict: string; count: number }[]
        freshness: { status: string; count: number }[]
    }
    categories: {
        total: number
        withProducts: number
        empty: number
    }
    ingredients: {
        total: number
        byVerdict: { verdict: string; count: number }[]
    }
    videos: {
        total: number
        analyzed: number
        pending: number
    }
    recentActivity: {
        productsThisWeek: number
        productsThisMonth: number
        aiApprovalRate: number
    }
}

const AnalyticsDashboard: React.FC = () => {
    const [stats, setStats] = useState<Stats | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchStats = async () => {
            try {
                // Fetch all data in parallel
                const [products, categories, ingredients, videos] = await Promise.all([
                    fetch('/api/products?limit=0').then(r => r.json()),
                    fetch('/api/categories?limit=0').then(r => r.json()),
                    fetch('/api/ingredients?limit=0').then(r => r.json()),
                    fetch('/api/videos?limit=0').then(r => r.json()),
                ])

                // Fetch product details for breakdown
                const productDetails = await fetch('/api/products?limit=500&depth=1').then(r => r.json())

                // Calculate stats
                const productDocs = productDetails.docs || []

                // Products by status
                const statusCounts = productDocs.reduce((acc: Record<string, number>, p: any) => {
                    acc[p.status || 'unknown'] = (acc[p.status || 'unknown'] || 0) + 1
                    return acc
                }, {})

                // Products by category
                const categoryCounts: Record<string, number> = {}
                for (const p of productDocs) {
                    const catName = p.category?.name || 'Uncategorized'
                    categoryCounts[catName] = (categoryCounts[catName] || 0) + 1
                }
                const byCategory = Object.entries(categoryCounts)
                    .map(([name, count]) => ({ name, count }))
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 10)

                // Products by verdict
                const verdictCounts = productDocs.reduce((acc: Record<string, number>, p: any) => {
                    const v = p.verdictOverride || p.verdict || 'unknown'
                    acc[v] = (acc[v] || 0) + 1
                    return acc
                }, {})

                // Freshness stats
                const freshnessCounts = productDocs.reduce((acc: Record<string, number>, p: any) => {
                    const f = p.freshnessStatus || 'unknown'
                    acc[f] = (acc[f] || 0) + 1
                    return acc
                }, {})

                // Recent activity
                const now = new Date()
                const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
                const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

                const productsThisWeek = productDocs.filter((p: any) =>
                    new Date(p.createdAt) > weekAgo
                ).length

                const productsThisMonth = productDocs.filter((p: any) =>
                    new Date(p.createdAt) > monthAgo
                ).length

                // AI approval rate (non ai_draft / total that were ai_draft)
                // Approximation based on audit logs would be more accurate
                const totalNonAi = productDocs.filter((p: any) => p.status !== 'ai_draft').length
                const aiApprovalRate = products.totalDocs > 0
                    ? Math.round((totalNonAi / products.totalDocs) * 100)
                    : 0

                // Categories with products
                const categoriesWithProducts = (categories.docs || []).filter((c: any) =>
                    (c.productCount || 0) > 0
                ).length

                // Ingredient verdicts
                const ingredientVerdicts = (ingredients.docs || []).reduce((acc: Record<string, number>, i: any) => {
                    acc[i.verdict || 'unknown'] = (acc[i.verdict || 'unknown'] || 0) + 1
                    return acc
                }, {})

                // Videos
                const videoDocs = videos.docs || []
                const analyzedVideos = videoDocs.filter((v: any) => v.analyzedAt).length

                setStats({
                    products: {
                        total: products.totalDocs || 0,
                        published: statusCounts['published'] || 0,
                        draft: statusCounts['draft'] || 0,
                        aiDraft: statusCounts['ai_draft'] || 0,
                        byCategory,
                        byVerdict: Object.entries(verdictCounts).map(([verdict, count]) => ({ verdict, count: count as number })),
                        freshness: Object.entries(freshnessCounts).map(([status, count]) => ({ status, count: count as number })),
                    },
                    categories: {
                        total: categories.totalDocs || 0,
                        withProducts: categoriesWithProducts,
                        empty: (categories.totalDocs || 0) - categoriesWithProducts,
                    },
                    ingredients: {
                        total: ingredients.totalDocs || 0,
                        byVerdict: Object.entries(ingredientVerdicts).map(([verdict, count]) => ({ verdict, count: count as number })),
                    },
                    videos: {
                        total: videos.totalDocs || 0,
                        analyzed: analyzedVideos,
                        pending: (videos.totalDocs || 0) - analyzedVideos,
                    },
                    recentActivity: {
                        productsThisWeek,
                        productsThisMonth,
                        aiApprovalRate,
                    },
                })
            } catch (error) {
                console.error('Failed to fetch analytics:', error)
            } finally {
                setLoading(false)
            }
        }

        fetchStats()
    }, [])

    if (loading) {
        return (
            <div style={{ padding: '24px', textAlign: 'center', color: '#6b7280' }}>
                Loading analytics...
            </div>
        )
    }

    if (!stats) {
        return (
            <div style={{ padding: '24px', textAlign: 'center', color: '#ef4444' }}>
                Failed to load analytics
            </div>
        )
    }

    const StatCard = ({ title, value, subtitle, color = '#3b82f6' }: { title: string; value: number | string; subtitle?: string; color?: string }) => (
        <div style={{
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: '12px',
            padding: '20px',
            flex: 1,
            minWidth: '150px',
        }}>
            <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>{title}</p>
            <p style={{ margin: '8px 0 0', fontSize: '32px', fontWeight: 700, color }}>{value}</p>
            {subtitle && <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#9ca3af' }}>{subtitle}</p>}
        </div>
    )

    const BarChart = ({ data, title }: { data: { label: string; value: number; color?: string }[]; title: string }) => {
        const maxValue = Math.max(...data.map(d => d.value), 1)
        return (
            <div style={{ marginTop: '16px' }}>
                <h4 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 600, color: '#1f2937' }}>{title}</h4>
                {data.map((item, i) => (
                    <div key={i} style={{ marginBottom: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '2px' }}>
                            <span style={{ color: '#374151' }}>{item.label}</span>
                            <span style={{ color: '#6b7280' }}>{item.value}</span>
                        </div>
                        <div style={{ background: '#e5e7eb', borderRadius: '4px', height: '8px', overflow: 'hidden' }}>
                            <div style={{
                                width: `${(item.value / maxValue) * 100}%`,
                                height: '100%',
                                background: item.color || '#3b82f6',
                                borderRadius: '4px',
                            }} />
                        </div>
                    </div>
                ))}
            </div>
        )
    }

    return (
        <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
            <h1 style={{ margin: '0 0 24px', fontSize: '24px', fontWeight: 700, color: '#1f2937' }}>
                Analytics Dashboard
            </h1>

            {/* Overview Cards */}
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '24px' }}>
                <StatCard title="Total Products" value={stats.products.total} />
                <StatCard title="Published" value={stats.products.published} color="#22c55e" />
                <StatCard title="Pending Review" value={stats.products.aiDraft} color="#f59e0b" />
                <StatCard title="Categories" value={stats.categories.total} color="#8b5cf6" />
                <StatCard title="Ingredients" value={stats.ingredients.total} color="#ec4899" />
            </div>

            {/* Activity Cards */}
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '24px' }}>
                <StatCard title="Products This Week" value={stats.recentActivity.productsThisWeek} subtitle="New additions" />
                <StatCard title="Products This Month" value={stats.recentActivity.productsThisMonth} subtitle="30-day total" />
                <StatCard title="Videos Analyzed" value={stats.videos.analyzed} subtitle={`of ${stats.videos.total} total`} />
            </div>

            {/* Charts */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
                {/* Products by Category */}
                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '20px' }}>
                    <BarChart
                        title="Top Categories"
                        data={stats.products.byCategory.map(c => ({
                            label: c.name,
                            value: c.count,
                            color: '#3b82f6',
                        }))}
                    />
                </div>

                {/* Products by Verdict */}
                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '20px' }}>
                    <BarChart
                        title="Product Verdicts"
                        data={stats.products.byVerdict.map(v => ({
                            label: v.verdict.charAt(0).toUpperCase() + v.verdict.slice(1),
                            value: v.count,
                            color: v.verdict === 'recommend' ? '#22c55e' :
                                   v.verdict === 'caution' ? '#f59e0b' :
                                   v.verdict === 'avoid' ? '#ef4444' : '#6b7280',
                        }))}
                    />
                </div>

                {/* Freshness Status */}
                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '20px' }}>
                    <BarChart
                        title="Product Freshness"
                        data={stats.products.freshness.map(f => ({
                            label: f.status === 'fresh' ? 'Fresh' :
                                   f.status === 'needs_review' ? 'Needs Review' :
                                   f.status === 'stale' ? 'Stale' : 'Unknown',
                            value: f.count,
                            color: f.status === 'fresh' ? '#22c55e' :
                                   f.status === 'needs_review' ? '#f59e0b' :
                                   f.status === 'stale' ? '#ef4444' : '#6b7280',
                        }))}
                    />
                </div>

                {/* Ingredients by Verdict */}
                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '20px' }}>
                    <BarChart
                        title="Ingredient Verdicts"
                        data={stats.ingredients.byVerdict.map(v => ({
                            label: v.verdict.charAt(0).toUpperCase() + v.verdict.slice(1),
                            value: v.count,
                            color: v.verdict === 'recommend' ? '#22c55e' :
                                   v.verdict === 'caution' ? '#f59e0b' :
                                   v.verdict === 'avoid' ? '#ef4444' : '#6b7280',
                        }))}
                    />
                </div>
            </div>
        </div>
    )
}

export default AnalyticsDashboard
