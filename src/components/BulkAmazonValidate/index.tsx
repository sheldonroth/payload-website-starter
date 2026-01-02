'use client'

import React, { useState } from 'react'

interface ValidationResult {
    productId: number
    productName: string
    asin: string | null
    linkType: 'direct' | 'search'
    status: 'valid' | 'invalid'
    error?: string
    url: string
}

interface ValidateResponse {
    success: boolean
    validated: number
    valid: number
    invalid: number
    results: ValidationResult[]
    papiAvailable: boolean
}

/**
 * Bulk Amazon Link Validation Component
 *
 * Validates Amazon links for all products with ASINs.
 * Shows progress and results summary.
 */
const BulkAmazonValidate: React.FC = () => {
    const [isLoading, setIsLoading] = useState(false)
    const [progress, setProgress] = useState<string | null>(null)
    const [result, setResult] = useState<ValidateResponse | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [showDetails, setShowDetails] = useState(false)

    const handleValidateAll = async () => {
        setIsLoading(true)
        setProgress('Starting validation...')
        setResult(null)
        setError(null)

        try {
            const response = await fetch('/api/amazon/validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ validateAll: true, limit: 100 }),
            })

            const data: ValidateResponse = await response.json()

            if (!response.ok) {
                throw new Error((data as any).error || 'Validation failed')
            }

            setResult(data)
            setProgress(null)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Validation failed')
            setProgress(null)
        } finally {
            setIsLoading(false)
        }
    }

    const handleValidateUnchecked = async () => {
        setIsLoading(true)
        setProgress('Validating unchecked products...')
        setResult(null)
        setError(null)

        try {
            // First get count of unchecked products
            const response = await fetch('/api/amazon/validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ validateAll: true, limit: 50 }),
            })

            const data: ValidateResponse = await response.json()

            if (!response.ok) {
                throw new Error((data as any).error || 'Validation failed')
            }

            setResult(data)
            setProgress(null)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Validation failed')
            setProgress(null)
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div
            style={{
                background: '#fff',
                borderRadius: '12px',
                border: '1px solid #e5e7eb',
                padding: '20px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            }}
        >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <span style={{ fontSize: '24px' }}>🔗</span>
                <div>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#1f2937' }}>
                        Bulk Amazon Validation
                    </h3>
                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#6b7280' }}>
                        Validate Amazon links for all products
                    </p>
                </div>
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                <button
                    onClick={handleValidateUnchecked}
                    disabled={isLoading}
                    style={{
                        padding: '10px 16px',
                        background: isLoading ? '#9ca3af' : '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: isLoading ? 'not-allowed' : 'pointer',
                        fontWeight: 500,
                        fontSize: '14px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                    }}
                >
                    {isLoading ? (
                        <>
                            <span
                                style={{
                                    display: 'inline-block',
                                    width: '14px',
                                    height: '14px',
                                    border: '2px solid #fff',
                                    borderTopColor: 'transparent',
                                    borderRadius: '50%',
                                    animation: 'spin 1s linear infinite',
                                }}
                            />
                            Validating...
                        </>
                    ) : (
                        <>Validate Unchecked</>
                    )}
                </button>

                <button
                    onClick={handleValidateAll}
                    disabled={isLoading}
                    style={{
                        padding: '10px 16px',
                        background: isLoading ? '#9ca3af' : '#6b7280',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: isLoading ? 'not-allowed' : 'pointer',
                        fontWeight: 500,
                        fontSize: '14px',
                    }}
                >
                    Re-validate All
                </button>
            </div>

            {/* Progress */}
            {progress && (
                <div
                    style={{
                        padding: '12px',
                        background: '#eff6ff',
                        borderRadius: '8px',
                        color: '#1d4ed8',
                        fontSize: '13px',
                        marginBottom: '16px',
                    }}
                >
                    {progress}
                </div>
            )}

            {/* Error */}
            {error && (
                <div
                    style={{
                        padding: '12px',
                        background: '#fee2e2',
                        borderRadius: '8px',
                        color: '#dc2626',
                        fontSize: '13px',
                        marginBottom: '16px',
                    }}
                >
                    ❌ {error}
                </div>
            )}

            {/* Results Summary */}
            {result && (
                <div>
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(3, 1fr)',
                            gap: '12px',
                            marginBottom: '16px',
                        }}
                    >
                        <div
                            style={{
                                padding: '12px',
                                background: '#f3f4f6',
                                borderRadius: '8px',
                                textAlign: 'center',
                            }}
                        >
                            <div style={{ fontSize: '24px', fontWeight: 700, color: '#1f2937' }}>
                                {result.validated}
                            </div>
                            <div style={{ fontSize: '12px', color: '#6b7280' }}>Validated</div>
                        </div>
                        <div
                            style={{
                                padding: '12px',
                                background: '#d1fae5',
                                borderRadius: '8px',
                                textAlign: 'center',
                            }}
                        >
                            <div style={{ fontSize: '24px', fontWeight: 700, color: '#047857' }}>
                                {result.valid}
                            </div>
                            <div style={{ fontSize: '12px', color: '#047857' }}>Valid</div>
                        </div>
                        <div
                            style={{
                                padding: '12px',
                                background: '#fee2e2',
                                borderRadius: '8px',
                                textAlign: 'center',
                            }}
                        >
                            <div style={{ fontSize: '24px', fontWeight: 700, color: '#dc2626' }}>
                                {result.invalid}
                            </div>
                            <div style={{ fontSize: '12px', color: '#dc2626' }}>Invalid</div>
                        </div>
                    </div>

                    {/* PA-API Status */}
                    <div
                        style={{
                            padding: '8px 12px',
                            background: result.papiAvailable ? '#d1fae5' : '#fef3c7',
                            borderRadius: '6px',
                            fontSize: '12px',
                            color: result.papiAvailable ? '#047857' : '#92400e',
                            marginBottom: '12px',
                        }}
                    >
                        {result.papiAvailable
                            ? '✓ Using Amazon PA-API for validation'
                            : '⚠️ Using HTTP check (PA-API not configured)'}
                    </div>

                    {/* Toggle Details */}
                    {result.results.length > 0 && (
                        <button
                            onClick={() => setShowDetails(!showDetails)}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: '#3b82f6',
                                cursor: 'pointer',
                                fontSize: '13px',
                                padding: 0,
                                textDecoration: 'underline',
                            }}
                        >
                            {showDetails ? 'Hide Details' : 'Show Details'}
                        </button>
                    )}

                    {/* Details Table */}
                    {showDetails && result.results.length > 0 && (
                        <div
                            style={{
                                marginTop: '12px',
                                maxHeight: '300px',
                                overflowY: 'auto',
                                border: '1px solid #e5e7eb',
                                borderRadius: '8px',
                            }}
                        >
                            <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ background: '#f9fafb' }}>
                                        <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Product</th>
                                        <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Type</th>
                                        <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Status</th>
                                        <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Error</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {result.results.map((r) => (
                                        <tr key={r.productId} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                            <td style={{ padding: '8px' }}>
                                                <a
                                                    href={`/admin/collections/products/${r.productId}`}
                                                    style={{ color: '#3b82f6', textDecoration: 'none' }}
                                                >
                                                    {r.productName}
                                                </a>
                                            </td>
                                            <td style={{ padding: '8px' }}>
                                                <span
                                                    style={{
                                                        padding: '2px 6px',
                                                        background: r.linkType === 'direct' ? '#dbeafe' : '#fef3c7',
                                                        borderRadius: '4px',
                                                        fontSize: '11px',
                                                    }}
                                                >
                                                    {r.linkType}
                                                </span>
                                            </td>
                                            <td style={{ padding: '8px' }}>
                                                <span
                                                    style={{
                                                        color: r.status === 'valid' ? '#047857' : '#dc2626',
                                                        fontWeight: 500,
                                                    }}
                                                >
                                                    {r.status === 'valid' ? '✓' : '✗'} {r.status}
                                                </span>
                                            </td>
                                            <td style={{ padding: '8px', color: '#dc2626' }}>
                                                {r.error || '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            <style>{`
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    )
}

export default BulkAmazonValidate
