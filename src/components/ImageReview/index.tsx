'use client'

import React, { useState, useEffect } from 'react'

interface ProductForReview {
    id: number
    name: string
    brand: string
    status: 'pending' | 'searching' | 'success' | 'failed'
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

    // Find and internalize image for a product
    const findImage = async (productId: number) => {
        setProducts(prev => prev.map(p =>
            p.id === productId ? { ...p, status: 'searching' as const } : p
        ))

        try {
            // Call the product enrich endpoint - it now searches multiple sources
            // and automatically internalizes the image
            const res = await fetch('/api/product/enrich', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    productId,
                    autoApply: true, // Search, download, and save internally
                }),
            })

            const data = await res.json()

            if (res.ok && data.mediaId) {
                // Success - image was found and saved internally
                setProducts(prev => prev.map(p =>
                    p.id === productId
                        ? { ...p, status: 'success' as const, source: data.source }
                        : p
                ))
                setMessage(`✅ Found image from ${data.source}`)

                // Remove from list after short delay
                setTimeout(() => {
                    setProducts(prev => prev.filter(p => p.id !== productId))
                }, 1500)
            } else {
                // Failed - no image could be downloaded
                setProducts(prev => prev.map(p =>
                    p.id === productId
                        ? { ...p, status: 'failed' as const, error: data.imageError || 'No image found' }
                        : p
                ))
            }
        } catch (error) {
            setProducts(prev => prev.map(p =>
                p.id === productId
                    ? { ...p, status: 'failed' as const, error: 'Request failed' }
                    : p
            ))
        }
    }

    // Retry search for a failed product
    const retrySearch = (productId: number) => {
        setProducts(prev => prev.map(p =>
            p.id === productId ? { ...p, status: 'pending' as const, error: undefined } : p
        ))
        findImage(productId)
    }

    // Skip this product (remove from list)
    const skipProduct = (productId: number) => {
        setProducts(prev => prev.filter(p => p.id !== productId))
    }

    // Find images for all pending products
    const findAllImages = async () => {
        const pendingProducts = products.filter(p => p.status === 'pending')
        for (const product of pendingProducts) {
            await findImage(product.id)
            // Small delay between requests
            await new Promise(r => setTimeout(r, 500))
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
                                onClick={() => findImage(product.id)}
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

                        {product.status === 'success' && (
                            <div style={{
                                padding: '6px',
                                background: '#22c55e',
                                color: '#fff',
                                borderRadius: '4px',
                                fontSize: '11px',
                                textAlign: 'center',
                            }}>
                                ✓ Found ({product.source})
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
                                        onClick={() => retrySearch(product.id)}
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
