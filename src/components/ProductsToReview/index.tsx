'use client'

import React, { useEffect, useState } from 'react'

interface DraftProduct {
    id: number
    name: string
    brand: string
    status: string
    createdAt: string
}

const ProductsToReview: React.FC = () => {
    const [products, setProducts] = useState<DraftProduct[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchDrafts = async () => {
            try {
                // Fetch both ai_draft AND draft products
                const response = await fetch('/api/products?where[or][0][status][equals]=ai_draft&where[or][1][status][equals]=draft&limit=10&sort=-createdAt')
                const data = await response.json()
                setProducts(data.docs || [])
            } catch (error) {
                console.error('Failed to fetch drafts:', error)
            } finally {
                setLoading(false)
            }
        }

        fetchDrafts()
    }, [])

    const formatDate = (dateString: string) => {
        const date = new Date(dateString)
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }

    const getStatusBadge = (status: string) => {
        if (status === 'ai_draft') {
            return {
                label: '🤖 AI Draft',
                background: '#dbeafe',
                color: '#1d4ed8',
            }
        }
        return {
            label: '📝 Draft',
            background: '#fef3c7',
            color: '#92400e',
        }
    }

    return (
        <div
            style={{
                background: '#fff',
                borderRadius: '8px',
                border: '1px solid #e5e5e5',
                padding: '24px',
                marginBottom: '24px',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '24px' }}>📋</span>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Products to Review</h3>
                        <p style={{ margin: 0, fontSize: '14px', color: '#6e6e73' }}>
                            AI drafts and manual drafts waiting for publishing
                        </p>
                    </div>
                </div>
                <a
                    href="/admin/collections/products?where[or][0][status][equals]=ai_draft&where[or][1][status][equals]=draft"
                    style={{
                        fontSize: '13px',
                        color: '#5c5ce0',
                        textDecoration: 'none',
                    }}
                >
                    View All →
                </a>
            </div>

            {loading ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#86868b' }}>
                    Loading...
                </div>
            ) : products.length === 0 ? (
                <div
                    style={{
                        padding: '24px',
                        textAlign: 'center',
                        background: '#f9fafb',
                        borderRadius: '6px',
                        color: '#6b7280',
                    }}
                >
                    <span style={{ fontSize: '32px', display: 'block', marginBottom: '8px' }}>✅</span>
                    <p style={{ margin: 0 }}>No drafts to review!</p>
                </div>
            ) : (
                <div>
                    {products.map((product) => {
                        const badge = getStatusBadge(product.status)
                        return (
                            <a
                                key={product.id}
                                href={`/admin/collections/products/${product.id}`}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '12px',
                                    marginBottom: '8px',
                                    background: '#f9fafb',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '6px',
                                    textDecoration: 'none',
                                    color: '#374151',
                                }}
                            >
                                <div>
                                    <p style={{ margin: 0, fontWeight: 600, fontSize: '14px' }}>
                                        {product.name}
                                    </p>
                                    <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#6b7280' }}>
                                        {product.brand}
                                    </p>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <span
                                        style={{
                                            display: 'inline-block',
                                            padding: '4px 8px',
                                            background: badge.background,
                                            color: badge.color,
                                            fontSize: '11px',
                                            fontWeight: 600,
                                            borderRadius: '4px',
                                        }}
                                    >
                                        {badge.label}
                                    </span>
                                    <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#9ca3af' }}>
                                        {formatDate(product.createdAt)}
                                    </p>
                                </div>
                            </a>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

export default ProductsToReview
