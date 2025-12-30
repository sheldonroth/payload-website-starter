'use client'

import React, { useState } from 'react'

interface ExtractedProduct {
    productName: string
    brandName: string
    suggestedCategory: string
    isNewCategory: boolean
    sentimentScore: number
    pros: string[]
    cons: string[]
    summary: string
}

interface AnalysisResult {
    success: boolean
    transcript?: string
    productsFound?: number
    products?: ExtractedProduct[]
    draftsCreated?: { id: number; name: string; category: string; isNewCategory: boolean }[]
    existingCategories?: string[]
    error?: string
}

type AnalysisStep = 'idle' | 'analyzing' | 'done' | 'error'

const VideoToDraft: React.FC = () => {
    const [videoUrl, setVideoUrl] = useState('')
    const [step, setStep] = useState<AnalysisStep>('idle')
    const [result, setResult] = useState<AnalysisResult | null>(null)
    const [error, setError] = useState<string | null>(null)

    const handleAnalyze = async () => {
        if (!videoUrl.trim()) return

        setStep('analyzing')
        setError(null)
        setResult(null)

        try {
            const response = await fetch('/api/video/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ videoUrl }),
            })

            const data: AnalysisResult = await response.json()

            if (data.success) {
                setStep('done')
                setResult(data)
            } else {
                setStep('error')
                setError(data.error || 'Analysis failed')
            }
        } catch (err) {
            setStep('error')
            setError(err instanceof Error ? err.message : 'Network error')
        }
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
                <span style={{ fontSize: '24px' }}>🎬</span>
                <div>
                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Video-to-Draft</h3>
                    <p style={{ margin: 0, fontSize: '14px', color: '#6e6e73' }}>
                        Analyze a single video and create product drafts
                    </p>
                </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
                <label
                    style={{
                        display: 'block',
                        fontSize: '14px',
                        fontWeight: 500,
                        marginBottom: '8px',
                    }}
                >
                    YouTube Video URL
                </label>
                <input
                    type="url"
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                    disabled={step === 'analyzing'}
                    style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '6px',
                        border: '1px solid #d1d1d6',
                        fontSize: '14px',
                        boxSizing: 'border-box',
                        color: '#1f2937',
                        backgroundColor: '#fff',
                    }}
                />
            </div>

            <button
                onClick={handleAnalyze}
                disabled={!videoUrl.trim() || step === 'analyzing'}
                style={{
                    width: '100%',
                    padding: '12px',
                    background: step === 'analyzing' ? '#86868b' : '#5c5ce0',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: step === 'analyzing' ? 'not-allowed' : 'pointer',
                }}
            >
                {step === 'analyzing' ? '⏳ Analyzing...' : '🔍 Analyze Video'}
            </button>

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

            {result && result.success && (
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
                            ✅ Found {result.productsFound} product{result.productsFound !== 1 ? 's' : ''}
                        </p>
                        <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#15803d' }}>
                            Created {result.draftsCreated?.length} draft{result.draftsCreated?.length !== 1 ? 's' : ''}
                        </p>
                    </div>

                    {result.draftsCreated && result.draftsCreated.length > 0 && (
                        <div>
                            <p style={{ fontWeight: 500, marginBottom: '8px' }}>Created Drafts:</p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {result.draftsCreated.map((draft) => (
                                    <a
                                        key={draft.id}
                                        href={`/admin/collections/products/${draft.id}`}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: '12px',
                                            background: '#f9fafb',
                                            border: '1px solid #e5e7eb',
                                            borderRadius: '6px',
                                            textDecoration: 'none',
                                            color: '#374151',
                                        }}
                                    >
                                        <div>
                                            <p style={{ margin: 0, fontWeight: 600, fontSize: '14px' }}>{draft.name}</p>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            {/* Category Badge */}
                                            <span
                                                style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '4px',
                                                    padding: '4px 10px',
                                                    background: draft.isNewCategory ? '#dbeafe' : '#f3f4f6',
                                                    color: draft.isNewCategory ? '#1d4ed8' : '#6b7280',
                                                    fontSize: '12px',
                                                    fontWeight: 600,
                                                    borderRadius: '4px',
                                                    border: draft.isNewCategory ? '1px solid #3b82f6' : '1px solid #e5e7eb',
                                                }}
                                            >
                                                {draft.category}
                                                {draft.isNewCategory && (
                                                    <span
                                                        style={{
                                                            background: '#3b82f6',
                                                            color: '#fff',
                                                            padding: '1px 5px',
                                                            borderRadius: '3px',
                                                            fontSize: '10px',
                                                            fontWeight: 700,
                                                            textTransform: 'uppercase',
                                                        }}
                                                    >
                                                        New
                                                    </span>
                                                )}
                                            </span>
                                            <span style={{ color: '#9ca3af' }}>→</span>
                                        </div>
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

export default VideoToDraft
