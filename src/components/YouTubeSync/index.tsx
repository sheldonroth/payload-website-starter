'use client'

import React, { useState } from 'react'

interface SyncResult {
    success: boolean
    imported?: number
    skipped?: number
    message?: string
    error?: string
}

const YouTubeSync: React.FC = () => {
    const [syncing, setSyncing] = useState(false)
    const [result, setResult] = useState<SyncResult | null>(null)
    const [error, setError] = useState<string | null>(null)

    const handleSync = async () => {
        setSyncing(true)
        setError(null)
        setResult(null)

        try {
            const response = await fetch('/api/youtube/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            })

            const data: SyncResult = await response.json()

            if (data.success) {
                setResult(data)
            } else {
                setError(data.error || 'Sync failed')
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Network error')
        } finally {
            setSyncing(false)
        }
    }

    return (
        <div
            style={{
                background: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)',
                borderRadius: '12px',
                padding: '24px',
                marginBottom: '24px',
                color: '#fff',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <span style={{ fontSize: '32px' }}>📺</span>
                <div>
                    <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>YouTube Video Sync</h3>
                    <p style={{ margin: 0, fontSize: '14px', opacity: 0.9 }}>
                        Import videos from your YouTube channel
                    </p>
                </div>
            </div>

            <p style={{ fontSize: '13px', opacity: 0.85, marginBottom: '20px' }}>
                Syncs your latest videos and auto-detects which ones are Shorts vs longform content.
            </p>

            <button
                onClick={handleSync}
                disabled={syncing}
                style={{
                    width: '100%',
                    padding: '14px 20px',
                    background: syncing ? 'rgba(255,255,255,0.3)' : '#fff',
                    color: syncing ? '#fff' : '#5b21b6',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '16px',
                    fontWeight: 700,
                    cursor: syncing ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    transition: 'all 0.2s',
                }}
            >
                {syncing ? (
                    <>
                        <span style={{ animation: 'spin 1s linear infinite' }}>⏳</span>
                        Syncing Videos...
                    </>
                ) : (
                    <>
                        🔄 Sync Videos Now
                    </>
                )}
            </button>

            {error && (
                <div
                    style={{
                        marginTop: '16px',
                        padding: '12px 16px',
                        background: 'rgba(239, 68, 68, 0.2)',
                        border: '1px solid rgba(239, 68, 68, 0.5)',
                        borderRadius: '8px',
                        fontSize: '14px',
                    }}
                >
                    ❌ {error}
                </div>
            )}

            {result && result.success && (
                <div
                    style={{
                        marginTop: '16px',
                        padding: '16px',
                        background: 'rgba(16, 185, 129, 0.2)',
                        border: '1px solid rgba(16, 185, 129, 0.5)',
                        borderRadius: '8px',
                    }}
                >
                    <p style={{ margin: 0, fontWeight: 600, fontSize: '16px' }}>
                        ✅ Sync Complete!
                    </p>
                    <div style={{ marginTop: '8px', fontSize: '14px' }}>
                        <p style={{ margin: '4px 0' }}>📥 Imported: {result.imported} videos</p>
                        <p style={{ margin: '4px 0' }}>⏭️ Skipped: {result.skipped} (too long or duplicates)</p>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    )
}

export default YouTubeSync
