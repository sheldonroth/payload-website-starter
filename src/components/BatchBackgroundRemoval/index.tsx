'use client'

import React, { useState, useEffect, useCallback } from 'react'

interface ProductWithImage {
    id: number
    name: string
    brand: string
    imageUrl: string | null
    imageMediaUrl: string | null
    hasImage: boolean
    backgroundRemoved: boolean
}

interface ProcessingResult {
    productId: number
    success: boolean
    newMediaId?: number
    error?: string
}

/**
 * Batch Background Removal Component
 *
 * Dashboard tool for removing backgrounds from multiple product images at once.
 * Uses Photoroom API ($0.02/image).
 *
 * Features:
 * - Product grid with image previews
 * - Multi-select with checkboxes
 * - Progress tracking during batch processing
 * - Cost estimation before processing
 */
const BatchBackgroundRemoval: React.FC = () => {
    const [products, setProducts] = useState<ProductWithImage[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
    const [processing, setProcessing] = useState(false)
    const [progress, setProgress] = useState({ current: 0, total: 0, success: 0, failed: 0 })
    const [message, setMessage] = useState('')
    const [searchTerm, setSearchTerm] = useState('')
    const [failedResults, setFailedResults] = useState<ProcessingResult[]>([])
    const [showErrorDetails, setShowErrorDetails] = useState(false)
    const [forceReprocess, setForceReprocess] = useState(false)

    const fetchProducts = useCallback(async () => {
        setLoading(true)
        try {
            // Fetch products with images (either imageUrl or image relationship)
            const res = await fetch(
                '/api/products?limit=200&sort=-updatedAt&depth=1&where[status][not_equals]=ai_draft'
            )
            const data = await res.json()

            const mapped = (data.docs || [])
                .map((p: any) => ({
                    id: p.id,
                    name: p.productName || p.name || 'Untitled',
                    brand: typeof p.brand === 'object' ? p.brand?.name : p.brand || 'Unknown',
                    imageUrl: p.imageUrl || null,
                    imageMediaUrl: p.image?.url || null,
                    hasImage: !!(p.imageUrl || p.image),
                    backgroundRemoved: !!p.backgroundRemoved,
                }))
                .filter((p: ProductWithImage) => p.hasImage) // Only show products with images

            setProducts(mapped)
        } catch (error) {
            console.error('Failed to fetch products:', error)
            setMessage('Failed to load products')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchProducts()
    }, [fetchProducts])

    const filteredProducts = products.filter(
        (p) =>
            p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.brand.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const toggleSelect = (id: number) => {
        setSelectedIds((prev) => {
            const next = new Set(prev)
            if (next.has(id)) {
                next.delete(id)
            } else {
                next.add(id)
            }
            return next
        })
    }

    const selectAll = () => {
        setSelectedIds(new Set(filteredProducts.map((p) => p.id)))
    }

    const deselectAll = () => {
        setSelectedIds(new Set())
    }

    const getImageUrl = (product: ProductWithImage): string | null => {
        if (product.imageUrl) return product.imageUrl
        if (product.imageMediaUrl) {
            return product.imageMediaUrl.startsWith('http')
                ? product.imageMediaUrl
                : `${window.location.origin}${product.imageMediaUrl}`
        }
        return null
    }

    const estimatedCost = (selectedIds.size * 0.02).toFixed(2)

    // Count how many selected products are already processed
    const alreadyProcessedCount = Array.from(selectedIds).filter(
        (id) => products.find((p) => p.id === id)?.backgroundRemoved
    ).length

    const removeBackgrounds = async () => {
        if (selectedIds.size === 0) {
            setMessage('Please select products first')
            return
        }

        // Build confirmation message
        let confirmMsg = `Remove backgrounds from ${selectedIds.size} product images?\n\nEstimated cost: $${estimatedCost}`
        if (alreadyProcessedCount > 0) {
            confirmMsg += `\n\n⚠️ ${alreadyProcessedCount} product(s) already processed.`
            if (forceReprocess) {
                confirmMsg += `\nForce re-process is ON - they will be re-processed with transparent backgrounds.`
            } else {
                confirmMsg += `\nEnable "Force re-process" to re-process them.`
            }
        }
        confirmMsg += `\n\nThis will replace the original images.`

        const confirmed = confirm(confirmMsg)
        if (!confirmed) return

        setProcessing(true)
        setProgress({ current: 0, total: selectedIds.size, success: 0, failed: 0 })
        setMessage(`Processing ${selectedIds.size} images...`)
        setFailedResults([])
        setShowErrorDetails(false)

        const productIds = Array.from(selectedIds)

        try {
            const res = await fetch('/api/background/batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ productIds, force: forceReprocess }),
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error || 'Batch processing failed')
            }

            setProgress({
                current: data.processed,
                total: data.processed,
                success: data.successCount,
                failed: data.failureCount,
            })

            // Store failed results for display
            const failed = (data.results || []).filter((r: ProcessingResult) => !r.success)
            setFailedResults(failed)
            if (failed.length > 0) {
                setShowErrorDetails(true)
            }

            setMessage(
                `Completed: ${data.successCount} succeeded, ${data.failureCount} failed. Cost: ${data.estimatedCost}`
            )

            // Clear selection and refresh
            setSelectedIds(new Set())
            fetchProducts()
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Batch processing failed')
        } finally {
            setProcessing(false)
        }
    }

    if (loading) {
        return (
            <div style={{ padding: '16px', background: '#f9fafb', borderRadius: '8px' }}>
                Loading products with images...
            </div>
        )
    }

    return (
        <div style={{ padding: '16px', background: '#f9fafb', borderRadius: '8px' }}>
            {/* Header */}
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '16px',
                    flexWrap: 'wrap',
                    gap: '12px',
                }}
            >
                <div>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>
                        ✂️ Batch Background Removal
                    </h3>
                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#6b7280' }}>
                        {products.length} products with images | {selectedIds.size} selected |
                        Est. cost: ${estimatedCost}
                    </p>
                </div>

                {/* Search */}
                <input
                    type="text"
                    placeholder="Search products..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{
                        padding: '8px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '13px',
                        width: '200px',
                    }}
                />
            </div>

            {/* Action buttons */}
            <div
                style={{
                    display: 'flex',
                    gap: '8px',
                    marginBottom: '16px',
                    flexWrap: 'wrap',
                }}
            >
                <button
                    onClick={selectAll}
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
                    Select All ({filteredProducts.length})
                </button>
                <button
                    onClick={deselectAll}
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
                    Deselect All
                </button>
                <button
                    onClick={removeBackgrounds}
                    disabled={processing || selectedIds.size === 0}
                    style={{
                        padding: '6px 16px',
                        background:
                            processing || selectedIds.size === 0 ? '#9ca3af' : '#1d4ed8',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '13px',
                        fontWeight: 500,
                        cursor:
                            processing || selectedIds.size === 0 ? 'not-allowed' : 'pointer',
                    }}
                >
                    {processing
                        ? `Processing ${progress.current}/${progress.total}...`
                        : `Remove Backgrounds (${selectedIds.size})`}
                </button>

                {/* Force reprocess checkbox */}
                <label
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '13px',
                        color: '#374151',
                        cursor: 'pointer',
                        padding: '6px 12px',
                        background: forceReprocess ? '#fef3c7' : '#fff',
                        border: `1px solid ${forceReprocess ? '#f59e0b' : '#d1d5db'}`,
                        borderRadius: '6px',
                    }}
                >
                    <input
                        type="checkbox"
                        checked={forceReprocess}
                        onChange={(e) => setForceReprocess(e.target.checked)}
                        disabled={processing}
                        style={{ cursor: 'pointer' }}
                    />
                    Force re-process (transparent)
                </label>

                {alreadyProcessedCount > 0 && selectedIds.size > 0 && (
                    <span style={{ fontSize: '12px', color: '#f59e0b' }}>
                        ⚠️ {alreadyProcessedCount} already processed
                    </span>
                )}
            </div>

            {/* Progress bar */}
            {processing && (
                <div style={{ marginBottom: '16px' }}>
                    <div
                        style={{
                            height: '8px',
                            background: '#e5e7eb',
                            borderRadius: '4px',
                            overflow: 'hidden',
                        }}
                    >
                        <div
                            style={{
                                height: '100%',
                                width: `${(progress.current / progress.total) * 100}%`,
                                background: '#3b82f6',
                                transition: 'width 0.3s',
                            }}
                        />
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                        {progress.success} succeeded, {progress.failed} failed
                    </div>
                </div>
            )}

            {/* Message */}
            {message && (
                <div
                    style={{
                        padding: '8px 12px',
                        background: message.includes('failed') ? '#fee2e2' : '#d1fae5',
                        color: message.includes('failed') ? '#dc2626' : '#047857',
                        borderRadius: '6px',
                        marginBottom: '16px',
                        fontSize: '13px',
                    }}
                >
                    {message}
                    {failedResults.length > 0 && (
                        <button
                            onClick={() => setShowErrorDetails(!showErrorDetails)}
                            style={{
                                marginLeft: '12px',
                                padding: '2px 8px',
                                background: 'transparent',
                                border: '1px solid #dc2626',
                                borderRadius: '4px',
                                fontSize: '12px',
                                cursor: 'pointer',
                                color: '#dc2626',
                            }}
                        >
                            {showErrorDetails ? 'Hide Details' : 'Show Details'}
                        </button>
                    )}
                </div>
            )}

            {/* Error Details */}
            {showErrorDetails && failedResults.length > 0 && (
                <div
                    style={{
                        padding: '12px',
                        background: '#fef2f2',
                        border: '1px solid #fecaca',
                        borderRadius: '6px',
                        marginBottom: '16px',
                        maxHeight: '200px',
                        overflowY: 'auto',
                    }}
                >
                    <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: '#991b1b' }}>
                        Failed Products ({failedResults.length}):
                    </div>
                    {failedResults.map((result) => {
                        const product = products.find(p => p.id === result.productId)
                        return (
                            <div
                                key={result.productId}
                                style={{
                                    padding: '6px 8px',
                                    background: '#fff',
                                    borderRadius: '4px',
                                    marginBottom: '4px',
                                    fontSize: '12px',
                                }}
                            >
                                <div style={{ fontWeight: 500 }}>
                                    #{result.productId}: {product?.name || 'Unknown Product'}
                                </div>
                                <div style={{ color: '#dc2626', marginTop: '2px' }}>
                                    Error: {result.error || 'Unknown error'}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Product grid */}
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                    gap: '12px',
                    maxHeight: '400px',
                    overflowY: 'auto',
                }}
            >
                {filteredProducts.map((product) => {
                    const imageUrl = getImageUrl(product)
                    const isSelected = selectedIds.has(product.id)

                    return (
                        <div
                            key={product.id}
                            onClick={() => !processing && toggleSelect(product.id)}
                            style={{
                                padding: '8px',
                                background: isSelected ? '#dbeafe' : product.backgroundRemoved ? '#f0fdf4' : '#fff',
                                border: isSelected
                                    ? '2px solid #3b82f6'
                                    : product.backgroundRemoved
                                    ? '1px solid #86efac'
                                    : '1px solid #e5e7eb',
                                borderRadius: '8px',
                                cursor: processing ? 'not-allowed' : 'pointer',
                                opacity: processing ? 0.7 : 1,
                                position: 'relative',
                            }}
                        >
                            {/* Image preview */}
                            <div
                                style={{
                                    height: '80px',
                                    background: '#f3f4f6',
                                    borderRadius: '4px',
                                    marginBottom: '8px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    overflow: 'hidden',
                                }}
                            >
                                {imageUrl ? (
                                    <img
                                        src={imageUrl}
                                        alt={product.name}
                                        style={{
                                            maxWidth: '100%',
                                            maxHeight: '100%',
                                            objectFit: 'contain',
                                        }}
                                    />
                                ) : (
                                    <span style={{ color: '#9ca3af', fontSize: '12px' }}>
                                        No preview
                                    </span>
                                )}
                            </div>

                            {/* Already processed badge */}
                            {product.backgroundRemoved && (
                                <div
                                    style={{
                                        position: 'absolute',
                                        top: '4px',
                                        right: '4px',
                                        background: '#10b981',
                                        color: 'white',
                                        fontSize: '10px',
                                        padding: '2px 6px',
                                        borderRadius: '4px',
                                        fontWeight: 500,
                                    }}
                                >
                                    ✓ Done
                                </div>
                            )}

                            {/* Product info */}
                            <div
                                style={{
                                    fontSize: '12px',
                                    fontWeight: 500,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                {product.name}
                            </div>
                            <div
                                style={{
                                    fontSize: '11px',
                                    color: '#6b7280',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                {product.brand}
                            </div>

                            {/* Selection checkbox */}
                            <div
                                style={{
                                    marginTop: '6px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                }}
                            >
                                <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => {}}
                                    style={{ cursor: 'pointer' }}
                                />
                                <span style={{ fontSize: '11px', color: '#9ca3af' }}>
                                    Select
                                </span>
                            </div>
                        </div>
                    )
                })}
            </div>

            {filteredProducts.length === 0 && (
                <div
                    style={{
                        padding: '32px',
                        textAlign: 'center',
                        color: '#6b7280',
                    }}
                >
                    {searchTerm
                        ? 'No products match your search'
                        : 'No products with images found'}
                </div>
            )}
        </div>
    )
}

export default BatchBackgroundRemoval
