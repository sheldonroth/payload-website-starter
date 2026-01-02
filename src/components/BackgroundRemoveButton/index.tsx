'use client'

import React, { useState } from 'react'
import { useFormFields, useDocumentInfo } from '@payloadcms/ui'

interface MediaData {
    id: number
    url?: string
    alt?: string
}

/**
 * Background Remove Button Component
 *
 * Inline UI component that appears in the product editor.
 * Allows users to remove backgrounds from product images using Photoroom API.
 *
 * NOTE: This component requires the PHOTOROOM_API_KEY environment variable to be set.
 * After adding/modifying this component, run: pnpm payload generate:importmap
 */
const BackgroundRemoveButton: React.FC<any> = () => {
    const [isLoading, setIsLoading] = useState(false)
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)

    // Get document info for the product ID
    const { id: productId } = useDocumentInfo()

    // Watch both image sources and backgroundRemoved flag
    const imageUrlField = useFormFields(([fields]) => fields.imageUrl)
    const imageField = useFormFields(([fields]) => fields.image)
    const backgroundRemovedField = useFormFields(([fields]) => fields.backgroundRemoved)

    // Extract values
    const imageUrl = imageUrlField?.value as string | null
    const imageData = imageField?.value as MediaData | number | null
    const hasImage = Boolean(imageUrl) || Boolean(imageData)
    const isAlreadyProcessed = Boolean(backgroundRemovedField?.value)

    // Get current image URL for display
    const getCurrentImageUrl = (): string | null => {
        if (imageUrl) return imageUrl
        if (typeof imageData === 'object' && imageData?.url) {
            return imageData.url.startsWith('http')
                ? imageData.url
                : `${window.location.origin}${imageData.url}`
        }
        return null
    }

    const currentImageUrl = getCurrentImageUrl()

    // Handle preview request
    const handlePreview = async (force: boolean = false) => {
        if (!productId) {
            setError('Please save the product first')
            return
        }

        setIsLoading(true)
        setError(null)
        setPreviewUrl(null)

        try {
            const response = await fetch('/api/background/remove', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ productId, preview: true, force }),
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || 'Failed to generate preview')
            }

            setPreviewUrl(data.preview)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Preview failed')
        } finally {
            setIsLoading(false)
        }
    }

    // Handle apply (save the processed image)
    const handleApply = async (force: boolean = false) => {
        if (!productId) {
            setError('Please save the product first')
            return
        }

        setIsLoading(true)
        setError(null)

        try {
            const response = await fetch('/api/background/remove', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ productId, preview: false, force }),
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || 'Failed to remove background')
            }

            setSuccess(true)
            setPreviewUrl(null)

            // Reload the page to show updated image
            setTimeout(() => {
                window.location.reload()
            }, 1500)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Background removal failed')
        } finally {
            setIsLoading(false)
        }
    }

    // Cancel preview
    const handleCancel = () => {
        setPreviewUrl(null)
        setError(null)
    }

    // No image available
    if (!hasImage) {
        return (
            <div
                style={{
                    padding: '12px 16px',
                    background: '#f9fafb',
                    borderRadius: '8px',
                    border: '1px dashed #d1d5db',
                    marginTop: '8px',
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        color: '#9ca3af',
                        fontSize: '13px',
                    }}
                >
                    <span style={{ fontSize: '16px' }}>✂️</span>
                    <span style={{ fontStyle: 'italic' }}>
                        Add an image above to enable background removal
                    </span>
                </div>
            </div>
        )
    }

    // Success state
    if (success) {
        return (
            <div
                style={{
                    padding: '12px 16px',
                    background: '#d1fae5',
                    borderRadius: '8px',
                    border: '1px solid #6ee7b7',
                    marginTop: '8px',
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        color: '#047857',
                        fontSize: '14px',
                        fontWeight: 500,
                    }}
                >
                    <span style={{ fontSize: '16px' }}>✓</span>
                    <span>Background removed successfully! Reloading...</span>
                </div>
            </div>
        )
    }

    // Preview mode
    if (previewUrl) {
        return (
            <div
                style={{
                    padding: '16px',
                    background: '#f3f4f6',
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb',
                    marginTop: '8px',
                }}
            >
                <div style={{ marginBottom: '12px', fontWeight: 600, fontSize: '14px' }}>
                    Preview: Background Removed
                </div>

                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '16px',
                        marginBottom: '16px',
                    }}
                >
                    {/* Original */}
                    <div>
                        <div
                            style={{
                                fontSize: '12px',
                                color: '#6b7280',
                                marginBottom: '4px',
                            }}
                        >
                            Original
                        </div>
                        {currentImageUrl && (
                            <img
                                src={currentImageUrl}
                                alt="Original"
                                style={{
                                    width: '100%',
                                    height: '120px',
                                    objectFit: 'contain',
                                    background: '#fff',
                                    borderRadius: '4px',
                                    border: '1px solid #e5e7eb',
                                }}
                            />
                        )}
                    </div>

                    {/* Processed */}
                    <div>
                        <div
                            style={{
                                fontSize: '12px',
                                color: '#6b7280',
                                marginBottom: '4px',
                            }}
                        >
                            Background Removed
                        </div>
                        <img
                            src={previewUrl}
                            alt="Preview"
                            style={{
                                width: '100%',
                                height: '120px',
                                objectFit: 'contain',
                                background: '#fff',
                                borderRadius: '4px',
                                border: '1px solid #e5e7eb',
                            }}
                        />
                    </div>
                </div>

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                        onClick={() => handleApply(isAlreadyProcessed)}
                        disabled={isLoading}
                        style={{
                            padding: '8px 16px',
                            background: isLoading ? '#9ca3af' : '#10b981',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: isLoading ? 'not-allowed' : 'pointer',
                            fontWeight: 500,
                            fontSize: '13px',
                        }}
                    >
                        {isLoading ? 'Applying...' : 'Apply & Save'}
                    </button>
                    <button
                        onClick={handleCancel}
                        disabled={isLoading}
                        style={{
                            padding: '8px 16px',
                            background: '#fff',
                            color: '#374151',
                            border: '1px solid #d1d5db',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: 500,
                            fontSize: '13px',
                        }}
                    >
                        Cancel
                    </button>
                </div>

                {error && (
                    <div
                        style={{
                            marginTop: '8px',
                            padding: '8px 12px',
                            background: '#fee2e2',
                            color: '#dc2626',
                            borderRadius: '4px',
                            fontSize: '13px',
                        }}
                    >
                        {error}
                    </div>
                )}
            </div>
        )
    }

    // Default state - show button
    return (
        <div
            style={{
                padding: '12px 16px',
                background: isAlreadyProcessed ? '#d1fae5' : '#fef3c7',
                borderRadius: '8px',
                border: `1px solid ${isAlreadyProcessed ? '#6ee7b7' : '#fcd34d'}`,
                marginTop: '8px',
            }}
        >
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '8px',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '18px' }}>{isAlreadyProcessed ? '✓' : '✂️'}</span>
                    <span style={{ fontWeight: 500, fontSize: '14px', color: isAlreadyProcessed ? '#047857' : '#92400e' }}>
                        {isAlreadyProcessed ? 'Background Removed' : 'Background Removal'}
                    </span>
                    <span
                        style={{
                            fontSize: '11px',
                            color: '#78716c',
                            background: 'rgba(0,0,0,0.05)',
                            padding: '2px 6px',
                            borderRadius: '4px',
                        }}
                    >
                        $0.02/image
                    </span>
                </div>

                <button
                    onClick={() => handlePreview(isAlreadyProcessed)}
                    disabled={isLoading || !productId}
                    style={{
                        padding: '6px 14px',
                        background: isLoading ? '#9ca3af' : isAlreadyProcessed ? '#f59e0b' : '#1d4ed8',
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
                            Processing...
                        </>
                    ) : isAlreadyProcessed ? (
                        'Re-process (Transparent)'
                    ) : (
                        'Remove Background'
                    )}
                </button>
            </div>

            {!productId && (
                <div
                    style={{
                        marginTop: '8px',
                        fontSize: '12px',
                        color: '#92400e',
                    }}
                >
                    Save the product first to enable background removal
                </div>
            )}

            {error && (
                <div
                    style={{
                        marginTop: '8px',
                        padding: '8px 12px',
                        background: '#fee2e2',
                        color: '#dc2626',
                        borderRadius: '4px',
                        fontSize: '13px',
                    }}
                >
                    {error}
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

export default BackgroundRemoveButton
