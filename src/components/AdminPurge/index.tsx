'use client'

import React, { useState } from 'react'

type PurgeStep = 'idle' | 'confirm' | 'purging' | 'done' | 'error'

interface PurgeResult {
    success: boolean
    action: string
    deleted: number
    kept?: number
    message?: string
    error?: string
}

const AdminPurge: React.FC = () => {
    const [step, setStep] = useState<PurgeStep>('idle')
    const [result, setResult] = useState<PurgeResult | null>(null)
    const [selectedAction, setSelectedAction] = useState<string>('')
    const [error, setError] = useState<string | null>(null)

    const handlePurge = async (action: string) => {
        setSelectedAction(action)
        setStep('confirm')
    }

    const confirmPurge = async () => {
        setStep('purging')
        setError(null)

        try {
            const response = await fetch('/api/admin/purge', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: selectedAction }),
            })

            const data: PurgeResult = await response.json()

            if (data.success) {
                setStep('done')
                setResult(data)
            } else {
                setStep('error')
                setError(data.error || 'Purge failed')
            }
        } catch (err) {
            setStep('error')
            setError(err instanceof Error ? err.message : 'Network error')
        }
    }

    const handleReset = () => {
        setStep('idle')
        setResult(null)
        setSelectedAction('')
        setError(null)
    }

    return (
        <div
            style={{
                background: '#fff',
                borderRadius: '8px',
                border: '1px solid #fecaca',
                padding: '24px',
                marginBottom: '24px',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <span style={{ fontSize: '24px' }}>🗑️</span>
                <div>
                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#dc2626' }}>Admin Purge</h3>
                    <p style={{ margin: 0, fontSize: '14px', color: '#6e6e73' }}>
                        Clean up AI drafts and duplicates
                    </p>
                </div>
            </div>

            {step === 'idle' && (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                        onClick={() => handlePurge('purge_duplicates')}
                        style={{
                            flex: 1,
                            minWidth: '140px',
                            padding: '12px',
                            background: '#fef3c7',
                            color: '#92400e',
                            border: '1px solid #fcd34d',
                            borderRadius: '6px',
                            fontSize: '13px',
                            fontWeight: 600,
                            cursor: 'pointer',
                        }}
                    >
                        🧹 Remove Duplicates
                    </button>
                    <button
                        onClick={() => handlePurge('purge_ai_drafts')}
                        style={{
                            flex: 1,
                            minWidth: '140px',
                            padding: '12px',
                            background: '#fee2e2',
                            color: '#dc2626',
                            border: '1px solid #fca5a5',
                            borderRadius: '6px',
                            fontSize: '13px',
                            fontWeight: 600,
                            cursor: 'pointer',
                        }}
                    >
                        🤖 AI Drafts Only
                    </button>
                    <button
                        onClick={() => handlePurge('purge_all_drafts')}
                        style={{
                            flex: 1,
                            minWidth: '140px',
                            padding: '12px',
                            background: '#7f1d1d',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '13px',
                            fontWeight: 600,
                            cursor: 'pointer',
                        }}
                    >
                        🗑️ Delete ALL Drafts
                    </button>
                </div>
            )}

            {step === 'confirm' && (
                <div>
                    <div
                        style={{
                            padding: '12px',
                            background: '#fef2f2',
                            border: '1px solid #fecaca',
                            borderRadius: '6px',
                            marginBottom: '16px',
                        }}
                    >
                        <p style={{ margin: 0, fontWeight: 600, color: '#dc2626' }}>
                            ⚠️ Are you sure?
                        </p>
                        <p style={{ margin: '8px 0 0', fontSize: '14px', color: '#7f1d1d' }}>
                            {selectedAction === 'purge_duplicates'
                                ? 'This will delete duplicate AI drafts, keeping only the newest of each product.'
                                : selectedAction === 'purge_ai_drafts'
                                    ? 'This will DELETE ALL products with ai_draft status.'
                                    : 'This will DELETE ALL products with ai_draft OR draft status. This cannot be undone!'}
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                            onClick={handleReset}
                            style={{
                                flex: 1,
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
                            Cancel
                        </button>
                        <button
                            onClick={confirmPurge}
                            style={{
                                flex: 1,
                                padding: '12px',
                                background: '#dc2626',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '6px',
                                fontSize: '14px',
                                fontWeight: 600,
                                cursor: 'pointer',
                            }}
                        >
                            Yes, Purge
                        </button>
                    </div>
                </div>
            )}

            {step === 'purging' && (
                <div style={{ padding: '20px', textAlign: 'center', color: '#dc2626' }}>
                    ⏳ Purging...
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
                            textAlign: 'center',
                        }}
                    >
                        <span style={{ fontSize: '32px', display: 'block', marginBottom: '8px' }}>✅</span>
                        <p style={{ margin: 0, fontWeight: 600, color: '#166534' }}>
                            {result.message}
                        </p>
                        {result.kept !== undefined && (
                            <p style={{ margin: '8px 0 0', fontSize: '14px', color: '#15803d' }}>
                                Kept: {result.kept} • Deleted: {result.deleted}
                            </p>
                        )}
                    </div>
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
                        Done
                    </button>
                </div>
            )}

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
                    <button
                        onClick={handleReset}
                        style={{
                            display: 'block',
                            marginTop: '8px',
                            padding: '8px 16px',
                            background: '#f3f4f6',
                            color: '#374151',
                            border: '1px solid #d1d5db',
                            borderRadius: '6px',
                            fontSize: '14px',
                            cursor: 'pointer',
                        }}
                    >
                        Try Again
                    </button>
                </div>
            )}
        </div>
    )
}

export default AdminPurge
