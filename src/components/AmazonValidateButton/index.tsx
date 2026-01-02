'use client'

import React, { useState } from 'react'
import { useFormFields, useDocumentInfo } from '@payloadcms/ui'

/**
 * Amazon Link Validation Button Component
 *
 * Inline UI component that appears in the product editor sidebar.
 * Validates Amazon product links by checking if the page exists.
 *
 * NOTE: After adding/modifying this component, run: pnpm payload generate:importmap
 */
const AmazonValidateButton: React.FC<any> = () => {
    const [isLoading, setIsLoading] = useState(false)
    const [result, setResult] = useState<{
        status: 'valid' | 'invalid'
        error?: string
        url?: string
        linkType?: 'direct' | 'search'
    } | null>(null)

    // Get document info for the product ID
    const { id: productId } = useDocumentInfo()

    // Watch relevant fields
    const amazonAsinField = useFormFields(([fields]) => fields.amazonAsin)
    const amazonLinkStatusField = useFormFields(([fields]) => fields.amazonLinkStatus)
    const amazonLinkLastCheckedField = useFormFields(([fields]) => fields.amazonLinkLastChecked)
    const amazonLinkErrorField = useFormFields(([fields]) => fields.amazonLinkError)
    const brandField = useFormFields(([fields]) => fields.brand)
    const nameField = useFormFields(([fields]) => fields.name)

    // Extract values
    const asin = amazonAsinField?.value as string | null
    const currentStatus = amazonLinkStatusField?.value as string
    const lastChecked = amazonLinkLastCheckedField?.value as string | null
    const lastError = amazonLinkErrorField?.value as string | null
    const brand = brandField?.value as string || ''
    const productName = nameField?.value as string || ''

    // Format the last checked date
    const formatDate = (dateStr: string | null): string => {
        if (!dateStr) return 'Never'
        try {
            return new Date(dateStr).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
            })
        } catch {
            return 'Unknown'
        }
    }

    // Handle validation
    const handleValidate = async () => {
        if (!productId) {
            setResult({ status: 'invalid', error: 'Please save the product first' })
            return
        }

        setIsLoading(true)
        setResult(null)

        try {
            const response = await fetch('/api/amazon/validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ productId }),
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || 'Validation failed')
            }

            if (data.results?.length > 0) {
                const productResult = data.results[0]
                setResult({
                    status: productResult.status,
                    error: productResult.error,
                    url: productResult.url,
                    linkType: productResult.linkType,
                })

                // Reload the page to show updated status
                if (productResult.status === 'valid' || productResult.status === 'invalid') {
                    setTimeout(() => {
                        window.location.reload()
                    }, 2000)
                }
            }
        } catch (err) {
            setResult({
                status: 'invalid',
                error: err instanceof Error ? err.message : 'Validation failed',
            })
        } finally {
            setIsLoading(false)
        }
    }

    // Generate preview URL
    const getPreviewUrl = (): string => {
        if (asin) {
            return `https://www.amazon.com/dp/${asin.toUpperCase()}`
        }
        const searchTerms = `${brand} ${productName}`.trim()
        return `https://www.amazon.com/s?k=${encodeURIComponent(searchTerms)}`
    }

    // Status colors and icons
    const getStatusStyle = () => {
        if (result?.status === 'valid' || currentStatus === 'valid') {
            return { bg: '#d1fae5', border: '#6ee7b7', color: '#047857', icon: '✓' }
        }
        if (result?.status === 'invalid' || currentStatus === 'invalid') {
            return { bg: '#fee2e2', border: '#fca5a5', color: '#dc2626', icon: '✗' }
        }
        return { bg: '#fef3c7', border: '#fcd34d', color: '#92400e', icon: '?' }
    }

    const style = getStatusStyle()

    return (
        <div
            style={{
                padding: '12px 16px',
                background: style.bg,
                borderRadius: '8px',
                border: `1px solid ${style.border}`,
                marginTop: '8px',
            }}
        >
            {/* Header */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '8px',
                    marginBottom: '8px',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '18px' }}>{style.icon}</span>
                    <span style={{ fontWeight: 600, fontSize: '14px', color: style.color }}>
                        Amazon Link Validation
                    </span>
                    {asin && (
                        <span
                            style={{
                                fontSize: '11px',
                                color: '#6b7280',
                                background: 'rgba(0,0,0,0.05)',
                                padding: '2px 6px',
                                borderRadius: '4px',
                            }}
                        >
                            ASIN: {asin}
                        </span>
                    )}
                </div>

                <button
                    onClick={handleValidate}
                    disabled={isLoading || !productId}
                    style={{
                        padding: '6px 14px',
                        background: isLoading ? '#9ca3af' : '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: isLoading || !productId ? 'not-allowed' : 'pointer',
                        fontWeight: 500,
                        fontSize: '13px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                    }}
                >
                    {isLoading ? (
                        <>
                            <span
                                style={{
                                    display: 'inline-block',
                                    width: '12px',
                                    height: '12px',
                                    border: '2px solid #fff',
                                    borderTopColor: 'transparent',
                                    borderRadius: '50%',
                                    animation: 'spin 1s linear infinite',
                                }}
                            />
                            Validating...
                        </>
                    ) : (
                        'Validate Link'
                    )}
                </button>
            </div>

            {/* Status Info */}
            <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>
                <div>
                    <strong>Status:</strong>{' '}
                    <span style={{ color: style.color, fontWeight: 500 }}>
                        {result?.status || currentStatus || 'Unchecked'}
                    </span>
                </div>
                <div>
                    <strong>Last Checked:</strong> {formatDate(lastChecked)}
                </div>
                <div>
                    <strong>Link Type:</strong> {asin ? 'Direct (ASIN)' : 'Search'}
                </div>
            </div>

            {/* Preview Link */}
            <div style={{ marginBottom: '8px' }}>
                <a
                    href={getPreviewUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                        fontSize: '12px',
                        color: '#2563eb',
                        textDecoration: 'underline',
                        wordBreak: 'break-all',
                    }}
                >
                    {getPreviewUrl()}
                </a>
            </div>

            {/* Result message */}
            {result && (
                <div
                    style={{
                        padding: '8px 12px',
                        background: result.status === 'valid' ? '#d1fae5' : '#fee2e2',
                        color: result.status === 'valid' ? '#047857' : '#dc2626',
                        borderRadius: '4px',
                        fontSize: '13px',
                        marginTop: '8px',
                    }}
                >
                    {result.status === 'valid' ? (
                        <>✓ Link validated successfully! Reloading...</>
                    ) : (
                        <>✗ {result.error || 'Validation failed'}</>
                    )}
                </div>
            )}

            {/* Last error if exists */}
            {lastError && !result && (
                <div
                    style={{
                        padding: '8px 12px',
                        background: '#fee2e2',
                        color: '#dc2626',
                        borderRadius: '4px',
                        fontSize: '12px',
                        marginTop: '8px',
                    }}
                >
                    Last error: {lastError}
                </div>
            )}

            {!productId && (
                <div
                    style={{
                        marginTop: '8px',
                        fontSize: '12px',
                        color: '#92400e',
                    }}
                >
                    Save the product first to enable validation
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

export default AmazonValidateButton
