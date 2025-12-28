'use client'

import React, { useEffect, useState, useCallback } from 'react'

interface SuggestedCategory {
    id: number
    name: string
    slug: string
    description?: string
    aiSource?: string
    productCount: number
    createdAt: string
}

const SuggestedCategories: React.FC = () => {
    const [categories, setCategories] = useState<SuggestedCategory[]>([])
    const [loading, setLoading] = useState(true)
    const [processing, setProcessing] = useState<number | null>(null)

    const fetchCategories = useCallback(async () => {
        setLoading(true)
        try {
            const response = await fetch(
                `/api/categories?where[aiSuggested][equals]=true&sort=-createdAt`
            )
            const data = await response.json()
            setCategories(data.docs || [])
        } catch (error) {
            console.error('Failed to fetch suggested categories:', error)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchCategories()
    }, [fetchCategories])

    const handleApprove = async (id: number) => {
        setProcessing(id)
        try {
            await fetch(`/api/categories/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ aiSuggested: false }),
            })
            await fetchCategories()
        } catch (error) {
            console.error('Failed to approve:', error)
        } finally {
            setProcessing(null)
        }
    }

    const handleReject = async (id: number) => {
        if (!confirm('Delete this suggested category?')) return
        setProcessing(id)
        try {
            await fetch(`/api/categories/${id}`, { method: 'DELETE' })
            await fetchCategories()
        } catch (error) {
            console.error('Failed to reject:', error)
        } finally {
            setProcessing(null)
        }
    }

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
        })
    }

    return (
        <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ marginBottom: '24px' }}>
                <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: '#1f2937' }}>
                    📂 Suggested Categories
                </h1>
                <p style={{ margin: '8px 0 0', color: '#6b7280' }}>
                    Categories automatically created from video analysis
                </p>
            </div>

            {/* Stats Bar */}
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
                <span style={{ fontSize: '14px', color: '#6b7280' }}>
                    <strong>{categories.length}</strong> suggested categories
                </span>
                <a
                    href="/admin/collections/categories"
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
                    View All Categories →
                </a>
            </div>

            {/* Categories List */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: '48px', color: '#6b7280' }}>Loading...</div>
            ) : categories.length === 0 ? (
                <div
                    style={{
                        textAlign: 'center',
                        padding: '64px',
                        background: '#f9fafb',
                        borderRadius: '12px',
                    }}
                >
                    <span style={{ fontSize: '48px', display: 'block', marginBottom: '16px' }}>✅</span>
                    <p style={{ fontSize: '18px', fontWeight: 600, color: '#1f2937' }}>No suggestions!</p>
                    <p style={{ color: '#6b7280' }}>All suggested categories have been reviewed.</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gap: '12px' }}>
                    {categories.map((category) => (
                        <div
                            key={category.id}
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
                            {/* Info */}
                            <div style={{ flex: 1 }}>
                                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#1f2937' }}>
                                    {category.name}
                                </h3>
                                {category.description && (
                                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#6b7280' }}>
                                        {category.description}
                                    </p>
                                )}
                                <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#9ca3af' }}>
                                    Slug: {category.slug} • {category.productCount || 0} products
                                    {category.aiSource && ` • Source: ${category.aiSource}`}
                                </p>
                            </div>

                            {/* Date */}
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                <p style={{ margin: 0, fontSize: '11px', color: '#9ca3af' }}>
                                    {formatDate(category.createdAt)}
                                </p>
                            </div>

                            {/* Actions */}
                            <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                                <a
                                    href={`/admin/collections/categories/${category.id}`}
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
                                    onClick={() => handleApprove(category.id)}
                                    disabled={processing === category.id}
                                    style={{
                                        padding: '8px 12px',
                                        background: '#10b981',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: '6px',
                                        fontSize: '12px',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        opacity: processing === category.id ? 0.5 : 1,
                                    }}
                                >
                                    Approve
                                </button>
                                <button
                                    onClick={() => handleReject(category.id)}
                                    disabled={processing === category.id}
                                    style={{
                                        padding: '8px 12px',
                                        background: '#fee2e2',
                                        color: '#dc2626',
                                        border: 'none',
                                        borderRadius: '6px',
                                        fontSize: '12px',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        opacity: processing === category.id ? 0.5 : 1,
                                    }}
                                >
                                    Reject
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

export default SuggestedCategories
