'use client'

import React, { useState, useEffect, useCallback } from 'react'

interface InternalizeStatus {
    externalUrls: number
    internalImages: number
    noImage: number
}

interface ProductWithExternalUrl {
    id: number
    name: string
    brand: string
    imageUrl: string
    status: 'pending' | 'processing' | 'success' | 'skipped' | 'failed'
    error?: string
}

interface ProcessingResult {
    productId: number
    productName: string
    success: boolean
    mediaId?: number
    error?: string
}

/**
 * Image Internalizer Component
 *
 * Dashboard tool to migrate external image URLs to internal Media storage.
 * Shows preview of each image before internalizing.
 */
const ImageInternalizer: React.FC = () => {
    const [status, setStatus] = useState<InternalizeStatus | null>(null)
    const [loading, setLoading] = useState(true)
    const [message, setMessage] = useState('')
    const [mode, setMode] = useState<'status' | 'preview'>('status')
    const [products, setProducts] = useState<ProductWithExternalUrl[]>([])
    const [loadingProducts, setLoadingProducts] = useState(false)

    const fetchStatus = useCallback(async () => {
        try {
            const res = await fetch('/api/images/internalize/status')
            if (res.ok) {
                const data = await res.json()
                setStatus(data)
            }
        } catch (error) {
            console.error('Failed to fetch status:', error)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchStatus()
    }, [fetchStatus])

    // Fetch products with external URLs for preview mode
    const loadProductsForPreview = async () => {
        setLoadingProducts(true)
        try {
            // Fetch products that have imageUrl set (external URLs)
            const res = await fetch('/api/products?limit=30&depth=1&where[imageUrl][exists]=true')
            const data = await res.json()

            const productsToReview: ProductWithExternalUrl[] = (data.docs || []).map((p: any) => ({
                id: p.id,
                name: p.name || 'Untitled',
                brand: typeof p.brand === 'object' ? p.brand?.name : p.brand || 'Unknown',
                imageUrl: p.imageUrl,
                status: 'pending' as const,
            }))

            setProducts(productsToReview)
            setMode('preview')
        } catch (error) {
            console.error('Failed to load products:', error)
            setMessage('Failed to load products for preview')
        } finally {
            setLoadingProducts(false)
        }
    }

    // Internalize a single product's image
    const internalizeProduct = async (productId: number) => {
        setProducts(prev => prev.map(p =>
            p.id === productId ? { ...p, status: 'processing' as const } : p
        ))

        try {
            const res = await fetch('/api/images/internalize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ productIds: [productId] }),
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error || 'Internalization failed')
            }

            const result = data.results?.[0]
            if (result?.success) {
                setProducts(prev => prev.map(p =>
                    p.id === productId ? { ...p, status: 'success' as const } : p
                ))
                setMessage(`✅ Internalized ${result.productName}`)

                // Remove after a delay
                setTimeout(() => {
                    setProducts(prev => prev.filter(p => p.id !== productId))
                }, 1500)
            } else {
                setProducts(prev => prev.map(p =>
                    p.id === productId
                        ? { ...p, status: 'failed' as const, error: result?.error || 'Failed' }
                        : p
                ))
            }
        } catch (error) {
            setProducts(prev => prev.map(p =>
                p.id === productId
                    ? { ...p, status: 'failed' as const, error: error instanceof Error ? error.message : 'Failed' }
                    : p
            ))
        }
    }

    // Skip a product
    const skipProduct = (productId: number) => {
        setProducts(prev => prev.filter(p => p.id !== productId))
    }

    // Internalize all pending products
    const internalizeAll = async () => {
        const pending = products.filter(p => p.status === 'pending')
        for (const product of pending) {
            await internalizeProduct(product.id)
            await new Promise(r => setTimeout(r, 300)) // Small delay between requests
        }
        fetchStatus()
    }

    // Back to status mode
    const backToStatus = () => {
        setMode('status')
        setProducts([])
        fetchStatus()
    }

    if (loading) {
        return (
            <div style={{ padding: '12px', background: '#f0f9ff', borderRadius: '6px', fontSize: '13px' }}>
                Loading image status...
            </div>
        )
    }

    if (!status) {
        return (
            <div style={{ padding: '12px', background: '#fef2f2', borderRadius: '6px', fontSize: '13px' }}>
                Failed to load status
            </div>
        )
    }

    const hasExternalUrls = status.externalUrls > 0

    // Preview mode - show products with external URLs
    if (mode === 'preview') {
        const pendingCount = products.filter(p => p.status === 'pending').length

        return (
            <div style={{ padding: '12px', background: '#f9fafb', borderRadius: '8px' }}>
                {/* Header with back button */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>
                        🖼️ Review External Images ({products.length})
                    </h4>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        {pendingCount > 0 && (
                            <button
                                onClick={internalizeAll}
                                style={{
                                    padding: '4px 10px',
                                    background: '#22c55e',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '4px',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                }}
                            >
                                ✓ Accept All ({pendingCount})
                            </button>
                        )}
                        <button
                            onClick={backToStatus}
                            style={{
                                padding: '4px 10px',
                                background: '#6b7280',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '4px',
                                fontSize: '12px',
                                cursor: 'pointer',
                            }}
                        >
                            ← Back
                        </button>
                    </div>
                </div>

                {message && (
                    <div style={{
                        padding: '8px',
                        background: message.includes('✅') ? '#d1fae5' : '#f3f4f6',
                        color: message.includes('✅') ? '#047857' : '#374151',
                        borderRadius: '6px',
                        marginBottom: '12px',
                        fontSize: '13px',
                    }}>
                        {message}
                    </div>
                )}

                <p style={{ fontSize: '11px', color: '#6b7280', margin: '0 0 12px' }}>
                    Review each image. Click ✓ to save internally, → to skip.
                </p>

                {products.length === 0 ? (
                    <div style={{
                        padding: '20px',
                        background: '#dcfce7',
                        borderRadius: '8px',
                        textAlign: 'center',
                        fontSize: '14px',
                        color: '#166534',
                    }}>
                        🎉 All external images reviewed!
                    </div>
                ) : (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                        gap: '12px',
                        maxHeight: '400px',
                        overflowY: 'auto',
                    }}>
                        {products.map((product) => (
                            <div
                                key={product.id}
                                style={{
                                    padding: '10px',
                                    background: product.status === 'success' ? '#d1fae5' :
                                                product.status === 'failed' ? '#fee2e2' : '#fff',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '8px',
                                }}
                            >
                                {/* Product Info */}
                                <div style={{
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    color: '#1f2937',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    marginBottom: '2px',
                                }}>
                                    {product.name}
                                </div>
                                <div style={{
                                    fontSize: '11px',
                                    color: '#6b7280',
                                    marginBottom: '8px',
                                }}>
                                    {product.brand}
                                </div>

                                {/* Image Preview */}
                                <div style={{
                                    width: '100%',
                                    height: '100px',
                                    marginBottom: '8px',
                                    borderRadius: '4px',
                                    overflow: 'hidden',
                                    background: '#f3f4f6',
                                }}>
                                    <img
                                        src={product.imageUrl}
                                        alt={`Preview for ${product.name}`}
                                        style={{
                                            width: '100%',
                                            height: '100%',
                                            objectFit: 'contain',
                                        }}
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y="50" x="50" text-anchor="middle" font-size="12" fill="%236b7280">Load Error</text></svg>'
                                        }}
                                    />
                                </div>

                                {/* Source URL (truncated) */}
                                <div style={{
                                    fontSize: '9px',
                                    color: '#9ca3af',
                                    marginBottom: '6px',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                }}>
                                    {new URL(product.imageUrl).hostname}
                                </div>

                                {/* Actions */}
                                {product.status === 'pending' && (
                                    <div style={{ display: 'flex', gap: '4px' }}>
                                        <button
                                            onClick={() => internalizeProduct(product.id)}
                                            style={{
                                                flex: 1,
                                                padding: '6px',
                                                background: '#22c55e',
                                                color: '#fff',
                                                border: 'none',
                                                borderRadius: '4px',
                                                fontSize: '11px',
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                            }}
                                        >
                                            ✓ Save
                                        </button>
                                        <button
                                            onClick={() => skipProduct(product.id)}
                                            style={{
                                                flex: 1,
                                                padding: '6px',
                                                background: '#6b7280',
                                                color: '#fff',
                                                border: 'none',
                                                borderRadius: '4px',
                                                fontSize: '11px',
                                                cursor: 'pointer',
                                            }}
                                        >
                                            → Skip
                                        </button>
                                    </div>
                                )}

                                {product.status === 'processing' && (
                                    <div style={{
                                        padding: '6px',
                                        background: '#e0e7ff',
                                        color: '#4338ca',
                                        borderRadius: '4px',
                                        fontSize: '11px',
                                        textAlign: 'center',
                                    }}>
                                        ⏳ Saving...
                                    </div>
                                )}

                                {product.status === 'success' && (
                                    <div style={{
                                        padding: '6px',
                                        background: '#22c55e',
                                        color: '#fff',
                                        borderRadius: '4px',
                                        fontSize: '11px',
                                        textAlign: 'center',
                                    }}>
                                        ✓ Saved!
                                    </div>
                                )}

                                {product.status === 'failed' && (
                                    <div>
                                        <div style={{
                                            padding: '4px',
                                            color: '#dc2626',
                                            fontSize: '10px',
                                            marginBottom: '4px',
                                        }}>
                                            {product.error}
                                        </div>
                                        <button
                                            onClick={() => skipProduct(product.id)}
                                            style={{
                                                width: '100%',
                                                padding: '4px',
                                                background: '#6b7280',
                                                color: '#fff',
                                                border: 'none',
                                                borderRadius: '4px',
                                                fontSize: '10px',
                                                cursor: 'pointer',
                                            }}
                                        >
                                            ✕ Remove
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        )
    }

    // Status mode - show counts and action buttons
    return (
        <div style={{ padding: '12px', background: '#f9fafb', borderRadius: '8px' }}>
            {/* Status display */}
            <div style={{ display: 'flex', gap: '16px', marginBottom: '12px', flexWrap: 'wrap' }}>
                <div style={{ fontSize: '13px' }}>
                    <span style={{ fontWeight: 600, color: hasExternalUrls ? '#dc2626' : '#059669' }}>
                        {status.externalUrls}
                    </span>{' '}
                    <span style={{ color: '#6b7280' }}>external URLs</span>
                </div>
                <div style={{ fontSize: '13px' }}>
                    <span style={{ fontWeight: 600, color: '#059669' }}>{status.internalImages}</span>{' '}
                    <span style={{ color: '#6b7280' }}>internal images</span>
                </div>
                <div style={{ fontSize: '13px' }}>
                    <span style={{ fontWeight: 600, color: '#9ca3af' }}>{status.noImage}</span>{' '}
                    <span style={{ color: '#6b7280' }}>no image</span>
                </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                    onClick={loadProductsForPreview}
                    disabled={loadingProducts || !hasExternalUrls}
                    style={{
                        padding: '6px 12px',
                        background: loadingProducts || !hasExternalUrls ? '#9ca3af' : '#2563eb',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '13px',
                        fontWeight: 500,
                        cursor: loadingProducts || !hasExternalUrls ? 'not-allowed' : 'pointer',
                    }}
                >
                    {loadingProducts ? 'Loading...' : hasExternalUrls ? `Review & Internalize (${status.externalUrls})` : 'All Images Internal ✓'}
                </button>

                <button
                    onClick={fetchStatus}
                    disabled={loadingProducts}
                    style={{
                        padding: '6px 12px',
                        background: '#fff',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '13px',
                        cursor: 'pointer',
                    }}
                >
                    Refresh
                </button>
            </div>

            {/* Message */}
            {message && (
                <div
                    style={{
                        marginTop: '12px',
                        padding: '8px 12px',
                        background: message.includes('failed') ? '#fee2e2' : '#d1fae5',
                        color: message.includes('failed') ? '#dc2626' : '#047857',
                        borderRadius: '6px',
                        fontSize: '13px',
                    }}
                >
                    {message}
                </div>
            )}
        </div>
    )
}

export default ImageInternalizer
