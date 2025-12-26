'use client'

import React, { useState } from 'react'

interface AnalysisResult {
    success: boolean
    videosProcessed?: number
    videosSkipped?: number
    productsFound?: number
    draftsCreated?: number
    createdDrafts?: { id: number; name: string; video: string }[]
    errors?: string[]
    error?: string
    message?: string
}

type AnalysisStep = 'idle' | 'analyzing' | 'done' | 'error'

const ChannelSync: React.FC = () => {
    const [maxVideos, setMaxVideos] = useState(10)
    const [step, setStep] = useState<AnalysisStep>('idle')
    const [result, setResult] = useState<AnalysisResult | null>(null)
    const [error, setError] = useState<string | null>(null)

    const handleAnalyze = async () => {
        setStep('analyzing')
        setError(null)
        setResult(null)

        try {
            const response = await fetch('/api/channel/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ maxVideos }),
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
                <span style={{ fontSize: '24px' }}>📺</span>
                <div>
                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Channel Sync</h3>
                    <p style={{ margin: 0, fontSize: '14px', color: '#6e6e73' }}>
                        Analyze all videos from your channel
                    </p>
                </div>
            </div>

            <p style={{ fontSize: '13px', color: '#86868b', marginBottom: '16px' }}>
                Uses the channel configured in YouTube Settings. Processes each video's transcript and creates product drafts.
            </p>

            <div style={{ marginBottom: '16px' }}>
                <label
                    style={{
                        display: 'block',
                        fontSize: '14px',
                        fontWeight: 500,
                        marginBottom: '8px',
                    }}
                >
                    Max Videos to Process
                </label>
                <select
                    value={maxVideos}
                    onChange={(e) => setMaxVideos(Number(e.target.value))}
                    disabled={step === 'analyzing'}
                    style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '6px',
                        border: '1px solid #d1d1d6',
                        fontSize: '14px',
                        boxSizing: 'border-box',
                    }}
                >
                    <option value={5}>5 videos</option>
                    <option value={10}>10 videos</option>
                    <option value={25}>25 videos</option>
                    <option value={50}>50 videos (max)</option>
                </select>
            </div>

            <button
                onClick={handleAnalyze}
                disabled={step === 'analyzing'}
                style={{
                    width: '100%',
                    padding: '12px',
                    background: step === 'analyzing' ? '#86868b' : '#10b981',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: step === 'analyzing' ? 'not-allowed' : 'pointer',
                }}
            >
                {step === 'analyzing' ? '⏳ Processing Channel...' : '🚀 Sync Channel'}
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
                            ✅ {result.message}
                        </p>
                        <div style={{ marginTop: '8px', fontSize: '14px', color: '#15803d' }}>
                            <p style={{ margin: '4px 0' }}>📹 Videos processed: {result.videosProcessed}</p>
                            <p style={{ margin: '4px 0' }}>⏭️ Videos skipped: {result.videosSkipped}</p>
                            <p style={{ margin: '4px 0' }}>📦 Products found: {result.productsFound}</p>
                            <p style={{ margin: '4px 0' }}>📝 Drafts created: {result.draftsCreated}</p>
                        </div>
                    </div>

                    {result.errors && result.errors.length > 0 && (
                        <div
                            style={{
                                padding: '12px',
                                background: '#fffbeb',
                                border: '1px solid #fde68a',
                                borderRadius: '6px',
                                marginBottom: '16px',
                            }}
                        >
                            <p style={{ margin: 0, fontWeight: 500, color: '#92400e', fontSize: '14px' }}>
                                ⚠️ Some videos skipped:
                            </p>
                            <ul style={{ margin: '8px 0 0', paddingLeft: '20px', fontSize: '13px', color: '#b45309' }}>
                                {result.errors.slice(0, 5).map((err, i) => (
                                    <li key={i}>{err}</li>
                                ))}
                                {result.errors.length > 5 && (
                                    <li>...and {result.errors.length - 5} more</li>
                                )}
                            </ul>
                        </div>
                    )}

                    {result.createdDrafts && result.createdDrafts.length > 0 && (
                        <div>
                            <p style={{ fontWeight: 500, marginBottom: '8px' }}>Created Drafts:</p>
                            <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                {result.createdDrafts.map((draft) => (
                                    <a
                                        key={draft.id}
                                        href={`/admin/collections/products/${draft.id}`}
                                        style={{
                                            display: 'block',
                                            padding: '10px 12px',
                                            marginBottom: '6px',
                                            background: '#f9fafb',
                                            border: '1px solid #e5e7eb',
                                            borderRadius: '6px',
                                            textDecoration: 'none',
                                            color: '#374151',
                                        }}
                                    >
                                        <p style={{ margin: 0, fontWeight: 600, fontSize: '14px' }}>{draft.name}</p>
                                        <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#6b7280' }}>
                                            From: {draft.video}
                                        </p>
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

export default ChannelSync
