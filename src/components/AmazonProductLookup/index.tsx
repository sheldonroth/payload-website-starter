'use client'

import React, { useState, useEffect } from 'react'

interface Product {
    id: number
    name: string
    brand?: string
    amazonAsin?: string
}

interface AmazonResult {
    asin: string
    title: string
    price?: string
    imageUrl?: string
    url: string
    rating?: string
    reviews?: number
}

interface LookupResponse {
    success: boolean
    results?: AmazonResult[]
    searchQuery?: string
    error?: string
}

type LookupStep = 'idle' | 'loading' | 'searching' | 'results' | 'error'

const AmazonProductLookup: React.FC = () => {
    const [products, setProducts] = useState<Product[]>([])
    const [selectedId, setSelectedId] = useState<number | null>(null)
    const [step, setStep] = useState<LookupStep>('idle')
    const [results, setResults] = useState<AmazonResult[]>([])
    const [searchQuery, setSearchQuery] = useState<string>('')
    const [error, setError] = useState<string | null>(null)
    const [applying, setApplying] = useState<string | null>(null)
    const [applied, setApplied] = useState<string | null>(null)

    // Fetch products on mount
    useEffect(() => {
        const fetchProducts = async () => {
            setStep('loading')
            try {
                const response = await fetch('/api/products?limit=100&sort=-createdAt&where[status][not_equals]=ai_draft')
                const data = await response.json()
                setProducts(data.docs || [])
                setStep('idle')
            } catch (err) {
                setStep('error')
                setError('Failed to load products')
            }
        }
        fetchProducts()
    }, [])

    const handleSearch = async () => {
        if (!selectedId) return

        setStep('searching')
        setError(null)
        setResults([])
        setApplied(null)

        try {
            const response = await fetch('/api/product/amazon-lookup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ productId: selectedId }),
            })

            const data: LookupResponse = await response.json()

            if (data.success && data.results) {
                setStep('results')
                setResults(data.results)
                setSearchQuery(data.searchQuery || '')
            } else {
                setStep('error')
                setError(data.error || 'Search failed')
            }
        } catch (err) {
            setStep('error')
            setError(err instanceof Error ? err.message : 'Network error')
        }
    }

    const handleApply = async (result: AmazonResult) => {
        if (!selectedId) return

        setApplying(result.asin)

        try {
            const response = await fetch('/api/product/amazon-lookup', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    productId: selectedId,
                    asin: result.asin,
                }),
            })

            const data = await response.json()

            if (data.success) {
                setApplied(result.asin)
                // Update local products list
                setProducts(products.map(p =>
                    p.id === selectedId ? { ...p, amazonAsin: result.asin } : p
                ))
            } else {
                setError(data.error || 'Failed to apply ASIN')
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Network error')
        } finally {
            setApplying(null)
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
                <span style={{ fontSize: '24px' }}>🛒</span>
                <div>
                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Amazon Product Lookup</h3>
                    <p style={{ margin: 0, fontSize: '14px', color: '#6e6e73' }}>
                        Find & link Amazon products for affiliate links
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
                                setResults([])
                                setApplied(null)
                                setStep('idle')
                            }}
                            disabled={step === 'searching'}
                            style={{
                                width: '100%',
                                padding: '10px 14px',
                                borderRadius: '6px',
                                border: '1px solid #d1d1d6',
                                fontSize: '14px',
                                boxSizing: 'border-box',
                                color: '#1f2937',
                                backgroundColor: '#fff',
                            }}
                        >
                            <option value="">Choose a product...</option>
                            {products.map((product) => (
                                <option key={product.id} value={product.id}>
                                    {product.name} {product.brand ? `(${product.brand})` : ''}
                                    {product.amazonAsin ? ' ✓ ASIN' : ' ⚠️ No ASIN'}
                                </option>
                            ))}
                        </select>
                        <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#86868b' }}>
                            ✓ = has ASIN (direct link), ⚠️ = needs ASIN (search link only)
                        </p>
                    </div>

                    {selectedProduct && (
                        <div style={{
                            padding: '12px',
                            background: '#f3f4f6',
                            borderRadius: '6px',
                            marginBottom: '16px',
                            fontSize: '13px'
                        }}>
                            <strong>Selected:</strong> {selectedProduct.name}
                            {selectedProduct.brand && <span> by {selectedProduct.brand}</span>}
                            {selectedProduct.amazonAsin && (
                                <div style={{ marginTop: '4px', color: '#059669' }}>
                                    Current ASIN: {selectedProduct.amazonAsin}
                                </div>
                            )}
                        </div>
                    )}

                    <button
                        onClick={handleSearch}
                        disabled={!selectedId || step === 'searching'}
                        style={{
                            width: '100%',
                            padding: '12px',
                            background: step === 'searching' ? '#86868b' : '#f97316',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '14px',
                            fontWeight: 600,
                            cursor: !selectedId || step === 'searching' ? 'not-allowed' : 'pointer',
                        }}
                    >
                        {step === 'searching' ? '⏳ Searching Amazon...' : '🔍 Search Amazon Products'}
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

            {results.length > 0 && (
                <div style={{ marginTop: '16px' }}>
                    <div style={{
                        padding: '8px 12px',
                        background: '#dbeafe',
                        borderRadius: '6px',
                        marginBottom: '12px',
                        fontSize: '13px',
                        color: '#1e40af'
                    }}>
                        Found {results.length} results for "{searchQuery}"
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {results.map((result) => (
                            <div
                                key={result.asin}
                                style={{
                                    padding: '12px',
                                    background: applied === result.asin ? '#d1fae5' : '#f9fafb',
                                    border: applied === result.asin ? '2px solid #10b981' : '1px solid #e5e7eb',
                                    borderRadius: '8px',
                                }}
                            >
                                <div style={{ display: 'flex', gap: '12px' }}>
                                    {result.imageUrl && (
                                        <img
                                            src={result.imageUrl}
                                            alt={result.title}
                                            style={{
                                                width: '80px',
                                                height: '80px',
                                                objectFit: 'contain',
                                                borderRadius: '6px',
                                                background: '#fff',
                                                border: '1px solid #e5e7eb'
                                            }}
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).style.display = 'none'
                                            }}
                                        />
                                    )}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <h4 style={{
                                            margin: '0 0 4px 0',
                                            fontSize: '14px',
                                            fontWeight: 600,
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            display: '-webkit-box',
                                            WebkitLineClamp: 2,
                                            WebkitBoxOrient: 'vertical'
                                        }}>
                                            {result.title}
                                        </h4>
                                        <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
                                            <strong>ASIN:</strong> {result.asin}
                                        </div>
                                        {result.price && (
                                            <div style={{ fontSize: '16px', fontWeight: 700, color: '#059669' }}>
                                                {result.price}
                                            </div>
                                        )}
                                        {result.rating && (
                                            <div style={{ fontSize: '12px', color: '#6b7280' }}>
                                                ⭐ {result.rating} {result.reviews && `(${result.reviews.toLocaleString()} reviews)`}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                                    {applied === result.asin ? (
                                        <div style={{
                                            flex: 1,
                                            padding: '8px',
                                            background: '#10b981',
                                            color: '#fff',
                                            borderRadius: '6px',
                                            fontSize: '13px',
                                            fontWeight: 600,
                                            textAlign: 'center'
                                        }}>
                                            ✓ ASIN Applied!
                                        </div>
                                    ) : (
                                        <>
                                            <button
                                                onClick={() => handleApply(result)}
                                                disabled={applying === result.asin}
                                                style={{
                                                    flex: 1,
                                                    padding: '8px',
                                                    background: applying === result.asin ? '#86868b' : '#10b981',
                                                    color: '#fff',
                                                    border: 'none',
                                                    borderRadius: '6px',
                                                    fontSize: '13px',
                                                    fontWeight: 600,
                                                    cursor: applying === result.asin ? 'not-allowed' : 'pointer',
                                                }}
                                            >
                                                {applying === result.asin ? 'Applying...' : '✓ Use This Product'}
                                            </button>
                                            <a
                                                href={result.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                style={{
                                                    padding: '8px 12px',
                                                    background: '#e5e7eb',
                                                    color: '#374151',
                                                    border: 'none',
                                                    borderRadius: '6px',
                                                    fontSize: '13px',
                                                    fontWeight: 500,
                                                    textDecoration: 'none',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '4px'
                                                }}
                                            >
                                                View ↗
                                            </a>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

export default AmazonProductLookup
