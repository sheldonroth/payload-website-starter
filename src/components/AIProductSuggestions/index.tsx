'use client'

import React, { useEffect, useState, useCallback } from 'react'

interface AIProduct {
    id: number
    name: string
    brand: string
    summary: string
    category?: { name: string } | string
    imageUrl?: string
    status: string
    createdAt: string
}

const AIProductSuggestions: React.FC = () => {
    const [products, setProducts] = useState<AIProduct[]>([])
    const [loading, setLoading] = useState(true)
    const [processing, setProcessing] = useState<number | null>(null)
    const [page, setPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [totalDocs, setTotalDocs] = useState(0)
    const limit = 20

    const fetchProducts = useCallback(async () => {
        setLoading(true)
        try {
            const response = await fetch(
                `/api/products?where[status][equals]=ai_draft&limit=${limit}&page=${page}&sort=-createdAt&depth=1`
            )
            const data = await response.json()
            setProducts(data.docs || [])
            setTotalPages(data.totalPages || 1)
            setTotalDocs(data.totalDocs || 0)
        } catch (error) {
            console.error('Failed to fetch AI suggestions:', error)
        } finally {
            setLoading(false)
        }
    }, [page])

    useEffect(() => {
        fetchProducts()
    }, [fetchProducts])

    const handleApprove = async (id: number) => {
        setProcessing(id)
        try {
            await fetch(`/api/products/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'draft' }),
            })
            await fetchProducts()
        } catch (error) {
            console.error('Failed to approve:', error)
        } finally {
            setProcessing(null)
        }
    }

    const handleReject = async (id: number) => {
        if (!confirm('Delete this AI suggestion?')) return
        setProcessing(id)
        try {
            await fetch(`/api/products/${id}`, { method: 'DELETE' })
            await fetchProducts()
        } catch (error) {
            console.error('Failed to reject:', error)
        } finally {
            setProcessing(null)
        }
    }

    const handleApproveAll = async () => {
        if (!confirm(`Approve all ${totalDocs} AI suggestions? This will move them to Draft status.`)) return
        setLoading(true)
        try {
            // Approve all in batches
            for (const product of products) {
                await fetch(`/api/products/${product.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: 'draft' }),
                })
            }
            await fetchProducts()
        } catch (error) {
            console.error('Failed to approve all:', error)
        } finally {
            setLoading(false)
        }
    }

    const getCategoryName = (cat: AIProduct['category']) => {
        if (!cat) return 'Uncategorized'
        if (typeof cat === 'string') return cat
        return cat.name || 'Unknown'
    }

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
        })
    }

    return (
        <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ marginBottom: '24px' }}>
                <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: '#1f2937' }}>
                    🤖 AI Product Suggestions
                </h1>
                <p style={{ margin: '8px 0 0', color: '#6b7280' }}>
                    Review and approve AI-generated product drafts from video analysis
                </p>
            </div>

            {/* Stats & Actions Bar */}
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '16px',
                    padding: '16px',
                    background: '#f9fafb',
                    borderRadius: '8px',
                }}
            >
                <div>
                    <span style={{ fontSize: '14px', color: '#6b7280' }}>
                        Showing {products.length} of <strong>{totalDocs}</strong> suggestions
                    </span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    {products.length > 0 && (
                        <button
                            onClick={handleApproveAll}
                            disabled={loading}
                            style={{
                                padding: '8px 16px',
                                background: '#10b981',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '6px',
                                fontSize: '13px',
                                fontWeight: 600,
                                cursor: 'pointer',
                            }}
                        >
                            ✅ Approve All on Page
                        </button>
                    )}
                    <a
                        href="/admin/collections/products?where[status][equals]=ai_draft"
                        style={{
                            padding: '8px 16px',
                            background: '#e5e7eb',
                            color: '#374151',
                            textDecoration: 'none',
                            borderRadius: '6px',
                            fontSize: '13px',
                            fontWeight: 500,
                        }}
                    >
                        View in Products →
                    </a>
                </div>
            </div>

            {/* Products Grid */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: '48px', color: '#6b7280' }}>Loading...</div>
            ) : products.length === 0 ? (
                <div
                    style={{
                        textAlign: 'center',
                        padding: '64px',
                        background: '#f9fafb',
                        borderRadius: '12px',
                    }}
                >
                    <span style={{ fontSize: '48px', display: 'block', marginBottom: '16px' }}>🎉</span>
                    <p style={{ fontSize: '18px', fontWeight: 600, color: '#1f2937' }}>All caught up!</p>
                    <p style={{ color: '#6b7280' }}>No AI suggestions waiting for review.</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gap: '12px' }}>
                    {products.map((product) => (
                        <div
                            key={product.id}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '16px',
                                padding: '16px',
                                background: '#fff',
                                border: '1px solid #e5e7eb',
                                borderRadius: '8px',
                            }}
                        >
                            {/* Image */}
                            <div
                                style={{
                                    width: '64px',
                                    height: '64px',
                                    borderRadius: '8px',
                                    background: '#f3f4f6',
                                    overflow: 'hidden',
                                    flexShrink: 0,
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

                            {/* Info */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <h3
                                        style={{
                                            margin: 0,
                                            fontSize: '15px',
                                            fontWeight: 600,
                                            color: '#1f2937',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                        }}
                                    >
                                        {product.name}
                                    </h3>
                                    <span
                                        style={{
                                            padding: '2px 8px',
                                            background: '#dbeafe',
                                            color: '#1d4ed8',
                                            fontSize: '10px',
                                            fontWeight: 600,
                                            borderRadius: '4px',
                                        }}
                                    >
                                        {getCategoryName(product.category)}
                                    </span>
                                </div>
                                <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#6b7280' }}>
                                    {product.brand}
                                </p>
                                <p
                                    style={{
                                        margin: '4px 0 0',
                                        fontSize: '12px',
                                        color: '#9ca3af',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                    }}
                                >
                                    {product.summary || 'No summary'}
                                </p>
                            </div>

                            {/* Date */}
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                <p style={{ margin: 0, fontSize: '11px', color: '#9ca3af' }}>
                                    {formatDate(product.createdAt)}
                                </p>
                            </div>

                            {/* Actions */}
                            <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                                <a
                                    href={`/admin/collections/products/${product.id}`}
                                    style={{
                                        padding: '8px 12px',
                                        background: '#f3f4f6',
                                        color: '#374151',
                                        textDecoration: 'none',
                                        borderRadius: '6px',
                                        fontSize: '12px',
                                        fontWeight: 500,
                                    }}
                                >
                                    Edit
                                </a>
                                <button
                                    onClick={() => handleApprove(product.id)}
                                    disabled={processing === product.id}
                                    style={{
                                        padding: '8px 12px',
                                        background: '#10b981',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: '6px',
                                        fontSize: '12px',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        opacity: processing === product.id ? 0.5 : 1,
                                    }}
                                >
                                    Approve
                                </button>
                                <button
                                    onClick={() => handleReject(product.id)}
                                    disabled={processing === product.id}
                                    style={{
                                        padding: '8px 12px',
                                        background: '#fee2e2',
                                        color: '#dc2626',
                                        border: 'none',
                                        borderRadius: '6px',
                                        fontSize: '12px',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        opacity: processing === product.id ? 0.5 : 1,
                                    }}
                                >
                                    Reject
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'center',
                        gap: '8px',
                        marginTop: '24px',
                    }}
                >
                    <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                        style={{
                            padding: '8px 16px',
                            background: page === 1 ? '#f3f4f6' : '#e5e7eb',
                            color: page === 1 ? '#9ca3af' : '#374151',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: page === 1 ? 'not-allowed' : 'pointer',
                        }}
                    >
                        ← Previous
                    </button>
                    <span style={{ padding: '8px 16px', color: '#6b7280' }}>
                        Page {page} of {totalPages}
                    </span>
                    <button
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        style={{
                            padding: '8px 16px',
                            background: page === totalPages ? '#f3f4f6' : '#e5e7eb',
                            color: page === totalPages ? '#9ca3af' : '#374151',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: page === totalPages ? 'not-allowed' : 'pointer',
                        }}
                    >
                        Next →
                    </button>
                </div>
            )}
        </div>
    )
}

export default AIProductSuggestions
