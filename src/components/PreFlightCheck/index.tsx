'use client'

import React, { useState, useEffect } from 'react'

interface Ingredient {
    id: number
    name: string
    verdict: 'safe' | 'caution' | 'avoid' | 'unknown'
}

interface Conflict {
    message: string
    severity: 'error' | 'warning'
}

interface PreFlightData {
    productId: number
    productName: string
    brand?: string
    verdict: string
    autoVerdict?: string
    verdictOverride: boolean
    verdictOverrideReason?: string
    ingredients: Ingredient[]
    conflicts: Conflict[]
    canPublish: boolean
    missingFields: string[]
    imageUrl?: string
    category?: string
}

interface PreFlightCheckProps {
    productId: number
    onClose: () => void
    onConfirm: () => void
}

const VERDICT_STYLES = {
    recommend: { bg: '#dcfce7', border: '#86efac', text: '#166534', icon: '&#x2705;', label: 'RECOMMEND' },
    caution: { bg: '#fef3c7', border: '#fcd34d', text: '#92400e', icon: '&#x26A0;&#xFE0F;', label: 'CAUTION' },
    avoid: { bg: '#fee2e2', border: '#fca5a5', text: '#991b1b', icon: '&#x1F6AB;', label: 'AVOID' },
    pending: { bg: '#f3f4f6', border: '#d1d5db', text: '#6b7280', icon: '&#x23F3;', label: 'PENDING' },
}

const INGREDIENT_VERDICT_STYLES = {
    safe: { bg: '#dcfce7', text: '#166534' },
    caution: { bg: '#fef3c7', text: '#92400e' },
    avoid: { bg: '#fee2e2', text: '#991b1b' },
    unknown: { bg: '#f3f4f6', text: '#6b7280' },
}

