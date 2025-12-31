'use client'

import React, { useState } from 'react'

interface IngestResult {
    inputType: 'youtube' | 'youtube_channel' | 'tiktok' | 'amazon' | 'product_page' | 'barcode' | 'unknown'
    success: boolean
    productsFound?: number
    draftsCreated?: number
    merged?: number
    skipped?: number
    message: string
    details?: {
        draftsCreated?: Array<{ id: number; name: string }>
        existingProductId?: number
        skippedDuplicates?: string[]
        mergedProducts?: Array<{ id: number; name: string; status: string }>
        detectedType?: string
        detectedValue?: string
        hint?: string
    }
}

type IngestStep = 'idle' | 'detecting' | 'ingesting' | 'done' | 'error'

const INPUT_TYPE_CONFIG: Record<string, { icon: string; label: string; color: string }> = {
    youtube: { icon: '📺', label: 'YouTube Video', color: '#ff0000' },
    youtube_channel: { icon: '📺', label: 'YouTube Channel', color: '#cc0000' },
    tiktok: { icon: '🎵', label: 'TikTok Video', color: '#000000' },
    amazon: { icon: '📦', label: 'Amazon Product', color: '#ff9900' },
    product_page: { icon: '🛒', label: 'Product Page', color: '#10b981' },
    barcode: { icon: '📊', label: 'UPC Barcode', color: '#6366f1' },
    unknown: { icon: '❓', label: 'Unknown', color: '#9ca3af' },
}

// Check if YouTube URL is a channel URL (not a video)
function isYouTubeChannelUrl(url: string): boolean {
    const channelPatterns = [
        /youtube\.com\/@[\w.-]+/i,           // @username format
        /youtube\.com\/channel\/UC[\w-]+/i,  // /channel/UCxxxx format
        /youtube\.com\/c\/[\w.-]+/i,         // /c/channelname format
        /youtube\.com\/user\/[\w.-]+/i,      // /user/username format (legacy)
    ]
    return channelPatterns.some(pattern => pattern.test(url))
}

function detectInputType(input: string): string {
    const trimmed = input.trim().toLowerCase()

    // YouTube - check for channel URLs first
    if (trimmed.includes('youtube.com') || trimmed.includes('youtu.be')) {
        if (isYouTubeChannelUrl(input)) return 'youtube_channel'
        return 'youtube'
    }
    if (trimmed.includes('tiktok.com') || trimmed.includes('vm.tiktok.com')) return 'tiktok'
    if (trimmed.includes('amazon.com') || trimmed.includes('amzn.to') || trimmed.includes('amzn.com')) return 'amazon'
    if (trimmed.includes('walmart.com') || trimmed.includes('target.com') || trimmed.includes('iherb.com')) return 'product_page'
    if (/^\d{12,14}$/.test(trimmed)) return 'barcode'
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return 'product_page'

    return 'unknown'
}

