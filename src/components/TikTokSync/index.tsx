'use client'

import React, { useState } from 'react'

type SyncStep = 'idle' | 'analyzing' | 'done' | 'error'
type Mode = 'video' | 'profile'

interface SyncResult {
    success: boolean
    mode: string
    videosProcessed: number
    videosSkipped: number
    productsFound: number
    draftsCreated: number
    skippedDuplicates: string[]
    errors: string[]
    createdDrafts: { id: number; name: string; category: string }[]
    error?: string
}

const TikTokSync: React.FC = () => {
    const [mode, setMode] = useState<Mode>('video')
    const [videoUrl, setVideoUrl] = useState('')
    const [username, setUsername] = useState('')
    const [maxVideos, setMaxVideos] = useState(5)
    const [step, setStep] = useState<SyncStep>('idle')
    const [result, setResult] = useState<SyncResult | null>(null)
    const [error, setError] = useState<string | null>(null)

    const handleAnalyze = async () => {
        setStep('analyzing')
        setError(null)
        setResult(null)

        try {
            const body = mode === 'video'
                ? { videoUrl: videoUrl.trim() }
                : { username: username.trim(), maxVideos }

            const response = await fetch('/api/tiktok/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            })

            const data: SyncResult = await response.json()

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

    const handleReset = () => {
        setStep('idle')
        setResult(null)
        setError(null)
    }

    const canSubmit = mode === 'video'
        ? videoUrl.trim().length > 0
        : username.trim().length > 0

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
                <span style={{ fontSize: '24px' }}>🎵</span>
                <div>
                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>TikTok Analyzer</h3>
                    <p style={{ margin: 0, fontSize: '14px', color: '#6e6e73' }}>
                        Extract products from TikTok videos
                    </p>
                </div>
            </div>

            {(step === 'idle' || step === 'error') && (
                <>
                    {/* Mode Toggle */}
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                        <button
                            onClick={() => setMode('video')}
                            style={{
                                flex: 1,
                                padding: '10px',
                                background: mode === 'video' ? '#000' : '#f3f4f6',
                                color: mode === 'video' ? '#fff' : '#374151',
                                border: 'none',
                                borderRadius: '6px',
                                fontSize: '13px',
                                fontWeight: 600,
                                cursor: 'pointer',
                            }}
                        >
                            Single Video
                        </button>
                        <button
                            onClick={() => setMode('profile')}
                            style={{
                                flex: 1,
                                padding: '10px',
                                background: mode === 'profile' ? '#000' : '#f3f4f6',
                                color: mode === 'profile' ? '#fff' : '#374151',
                                border: 'none',
                                borderRadius: '6px',
                                fontSize: '13px',
                                fontWeight: 600,
                                cursor: 'pointer',
                            }}
                        >
                            Profile Sync
                        </button>
                    </div>

                    {mode === 'video' ? (
                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '8px' }}>
                                TikTok Video URL
                            </label>
                            <input
                                type="text"
                                value={videoUrl}
                                onChange={(e) => setVideoUrl(e.target.value)}
                                placeholder="https://www.tiktok.com/@user/video/..."
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
                    ) : (
                        <>
                            <div style={{ marginBottom: '12px' }}>
                                <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '8px' }}>
                                    TikTok Username
                                </label>
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="@mychemist or mychemist"
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
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '8px' }}>
                                    Max Videos: {maxVideos}
                                </label>
                                <input
                                    type="range"
                                    min="1"
                                    max="100"
                                    value={maxVideos}
                                    onChange={(e) => setMaxVideos(Number(e.target.value))}
                                    style={{ width: '100%' }}
                                />
                            </div>
                        </>
                    )}

                    <button
                        onClick={handleAnalyze}
                        disabled={!canSubmit}
                        style={{
                            width: '100%',
                            padding: '12px',
                            background: canSubmit ? '#000' : '#86868b',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '14px',
                            fontWeight: 600,
                            cursor: canSubmit ? 'pointer' : 'not-allowed',
                        }}
                    >
                        🎵 Analyze TikTok
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
                </>
            )}

            {step === 'analyzing' && (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: '#86868b' }}>
                    <div style={{ fontSize: '32px', marginBottom: '12px' }}>🎵</div>
                    <p style={{ margin: 0, fontWeight: 500 }}>
                        {mode === 'video' ? 'Analyzing video...' : 'Scraping profile & analyzing videos...'}
                    </p>
                    <p style={{ margin: '8px 0 0', fontSize: '12px' }}>
                        This may take a minute
                    </p>
                </div>
            )}

            {step === 'done' && result && (
                <div>
                    <div
                        style={{
                            padding: '16px',
                            background: '#f0fdf4',
                            border: '1px solid #bbf7d0',
                            borderRadius: '8px',
                            marginBottom: '16px',
                        }}
                    >
                        <p style={{ margin: 0, fontWeight: 600, color: '#166534' }}>
                            ✅ Analysis Complete!
                        </p>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
                        <div style={{ padding: '12px', background: '#f9fafb', borderRadius: '6px', textAlign: 'center' }}>
                            <p style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: '#3b82f6' }}>
                                {result.videosProcessed}
                            </p>
                            <p style={{ margin: 0, fontSize: '11px', color: '#6b7280' }}>Videos Processed</p>
                        </div>
                        <div style={{ padding: '12px', background: '#f9fafb', borderRadius: '6px', textAlign: 'center' }}>
                            <p style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: '#10b981' }}>
                                {result.draftsCreated}
                            </p>
                            <p style={{ margin: 0, fontSize: '11px', color: '#6b7280' }}>Drafts Created</p>
                        </div>
                    </div>

                    {result.skippedDuplicates.length > 0 && (
                        <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '12px' }}>
                            ⚠️ Skipped {result.skippedDuplicates.length} duplicates
                        </p>
                    )}

                    {result.createdDrafts.length > 0 && (
                        <div style={{ marginBottom: '16px' }}>
                            <p style={{ fontWeight: 500, marginBottom: '8px', fontSize: '14px' }}>Products Found:</p>
                            {result.createdDrafts.slice(0, 5).map((draft) => (
                                <a
                                    key={draft.id}
                                    href={`/admin/collections/products/${draft.id}`}
                                    style={{
                                        display: 'block',
                                        padding: '8px 12px',
                                        marginBottom: '4px',
                                        background: '#f9fafb',
                                        borderRadius: '4px',
                                        textDecoration: 'none',
                                        color: '#374151',
                                        fontSize: '13px',
                                    }}
                                >
                                    {draft.name} → {draft.category}
                                </a>
                            ))}
                            {result.createdDrafts.length > 5 && (
                                <p style={{ fontSize: '12px', color: '#6b7280' }}>
                                    ...and {result.createdDrafts.length - 5} more
                                </p>
                            )}
                        </div>
                    )}

                    <button
                        onClick={handleReset}
                        style={{
                            width: '100%',
                            padding: '12px',
                            background: '#f3f4f6',
                            color: '#374151',
                            border: '1px solid #d1d5db',
                            borderRadius: '6px',
                            fontSize: '14px',
                            fontWeight: 600,
                            cursor: 'pointer',
                        }}
                    >
                        Analyze Another
                    </button>
                </div>
            )}
        </div>
    )
}

export default TikTokSync
