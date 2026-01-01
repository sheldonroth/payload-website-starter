'use client'

import React, { useState } from 'react'
import { useDocumentInfo, useFormFields } from '@payloadcms/ui'

/**
 * Retry Image Search Button
 *
 * Allows re-searching for product images from the product editor.
 * Uses multiple sources (Google, Open Food Facts) and tries until one works.
 */
const RetryImageSearch: React.FC = () => {
    const { id } = useDocumentInfo()
    const [loading, setLoading] = useState(false)
    const [result, setResult] = useState<{
        success: boolean
        message: string
        source?: string
    } | null>(null)

    // Watch the image field to see if product already has an image
    const imageField = useFormFields(([fields]) => fields.image)
    const hasImage = !!imageField?.value

    const handleRetry = async () => {
        if (!id) return

        setLoading(true)
        setResult(null)

        try {
            const res = await fetch('/api/product/enrich', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    productId: id,
                    autoApply: true,
                }),
            })

            const data = await res.json()

            if (!res.ok) {
                setResult({
                    success: false,
                    message: data.error || 'Search failed',
                })
                return
            }

            if (data.mediaId) {
                setResult({
                    success: true,
                    message: `Found image from ${data.source}`,
                    source: data.source,
                })
                // Reload the page to show the new image
                setTimeout(() => window.location.reload(), 1500)
            } else {
                setResult({
                    success: false,
                    message: data.imageError || `Tried ${data.triedUrls} URLs, none worked`,
                })
            }
        } catch (error) {
            setResult({
                success: false,
                message: error instanceof Error ? error.message : 'Search failed',
            })
        } finally {
            setLoading(false)
        }
    }

    // Don't show if product already has an image (unless we want to allow replacement)
    if (hasImage) {
        return (
            <div style={{
                padding: '8px 12px',
                background: '#d1fae5',
                borderRadius: '6px',
                fontSize: '13px',
                color: '#047857',
            }}>
                ✓ Image attached
            </div>
        )
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button
                onClick={handleRetry}
                disabled={loading || !id}
                style={{
                    padding: '8px 16px',
                    background: loading ? '#9ca3af' : '#2563eb',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                }}
            >
                {loading ? (
                    <>
                        <span style={{ animation: 'spin 1s linear infinite' }}>⟳</span>
                        Searching multiple sources...
                    </>
                ) : (
                    <>
                        🔍 Find Image (Google + Open Food Facts)
                    </>
                )}
            </button>

            {result && (
                <div
                    style={{
                        padding: '8px 12px',
                        background: result.success ? '#d1fae5' : '#fee2e2',
                        color: result.success ? '#047857' : '#dc2626',
                        borderRadius: '6px',
                        fontSize: '13px',
                    }}
                >
                    {result.success ? '✓' : '✗'} {result.message}
                </div>
            )}

            <p style={{ fontSize: '11px', color: '#6b7280', margin: 0 }}>
                Searches Google Images and Open Food Facts, tries each result until one downloads successfully.
            </p>
        </div>
    )
}

export default RetryImageSearch