const MagicInput: React.FC = () => {
    const [input, setInput] = useState('')
    const [step, setStep] = useState<IngestStep>('idle')
    const [result, setResult] = useState<IngestResult | null>(null)
    const [error, setError] = useState<string | null>(null)

    const inputType = input.trim() ? detectInputType(input) : null
    const typeConfig = inputType ? INPUT_TYPE_CONFIG[inputType] : null

    const handleIngest = async () => {
        if (!input.trim()) return

        setStep('ingesting')
        setError(null)
        setResult(null)

        try {
            const response = await fetch('/api/ingest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ input: input.trim(), autoCreate: true }),
            })

            const data: IngestResult = await response.json()

            if (data.success) {
                setStep('done')
                setResult(data)
            } else {
                setStep('error')
                setError(data.message || 'Ingestion failed')
            }
        } catch (err) {
            setStep('error')
            setError(err instanceof Error ? err.message : 'Network error')
        }
    }

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && input.trim() && step !== 'ingesting') {
            handleIngest()
        }
    }

    const handleClear = () => {
        setInput('')
        setStep('idle')
        setResult(null)
        setError(null)
    }

    return (
        <div
            style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                borderRadius: '12px',
                padding: '24px',
                marginBottom: '24px',
                boxShadow: '0 4px 20px rgba(102, 126, 234, 0.3)',
            }}
        >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                <span style={{ fontSize: '32px' }}>&#x2728;</span>
                <div>
                    <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#fff' }}>
                        Magic Input
                    </h3>
                    <p style={{ margin: 0, fontSize: '14px', color: 'rgba(255,255,255,0.8)' }}>
                        Paste any URL or barcode - we'll figure out the rest
                    </p>
                </div>
            </div>

            {/* Input Field */}
            <div style={{ position: 'relative', marginBottom: '16px' }}>
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="YouTube URL, TikTok, Amazon link, or UPC barcode..."
                    disabled={step === 'ingesting'}
                    style={{
                        width: '100%',
                        padding: '16px 20px',
                        paddingRight: typeConfig ? '140px' : '20px',
                        borderRadius: '10px',
                        border: '2px solid rgba(255,255,255,0.3)',
                        fontSize: '16px',
                        boxSizing: 'border-box',
                        background: 'rgba(255,255,255,0.95)',
                        color: '#1f2937',
                        outline: 'none',
                        transition: 'all 0.2s',
                    }}
                />
                {/* Input Type Badge */}
                {typeConfig && (
                    <span
                        style={{
                            position: 'absolute',
                            right: '12px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 12px',
                            background: typeConfig.color,
                            color: '#fff',
                            fontSize: '12px',
                            fontWeight: 600,
                            borderRadius: '6px',
                        }}
                    >
                        {typeConfig.icon} {typeConfig.label}
                    </span>
                )}
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '12px' }}>
                <button
                    onClick={handleIngest}
                    disabled={!input.trim() || step === 'ingesting' || inputType === 'unknown'}
                    style={{
                        flex: 1,
                        padding: '14px 24px',
                        background: step === 'ingesting' ? 'rgba(255,255,255,0.3)' : '#fff',
                        color: step === 'ingesting' ? '#fff' : '#667eea',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '16px',
                        fontWeight: 700,
                        cursor: !input.trim() || step === 'ingesting' ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s',
                        opacity: !input.trim() || inputType === 'unknown' ? 0.6 : 1,
                    }}
                >
                    {step === 'ingesting' ? (
                        <>&#x23F3; Analyzing...</>
                    ) : (
                        <>&#x1F680; Ingest</>
                    )}
                </button>
                {(result || error) && (
                    <button
                        onClick={handleClear}
                        style={{
                            padding: '14px 20px',
                            background: 'rgba(255,255,255,0.2)',
                            color: '#fff',
                            border: '2px solid rgba(255,255,255,0.3)',
                            borderRadius: '8px',
                            fontSize: '14px',
                            fontWeight: 600,
                            cursor: 'pointer',
                        }}
                    >
                        Clear
                    </button>
                )}
            </div>

            {/* Supported Types */}
            {step === 'idle' && !input && (
                <div style={{ marginTop: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {['youtube', 'tiktok', 'amazon', 'barcode'].map((type) => {
                        const config = INPUT_TYPE_CONFIG[type]
                        return (
                            <span
                                key={type}
                                style={{
                                    padding: '4px 10px',
                                    background: 'rgba(255,255,255,0.15)',
                                    color: 'rgba(255,255,255,0.9)',
                                    fontSize: '12px',
                                    borderRadius: '4px',
                                }}
                            >
                                {config.icon} {config.label}
                            </span>
                        )
                    })}
                </div>
            )}

            {/* Error Message */}
            {error && (
                <div
                    style={{
                        marginTop: '16px',
                        padding: '14px',
                        background: 'rgba(239, 68, 68, 0.2)',
                        border: '1px solid rgba(239, 68, 68, 0.4)',
                        borderRadius: '8px',
                        color: '#fecaca',
                        fontSize: '14px',
                    }}
                >
                    &#x26A0;&#xFE0F; {error}
                </div>
            )}

            {/* Success Result */}
            {result && result.success && (
                <div
                    style={{
                        marginTop: '16px',
                        padding: '16px',
                        background: 'rgba(255,255,255,0.95)',
                        borderRadius: '10px',
                    }}
                >
                    {/* Summary Stats */}
                    <div style={{ display: 'flex', gap: '16px', marginBottom: '12px', flexWrap: 'wrap' }}>
                        {result.productsFound !== undefined && result.productsFound > 0 && (
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '24px', fontWeight: 700, color: '#10b981' }}>
                                    {result.productsFound}
                                </div>
                                <div style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase' }}>
                                    Found
                                </div>
                            </div>
                        )}
                        {result.draftsCreated !== undefined && result.draftsCreated > 0 && (
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '24px', fontWeight: 700, color: '#6366f1' }}>
                                    {result.draftsCreated}
                                </div>
                                <div style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase' }}>
                                    Created
                                </div>
                            </div>
                        )}
                        {result.merged !== undefined && result.merged > 0 && (
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '24px', fontWeight: 700, color: '#f59e0b' }}>
                                    {result.merged}
                                </div>
                                <div style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase' }}>
                                    Merged
                                </div>
                            </div>
                        )}
                        {result.skipped !== undefined && result.skipped > 0 && (
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '24px', fontWeight: 700, color: '#9ca3af' }}>
                                    {result.skipped}
                                </div>
                                <div style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase' }}>
                                    Skipped
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Message */}
                    <p style={{ margin: '0 0 12px', fontSize: '14px', color: '#374151' }}>
                        {result.message}
                    </p>

                    {/* Created Drafts Links */}
                    {result.details?.draftsCreated && result.details.draftsCreated.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <p style={{ margin: 0, fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>
                                Review Drafts:
                            </p>
                            {result.details.draftsCreated.slice(0, 5).map((draft) => (
                                <a
                                    key={draft.id}
                                    href={`/admin/collections/products/${draft.id}`}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '10px 14px',
                                        background: '#f3f4f6',
                                        borderRadius: '6px',
                                        textDecoration: 'none',
                                        color: '#374151',
                                        fontSize: '14px',
                                    }}
                                >
                                    <span style={{ fontWeight: 500 }}>{draft.name}</span>
                                    <span style={{ color: '#9ca3af' }}>&#x2192;</span>
                                </a>
                            ))}
                            {result.details.draftsCreated.length > 5 && (
                                <a
                                    href="/admin/collections/products?where[status][equals]=ai_draft"
                                    style={{
                                        fontSize: '13px',
                                        color: '#6366f1',
                                        textDecoration: 'none',
                                    }}
                                >
                                    + {result.details.draftsCreated.length - 5} more in AI Drafts
                                </a>
                            )}
                        </div>
                    )}

                    {/* Existing Product Link */}
                    {result.details?.existingProductId && (
                        <a
                            href={`/admin/collections/products/${result.details.existingProductId}`}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '10px 16px',
                                background: '#f59e0b',
                                color: '#fff',
                                borderRadius: '6px',
                                textDecoration: 'none',
                                fontSize: '14px',
                                fontWeight: 600,
                            }}
                        >
                            View Existing Product &#x2192;
                        </a>
                    )}
                </div>
            )}
        </div>
    )
}

export default MagicInput
