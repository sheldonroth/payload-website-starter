'use client'

import React, { useState, useEffect } from 'react'

interface Product {
    id: number
    name: string
    brand?: string
    status: string
}

interface SEOResult {
    metaTitle: string
    metaDescription: string
    keywords: string[]
    ogTitle: string
    ogDescription: string
}

interface GenerationResult {
    success: boolean
    itemName?: string
    seo?: SEOResult
    applied?: boolean
    error?: string
}

type GenerationStep = 'idle' | 'loading' | 'generating' | 'done' | 'error'

const SEOGenerator: React.FC = () => {
    const [products, setProducts] = useState<Product[]>([])
    const [selectedId, setSelectedId] = useState<number | null>(null)
    const [step, setStep] = useState<GenerationStep>('idle')
    const [result, setResult] = useState<GenerationResult | null>(null)
    const [error, setError] = useState<string | null>(null)

    // Fetch products on mount
    useEffect(() => {
        const fetchProducts = async () => {
            setStep('loading')
            try {
                const response = await fetch('/api/products?limit=50&sort=-createdAt')
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

    const handleGenerate = async () => {
        if (!selectedId) return

        setStep('generating')
        setError(null)
        setResult(null)

        try {
            const response = await fetch('/api/seo/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'product', id: selectedId }),
            })

            const data: GenerationResult = await response.json()

            if (data.success && data.seo) {
                setStep('done')
                setResult(data)
            } else {
                setStep('error')
                setError(data.error || 'Generation failed')
            }
        } catch (err) {
            setStep('error')
            setError(err instanceof Error ? err.message : 'Network error')
        }
    }

    const handleApply = async () => {
        if (!selectedId) return

        try {
            await fetch('/api/seo/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'product', id: selectedId, autoApply: true }),
            })
            // Update UI to show applied
            if (result) {
                setResult({ ...result, applied: true })
            }
        } catch (err) {
            setError('Failed to apply SEO data')
        }
    }

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text)
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <span style={{ fontSize: '24px' }}>🔍</span>
                <div>
                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>SEO Meta Generator</h3>
                    <p style={{ margin: 0, fontSize: '14px', color: '#6e6e73' }}>
                        AI-powered meta titles & descriptions
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
                            onChange={(e) => setSelectedId(Number(e.target.value) || null)}
                            disabled={step === 'generating'}
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
                                </option>
                            ))}
                        </select>
                    </div>

                    <button
                        onClick={handleGenerate}
                        disabled={!selectedId || step === 'generating'}
                        style={{
                            width: '100%',
                            padding: '12px',
                            background: step === 'generating' ? '#86868b' : '#8b5cf6',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '14px',
                            fontWeight: 600,
                            cursor: !selectedId || step === 'generating' ? 'not-allowed' : 'pointer',
                        }}
                    >
                        {step === 'generating' ? '⏳ Generating...' : '✨ Generate SEO Meta'}
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

            {result && result.success && result.seo && (
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
                            ✅ SEO Generated for "{result.itemName}"
                            {result.applied && <span style={{ marginLeft: '8px', fontSize: '12px' }}>• Applied!</span>}
                        </p>
                    </div>

                    {/* Meta Title */}
                    <div style={{ marginBottom: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <label style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>
                                Meta Title ({result.seo.metaTitle.length} chars)
                            </label>
                            <button
                                onClick={() => copyToClipboard(result.seo!.metaTitle)}
                                style={{ fontSize: '11px', color: '#8b5cf6', background: 'none', border: 'none', cursor: 'pointer' }}
                            >
                                Copy
                            </button>
                        </div>
                        <div style={{ padding: '10px', background: '#f9fafb', borderRadius: '6px', fontSize: '14px' }}>
                            {result.seo.metaTitle}
                        </div>
                    </div>

                    {/* Meta Description */}
                    <div style={{ marginBottom: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <label style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>
                                Meta Description ({result.seo.metaDescription.length} chars)
                            </label>
                            <button
                                onClick={() => copyToClipboard(result.seo!.metaDescription)}
                                style={{ fontSize: '11px', color: '#8b5cf6', background: 'none', border: 'none', cursor: 'pointer' }}
                            >
                                Copy
                            </button>
                        </div>
                        <div style={{ padding: '10px', background: '#f9fafb', borderRadius: '6px', fontSize: '14px' }}>
                            {result.seo.metaDescription}
                        </div>
                    </div>

                    {/* Keywords */}
                    <div style={{ marginBottom: '12px' }}>
                        <label style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                            Keywords
                        </label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {result.seo.keywords.map((kw, i) => (
                                <span
                                    key={i}
                                    style={{
                                        padding: '4px 10px',
                                        background: '#ede9fe',
                                        color: '#7c3aed',
                                        fontSize: '12px',
                                        borderRadius: '4px',
                                    }}
                                >
                                    {kw}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* OG Tags */}
                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                            Social Sharing (OG)
                        </label>
                        <div style={{ padding: '10px', background: '#f9fafb', borderRadius: '6px', fontSize: '13px' }}>
                            <p style={{ margin: '0 0 4px', fontWeight: 500 }}>{result.seo.ogTitle}</p>
                            <p style={{ margin: 0, color: '#6b7280' }}>{result.seo.ogDescription}</p>
                        </div>
                    </div>

                    {/* Copy All Button */}
                    <button
                        onClick={() => copyToClipboard(`Meta Title: ${result.seo!.metaTitle}\nMeta Description: ${result.seo!.metaDescription}\nKeywords: ${result.seo!.keywords.join(', ')}`)}
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
                        📋 Copy All SEO Data
                    </button>
                </div>
            )}
        </div>
    )
}

export default SEOGenerator
