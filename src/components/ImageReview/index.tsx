'use client'

import React, { useState, useEffect } from 'react'

interface ProductForReview {
    id: number
    name: string
    brand: string
    imageUrl: string | null
    suggestedImageUrl: string | null | undefined
    isLoadingSuggestion?: boolean
}

const ImageReview: React.FC = () => {
    const [products, setProducts] = useState<ProductForReview[]>([])
    const [loading, setLoading] = useState(true)
    const [message, setMessage] = useState('')

    // Fetch products without images on mount
    useEffect(() => {
        const fetchProducts = async () => {
            try {
                const res = await fetch('/api/products?limit=50&sort=-updatedAt&depth=0')
                const data = await res.json()

                // Filter to only products without images
                const productsWithoutImages = (data.docs || [])
                    .filter((p: any) => !p.imageUrl && !p.image)
                    .slice(0, 20) // Limit to 20 for performance
                    .map((p: any) => ({
                        id: p.id,
                        name: p.name || 'Untitled',
                        brand: p.brand || 'Unknown',
                        imageUrl: null,
                        suggestedImageUrl: null,
                        isLoadingSuggestion: false,
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

    // Fetch image suggestion for a product
    const fetchSuggestion = async (productId: number) => {
        setProducts(prev => prev.map(p =>
            p.id === productId ? { ...p, isLoadingSuggestion: true } : p
        ))

        try {
            // Call the product enrich endpoint to get an image
            const res = await fetch('/api/product/enrich', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    productId,
                    enrichFields: ['imageUrl'],
                    dryRun: true, // Just get suggestion, don't save yet
                }),
            })

            if (res.ok) {
                const data = await res.json()
                const suggestedUrl = data.enrichedData?.imageUrl || data.imageUrl

                setProducts(prev => prev.map(p =>
                    p.id === productId
                        ? { ...p, suggestedImageUrl: suggestedUrl, isLoadingSuggestion: false }
                        : p
                ))
            } else {
                setProducts(prev => prev.map(p =>
                    p.id === productId ? { ...p, isLoadingSuggestion: false } : p
                ))
                setMessage(`Couldn't find image for product ${productId}`)
            }
        } catch {
            setProducts(prev => prev.map(p =>
                p.id === productId ? { ...p, isLoadingSuggestion: false } : p
            ))
        }
    }

    // Accept the suggested image
    const acceptImage = async (productId: number, imageUrl: string) => {
        try {
            const res = await fetch(`/api/products/${productId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageUrl }),
            })

            if (res.ok) {
                // Remove from list after accepting
                setProducts(prev => prev.filter(p => p.id !== productId))
                setMessage(`✅ Image saved!`)
            }
        } catch {
            setMessage('Failed to save image')
        }
    }

    // Reject and try another
    const tryAnother = (productId: number) => {
        // Clear current suggestion and fetch new one
        setProducts(prev => prev.map(p =>
            p.id === productId ? { ...p, suggestedImageUrl: null } : p
        ))
        fetchSuggestion(productId)
    }

    // Skip this product (remove from list)
    const skipProduct = (productId: number) => {
        setProducts(prev => prev.filter(p => p.id !== productId))
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

    return (
        <div style={{
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: '12px',
            padding: '16px',
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#1f2937', margin: 0 }}>
                    🖼️ Image Review ({products.length} need images)
                </h3>
            </div>

            {message && (
                <div style={{
                    padding: '8px',
                    background: '#f3f4f6',
                    borderRadius: '6px',
                    marginBottom: '12px',
                    fontSize: '13px',
                }}>
                    {message}
                </div>
            )}

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
                            padding: '12px',
                            background: '#f9fafb',
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px',
                        }}
                    >
                        {/* Image Preview */}
                        <div style={{
                            width: '100%',
                            height: '100px',
                            background: '#e5e7eb',
                            borderRadius: '6px',
                            marginBottom: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            overflow: 'hidden',
                        }}>
                            {product.isLoadingSuggestion ? (
                                <span style={{ color: '#6b7280', fontSize: '12px' }}>Loading...</span>
                            ) : product.suggestedImageUrl ? (
                                <img
                                    src={product.suggestedImageUrl}
                                    alt={product.name}
                                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = 'none'
                                    }}
                                />
                            ) : (
                                <button
                                    onClick={() => fetchSuggestion(product.id)}
                                    style={{
                                        padding: '8px 12px',
                                        background: '#3b82f6',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: '6px',
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                    }}
                                >
                                    🔍 Find Image
                                </button>
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

                        {/* Action Buttons */}
                        {product.suggestedImageUrl && (
                            <div style={{ display: 'flex', gap: '6px' }}>
                                <button
                                    onClick={() => acceptImage(product.id, product.suggestedImageUrl!)}
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
                                    ✓ Yes
                                </button>
                                <button
                                    onClick={() => tryAnother(product.id)}
                                    style={{
                                        flex: 1,
                                        padding: '6px',
                                        background: '#f59e0b',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: '4px',
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                    }}
                                >
                                    🔄 Try
                                </button>
                                <button
                                    onClick={() => skipProduct(product.id)}
                                    style={{
                                        flex: 1,
                                        padding: '6px',
                                        background: '#ef4444',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: '4px',
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                    }}
                                >
                                    ✕ Skip
                                </button>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    )
}

export default ImageReview
