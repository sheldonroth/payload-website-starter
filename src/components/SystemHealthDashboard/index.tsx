'use client'

import React, { useState, useEffect, useCallback } from 'react'

interface AuditError {
    id: number
    action: string
    errorMessage?: string
    targetCollection?: string
    targetId?: number
    targetName?: string
    metadata?: {
        category?: string
        errorName?: string
        errorMessage?: string
        isWarning?: boolean
        timestamp?: string
    }
    retryable?: boolean
    retryEndpoint?: string
    retryPayload?: Record<string, unknown>
    retryCount?: number
    resolvedAt?: string
    createdAt: string
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string; icon: string }> = {
    ingredient_parse_error: { bg: '#fef3c7', text: '#92400e', icon: '&#x1F9EA;' },
    category_hydration_error: { bg: '#e0f2fe', text: '#0369a1', icon: '&#x1F4C1;' },
    verdict_calculation_error: { bg: '#fce7f3', text: '#9d174d', icon: '&#x2696;' },
    conflict_detection_error: { bg: '#fee2e2', text: '#991b1b', icon: '&#x26A0;' },
    enrichment_error: { bg: '#ddd6fe', text: '#6b21a8', icon: '&#x1F50D;' },
    image_processing_error: { bg: '#ccfbf1', text: '#0f766e', icon: '&#x1F5BC;' },
    fuzzy_match_error: { bg: '#fef3c7', text: '#92400e', icon: '&#x1F50E;' },
    ai_classification_error: { bg: '#e0e7ff', text: '#4338ca', icon: '&#x1F916;' },
    safe_alternatives_error: { bg: '#dcfce7', text: '#166534', icon: '&#x1F500;' },
    ocr_extraction_error: { bg: '#f5f5f4', text: '#57534e', icon: '&#x1F4F7;' },
    threshold_fetch_error: { bg: '#fef3c7', text: '#92400e', icon: '&#x2699;' },
    default: { bg: '#f3f4f6', text: '#374151', icon: '&#x2753;' },
}

