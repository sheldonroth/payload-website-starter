'use client'

import React, { useState, useEffect } from 'react'

interface ProductForReview {
    id: number
    name: string
    brand: string
    status: 'pending' | 'searching' | 'preview' | 'saving' | 'success' | 'failed'
    previewUrl?: string
    previewSource?: string
    triedUrls?: string[] // URLs we've already tried
    error?: string
    source?: string
}

const ImageReview: React.FC = () => {
    const [products, setProducts] = useState<ProductForReview[]>([])
    const [loading, setLoading] = useState(true)
    const [message, setMessage] = useState('')

    // Fetch products without images on mount
    useEffect(() => {
        const fetchProducts = async () => {
            try {
                // Exclude ai_draft products - only show manually created or approved products
                const res = await fetch('/api/products?limit=50&sort=-updatedAt&depth=0&where[status][not_equals]=ai_draft')
                const data = await res.json()

                // Filter to only products without images
                const productsWithoutImages = (data.docs || [])
                    .filter((p: any) => !p.imageUrl && !p.image)
                    .slice(0, 20) // Limit to 20 for performance
                    .map((p: any) => ({
                        id: p.id,
                        name: p.name || 'Untitled',
                        brand: p.brand || 'Unknown',
                        status: 'pending' as const,
                    }))

                setProducts(productsWithoutImages)
            } catch (error) {
                console.error('Failed to fetch products:', error)
            } finally {
                setLoading(false)
            }
        }
        fetchProducts()
    }, [])

    // Search for image preview (doesn't save yet)
    const searchForPreview = async (productId: number, excludeUrls: string[] = []) => {
        setProducts(prev => prev.map(p =>
            p.id === productId ? { ...p, status: 'searching' as const, triedUrls: excludeUrls } : p
        ))

        try {
            const res = await fetch('/api/product/search-images', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ productId, excludeUrls }),
            })

            const data = await res.json()

            if (res.ok && data.previewUrl) {
                setProducts(prev => prev.map(p =>
                    p.id === productId
                        ? {
                            ...p,
                            status: 'preview' as const,
                            previewUrl: data.previewUrl,
                            previewSource: data.source,
                            triedUrls: excludeUrls,
                        }
                        : p
                ))
            } else {
                setProducts(prev => prev.map(p =>
                    p.id === productId
                        ? { ...p, status: 'failed' as const, error: data.error || 'No images found' }
                        : p
                ))
            }
        } catch (error) {
            setProducts(prev => prev.map(p =>
                p.id === productId
                    ? { ...p, status: 'failed' as const, error: 'Search failed' }
                    : p
            ))
        }
    }

    // Accept the previewed image - download and save
    const acceptImage = async (productId: number) => {
        const product = products.find(p => p.id === productId)
        if (!product?.previewUrl) return

        setProducts(prev => prev.map(p =>
            p.id === productId ? { ...p, status: 'saving' as const } : p
        ))

        try {
            const res = await fetch('/api/product/save-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ productId, imageUrl: product.previewUrl }),
            })

            const data = await res.json()

            if (res.ok && data.success) {
                setProducts(prev => prev.map(p =>
                    p.id === productId
                        ? { ...p, status: 'success' as const, source: product.previewSource }
                        : p
                ))
                setMessage(`✅ Saved image from ${product.previewSource}`)

                setTimeout(() => {
                    setProducts(prev => prev.filter(p => p.id !== productId))
                }, 1500)
            } else {
                // Download failed - try next image
                const triedUrls = [...(product.triedUrls || []), product.previewUrl]
                searchForPreview(productId, triedUrls)
                setMessage(`⚠️ Download failed, trying next...`)
            }
        } catch (error) {
            setProducts(prev => prev.map(p =>
                p.id === productId
                    ? { ...p, status: 'failed' as const, error: 'Save failed' }
                    : p
            ))
        }
    }

    // Reject current preview and try next image
    const tryNextImage = (productId: number) => {
        const product = products.find(p => p.id === productId)
        if (!product?.previewUrl) return

        const triedUrls = [...(product.triedUrls || []), product.previewUrl]
        searchForPreview(productId, triedUrls)
    }

    // Skip this product (remove from list)
    const skipProduct = (productId: number) => {
        setProducts(prev => prev.filter(p => p.id !== productId))
    }

    // Search for all pending products
    const findAllImages = async () => {
        const pendingProducts = products.filter(p => p.status === 'pending')
        for (const product of pendingProducts) {
            await searchForPreview(product.id)
            await new Promise(r => setTimeout(r, 300))
        }
    }

    if (loading) {
        return (
            <div style={{ padding: '16px', background: '#f9fafb', borderRadius: '8px', fontSize: '14px' }}>
                Loading products without images...
            </div>
        )
    }

    if (products.length === 0) {
        return (
            <div style={{
                padding: '20px',
                background: '#dcfce7',
                borderRadius: '8px',
                textAlign: 'center',
                fontSize: '14px',
                color: '#166534',
            }}>
                🎉 All products have images!
            </div>
        )
    }

    const pendingCount = products.filter(p => p.status === 'pending').length
    const isSearching = products.some(p => p.status === 'searching')

    return (
        <div style={{
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: '12px',
            padding: '16px',
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#1f2937', margin: 0 }}>
                    🖼️ Products Missing Images ({products.length})
                </h3>
                {pendingCount > 0 && (
                    <button
                        onClick={findAllImages}
                        disabled={isSearching}
                        style={{
                            padding: '6px 12px',
                            background: isSearching ? '#9ca3af' : '#2563eb',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: isSearching ? 'not-allowed' : 'pointer',
                        }}
                    >
                        {isSearching ? 'Searching...' : `🔍 Find All (${pendingCount})`}
                    </button>
                )}
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
                Searches Google Images + Open Food Facts, downloads and stores internally.
            </p>

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                gap: '10px',
                maxHeight: '350px',
                overflowY: 'auto',
            }}>
                {products.map((product) => (
                    <div
                        key={product.id}
                        style={{
                            padding: '10px',
                            background: product.status === 'success' ? '#d1fae5' :
                                        product.status === 'failed' ? '#fee2e2' : '#f9fafb',
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

                        {/* Status & Actions */}
                        {product.status === 'pending' && (
                            <button
                                onClick={() => searchForPreview(product.id)}
                                style={{
                                    width: '100%',
                                    padding: '6px',
                                    background: '#3b82f6',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '4px',
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                }}
                            >
                                🔍 Find Image
                            </button>
                        )}

                        {product.status === 'searching' && (
                            <div style={{
                                padding: '6px',
                                background: '#e0e7ff',
                                color: '#4338ca',
                                borderRadius: '4px',
                                fontSize: '11px',
                                textAlign: 'center',
                            }}>
                                ⏳ Searching...
                            </div>
                        )}

                        {product.status === 'preview' && product.previewUrl && (
                            <div>
                                {/* Preview Image */}
                                <div style={{
                                    width: '100%',
                                    height: '100px',
                                    marginBottom: '6px',
                                    borderRadius: '4px',
                                    overflow: 'hidden',
                                    background: '#f3f4f6',
                                }}>
                                    <img
                                        src={product.previewUrl}
                                        alt={`Preview for ${product.name}`}
                                        style={{
                                            width: '100%',
                                            height: '100%',
                                            objectFit: 'contain',
                                        }}
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).style.display = 'none'
                                        }}
                                    />
                                </div>
                                <div style={{
                                    fontSize: '9px',
                                    color: '#6b7280',
                                    marginBottom: '4px',
                                    textAlign: 'center',
                                }}>
                                    {product.previewSource}
                                </div>
                                {/* Accept / Try Next / Skip buttons */}
                                <div style={{ display: 'flex', gap: '3px' }}>
                                    <button
                                        onClick={() => acceptImage(product.id)}
                                        style={{
                                            flex: 1,
                                            padding: '4px',
                                            background: '#22c55e',
                                            color: '#fff',
                                            border: 'none',
                                            borderRadius: '4px',
                                            fontSize: '10px',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                        }}
                                    >
                                        ✓
                                    </button>
                                    <button
                                        onClick={() => tryNextImage(product.id)}
                                        style={{
                                            flex: 1,
                                            padding: '4px',
                                            background: '#f59e0b',
                                            color: '#fff',
                                            border: 'none',
                                            borderRadius: '4px',
                                            fontSize: '10px',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        →
                                    </button>
                                    <button
                                        onClick={() => skipProduct(product.id)}
                                        style={{
                                            flex: 1,
                                            padding: '4px',
                                            background: '#6b7280',
                                            color: '#fff',
                                            border: 'none',
                                            borderRadius: '4px',
                                            fontSize: '10px',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        ✕
                                    </button>
                                </div>
                            </div>
                        )}

                        {product.status === 'saving' && (
                            <div style={{
                                padding: '6px',
                                background: '#fef3c7',
                                color: '#92400e',
                                borderRadius: '4px',
                                fontSize: '11px',
                                textAlign: 'center',
                            }}>
                                💾 Saving...
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
                                ✓ Saved ({product.source})
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
                                <div style={{ display: 'flex', gap: '4px' }}>
                                    <button
                                        onClick={() => searchForPreview(product.id)}
                                        style={{
                                            flex: 1,
                                            padding: '4px',
                                            background: '#f59e0b',
                                            color: '#fff',
                                            border: 'none',
                                            borderRadius: '4px',
                                            fontSize: '10px',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        🔄 Retry
                                    </button>
                                    <button
                                        onClick={() => skipProduct(product.id)}
                                        style={{
                                            flex: 1,
                                            padding: '4px',
                                            background: '#6b7280',
                                            color: '#fff',
                                            border: 'none',
                                            borderRadius: '4px',
                                            fontSize: '10px',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        ✕ Skip
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    )
}

export default ImageReview
