'use client'

import React, { useState, useEffect, useCallback } from 'react'

interface AIDraft {
    id: number
    name: string
    brand?: string
    category?: { name: string; id: number }
    verdict: string
    autoVerdict?: string
    aiConfidence?: 'high' | 'medium' | 'low'
    aiSourceType?: string
    sourceVideo?: { id: number; title: string; youtubeVideoId?: string }
    imageUrl?: string
    createdAt: string
    conflicts?: { detected?: string[] }
}

type ActionType = 'approve' | 'reject' | 'enrich'

const CONFIDENCE_COLORS = {
    high: { bg: '#dcfce7', text: '#166534', label: 'High' },
    medium: { bg: '#fef3c7', text: '#92400e', label: 'Medium' },
    low: { bg: '#fee2e2', text: '#991b1b', label: 'Low' },
}

const VERDICT_COLORS = {
    recommend: { bg: '#dcfce7', text: '#166534', icon: '&#x2705;' },
    avoid: { bg: '#fee2e2', text: '#991b1b', icon: '&#x1F6AB;' },
}

const AIDraftInbox: React.FC = () => {
    const [drafts, setDrafts] = useState<AIDraft[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
    const [processingIds, setProcessingIds] = useState<Set<number>>(new Set())
    const [filter, setFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all')

    const fetchDrafts = useCallback(async () => {
        try {
            const response = await fetch('/api/products?where[status][equals]=ai_draft&sort=-createdAt&limit=50&depth=1')
            const data = await response.json()
            setDrafts(data.docs || [])
            setError(null)
        } catch (err) {
            setError('Failed to load AI drafts')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchDrafts()
    }, [fetchDrafts])

    const handleAction = async (id: number, action: ActionType) => {
        setProcessingIds(prev => new Set(prev).add(id))

        try {
            if (action === 'approve') {
                await fetch(`/api/products/${id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: 'draft' }),
                })
                setDrafts(prev => prev.filter(d => d.id !== id))
            } else if (action === 'reject') {
                await fetch(`/api/products/${id}`, { method: 'DELETE' })
                setDrafts(prev => prev.filter(d => d.id !== id))
            } else if (action === 'enrich') {
                await fetch('/api/product/enrich', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ productId: id, autoApply: true }),
                })
                await fetchDrafts()
            }
            setSelectedIds(prev => {
                const next = new Set(prev)
                next.delete(id)
                return next
            })
        } catch (err) {
            setError(`Failed to ${action} draft`)
        } finally {
            setProcessingIds(prev => {
                const next = new Set(prev)
                next.delete(id)
                return next
            })
        }
    }

    const handleBulkAction = async (action: 'approve' | 'reject') => {
        const ids = Array.from(selectedIds)
        for (const id of ids) {
            await handleAction(id, action)
        }
    }

    const toggleSelect = (id: number) => {
        setSelectedIds(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const toggleSelectAll = () => {
        if (selectedIds.size === filteredDrafts.length) {
            setSelectedIds(new Set())
        } else {
            setSelectedIds(new Set(filteredDrafts.map(d => d.id)))
        }
    }

    const filteredDrafts = filter === 'all'
        ? drafts
        : drafts.filter(d => d.aiConfidence === filter)

    if (loading) {
        return (
            <div style={{
                background: '#fff',
                borderRadius: '8px',
                border: '1px solid #e5e5e5',
                padding: '40px',
                textAlign: 'center',
                color: '#6b7280',
            }}>
                Loading AI drafts...
            </div>
        )
    }

    return (
        <div
            style={{
                background: '#fff',
                borderRadius: '12px',
                border: '1px solid #e5e5e5',
                overflow: 'hidden',
            }}
        >
            {/* Header */}
            <div
                style={{
                    padding: '20px 24px',
                    borderBottom: '1px solid #e5e5e5',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: '#fafafa',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '28px' }}>&#x1F4E5;</span>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#111827' }}>
                            AI Draft Inbox
                        </h3>
                        <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>
                            {drafts.length} product{drafts.length !== 1 ? 's' : ''} awaiting review
                        </p>
                    </div>
                </div>

                {/* Filters */}
                <div style={{ display: 'flex', gap: '8px' }}>
                    {(['all', 'high', 'medium', 'low'] as const).map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            style={{
                                padding: '6px 12px',
                                border: '1px solid',
                                borderColor: filter === f ? '#6366f1' : '#e5e7eb',
                                background: filter === f ? '#eef2ff' : '#fff',
                                color: filter === f ? '#6366f1' : '#6b7280',
                                borderRadius: '6px',
                                fontSize: '12px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                textTransform: 'capitalize',
                            }}
                        >
                            {f === 'all' ? 'All' : `${f} Confidence`}
                        </button>
                    ))}
                </div>
            </div>

            {/* Bulk Actions Bar */}
            {selectedIds.size > 0 && (
                <div
                    style={{
                        padding: '12px 24px',
                        background: '#eef2ff',
                        borderBottom: '1px solid #c7d2fe',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '16px',
                    }}
                >
                    <span style={{ fontSize: '14px', fontWeight: 600, color: '#4f46e5' }}>
                        {selectedIds.size} selected
                    </span>
                    <button
                        onClick={() => handleBulkAction('approve')}
                        style={{
                            padding: '6px 14px',
                            background: '#10b981',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '13px',
                            fontWeight: 600,
                            cursor: 'pointer',
                        }}
                    >
                        &#x2705; Approve All
                    </button>
                    <button
                        onClick={() => handleBulkAction('reject')}
                        style={{
                            padding: '6px 14px',
                            background: '#ef4444',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '13px',
                            fontWeight: 600,
                            cursor: 'pointer',
                        }}
                    >
                        &#x1F5D1; Reject All
                    </button>
                    <button
                        onClick={() => setSelectedIds(new Set())}
                        style={{
                            padding: '6px 14px',
                            background: 'transparent',
                            color: '#6b7280',
                            border: '1px solid #e5e7eb',
                            borderRadius: '6px',
                            fontSize: '13px',
                            cursor: 'pointer',
                        }}
                    >
                        Clear
                    </button>
                </div>
            )}

            {error && (
                <div style={{ padding: '12px 24px', background: '#fef2f2', color: '#dc2626', fontSize: '14px' }}>
                    {error}
                </div>
            )}

            {/* Empty State */}
            {filteredDrafts.length === 0 && (
                <div style={{ padding: '60px 24px', textAlign: 'center' }}>
                    <span style={{ fontSize: '48px', display: 'block', marginBottom: '16px' }}>&#x1F389;</span>
                    <h4 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 600, color: '#111827' }}>
                        {filter === 'all' ? 'Inbox Zero!' : `No ${filter} confidence drafts`}
                    </h4>
                    <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>
                        {filter === 'all'
                            ? 'All AI-generated products have been reviewed'
                            : 'Try a different confidence filter'}
                    </p>
                </div>
            )}

            {/* Draft List */}
            {filteredDrafts.length > 0 && (
                <div>
                    {/* Select All Row */}
                    <div
                        style={{
                            padding: '10px 24px',
                            borderBottom: '1px solid #f3f4f6',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            background: '#fafafa',
                        }}
                    >
                        <input
                            type="checkbox"
                            checked={selectedIds.size === filteredDrafts.length && filteredDrafts.length > 0}
                            onChange={toggleSelectAll}
                            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                        />
                        <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: 500 }}>
                            Select all ({filteredDrafts.length})
                        </span>
                    </div>

                    {filteredDrafts.map((draft) => {
                        const isProcessing = processingIds.has(draft.id)
                        const isSelected = selectedIds.has(draft.id)
                        const confidence = draft.aiConfidence ? CONFIDENCE_COLORS[draft.aiConfidence] : null
                        const verdict = VERDICT_COLORS[draft.verdict as keyof typeof VERDICT_COLORS] || VERDICT_COLORS.recommend

                        return (
                            <div
                                key={draft.id}
                                style={{
                                    padding: '16px 24px',
                                    borderBottom: '1px solid #f3f4f6',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '16px',
                                    opacity: isProcessing ? 0.5 : 1,
                                    background: isSelected ? '#f0f9ff' : '#fff',
                                    transition: 'all 0.15s',
                                }}
                            >
                                {/* Checkbox */}
                                <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => toggleSelect(draft.id)}
                                    disabled={isProcessing}
                                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                />

                                {/* Image */}
                                <div
                                    style={{
                                        width: '56px',
                                        height: '56px',
                                        borderRadius: '8px',
                                        background: '#f3f4f6',
                                        overflow: 'hidden',
                                        flexShrink: 0,
                                    }}
                                >
                                    {draft.imageUrl ? (
                                        <img
                                            src={draft.imageUrl}
                                            alt={draft.name}
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).style.display = 'none'
                                            }}
                                        />
                                    ) : (
                                        <div style={{
                                            width: '100%',
                                            height: '100%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '24px',
                                            color: '#d1d5db',
                                        }}>
                                            &#x1F4E6;
                                        </div>
                                    )}
                                </div>

                                {/* Info */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                        <a
                                            href={`/admin/collections/products/${draft.id}`}
                                            style={{
                                                fontSize: '15px',
                                                fontWeight: 600,
                                                color: '#111827',
                                                textDecoration: 'none',
                                            }}
                                        >
                                            {draft.name}
                                        </a>
                                        {/* Verdict Badge */}
                                        <span
                                            style={{
                                                padding: '2px 8px',
                                                background: verdict.bg,
                                                color: verdict.text,
                                                fontSize: '11px',
                                                fontWeight: 600,
                                                borderRadius: '4px',
                                                textTransform: 'uppercase',
                                            }}
                                            dangerouslySetInnerHTML={{ __html: `${verdict.icon} ${draft.verdict}` }}
                                        />
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px', color: '#6b7280' }}>
                                        {draft.brand && <span>{draft.brand}</span>}
                                        {draft.category && (
                                            <span style={{ color: '#9ca3af' }}>
                                                &#x1F4C1; {draft.category.name}
                                            </span>
                                        )}
                                        {confidence && (
                                            <span
                                                style={{
                                                    padding: '2px 6px',
                                                    background: confidence.bg,
                                                    color: confidence.text,
                                                    fontSize: '10px',
                                                    fontWeight: 600,
                                                    borderRadius: '3px',
                                                }}
                                            >
                                                {confidence.label} Confidence
                                            </span>
                                        )}
                                        {draft.sourceVideo && (
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <span style={{ color: '#ef4444' }}>&#x25B6;</span>
                                                <a
                                                    href={draft.sourceVideo.youtubeVideoId
                                                        ? `https://youtube.com/watch?v=${draft.sourceVideo.youtubeVideoId}`
                                                        : `/admin/collections/videos/${draft.sourceVideo.id}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    style={{
                                                        color: '#6366f1',
                                                        textDecoration: 'none',
                                                        fontSize: '12px',
                                                    }}
                                                    title={`From: ${draft.sourceVideo.title}`}
                                                >
                                                    {draft.sourceVideo.title || 'Source Video'}
                                                </a>
                                            </span>
                                        )}
                                    </div>
                                    {draft.conflicts?.detected && draft.conflicts.detected.length > 0 && (
                                        <div style={{ marginTop: '6px', fontSize: '12px', color: '#dc2626' }}>
                                            &#x26A0;&#xFE0F; {draft.conflicts.detected.length} conflict{draft.conflicts.detected.length > 1 ? 's' : ''}
                                        </div>
                                    )}
                                </div>

                                {/* Actions */}
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button
                                        onClick={() => handleAction(draft.id, 'approve')}
                                        disabled={isProcessing}
                                        title="Approve (promote to Draft)"
                                        style={{
                                            padding: '8px 12px',
                                            background: '#10b981',
                                            color: '#fff',
                                            border: 'none',
                                            borderRadius: '6px',
                                            fontSize: '13px',
                                            fontWeight: 600,
                                            cursor: isProcessing ? 'not-allowed' : 'pointer',
                                        }}
                                    >
                                        &#x2705;
                                    </button>
                                    <button
                                        onClick={() => handleAction(draft.id, 'enrich')}
                                        disabled={isProcessing}
                                        title="Enrich (find image & price)"
                                        style={{
                                            padding: '8px 12px',
                                            background: '#6366f1',
                                            color: '#fff',
                                            border: 'none',
                                            borderRadius: '6px',
                                            fontSize: '13px',
                                            fontWeight: 600,
                                            cursor: isProcessing ? 'not-allowed' : 'pointer',
                                        }}
                                    >
                                        &#x1F50D;
                                    </button>
                                    <button
                                        onClick={() => handleAction(draft.id, 'reject')}
                                        disabled={isProcessing}
                                        title="Reject (delete)"
                                        style={{
                                            padding: '8px 12px',
                                            background: '#ef4444',
                                            color: '#fff',
                                            border: 'none',
                                            borderRadius: '6px',
                                            fontSize: '13px',
                                            fontWeight: 600,
                                            cursor: isProcessing ? 'not-allowed' : 'pointer',
                                        }}
                                    >
                                        &#x1F5D1;
                                    </button>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Footer */}
            {filteredDrafts.length > 0 && (
                <div
                    style={{
                        padding: '12px 24px',
                        background: '#fafafa',
                        borderTop: '1px solid #e5e5e5',
                        textAlign: 'center',
                    }}
                >
                    <a
                        href="/admin/collections/products?where[status][equals]=ai_draft"
                        style={{ fontSize: '13px', color: '#6366f1', textDecoration: 'none' }}
                    >
                        View all AI drafts in list view &#x2192;
                    </a>
                </div>
            )}
        </div>
    )
}

export default AIDraftInbox
