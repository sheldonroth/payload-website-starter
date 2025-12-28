'use client'

import React, { useState, useEffect, useCallback } from 'react'

interface ProductImage {
    id: number
    name: string
    brand: string
    imageUrl: string | null
    hasImage: boolean
}

const BatchImageReviewer: React.FC = () => {
    const [products, setProducts] = useState<ProductImage[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
    const [processing, setProcessing] = useState(false)
    const [message, setMessage] = useState('')
    const [searchTerm, setSearchTerm] = useState('')
    const [filter, setFilter] = useState<'all' | 'with' | 'without'>('without')

    const fetchProducts = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/products?limit=100&sort=-updatedAt&depth=0')
            const data = await res.json()
            const mapped = (data.docs || []).map((p: any) => ({
                id: p.id,
                name: p.name || 'Untitled',
                brand: p.brand || 'Unknown Brand',
                imageUrl: p.imageUrl || null,
                hasImage: !!(p.imageUrl || p.image),
            }))
            setProducts(mapped)
        } catch (error) {
            console.error('Failed to fetch products:', error)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchProducts()
    }, [fetchProducts])

    const filteredProducts = products.filter(p => {
        const matchesSearch =
            p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.brand.toLowerCase().includes(searchTerm.toLowerCase())

        if (filter === 'with') return matchesSearch && p.hasImage
        if (filter === 'without') return matchesSearch && !p.hasImage
        return matchesSearch
    })

    const toggleSelect = (id: number) => {
        setSelectedIds(prev => {
            const next = new Set(prev)
            if (next.has(id)) {
                next.delete(id)
            } else {
                next.add(id)
            }
            return next
        })
    }

    const selectAll = () => {
        setSelectedIds(new Set(filteredProducts.map(p => p.id)))
    }

    const deselectAll = () => {
        setSelectedIds(new Set())
    }

    const fetchImagesForSelected = async () => {
        if (selectedIds.size === 0) {
            setMessage('Please select products first')
            return
        }

        setProcessing(true)
        setMessage(`Fetching images for ${selectedIds.size} products...`)

        let successCount = 0
        let failCount = 0

        for (const id of selectedIds) {
            try {
                const res = await fetch('/api/product/enrich', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        productId: id,
                        enrichFields: ['imageUrl'] // Only fetch image
                    }),
                })
                if (res.ok) {
                    successCount++
                } else {
                    failCount++
                }
            } catch {
                failCount++
            }
        }

        setMessage(`✅ ${successCount} images fetched, ${failCount} failed`)
        setProcessing(false)
        setSelectedIds(new Set())
        fetchProducts() // Refresh list
    }

    const clearImagesForSelected = async () => {
        if (selectedIds.size === 0) {
            setMessage('Please select products first')
            return
        }

        if (!confirm(`Clear images for ${selectedIds.size} products?`)) return

        setProcessing(true)
        setMessage(`Clearing images for ${selectedIds.size} products...`)

        let successCount = 0

        for (const id of selectedIds) {
            try {
                const res = await fetch(`/api/products/${id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ imageUrl: null, image: null }),
                })
                if (res.ok) successCount++
            } catch { /* ignore */ }
        }

        setMessage(`✅ Cleared ${successCount} product images`)
        setProcessing(false)
        setSelectedIds(new Set())
        fetchProducts()
    }

    if (loading) {
        return (
            <div style={{ padding: '16px', background: '#f9fafb', borderRadius: '8px' }}>
                Loading products...
            </div>
        )
    }

    const withoutImageCount = products.filter(p => !p.hasImage).length
    const withImageCount = products.filter(p => p.hasImage).length

    return (
        <div style={{
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: '12px',
            padding: '20px',
        }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px', color: '#1f2937' }}>
                🖼️ Batch Image Reviewer
            </h3>

            {/* Stats */}
            <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                <div style={{ fontSize: '13px' }}>
                    <span style={{ color: '#ef4444', fontWeight: 600 }}>{withoutImageCount}</span>
                    <span style={{ color: '#6b7280' }}> missing images</span>
                </div>
                <div style={{ fontSize: '13px' }}>
                    <span style={{ color: '#22c55e', fontWeight: 600 }}>{withImageCount}</span>
                    <span style={{ color: '#6b7280' }}> have images</span>
                </div>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                <input
                    type="text"
                    placeholder="Search..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{
                        padding: '8px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '13px',
                        flex: 1,
                        minWidth: '150px',
                    }}
                />
                <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value as any)}
                    style={{
                        padding: '8px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '13px',
                        background: '#fff',
                    }}
                >
                    <option value="without">❌ Without Image</option>
                    <option value="with">✅ With Image</option>
                    <option value="all">📦 All Products</option>
                </select>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                <button
                    onClick={selectAll}
                    disabled={processing}
                    style={{
                        padding: '8px 12px',
                        background: '#e5e7eb',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '12px',
                        cursor: 'pointer',
                    }}
                >
                    Select All ({filteredProducts.length})
                </button>
                <button
                    onClick={deselectAll}
                    disabled={processing}
                    style={{
                        padding: '8px 12px',
                        background: '#e5e7eb',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '12px',
                        cursor: 'pointer',
                    }}
                >
                    Deselect All
                </button>
                <button
                    onClick={fetchImagesForSelected}
                    disabled={processing || selectedIds.size === 0}
                    style={{
                        padding: '8px 16px',
                        background: selectedIds.size > 0 ? '#3b82f6' : '#9ca3af',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: selectedIds.size > 0 ? 'pointer' : 'not-allowed',
                    }}
                >
                    🔍 Fetch Images ({selectedIds.size})
                </button>
                <button
                    onClick={clearImagesForSelected}
                    disabled={processing || selectedIds.size === 0}
                    style={{
                        padding: '8px 16px',
                        background: selectedIds.size > 0 ? '#ef4444' : '#9ca3af',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: selectedIds.size > 0 ? 'pointer' : 'not-allowed',
                    }}
                >
                    🗑️ Clear Images
                </button>
            </div>

            {/* Message */}
            {message && (
                <div style={{
                    padding: '8px 12px',
                    background: '#f3f4f6',
                    borderRadius: '6px',
                    marginBottom: '12px',
                    fontSize: '13px',
                    color: '#374151',
                }}>
                    {message}
                </div>
            )}

            {/* Product Grid */}
            <div style={{
                maxHeight: '400px',
                overflowY: 'auto',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                gap: '12px',
            }}>
                {filteredProducts.map((product) => (
                    <div
                        key={product.id}
                        onClick={() => toggleSelect(product.id)}
                        style={{
                            padding: '12px',
                            background: selectedIds.has(product.id) ? '#dbeafe' : '#f9fafb',
                            border: selectedIds.has(product.id) ? '2px solid #3b82f6' : '1px solid #e5e7eb',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            transition: 'all 0.1s',
                        }}
                    >
                        {/* Image Preview */}
                        <div style={{
                            width: '100%',
                            height: '80px',
                            background: product.imageUrl ? '#fff' : '#e5e7eb',
                            borderRadius: '6px',
                            marginBottom: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            overflow: 'hidden',
                        }}>
                            {product.imageUrl ? (
                                <img
                                    src={product.imageUrl}
                                    alt={product.name}
                                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = 'none'
                                    }}
                                />
                            ) : (
                                <span style={{ color: '#9ca3af', fontSize: '24px' }}>📷</span>
                            )}
                        </div>

                        {/* Product Info */}
                        <div style={{
                            fontSize: '12px',
                            fontWeight: 600,
                            color: '#1f2937',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                        }}>
                            {product.name}
                        </div>
                        <div style={{
                            fontSize: '11px',
                            color: '#6b7280',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                        }}>
                            {product.brand}
                        </div>

                        {/* Status */}
                        <div style={{
                            marginTop: '6px',
                            fontSize: '10px',
                            fontWeight: 600,
                            color: product.hasImage ? '#22c55e' : '#ef4444',
                        }}>
                            {product.hasImage ? '✅ Has Image' : '❌ No Image'}
                        </div>
                    </div>
                ))}
            </div>

            {filteredProducts.length === 0 && (
                <div style={{ textAlign: 'center', padding: '24px', color: '#6b7280' }}>
                    No products match your filter
                </div>
            )}
        </div>
    )
}

export default BatchImageReviewer