const SystemHealthDashboard: React.FC = () => {
    const [errors, setErrors] = useState<AuditError[]>([])
    const [loading, setLoading] = useState(true)
    const [retryingIds, setRetryingIds] = useState<Set<number>>(new Set())
    const [filter, setFilter] = useState<'all' | 'unresolved' | 'retryable'>('unresolved')
    const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null)

    const fetchErrors = useCallback(async () => {
        try {
            // Fetch errors (action=error, success=false or warnings)
            let url = '/api/audit-log?where[action][equals]=error&sort=-createdAt&limit=50&depth=0'

            if (filter === 'unresolved') {
                url += '&where[resolvedAt][exists]=false&where[success][equals]=false'
            } else if (filter === 'retryable') {
                url += '&where[retryable][equals]=true&where[resolvedAt][exists]=false'
            }

            const response = await fetch(url)
            const data = await response.json()
            setErrors(data.docs || [])
        } catch (err) {
            console.error('Failed to fetch errors:', err)
        } finally {
            setLoading(false)
        }
    }, [filter])

    useEffect(() => {
        fetchErrors()

        // Auto-refresh every 30 seconds
        const interval = setInterval(fetchErrors, 30000)
        setRefreshInterval(interval)

        return () => {
            if (interval) clearInterval(interval)
        }
    }, [fetchErrors])

    const handleRetry = async (error: AuditError) => {
        if (!error.retryEndpoint) return

        setRetryingIds((prev) => new Set(prev).add(error.id))

        try {
            const response = await fetch('/api/error/retry', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ errorId: error.id }),
            })

            if (response.ok) {
                // Refresh to get updated status
                await fetchErrors()
            } else {
                console.error('Retry failed:', await response.text())
            }
        } catch (err) {
            console.error('Retry error:', err)
        } finally {
            setRetryingIds((prev) => {
                const next = new Set(prev)
                next.delete(error.id)
                return next
            })
        }
    }

    const handleMarkResolved = async (errorId: number) => {
        try {
            await fetch(`/api/audit-log/${errorId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ resolvedAt: new Date().toISOString() }),
            })
            await fetchErrors()
        } catch (err) {
            console.error('Failed to mark resolved:', err)
        }
    }

    const getTimeAgo = (dateString: string) => {
        const date = new Date(dateString)
        const now = new Date()
        const diffMs = now.getTime() - date.getTime()
        const diffMins = Math.floor(diffMs / 60000)
        const diffHours = Math.floor(diffMins / 60)
        const diffDays = Math.floor(diffHours / 24)

        if (diffMins < 1) return 'just now'
        if (diffMins < 60) return `${diffMins}m ago`
        if (diffHours < 24) return `${diffHours}h ago`
        return `${diffDays}d ago`
    }

    const unresolvedCount = errors.filter((e) => !e.resolvedAt && !e.metadata?.isWarning).length
    const retryableCount = errors.filter((e) => e.retryable && !e.resolvedAt).length

    if (loading) {
        return (
            <div
                style={{
                    background: '#fff',
                    borderRadius: '8px',
                    border: '1px solid #e5e5e5',
                    padding: '40px',
                    textAlign: 'center',
                    color: '#6b7280',
                }}
            >
                Loading system health...
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
                    background: unresolvedCount > 0 ? '#fef2f2' : '#f0fdf4',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '28px' }}>
                        {unresolvedCount > 0 ? '\u{1F6A8}' : '\u{2705}'}
                    </span>
                    <div>
                        <h3
                            style={{
                                margin: 0,
                                fontSize: '18px',
                                fontWeight: 700,
                                color: unresolvedCount > 0 ? '#991b1b' : '#166534',
                            }}
                        >
                            System Health
                        </h3>
                        <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>
                            {unresolvedCount > 0
                                ? `${unresolvedCount} unresolved error${unresolvedCount !== 1 ? 's' : ''}`
                                : 'All systems operational'}
                            {retryableCount > 0 && ` (${retryableCount} retryable)`}
                        </p>
                    </div>
                </div>

                {/* Filters */}
                <div style={{ display: 'flex', gap: '8px' }}>
                    {(['unresolved', 'retryable', 'all'] as const).map((f) => (
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
                            {f}
                        </button>
                    ))}
                </div>
            </div>

            {/* Empty State */}
            {errors.length === 0 && (
                <div style={{ padding: '60px 24px', textAlign: 'center' }}>
                    <span style={{ fontSize: '48px', display: 'block', marginBottom: '16px' }}>
                        {'\u{1F389}'}
                    </span>
                    <h4
                        style={{
                            margin: '0 0 8px',
                            fontSize: '18px',
                            fontWeight: 600,
                            color: '#111827',
                        }}
                    >
                        No errors found
                    </h4>
                    <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>
                        {filter === 'unresolved'
                            ? 'All errors have been resolved'
                            : filter === 'retryable'
                              ? 'No retryable errors at this time'
                              : 'System is running smoothly'}
                    </p>
                </div>
            )}

            {/* Error List */}
            {errors.length > 0 && (
                <div>
                    {errors.map((error) => {
                        const isRetrying = retryingIds.has(error.id)
                        const category = error.metadata?.category || 'default'
                        const colors = CATEGORY_COLORS[category] || CATEGORY_COLORS.default
                        const isWarning = error.metadata?.isWarning
                        const isResolved = !!error.resolvedAt

                        return (
                            <div
                                key={error.id}
                                style={{
                                    padding: '16px 24px',
                                    borderBottom: '1px solid #f3f4f6',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '16px',
                                    opacity: isRetrying || isResolved ? 0.6 : 1,
                                    background: isResolved ? '#f9fafb' : '#fff',
                                }}
                            >
                                {/* Icon */}
                                <div
                                    style={{
                                        width: '40px',
                                        height: '40px',
                                        borderRadius: '8px',
                                        background: colors.bg,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0,
                                    }}
                                    dangerouslySetInnerHTML={{ __html: colors.icon }}
                                />

                                {/* Info */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            marginBottom: '4px',
                                        }}
                                    >
                                        <span
                                            style={{
                                                fontSize: '14px',
                                                fontWeight: 600,
                                                color: '#111827',
                                            }}
                                        >
                                            {error.errorMessage || error.metadata?.errorMessage || 'Unknown error'}
                                        </span>
                                        {/* Category Badge */}
                                        <span
                                            style={{
                                                padding: '2px 8px',
                                                background: colors.bg,
                                                color: colors.text,
                                                fontSize: '10px',
                                                fontWeight: 600,
                                                borderRadius: '4px',
                                            }}
                                        >
                                            {category.replace(/_/g, ' ')}
                                        </span>
                                        {isWarning && (
                                            <span
                                                style={{
                                                    padding: '2px 8px',
                                                    background: '#fef3c7',
                                                    color: '#92400e',
                                                    fontSize: '10px',
                                                    fontWeight: 600,
                                                    borderRadius: '4px',
                                                }}
                                            >
                                                WARNING
                                            </span>
                                        )}
                                        {isResolved && (
                                            <span
                                                style={{
                                                    padding: '2px 8px',
                                                    background: '#dcfce7',
                                                    color: '#166534',
                                                    fontSize: '10px',
                                                    fontWeight: 600,
                                                    borderRadius: '4px',
                                                }}
                                            >
                                                RESOLVED
                                            </span>
                                        )}
                                    </div>
                                    <div
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '12px',
                                            fontSize: '12px',
                                            color: '#6b7280',
                                        }}
                                    >
                                        <span>{getTimeAgo(error.createdAt)}</span>
                                        {error.targetCollection && error.targetId && (
                                            <a
                                                href={`/admin/collections/${error.targetCollection}/${error.targetId}`}
                                                style={{
                                                    color: '#6366f1',
                                                    textDecoration: 'none',
                                                }}
                                            >
                                                {error.targetName || `${error.targetCollection} #${error.targetId}`}
                                            </a>
                                        )}
                                        {error.retryCount !== undefined && error.retryCount > 0 && (
                                            <span style={{ color: '#9ca3af' }}>
                                                {error.retryCount} retry attempt{error.retryCount !== 1 ? 's' : ''}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Actions */}
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    {error.retryable && !isResolved && (
                                        <button
                                            onClick={() => handleRetry(error)}
                                            disabled={isRetrying}
                                            title={`Retry via ${error.retryEndpoint}`}
                                            style={{
                                                padding: '8px 12px',
                                                background: '#6366f1',
                                                color: '#fff',
                                                border: 'none',
                                                borderRadius: '6px',
                                                fontSize: '13px',
                                                fontWeight: 600,
                                                cursor: isRetrying ? 'not-allowed' : 'pointer',
                                                opacity: isRetrying ? 0.7 : 1,
                                            }}
                                        >
                                            {isRetrying ? '...' : '\u{1F504}'} Retry
                                        </button>
                                    )}
                                    {!isResolved && !isWarning && (
                                        <button
                                            onClick={() => handleMarkResolved(error.id)}
                                            title="Mark as resolved"
                                            style={{
                                                padding: '8px 12px',
                                                background: '#10b981',
                                                color: '#fff',
                                                border: 'none',
                                                borderRadius: '6px',
                                                fontSize: '13px',
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                            }}
                                        >
                                            {'\u{2705}'} Resolve
                                        </button>
                                    )}
                                    <a
                                        href={`/admin/collections/audit-log/${error.id}`}
                                        style={{
                                            padding: '8px 12px',
                                            background: 'transparent',
                                            color: '#6b7280',
                                            border: '1px solid #e5e7eb',
                                            borderRadius: '6px',
                                            fontSize: '13px',
                                            textDecoration: 'none',
                                            display: 'flex',
                                            alignItems: 'center',
                                        }}
                                    >
                                        Details
                                    </a>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Footer */}
            {errors.length > 0 && (
                <div
                    style={{
                        padding: '12px 24px',
                        background: '#fafafa',
                        borderTop: '1px solid #e5e5e5',
                        textAlign: 'center',
                    }}
                >
                    <a
                        href="/admin/collections/audit-log?where[action][equals]=error"
                        style={{ fontSize: '13px', color: '#6366f1', textDecoration: 'none' }}
                    >
                        View all errors in Audit Log {'\u{2192}'}
                    </a>
                </div>
            )}
        </div>
    )
}

export default SystemHealthDashboard
