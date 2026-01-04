'use client'

import React, { useState } from 'react'

interface ExtractedProduct {
    name: string
    brand?: string
    imageUrl?: string
    ingredients?: string
    summary?: string
    priceRange?: string
    sourceUrl?: string
}

interface CategorySuggestion {
    id: number | null
    name: string
    confidence: number
    reasoning: string
}

interface PreviewResult {
    success: boolean
    inputType: string
    product: ExtractedProduct | null
    suggestedCategory?: CategorySuggestion
    existingProduct?: {
        id: number
        name: string
        status: string
    }
    message: string
}

const FetchProduct: React.FC = () => {
    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(false)
    const [preview, setPreview] = useState<PreviewResult | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [creating, setCreating] = useState(false)
    const [created, setCreated] = useState<{ id: number; name: string } | null>(null)

    const handleFetch = async () => {
        if (!input.trim()) return

        setLoading(true)
        setError(null)
        setPreview(null)
        setCreated(null)

        try {
            const response = await fetch('/api/product/preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ input: input.trim() }),
            })

            const result: PreviewResult = await response.json()

            if (!response.ok || !result.success) {
                setError(result.message || 'Failed to fetch product data')
                return
            }

            setPreview(result)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch product')
        } finally {
            setLoading(false)
        }
    }

    const handleConfirm = async () => {
        if (!preview?.product) return

        setCreating(true)
        setError(null)

        try {
            const response = await fetch('/api/product/confirm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    product: preview.product,
                    categoryId: preview.suggestedCategory?.id,
                }),
            })

            const result = await response.json()

            if (!response.ok || !result.success) {
                setError(result.error || 'Failed to create product')
                return
            }

            setCreated({ id: result.productId, name: preview.product.name })
            setPreview(null)
            setInput('')
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create product')
        } finally {
            setCreating(false)
        }
    }

    const handleReset = () => {
        setInput('')
        setPreview(null)
        setError(null)
        setCreated(null)
    }

    return (
        <div
            style={{
                background: '#fff',
                borderRadius: '12px',
                border: '1px solid #e5e5e5',
                overflow: 'hidden',
                marginBottom: '24px',
            }}
        >
            {/* Header */}
            <div
                style={{
                    padding: '20px 24px',
                    borderBottom: '1px solid #e5e5e5',
                    background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '28px' }}>{'\u{1F4E6}'}</span>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0369a1' }}>
                            Fetch Product
                        </h3>
                        <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>
                            Enter a URL or barcode to preview and create a product
                        </p>
                    </div>
                </div>
            </div>

            {/* Input Section */}
            <div style={{ padding: '24px' }}>
                <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleFetch()}
                        placeholder="Paste Amazon URL, product page URL, or UPC barcode..."
                        disabled={loading}
                        style={{
                            flex: 1,
                            padding: '12px 16px',
                            border: '2px solid #e5e7eb',
                            borderRadius: '8px',
                            fontSize: '15px',
                            outline: 'none',
                            transition: 'border-color 0.2s',
                        }}
                    />
                    <button
                        onClick={handleFetch}
                        disabled={loading || !input.trim()}
                        style={{
                            padding: '12px 24px',
                            background: loading ? '#9ca3af' : '#0ea5e9',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '15px',
                            fontWeight: 600,
                            cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                        }}
                    >
                        {loading ? (
                            <>
                                <span style={{ animation: 'spin 1s linear infinite' }}>{'\u{1F504}'}</span>
                                Fetching...
                            </>
                        ) : (
                            <>
                                {'\u{1F50D}'} Fetch
                            </>
                        )}
                    </button>
                </div>

                {/* Examples */}
                <p style={{ margin: 0, fontSize: '12px', color: '#9ca3af' }}>
                    Examples: https://amazon.com/dp/B0123... | https://iherb.com/pr/... | 012345678901
                </p>
            </div>

            {/* Error State */}
            {error && (
                <div
                    style={{
                        margin: '0 24px 24px',
                        padding: '12px 16px',
                        background: '#fef2f2',
                        border: '1px solid #fecaca',
                        borderRadius: '8px',
                        color: '#dc2626',
                        fontSize: '14px',
                    }}
                >
                    {'\u{26A0}'} {error}
                </div>
            )}

            {/* Success State */}
            {created && (
                <div
                    style={{
                        margin: '0 24px 24px',
                        padding: '16px',
                        background: '#f0fdf4',
                        border: '1px solid #bbf7d0',
                        borderRadius: '8px',
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '24px' }}>{'\u{2705}'}</span>
                        <div style={{ flex: 1 }}>
                            <p style={{ margin: 0, fontWeight: 600, color: '#166534' }}>
                                Product Created!
                            </p>
                            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#6b7280' }}>
                                {created.name} is now in the AI Draft queue for review.
                            </p>
                        </div>
                        <a
                            href={`/admin/collections/products/${created.id}`}
                            style={{
                                padding: '8px 16px',
                                background: '#166534',
                                color: '#fff',
                                borderRadius: '6px',
                                textDecoration: 'none',
                                fontSize: '13px',
                                fontWeight: 600,
                            }}
                        >
                            View Product
                        </a>
                        <button
                            onClick={handleReset}
                            style={{
                                padding: '8px 16px',
                                background: 'transparent',
                                color: '#6b7280',
                                border: '1px solid #e5e7eb',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '13px',
                            }}
                        >
                            Fetch Another
                        </button>
                    </div>
                </div>
            )}

            {/* Existing Product Warning */}
            {preview?.existingProduct && (
                <div
                    style={{
                        margin: '0 24px 24px',
                        padding: '16px',
                        background: '#fefce8',
                        border: '1px solid #fde047',
                        borderRadius: '8px',
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '24px' }}>{'\u{1F4CB}'}</span>
                        <div style={{ flex: 1 }}>
                            <p style={{ margin: 0, fontWeight: 600, color: '#854d0e' }}>
                                Product Already Exists
                            </p>
                            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#6b7280' }}>
                                "{preview.existingProduct.name}" ({preview.existingProduct.status})
                            </p>
                        </div>
                        <a
                            href={`/admin/collections/products/${preview.existingProduct.id}`}
                            style={{
                                padding: '8px 16px',
                                background: '#854d0e',
                                color: '#fff',
                                borderRadius: '6px',
                                textDecoration: 'none',
                                fontSize: '13px',
                                fontWeight: 600,
                            }}
                        >
                            View Existing
                        </a>
                    </div>
                </div>
            )}

            {/* Preview Card */}
            {preview?.product && !preview.existingProduct && (
                <div
                    style={{
                        margin: '0 24px 24px',
                        border: '2px solid #e5e7eb',
                        borderRadius: '12px',
                        overflow: 'hidden',
                    }}
                >
                    {/* Preview Header */}
                    <div
                        style={{
                            padding: '12px 16px',
                            background: '#f9fafb',
                            borderBottom: '1px solid #e5e7eb',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                        }}
                    >
                        <span style={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>
                            {'\u{1F440}'} Preview
                        </span>
                        <span
                            style={{
                                padding: '4px 8px',
                                background: '#dbeafe',
                                color: '#1e40af',
                                fontSize: '11px',
                                fontWeight: 600,
                                borderRadius: '4px',
                                textTransform: 'uppercase',
                            }}
                        >
                            {preview.inputType}
                        </span>
                    </div>

                    {/* Product Info */}
                    <div style={{ padding: '20px', display: 'flex', gap: '20px' }}>
                        {/* Image */}
                        {preview.product.imageUrl && (
                            <div
                                style={{
                                    width: '120px',
                                    height: '120px',
                                    borderRadius: '8px',
                                    overflow: 'hidden',
                                    flexShrink: 0,
                                    background: '#f3f4f6',
                                }}
                            >
                                <img
                                    src={preview.product.imageUrl}
                                    alt={preview.product.name}
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        objectFit: 'cover',
                                    }}
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = 'none'
                                    }}
                                />
                            </div>
                        )}

                        {/* Details */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <h4
                                style={{
                                    margin: '0 0 8px',
                                    fontSize: '18px',
                                    fontWeight: 700,
                                    color: '#111827',
                                }}
                            >
                                {preview.product.name}
                            </h4>
                            {preview.product.brand && (
                                <p style={{ margin: '0 0 12px', fontSize: '14px', color: '#6b7280' }}>
                                    by <strong>{preview.product.brand}</strong>
                                    {preview.product.priceRange && (
                                        <span
                                            style={{
                                                marginLeft: '12px',
                                                padding: '2px 8px',
                                                background: '#f3f4f6',
                                                borderRadius: '4px',
                                                fontSize: '12px',
                                            }}
                                        >
                                            {preview.product.priceRange}
                                        </span>
                                    )}
                                </p>
                            )}

                            {preview.product.summary && (
                                <p
                                    style={{
                                        margin: '0 0 12px',
                                        fontSize: '13px',
                                        color: '#374151',
                                        lineHeight: 1.5,
                                    }}
                                >
                                    {preview.product.summary}
                                </p>
                            )}

                            {/* Category Suggestion */}
                            {preview.suggestedCategory && (
                                <div
                                    style={{
                                        padding: '12px',
                                        background: '#f0fdf4',
                                        borderRadius: '8px',
                                        marginTop: '12px',
                                    }}
                                >
                                    <div
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            marginBottom: '4px',
                                        }}
                                    >
                                        <span style={{ fontSize: '14px' }}>{'\u{1F916}'}</span>
                                        <span style={{ fontWeight: 600, color: '#166534', fontSize: '13px' }}>
                                            Suggested Category
                                        </span>
                                        <span
                                            style={{
                                                padding: '2px 6px',
                                                background:
                                                    preview.suggestedCategory.confidence >= 80
                                                        ? '#dcfce7'
                                                        : preview.suggestedCategory.confidence >= 60
                                                          ? '#fef9c3'
                                                          : '#fee2e2',
                                                color:
                                                    preview.suggestedCategory.confidence >= 80
                                                        ? '#166534'
                                                        : preview.suggestedCategory.confidence >= 60
                                                          ? '#854d0e'
                                                          : '#991b1b',
                                                fontSize: '11px',
                                                fontWeight: 600,
                                                borderRadius: '4px',
                                            }}
                                        >
                                            {preview.suggestedCategory.confidence}% confidence
                                        </span>
                                    </div>
                                    <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#111827' }}>
                                        {preview.suggestedCategory.name}
                                    </p>
                                    <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#6b7280' }}>
                                        {preview.suggestedCategory.reasoning}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Actions */}
                    <div
                        style={{
                            padding: '16px 20px',
                            background: '#f9fafb',
                            borderTop: '1px solid #e5e7eb',
                            display: 'flex',
                            justifyContent: 'flex-end',
                            gap: '12px',
                        }}
                    >
                        <button
                            onClick={handleReset}
                            style={{
                                padding: '10px 20px',
                                background: 'transparent',
                                color: '#6b7280',
                                border: '1px solid #e5e7eb',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '14px',
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={creating}
                            style={{
                                padding: '10px 24px',
                                background: creating ? '#9ca3af' : '#10b981',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: creating ? 'not-allowed' : 'pointer',
                                fontSize: '14px',
                                fontWeight: 600,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                            }}
                        >
                            {creating ? (
                                <>
                                    <span style={{ animation: 'spin 1s linear infinite' }}>{'\u{1F504}'}</span>
                                    Creating...
                                </>
                            ) : (
                                <>
                                    {'\u{2705}'} Confirm & Create
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}

export default FetchProduct