const PreFlightCheck: React.FC<PreFlightCheckProps> = ({ productId, onClose, onConfirm }) => {
    const [data, setData] = useState<PreFlightData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [publishing, setPublishing] = useState(false)

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await fetch(`/api/products/${productId}?depth=2`)
                const product = await response.json()

                // Extract ingredient details
                const ingredients: Ingredient[] = (product.ingredientsList || []).map((ing: any) => ({
                    id: ing.id,
                    name: ing.name,
                    verdict: ing.verdict || 'unknown',
                }))

                // Parse conflicts
                const conflicts: Conflict[] = []
                if (product.conflicts?.detected) {
                    for (const msg of product.conflicts.detected) {
                        const severity = msg.includes('&#x1F6AB;') || msg.includes('error') ? 'error' : 'warning'
                        conflicts.push({ message: msg, severity })
                    }
                }

                // Check for verdict/ingredient mismatch
                const hasAvoidIngredient = ingredients.some(i => i.verdict === 'avoid')
                if (hasAvoidIngredient && product.verdict === 'recommend' && !product.verdictOverride) {
                    conflicts.push({
                        message: 'Product marked RECOMMEND but contains AVOID ingredients',
                        severity: 'error',
                    })
                }

                // Check missing fields
                const missingFields: string[] = []
                if (!product.name) missingFields.push('Product Name')
                if (!product.brand) missingFields.push('Brand')
                if (!product.verdict || product.verdict === 'pending') missingFields.push('Verdict')
                if (!product.summary) missingFields.push('Summary')

                const hasErrors = conflicts.some(c => c.severity === 'error')
                const canPublish = !hasErrors && missingFields.length === 0

                setData({
                    productId: product.id,
                    productName: product.name,
                    brand: product.brand,
                    verdict: product.verdict,
                    autoVerdict: product.autoVerdict,
                    verdictOverride: product.verdictOverride,
                    verdictOverrideReason: product.verdictOverrideReason,
                    ingredients,
                    conflicts,
                    canPublish,
                    missingFields,
                    imageUrl: product.imageUrl,
                    category: product.category?.name,
                })
            } catch (err) {
                setError('Failed to load product data')
            } finally {
                setLoading(false)
            }
        }

        fetchData()
    }, [productId])

    const handlePublish = async () => {
        if (!data?.canPublish) return

        setPublishing(true)
        try {
            await fetch(`/api/products/${productId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'published' }),
            })
            onConfirm()
        } catch (err) {
            setError('Failed to publish')
            setPublishing(false)
        }
    }

    const verdictStyle = data ? VERDICT_STYLES[data.verdict as keyof typeof VERDICT_STYLES] || VERDICT_STYLES.pending : VERDICT_STYLES.pending

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0, 0, 0, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10000,
                padding: '20px',
            }}
            onClick={onClose}
        >
            <div
                style={{
                    background: '#fff',
                    borderRadius: '16px',
                    width: '100%',
                    maxWidth: '600px',
                    maxHeight: '90vh',
                    overflow: 'auto',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div
                    style={{
                        padding: '20px 24px',
                        borderBottom: '1px solid #e5e7eb',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '24px' }}>&#x1F6EB;</span>
                        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#111827' }}>
                            Pre-Flight Check
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'none',
                            border: 'none',
                            fontSize: '24px',
                            color: '#9ca3af',
                            cursor: 'pointer',
                            padding: '4px',
                        }}
                    >
                        &#x2715;
                    </button>
                </div>

                {/* Content */}
                <div style={{ padding: '24px' }}>
                    {loading && (
                        <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                            Loading pre-flight data...
                        </div>
                    )}

                    {error && (
                        <div style={{ padding: '16px', background: '#fef2f2', color: '#dc2626', borderRadius: '8px' }}>
                            {error}
                        </div>
                    )}

                    {data && (
                        <>
                            {/* Product Summary */}
                            <div
                                style={{
                                    display: 'flex',
                                    gap: '16px',
                                    marginBottom: '24px',
                                    padding: '16px',
                                    background: '#f9fafb',
                                    borderRadius: '12px',
                                }}
                            >
                                {data.imageUrl && (
                                    <img
                                        src={data.imageUrl}
                                        alt={data.productName}
                                        style={{
                                            width: '80px',
                                            height: '80px',
                                            borderRadius: '8px',
                                            objectFit: 'cover',
                                        }}
                                    />
                                )}
                                <div>
                                    <h3 style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: 600 }}>
                                        {data.productName}
                                    </h3>
                                    {data.brand && (
                                        <p style={{ margin: '0 0 8px', fontSize: '14px', color: '#6b7280' }}>
                                            {data.brand}
                                        </p>
                                    )}
                                    {data.category && (
                                        <span style={{ fontSize: '12px', color: '#9ca3af' }}>
                                            &#x1F4C1; {data.category}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Verdict Section */}
                            <div style={{ marginBottom: '24px' }}>
                                <h4 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 600, color: '#374151', textTransform: 'uppercase' }}>
                                    Verdict
                                </h4>
                                <div
                                    style={{
                                        padding: '16px',
                                        background: verdictStyle.bg,
                                        border: `2px solid ${verdictStyle.border}`,
                                        borderRadius: '10px',
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                        <span
                                            style={{ fontSize: '24px' }}
                                            dangerouslySetInnerHTML={{ __html: verdictStyle.icon }}
                                        />
                                        <span style={{ fontSize: '20px', fontWeight: 700, color: verdictStyle.text }}>
                                            {verdictStyle.label}
                                        </span>
                                    </div>

                                    {data.verdictOverride && (
                                        <div style={{
                                            marginTop: '8px',
                                            padding: '8px 12px',
                                            background: 'rgba(0,0,0,0.05)',
                                            borderRadius: '6px',
                                            fontSize: '13px',
                                        }}>
                                            <strong>&#x270D;&#xFE0F; Manual Override</strong>
                                            {data.autoVerdict && data.autoVerdict !== data.verdict && (
                                                <span style={{ color: '#6b7280', marginLeft: '8px' }}>
                                                    (Auto: {data.autoVerdict.toUpperCase()})
                                                </span>
                                            )}
                                            {data.verdictOverrideReason && (
                                                <p style={{ margin: '6px 0 0', color: '#4b5563' }}>
                                                    {data.verdictOverrideReason}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Ingredients Section */}
                            {data.ingredients.length > 0 && (
                                <div style={{ marginBottom: '24px' }}>
                                    <h4 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 600, color: '#374151', textTransform: 'uppercase' }}>
                                        Linked Ingredients ({data.ingredients.length})
                                    </h4>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                        {data.ingredients.map((ing) => {
                                            const style = INGREDIENT_VERDICT_STYLES[ing.verdict]
                                            return (
                                                <span
                                                    key={ing.id}
                                                    style={{
                                                        padding: '4px 10px',
                                                        background: style.bg,
                                                        color: style.text,
                                                        fontSize: '13px',
                                                        fontWeight: 500,
                                                        borderRadius: '6px',
                                                    }}
                                                >
                                                    {ing.name}
                                                </span>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Missing Fields */}
                            {data.missingFields.length > 0 && (
                                <div
                                    style={{
                                        marginBottom: '24px',
                                        padding: '16px',
                                        background: '#fef3c7',
                                        border: '1px solid #fcd34d',
                                        borderRadius: '10px',
                                    }}
                                >
                                    <h4 style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: 600, color: '#92400e' }}>
                                        &#x26A0;&#xFE0F; Missing Required Fields
                                    </h4>
                                    <ul style={{ margin: 0, paddingLeft: '20px', color: '#92400e', fontSize: '14px' }}>
                                        {data.missingFields.map((field) => (
                                            <li key={field}>{field}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Conflicts Section */}
                            {data.conflicts.length > 0 && (
                                <div style={{ marginBottom: '24px' }}>
                                    <h4 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 600, color: '#374151', textTransform: 'uppercase' }}>
                                        Conflicts ({data.conflicts.length})
                                    </h4>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {data.conflicts.map((conflict, i) => (
                                            <div
                                                key={i}
                                                style={{
                                                    padding: '12px 16px',
                                                    background: conflict.severity === 'error' ? '#fee2e2' : '#fef3c7',
                                                    border: `1px solid ${conflict.severity === 'error' ? '#fca5a5' : '#fcd34d'}`,
                                                    borderRadius: '8px',
                                                    fontSize: '14px',
                                                    color: conflict.severity === 'error' ? '#991b1b' : '#92400e',
                                                }}
                                            >
                                                {conflict.severity === 'error' ? '&#x1F6AB;' : '&#x26A0;&#xFE0F;'} {conflict.message}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* All Clear */}
                            {data.canPublish && data.conflicts.length === 0 && data.missingFields.length === 0 && (
                                <div
                                    style={{
                                        marginBottom: '24px',
                                        padding: '16px',
                                        background: '#dcfce7',
                                        border: '1px solid #86efac',
                                        borderRadius: '10px',
                                        textAlign: 'center',
                                    }}
                                >
                                    <span style={{ fontSize: '32px', display: 'block', marginBottom: '8px' }}>&#x2705;</span>
                                    <p style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#166534' }}>
                                        All checks passed! Ready to publish.
                                    </p>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer */}
                <div
                    style={{
                        padding: '16px 24px',
                        borderTop: '1px solid #e5e7eb',
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: '12px',
                        background: '#fafafa',
                    }}
                >
                    <button
                        onClick={onClose}
                        style={{
                            padding: '10px 20px',
                            background: '#fff',
                            color: '#374151',
                            border: '1px solid #d1d5db',
                            borderRadius: '8px',
                            fontSize: '14px',
                            fontWeight: 600,
                            cursor: 'pointer',
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handlePublish}
                        disabled={!data?.canPublish || publishing}
                        style={{
                            padding: '10px 24px',
                            background: data?.canPublish ? '#10b981' : '#9ca3af',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '14px',
                            fontWeight: 600,
                            cursor: data?.canPublish && !publishing ? 'pointer' : 'not-allowed',
                            opacity: publishing ? 0.7 : 1,
                        }}
                    >
                        {publishing ? 'Publishing...' : '&#x1F680; Publish'}
                    </button>
                </div>
            </div>
        </div>
    )
}

export default PreFlightCheck
