'use client'

import React, { useState } from 'react'

interface PollOption {
    name: string
    description: string
}

interface GeneratedPoll {
    title: string
    description: string
    options: PollOption[]
}

interface GenerationResult {
    success: boolean
    poll?: GeneratedPoll
    created?: boolean
    pollId?: number
    error?: string
}

type GenerationStep = 'idle' | 'generating' | 'preview' | 'creating' | 'done' | 'error'

const CategoryPollGenerator: React.FC = () => {
    const [step, setStep] = useState<GenerationStep>('idle')
    const [generatedPoll, setGeneratedPoll] = useState<GeneratedPoll | null>(null)
    const [createdPollId, setCreatedPollId] = useState<number | null>(null)
    const [error, setError] = useState<string | null>(null)

    const handleGenerate = async () => {
        setStep('generating')
        setError(null)
        setGeneratedPoll(null)

        try {
            const response = await fetch('/api/poll/category', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ autoCreate: false }),
            })

            const data: GenerationResult = await response.json()

            if (data.success && data.poll) {
                setStep('preview')
                setGeneratedPoll(data.poll)
            } else {
                setStep('error')
                setError(data.error || 'Generation failed')
            }
        } catch (err) {
            setStep('error')
            setError(err instanceof Error ? err.message : 'Network error')
        }
    }

    const handleCreatePoll = async () => {
        setStep('creating')

        try {
            const response = await fetch('/api/poll/category', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ autoCreate: true }),
            })

            const data: GenerationResult = await response.json()

            if (data.success && data.pollId) {
                setStep('done')
                setCreatedPollId(data.pollId)
            } else {
                setStep('error')
                setError(data.error || 'Failed to create poll')
            }
        } catch (err) {
            setStep('error')
            setError(err instanceof Error ? err.message : 'Network error')
        }
    }

    const handleReset = () => {
        setStep('idle')
        setGeneratedPoll(null)
        setCreatedPollId(null)
        setError(null)
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
                <span style={{ fontSize: '24px' }}>📊</span>
                <div>
                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Category Poll</h3>
                    <p style={{ margin: 0, fontSize: '14px', color: '#6e6e73' }}>
                        Ask members which category to investigate
                    </p>
                </div>
            </div>

            {(step === 'idle' || step === 'generating' || step === 'error') && (
                <>
                    <p style={{ fontSize: '13px', color: '#86868b', marginBottom: '16px' }}>
                        AI will suggest 6 product categories for members to vote on.
                        Great for deciding what type of products to focus your investigations on.
                    </p>

                    <button
                        onClick={handleGenerate}
                        disabled={step === 'generating'}
                        style={{
                            width: '100%',
                            padding: '12px',
                            background: step === 'generating' ? '#86868b' : '#6366f1',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '14px',
                            fontWeight: 600,
                            cursor: step === 'generating' ? 'not-allowed' : 'pointer',
                        }}
                    >
                        {step === 'generating' ? '⏳ Generating categories...' : '📊 Generate Category Poll'}
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

            {(step === 'preview' || step === 'creating') && generatedPoll && (
                <div>
                    <div
                        style={{
                            padding: '16px',
                            background: '#eef2ff',
                            border: '1px solid #c7d2fe',
                            borderRadius: '8px',
                            marginBottom: '16px',
                        }}
                    >
                        <p style={{ margin: '0 0 8px', fontSize: '12px', color: '#4338ca', fontWeight: 600, textTransform: 'uppercase' }}>
                            Preview
                        </p>
                        <h4 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 600, color: '#1f2937' }}>
                            {generatedPoll.title}
                        </h4>
                        <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>
                            {generatedPoll.description}
                        </p>
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <p style={{ fontWeight: 500, marginBottom: '8px', fontSize: '14px' }}>Categories:</p>
                        {generatedPoll.options.map((option, index) => (
                            <div
                                key={index}
                                style={{
                                    padding: '10px 12px',
                                    marginBottom: '6px',
                                    background: '#f9fafb',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '6px',
                                }}
                            >
                                <p style={{ margin: 0, fontWeight: 600, fontSize: '14px' }}>{option.name}</p>
                                <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#6b7280' }}>
                                    {option.description}
                                </p>
                            </div>
                        ))}
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                            onClick={handleReset}
                            disabled={step === 'creating'}
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
                            ↩️ Regenerate
                        </button>
                        <button
                            onClick={handleCreatePoll}
                            disabled={step === 'creating'}
                            style={{
                                flex: 2,
                                padding: '12px',
                                background: step === 'creating' ? '#86868b' : '#10b981',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '6px',
                                fontSize: '14px',
                                fontWeight: 600,
                                cursor: step === 'creating' ? 'not-allowed' : 'pointer',
                            }}
                        >
                            {step === 'creating' ? '⏳ Creating...' : '✅ Publish Poll'}
                        </button>
                    </div>
                </div>
            )}

            {step === 'done' && createdPollId && (
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
                        <span style={{ fontSize: '32px', display: 'block', marginBottom: '8px' }}>🎉</span>
                        <p style={{ margin: 0, fontWeight: 600, color: '#166534' }}>
                            Category Poll Published!
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
                            Create Another
                        </button>
                        <a
                            href={`/admin/collections/investigation-polls/${createdPollId}`}
                            style={{
                                flex: 2,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px',
                                padding: '12px',
                                background: '#1f2937',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '6px',
                                fontSize: '14px',
                                fontWeight: 600,
                                textDecoration: 'none',
                            }}
                        >
                            View Poll →
                        </a>
                    </div>
                </div>
            )}
        </div>
    )
}

export default CategoryPollGenerator
