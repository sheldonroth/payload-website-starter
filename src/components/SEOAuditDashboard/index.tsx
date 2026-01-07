'use client'

import React, { useState, useEffect, useCallback } from 'react'

interface SEOIssue {
    id: number
    collection: string
    title: string
    slug: string
    issues: {
        type: 'error' | 'warning' | 'info'
        field: string
        message: string
    }[]
    score: number
}

interface AuditStats {
    totalPages: number
    totalProducts: number
    totalArticles: number
    issuesByType: {
        error: number
        warning: number
        info: number
    }
    averageScore: number
}

interface SEOCheckResult {
    type: 'error' | 'warning' | 'info'
    field: string
    message: string
}

const SEOAuditDashboard: React.FC = () => {
    const [issues, setIssues] = useState<SEOIssue[]>([])
    const [stats, setStats] = useState<AuditStats | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [filter, setFilter] = useState<'all' | 'error' | 'warning'>('all')

    const checkSEO = (
        doc: {
            meta?: {
                title?: string
                description?: string
                image?: unknown
            }
            title?: string
            name?: string
        },
        collection: string
    ): SEOCheckResult[] => {
        const results: SEOCheckResult[] = []
        const title = doc.meta?.title || doc.title || doc.name || ''
        const description = doc.meta?.description || ''
        const hasImage = !!doc.meta?.image

        // Title checks
        if (!title) {
            results.push({
                type: 'error',
                field: 'title',
                message: 'Missing title',
            })
        } else if (title.length < 30) {
            results.push({
                type: 'warning',
                field: 'title',
                message: `Title too short (${title.length}/50-60 chars)`,
            })
        } else if (title.length > 70) {
            results.push({
                type: 'warning',
                field: 'title',
                message: `Title too long (${title.length}/50-60 chars)`,
            })
        }

        // Description checks
        if (!description) {
            results.push({
                type: 'error',
                field: 'description',
                message: 'Missing meta description',
            })
        } else if (description.length < 100) {
            results.push({
                type: 'warning',
                field: 'description',
                message: `Description too short (${description.length}/150-160 chars)`,
            })
        } else if (description.length > 200) {
            results.push({
                type: 'warning',
                field: 'description',
                message: `Description too long (${description.length}/150-160 chars)`,
            })
        }

        // Image checks
        if (!hasImage) {
            results.push({
                type: 'warning',
                field: 'image',
                message: 'Missing Open Graph image',
            })
        }

        // Collection-specific checks
        if (collection === 'products') {
            // Product-specific: check for barcode, category
            const product = doc as { barcode?: string; category?: unknown }
            if (!product.barcode) {
                results.push({
                    type: 'info',
                    field: 'barcode',
                    message: 'No barcode for Schema.org markup',
                })
            }
            if (!product.category) {
                results.push({
                    type: 'info',
                    field: 'category',
                    message: 'No category assigned',
                })
            }
        }

        return results
    }

    const calculateScore = (issueList: SEOCheckResult[]): number => {
        let score = 100
        for (const issue of issueList) {
            if (issue.type === 'error') score -= 25
            else if (issue.type === 'warning') score -= 10
            else score -= 2
        }
        return Math.max(0, score)
    }

    const fetchData = useCallback(async () => {
        setLoading(true)
        try {
            // Fetch pages, products, and articles in parallel
            const [pagesRes, productsRes, articlesRes] = await Promise.all([
                fetch('/api/pages?limit=50&depth=1'),
                fetch('/api/products?limit=100&depth=1'),
                fetch('/api/articles?limit=50&depth=1'),
            ])

            const [pagesData, productsData, articlesData] = await Promise.all([
                pagesRes.json(),
                productsRes.json(),
                articlesRes.json(),
            ])

            const allIssues: SEOIssue[] = []

            // Check pages
            for (const page of pagesData.docs || []) {
                const issueList = checkSEO(page, 'pages')
                if (issueList.length > 0) {
                    allIssues.push({
                        id: page.id,
                        collection: 'pages',
                        title: page.title || 'Untitled Page',
                        slug: page.slug || '',
                        issues: issueList,
                        score: calculateScore(issueList),
                    })
                }
            }

            // Check products
            for (const product of productsData.docs || []) {
                const issueList = checkSEO(product, 'products')
                if (issueList.length > 0) {
                    allIssues.push({
                        id: product.id,
                        collection: 'products',
                        title: product.name || 'Untitled Product',
                        slug: product.slug || '',
                        issues: issueList,
                        score: calculateScore(issueList),
                    })
                }
            }

            // Check articles
            for (const article of articlesData.docs || []) {
                const issueList = checkSEO(article, 'articles')
                if (issueList.length > 0) {
                    allIssues.push({
                        id: article.id,
                        collection: 'articles',
                        title: article.title || 'Untitled Article',
                        slug: article.slug || '',
                        issues: issueList,
                        score: calculateScore(issueList),
                    })
                }
            }

            // Sort by score (worst first)
            allIssues.sort((a, b) => a.score - b.score)

            // Calculate stats
            let errorCount = 0
            let warningCount = 0
            let infoCount = 0
            let totalScore = 0

            for (const item of allIssues) {
                totalScore += item.score
                for (const issue of item.issues) {
                    if (issue.type === 'error') errorCount++
                    else if (issue.type === 'warning') warningCount++
                    else infoCount++
                }
            }

            setIssues(allIssues)
            setStats({
                totalPages: (pagesData.docs || []).length,
                totalProducts: (productsData.docs || []).length,
                totalArticles: (articlesData.docs || []).length,
                issuesByType: {
                    error: errorCount,
                    warning: warningCount,
                    info: infoCount,
                },
                averageScore: allIssues.length > 0 ? Math.round(totalScore / allIssues.length) : 100,
            })

            setError(null)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch data')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    const filteredIssues = issues.filter((item) => {
        if (filter === 'all') return true
        return item.issues.some((i) => i.type === filter)
    })

    const getScoreColor = (score: number): string => {
        if (score >= 80) return '#10b981'
        if (score >= 60) return '#f59e0b'
        return '#ef4444'
    }

    if (loading) {
        return (
            <div style={styles.container}>
                <div style={styles.loading}>Running SEO audit...</div>
            </div>
        )
    }

    if (error) {
        return (
            <div style={styles.container}>
                <div style={styles.error}>
                    <h3>Audit Failed</h3>
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
                    <h1 style={styles.title}>SEO Audit</h1>
                    <p style={styles.subtitle}>
                        Identify and fix SEO issues across your content
                    </p>
                </div>
                <button onClick={fetchData} style={styles.refreshButton}>
                    Run Audit
                </button>
            </div>

            {/* Stats */}
            {stats && (
                <div style={styles.statsRow}>
                    <div style={styles.statCard}>
                        <p style={styles.statLabel}>Content Audited</p>
                        <p style={styles.statValue}>
                            {stats.totalPages + stats.totalProducts + stats.totalArticles}
                        </p>
                        <p style={styles.statSubtext}>
                            {stats.totalPages} pages, {stats.totalProducts} products, {stats.totalArticles} articles
                        </p>
                    </div>
                    <div style={styles.statCard}>
                        <p style={styles.statLabel}>Average Score</p>
                        <p style={{ ...styles.statValue, color: getScoreColor(stats.averageScore) }}>
                            {stats.averageScore}/100
                        </p>
                    </div>
                    <div style={styles.statCard}>
                        <p style={styles.statLabel}>Errors</p>
                        <p style={{ ...styles.statValue, color: '#ef4444' }}>
                            {stats.issuesByType.error}
                        </p>
                    </div>
                    <div style={styles.statCard}>
                        <p style={styles.statLabel}>Warnings</p>
                        <p style={{ ...styles.statValue, color: '#f59e0b' }}>
                            {stats.issuesByType.warning}
                        </p>
                    </div>
                </div>
            )}

            {/* Filter */}
            <div style={styles.filterRow}>
                <span style={styles.filterLabel}>Show:</span>
                <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value as 'all' | 'error' | 'warning')}
                    style={styles.select}
                >
                    <option value="all">All Issues ({issues.length})</option>
                    <option value="error">
                        Errors Only ({issues.filter((i) => i.issues.some((x) => x.type === 'error')).length})
                    </option>
                    <option value="warning">
                        Warnings Only ({issues.filter((i) => i.issues.some((x) => x.type === 'warning')).length})
                    </option>
                </select>
            </div>

            {/* Issues List */}
            <div style={styles.section}>
                {filteredIssues.length === 0 ? (
                    <div style={styles.emptyState}>
                        <p style={{ fontSize: '24px', marginBottom: '8px' }}>{'\u2705'}</p>
                        <p>No SEO issues found!</p>
                    </div>
                ) : (
                    <div style={styles.issuesList}>
                        {filteredIssues.map((item) => (
                            <div key={`${item.collection}-${item.id}`} style={styles.issueCard}>
                                <div style={styles.issueHeader}>
                                    <div>
                                        <span style={styles.collectionBadge}>{item.collection}</span>
                                        <a
                                            href={`/admin/collections/${item.collection}/${item.id}`}
                                            style={styles.issueTitle}
                                        >
                                            {item.title}
                                        </a>
                                    </div>
                                    <div
                                        style={{
                                            ...styles.scoreCircle,
                                            borderColor: getScoreColor(item.score),
                                            color: getScoreColor(item.score),
                                        }}
                                    >
                                        {item.score}
                                    </div>
                                </div>
                                <div style={styles.issueBody}>
                                    {item.issues.map((issue, idx) => (
                                        <div key={idx} style={styles.issueItem}>
                                            <span
                                                style={{
                                                    ...styles.issueTypeBadge,
                                                    backgroundColor:
                                                        issue.type === 'error'
                                                            ? '#fef2f2'
                                                            : issue.type === 'warning'
                                                              ? '#fffbeb'
                                                              : '#f0f9ff',
                                                    color:
                                                        issue.type === 'error'
                                                            ? '#991b1b'
                                                            : issue.type === 'warning'
                                                              ? '#92400e'
                                                              : '#1e40af',
                                                }}
                                            >
                                                {issue.type}
                                            </span>
                                            <span style={styles.issueField}>{issue.field}:</span>
                                            <span style={styles.issueMessage}>{issue.message}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Tips */}
            <div style={styles.tipsSection}>
                <h3 style={styles.tipsTitle}>SEO Best Practices</h3>
                <ul style={styles.tipsList}>
                    <li>
                        <strong>Title:</strong> 50-60 characters, include primary keyword
                    </li>
                    <li>
                        <strong>Description:</strong> 150-160 characters with call-to-action
                    </li>
                    <li>
                        <strong>OG Image:</strong> 1200x630px for best social sharing
                    </li>
                    <li>
                        <strong>Products:</strong> Include barcode and category for rich snippets
                    </li>
                </ul>
            </div>
        </div>
    )
}

const styles: Record<string, React.CSSProperties> = {
    container: {
        padding: '24px',
        maxWidth: '1100px',
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
        padding: '10px 20px',
        background: '#3b82f6',
        color: '#fff',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: 600,
    },
    statsRow: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: '16px',
        marginBottom: '24px',
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
    statSubtext: {
        margin: '4px 0 0',
        fontSize: '11px',
        color: '#9ca3af',
    },
    filterRow: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '16px',
    },
    filterLabel: {
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
    section: {
        marginBottom: '32px',
    },
    emptyState: {
        textAlign: 'center',
        padding: '60px',
        background: '#f0fdf4',
        borderRadius: '12px',
        color: '#166534',
    },
    issuesList: {
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
    },
    issueCard: {
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: '10px',
        overflow: 'hidden',
    },
    issueHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 16px',
        borderBottom: '1px solid #f3f4f6',
        background: '#fafafa',
    },
    collectionBadge: {
        fontSize: '10px',
        fontWeight: 600,
        padding: '2px 6px',
        borderRadius: '4px',
        background: '#e0e7ff',
        color: '#4338ca',
        textTransform: 'uppercase',
        marginRight: '8px',
    },
    issueTitle: {
        fontSize: '14px',
        fontWeight: 600,
        color: '#111827',
        textDecoration: 'none',
    },
    scoreCircle: {
        width: '40px',
        height: '40px',
        borderRadius: '50%',
        border: '3px solid',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '12px',
        fontWeight: 700,
    },
    issueBody: {
        padding: '12px 16px',
    },
    issueItem: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 0',
    },
    issueTypeBadge: {
        fontSize: '10px',
        fontWeight: 600,
        padding: '2px 6px',
        borderRadius: '4px',
        textTransform: 'uppercase',
    },
    issueField: {
        fontSize: '13px',
        fontWeight: 600,
        color: '#374151',
    },
    issueMessage: {
        fontSize: '13px',
        color: '#6b7280',
    },
    tipsSection: {
        background: '#f9fafb',
        borderRadius: '12px',
        padding: '20px',
    },
    tipsTitle: {
        margin: '0 0 12px',
        fontSize: '16px',
        fontWeight: 600,
        color: '#111827',
    },
    tipsList: {
        margin: 0,
        paddingLeft: '20px',
        fontSize: '14px',
        color: '#6b7280',
        lineHeight: 1.8,
    },
}

export default SEOAuditDashboard
