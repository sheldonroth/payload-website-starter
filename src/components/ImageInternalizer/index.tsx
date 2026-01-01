'use client'

import React, { useState, useEffect, useCallback } from 'react'

interface InternalizeStatus {
    externalUrls: number
    internalImages: number
    noImage: number
}

interface ProcessingResult {
    productId: number
    productName: string
    success: boolean
    mediaId?: number
    error?: string
}

/**
 * Image Internalizer Component
 *
 * Dashboard tool to migrate external image URLs to internal Media storage.
 * Shows status and allows batch internalization.
 */
const ImageInternalizer: React.FC = () => {
    const [status, setStatus] = useState<InternalizeStatus | null>(null)
    const [loading, setLoading] = useState(true)
    const [processing, setProcessing] = useState(false)
    const [message, setMessage] = useState('')
    const [failedResults, setFailedResults] = useState<ProcessingResult[]>([])
    const [showDetails, setShowDetails] = useState(false)

    const fetchStatus = useCallback(async () => {
        try {
            const res = await fetch('/api/images/internalize/status')
            if (res.ok) {
                const data = await res.json()
                setStatus(data)
            }
        } catch (error) {
            console.error('Failed to fetch status:', error)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchStatus()
    }, [fetchStatus])

    const handleInternalize = async () => {
        if (!status || status.externalUrls === 0) return

        const confirmed = confirm(
            `Internalize ${status.externalUrls} external images?\n\nThis will download each image and store it in your Media library.`
        )
        if (!confirmed) return

        setProcessing(true)
        setMessage('Processing...')
        setFailedResults([])
        setShowDetails(false)

        try {
            const res = await fetch('/api/images/internalize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error || 'Internalization failed')
            }

            const failed = (data.results || []).filter((r: ProcessingResult) => !r.success)
            setFailedResults(failed)
            if (failed.length > 0) {
                setShowDetails(true)
            }

            const remainingMsg = data.remaining > 0 ? ` (${data.remaining} remaining - run again)` : ''
            setMessage(
                `Done: ${data.successCount} internalized, ${data.failureCount} failed${remainingMsg}`
            )

            // Refresh status
            fetchStatus()
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Internalization failed')
        } finally {
            setProcessing(false)
        }
    }

    if (loading) {
        return (
            <div style={{ padding: '12px', background: '#f0f9ff', borderRadius: '6px', fontSize: '13px' }}>
                Loading image status...
            </div>
        )
    }

    if (!status) {
        return (
            <div style={{ padding: '12px', background: '#fef2f2', borderRadius: '6px', fontSize: '13px' }}>
                Failed to load status
            </div>
        )
    }

    const hasExternalUrls = status.externalUrls > 0

    return (
        <div style={{ padding: '12px', background: '#f9fafb', borderRadius: '8px' }}>
            {/* Status display */}
            <div style={{ display: 'flex', gap: '16px', marginBottom: '12px', flexWrap: 'wrap' }}>
                <div style={{ fontSize: '13px' }}>
                    <span style={{ fontWeight: 600, color: hasExternalUrls ? '#dc2626' : '#059669' }}>
                        {status.externalUrls}
                    </span>{' '}
                    <span style={{ color: '#6b7280' }}>external URLs</span>
                </div>
                <div style={{ fontSize: '13px' }}>
                    <span style={{ fontWeight: 600, color: '#059669' }}>{status.internalImages}</span>{' '}
                    <span style={{ color: '#6b7280' }}>internal images</span>
                </div>
                <div style={{ fontSize: '13px' }}>
                    <span style={{ fontWeight: 600, color: '#9ca3af' }}>{status.noImage}</span>{' '}
                    <span style={{ color: '#6b7280' }}>no image</span>
                </div>
            </div>

            {/* Action button */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                    onClick={handleInternalize}
                    disabled={processing || !hasExternalUrls}
                    style={{
                        padding: '6px 12px',
                        background: processing || !hasExternalUrls ? '#9ca3af' : '#2563eb',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '13px',
                        fontWeight: 500,
                        cursor: processing || !hasExternalUrls ? 'not-allowed' : 'pointer',
                    }}
                >
                    {processing ? 'Processing...' : hasExternalUrls ? `Internalize ${status.externalUrls} Images` : 'All Images Internal ✓'}
                </button>

                <button
                    onClick={fetchStatus}
                    disabled={processing}
                    style={{
                        padding: '6px 12px',
                        background: '#fff',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '13px',
                        cursor: 'pointer',
                    }}
                >
                    Refresh
                </button>
            </div>

            {/* Message */}
            {message && (
                <div
                    style={{
                        marginTop: '12px',
                        padding: '8px 12px',
                        background: message.includes('failed') ? '#fee2e2' : '#d1fae5',
                        color: message.includes('failed') ? '#dc2626' : '#047857',
                        borderRadius: '6px',
                        fontSize: '13px',
                    }}
                >
                    {message}
                    {failedResults.length > 0 && (
                        <button
                            onClick={() => setShowDetails(!showDetails)}
                            style={{
                                marginLeft: '12px',
                                padding: '2px 8px',
                                background: 'transparent',
                                border: '1px solid currentColor',
                                borderRadius: '4px',
                                fontSize: '12px',
                                cursor: 'pointer',
                                color: 'inherit',
                            }}
                        >
                            {showDetails ? 'Hide Details' : 'Show Details'}
                        </button>
                    )}
                </div>
            )}

            {/* Error details */}
            {showDetails && failedResults.length > 0 && (
                <div
                    style={{
                        marginTop: '8px',
                        padding: '12px',
                        background: '#fef2f2',
                        border: '1px solid #fecaca',
                        borderRadius: '6px',
                        maxHeight: '150px',
                        overflowY: 'auto',
                    }}
                >
                    <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px', color: '#991b1b' }}>
                        Failed ({failedResults.length}):
                    </div>
                    {failedResults.map((result) => (
                        <div
                            key={result.productId}
                            style={{
                                padding: '4px 8px',
                                background: '#fff',
                                borderRadius: '4px',
                                marginBottom: '4px',
                                fontSize: '11px',
                            }}
                        >
                            <strong>#{result.productId}</strong>: {result.productName} — {result.error}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

export default ImageInternalizer
