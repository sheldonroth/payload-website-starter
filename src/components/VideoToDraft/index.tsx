'use client'

import React, { useState } from 'react'

interface ExtractedProduct {
    productName: string
    brandName: string
    category: string
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
    draftsCreated?: { id: number; name: string }[]
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
                        Analyze YouTube videos and auto-create product drafts
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
                            <p style={{ fontWeight: 500, marginBottom: '8px' }}>Edit Drafts:</p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                {result.draftsCreated.map((draft) => (
                                    <a
                                        key={draft.id}
                                        href={`/admin/collections/products/${draft.id}`}
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            padding: '8px 12px',
                                            background: '#1f2937',
                                            color: '#fff',
                                            borderRadius: '6px',
                                            fontSize: '13px',
                                            textDecoration: 'none',
                                        }}
                                    >
                                        {draft.name} →
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
