'use client'

import React, { useState, useEffect } from 'react'

interface Product {
    id: number
    name: string
    brand?: string
    imageUrl?: string
    priceRange?: string
}

interface EnrichResult {
    success: boolean
    productName?: string
    brand?: string
    imageUrl?: string
    priceRange?: string
    source?: string
    searchQuery?: string
    applied?: boolean
    error?: string
}

type EnrichStep = 'idle' | 'loading' | 'searching' | 'done' | 'error'

const ProductEnricher: React.FC = () => {
    const [products, setProducts] = useState<Product[]>([])
    const [selectedId, setSelectedId] = useState<number | null>(null)
    const [step, setStep] = useState<EnrichStep>('idle')
    const [result, setResult] = useState<EnrichResult | null>(null)
    const [error, setError] = useState<string | null>(null)

    // Fetch products on mount
    useEffect(() => {
        const fetchProducts = async () => {
            setStep('loading')
            try {
                const response = await fetch('/api/products?limit=50&sort=-createdAt')
                const data = await response.json()
                // Filter to products that might need enrichment
                const allProducts = data.docs || []
                setProducts(allProducts)
                setStep('idle')
            } catch (err) {
                setStep('error')
                setError('Failed to load products')
            }
        }
        fetchProducts()
    }, [])

    const handleEnrich = async (applyDirectly: boolean = false) => {
        if (!selectedId) return

        setStep('searching')
        setError(null)
        setResult(null)

        try {
            const response = await fetch('/api/product/enrich', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ productId: selectedId, autoApply: applyDirectly }),
            })

            const data: EnrichResult = await response.json()

            if (data.success) {
                setStep('done')
                setResult(data)
            } else {
                setStep('error')
                setError(data.error || 'Search failed')
            }
        } catch (err) {
            setStep('error')
            setError(err instanceof Error ? err.message : 'Network error')
        }
    }

    const handleApply = async () => {
        if (!selectedId || !result) return

        try {
            await fetch('/api/product/enrich', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ productId: selectedId, autoApply: true }),
            })
            setResult({ ...result, applied: true })
        } catch (err) {
            setError('Failed to apply')
        }
    }

    const selectedProduct = products.find(p => p.id === selectedId)

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
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <span style={{ fontSize: '24px' }}>🖼️</span>
                <div>
                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Product Enricher</h3>
                    <p style={{ margin: 0, fontSize: '14px', color: '#6e6e73' }}>
                        Find product images & prices
                    </p>
                </div>
            </div>

            {step === 'loading' && (
                <div style={{ padding: '20px', textAlign: 'center', color: '#86868b' }}>
                    Loading products...
                </div>
            )}

            {step !== 'loading' && (
                <>
                    <div style={{ marginBottom: '16px' }}>
                        <label
                            style={{
                                display: 'block',
                                fontSize: '14px',
                                fontWeight: 500,
                                marginBottom: '8px',
                            }}
                        >
                            Select Product
                        </label>
                        <select
                            value={selectedId || ''}
                            onChange={(e) => {
                                setSelectedId(Number(e.target.value) || null)
                                setResult(null)
                            }}
                            disabled={step === 'searching'}
                            style={{
                                width: '100%',
                                padding: '10px 14px',
                                borderRadius: '6px',
                                border: '1px solid #d1d1d6',
                                fontSize: '14px',
                                boxSizing: 'border-box',
                            }}
                        >
                            <option value="">Choose a product...</option>
                            {products.map((product) => (
                                <option key={product.id} value={product.id}>
                                    {product.name} {product.brand ? `(${product.brand})` : ''}
                                    {!product.imageUrl ? ' 📷' : ''}
                                    {!product.priceRange ? ' 💰' : ''}
                                </option>
                            ))}
                        </select>
                        <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#86868b' }}>
                            📷 = missing image, 💰 = missing price
                        </p>
                    </div>

                    <button
                        onClick={() => handleEnrich(false)}
                        disabled={!selectedId || step === 'searching'}
                        style={{
                            width: '100%',
                            padding: '12px',
                            background: step === 'searching' ? '#86868b' : '#ec4899',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '14px',
                            fontWeight: 600,
                            cursor: !selectedId || step === 'searching' ? 'not-allowed' : 'pointer',
                        }}
                    >
                        {step === 'searching' ? '⏳ Searching...' : '🔍 Find Image & Price'}
                    </button>
                </>
            )}

            {error && (
                <div
                    style={{
                        marginTop: '16px',
                        padding: '12px',
                        background: '#fef2f2',
                        border: '1px solid #fecaca',
                        borderRadius: '6px',
                        color: '#dc2626',
                        fontSize: '14px',
                    }}
                >
                    {error}
                </div>
            )}

            {result && result.success && (
                <div style={{ marginTop: '16px' }}>
                    <div
                        style={{
                            padding: '12px',
                            background: '#f0fdf4',
                            border: '1px solid #bbf7d0',
                            borderRadius: '6px',
                            marginBottom: '16px',
                        }}
                    >
                        <p style={{ margin: 0, fontWeight: 600, color: '#166534' }}>
                            ✅ Found info for "{result.productName}"
                            {result.applied && <span style={{ marginLeft: '8px', fontSize: '12px' }}>• Applied!</span>}
                        </p>
                    </div>

                    {/* Image Preview */}
                    {result.imageUrl && (
                        <div style={{ marginBottom: '12px' }}>
                            <label style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                                Product Image
                            </label>
                            <div style={{
                                background: '#f9fafb',
                                borderRadius: '8px',
                                padding: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px'
                            }}>
                                <img
                                    src={result.imageUrl}
                                    alt={result.productName}
                                    style={{
                                        width: '80px',
                                        height: '80px',
                                        objectFit: 'cover',
                                        borderRadius: '6px',
                                        border: '1px solid #e5e7eb'
                                    }}
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = 'none'
                                    }}
                                />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <p style={{ margin: 0, fontSize: '12px', color: '#6b7280', wordBreak: 'break-all' }}>
                                        {result.imageUrl.slice(0, 60)}...
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {!result.imageUrl && (
                        <div style={{ marginBottom: '12px', padding: '12px', background: '#fef3c7', borderRadius: '6px' }}>
                            <p style={{ margin: 0, fontSize: '13px', color: '#92400e' }}>
                                ⚠️ No image found. Try searching manually.
                            </p>
                        </div>
                    )}

                    {/* Price Range */}
                    <div style={{ marginBottom: '12px' }}>
                        <label style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                            Price Range
                        </label>
                        <div style={{ padding: '10px 12px', background: '#f9fafb', borderRadius: '6px' }}>
                            {result.priceRange ? (
                                <span style={{ fontSize: '18px', fontWeight: 700, color: '#059669' }}>
                                    {result.priceRange}
                                </span>
                            ) : (
                                <span style={{ fontSize: '14px', color: '#9ca3af' }}>
                                    Price not found
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Source */}
                    {result.source && (
                        <div style={{ marginBottom: '16px' }}>
                            <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>
                                Source: {result.source}
                            </p>
                        </div>
                    )}

                    {/* Apply Button */}
                    {!result.applied && (result.imageUrl || result.priceRange) && (
                        <button
                            onClick={handleApply}
                            style={{
                                width: '100%',
                                padding: '12px',
                                background: '#10b981',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '6px',
                                fontSize: '14px',
                                fontWeight: 600,
                                cursor: 'pointer',
                            }}
                        >
                            ✅ Apply to Product
                        </button>
                    )}
                </div>
            )}
        </div>
    )
}

export default ProductEnricher
