'use client'

import React, { useState, useEffect } from 'react'

/**
 * Email A/B Test Results Dashboard
 * 
 * View performance of A/B tested email subject lines.
 */

interface ABTestResult {
    templateId: string
    templateName: string
    variantA: {
        subject: string
        sent: number
        opened: number
        clicked: number
        openRate: string
    }
    variantB: {
        subject: string
        sent: number
        opened: number
        clicked: number
        openRate: string
    }
    winner: 'A' | 'B' | 'tie' | 'insufficient_data'
    confidence: string
}

export default function EmailABDashboard() {
    const [results, setResults] = useState<ABTestResult[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchABResults()
    }, [])

    const fetchABResults = async () => {
        try {
            // Fetch templates with A/B testing enabled
            const response = await fetch('/api/email-templates?where[subjectVariantB][exists]=true')
            const data = await response.json()

            if (data.docs) {
                const resultsWithStats = await Promise.all(
                    data.docs.map(async (template: any) => {
                        // Fetch send stats for this template
                        const statsResponse = await fetch(`/api/email-ab-results?templateId=${template.id}`)
                        const stats = await statsResponse.json()

                        return {
                            templateId: template.id,
                            templateName: template.subject,
                            variantA: {
                                subject: template.subject,
                                sent: stats.variantA?.sent || 0,
                                opened: stats.variantA?.opened || 0,
                                clicked: stats.variantA?.clicked || 0,
                                openRate: stats.variantA?.openRate || '0%',
                            },
                            variantB: {
                                subject: template.subjectVariantB || '',
                                sent: stats.variantB?.sent || 0,
                                opened: stats.variantB?.opened || 0,
                                clicked: stats.variantB?.clicked || 0,
                                openRate: stats.variantB?.openRate || '0%',
                            },
                            winner: stats.winner || 'insufficient_data',
                            confidence: stats.confidence || 'N/A',
                        }
                    })
                )
                setResults(resultsWithStats)
            }
        } catch (error) {
            console.error('Failed to fetch A/B results:', error)
        } finally {
            setLoading(false)
        }
    }

    const getWinnerBadge = (winner: string) => {
        switch (winner) {
            case 'A':
                return { bg: '#DCFCE7', text: '#16A34A', label: 'A Wins' }
            case 'B':
                return { bg: '#DBEAFE', text: '#2563EB', label: 'B Wins' }
            case 'tie':
                return { bg: '#FEF3C7', text: '#D97706', label: 'Tie' }
            default:
                return { bg: '#F3F4F6', text: '#6B7280', label: 'Collecting Data' }
        }
    }

    if (loading) {
        return (
            <div style={{ padding: '40px', textAlign: 'center' }}>
                <p>Loading A/B test results...</p>
            </div>
        )
    }

    return (
        <div style={{ padding: '20px', maxWidth: '1200px' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>
                📊 Email A/B Test Results
            </h1>
            <p style={{ color: '#666', marginBottom: '24px' }}>
                Compare subject line performance across email variants
            </p>

            {results.length === 0 ? (
                <div style={{
                    padding: '40px',
                    textAlign: 'center',
                    backgroundColor: '#F9FAFB',
                    borderRadius: '12px',
                }}>
                    <p style={{ color: '#6B7280', fontSize: '16px' }}>
                        No A/B tests running yet. Add a Subject Variant B to any email template to start testing.
                    </p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {results.map((result) => {
                        const badge = getWinnerBadge(result.winner)
                        const totalSent = result.variantA.sent + result.variantB.sent

                        return (
                            <div
                                key={result.templateId}
                                style={{
                                    backgroundColor: '#fff',
                                    border: '1px solid #E5E7EB',
                                    borderRadius: '12px',
                                    padding: '20px',
                                }}
                            >
                                {/* Header */}
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    marginBottom: '16px',
                                }}>
                                    <div>
                                        <h3 style={{ fontSize: '16px', fontWeight: '600', margin: 0 }}>
                                            {result.templateName}
                                        </h3>
                                        <p style={{ fontSize: '12px', color: '#6B7280', margin: '4px 0 0' }}>
                                            {totalSent} emails sent
                                        </p>
                                    </div>
                                    <span style={{
                                        backgroundColor: badge.bg,
                                        color: badge.text,
                                        padding: '4px 12px',
                                        borderRadius: '20px',
                                        fontSize: '12px',
                                        fontWeight: '600',
                                    }}>
                                        {badge.label}
                                    </span>
                                </div>

                                {/* Variants comparison */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    {/* Variant A */}
                                    <div style={{
                                        backgroundColor: result.winner === 'A' ? '#F0FDF4' : '#F9FAFB',
                                        padding: '16px',
                                        borderRadius: '8px',
                                        border: result.winner === 'A' ? '2px solid #16A34A' : '1px solid #E5E7EB',
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                                            <span style={{
                                                backgroundColor: '#E5E7EB',
                                                color: '#374151',
                                                padding: '2px 8px',
                                                borderRadius: '4px',
                                                fontSize: '12px',
                                                fontWeight: '600',
                                                marginRight: '8px',
                                            }}>
                                                A
                                            </span>
                                            <span style={{ fontSize: '12px', color: '#6B7280' }}>Control</span>
                                        </div>
                                        <p style={{
                                            fontSize: '14px',
                                            fontWeight: '500',
                                            color: '#1F2937',
                                            marginBottom: '12px',
                                            fontStyle: 'italic',
                                        }}>
                                            "{result.variantA.subject}"
                                        </p>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                                            <div>
                                                <p style={{ fontSize: '20px', fontWeight: 'bold', color: '#1F2937', margin: 0 }}>
                                                    {result.variantA.openRate}
                                                </p>
                                                <p style={{ fontSize: '11px', color: '#6B7280', margin: '2px 0 0' }}>Open Rate</p>
                                            </div>
                                            <div>
                                                <p style={{ fontSize: '20px', fontWeight: 'bold', color: '#1F2937', margin: 0 }}>
                                                    {result.variantA.opened}
                                                </p>
                                                <p style={{ fontSize: '11px', color: '#6B7280', margin: '2px 0 0' }}>Opened</p>
                                            </div>
                                            <div>
                                                <p style={{ fontSize: '20px', fontWeight: 'bold', color: '#1F2937', margin: 0 }}>
                                                    {result.variantA.clicked}
                                                </p>
                                                <p style={{ fontSize: '11px', color: '#6B7280', margin: '2px 0 0' }}>Clicked</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Variant B */}
                                    <div style={{
                                        backgroundColor: result.winner === 'B' ? '#EFF6FF' : '#F9FAFB',
                                        padding: '16px',
                                        borderRadius: '8px',
                                        border: result.winner === 'B' ? '2px solid #2563EB' : '1px solid #E5E7EB',
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                                            <span style={{
                                                backgroundColor: '#DBEAFE',
                                                color: '#2563EB',
                                                padding: '2px 8px',
                                                borderRadius: '4px',
                                                fontSize: '12px',
                                                fontWeight: '600',
                                                marginRight: '8px',
                                            }}>
                                                B
                                            </span>
                                            <span style={{ fontSize: '12px', color: '#6B7280' }}>Variant</span>
                                        </div>
                                        <p style={{
                                            fontSize: '14px',
                                            fontWeight: '500',
                                            color: '#1F2937',
                                            marginBottom: '12px',
                                            fontStyle: 'italic',
                                        }}>
                                            "{result.variantB.subject}"
                                        </p>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                                            <div>
                                                <p style={{ fontSize: '20px', fontWeight: 'bold', color: '#1F2937', margin: 0 }}>
                                                    {result.variantB.openRate}
                                                </p>
                                                <p style={{ fontSize: '11px', color: '#6B7280', margin: '2px 0 0' }}>Open Rate</p>
                                            </div>
                                            <div>
                                                <p style={{ fontSize: '20px', fontWeight: 'bold', color: '#1F2937', margin: 0 }}>
                                                    {result.variantB.opened}
                                                </p>
                                                <p style={{ fontSize: '11px', color: '#6B7280', margin: '2px 0 0' }}>Opened</p>
                                            </div>
                                            <div>
                                                <p style={{ fontSize: '20px', fontWeight: 'bold', color: '#1F2937', margin: 0 }}>
                                                    {result.variantB.clicked}
                                                </p>
                                                <p style={{ fontSize: '11px', color: '#6B7280', margin: '2px 0 0' }}>Clicked</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Statistical confidence */}
                                {result.winner !== 'insufficient_data' && (
                                    <p style={{
                                        marginTop: '12px',
                                        fontSize: '12px',
                                        color: '#6B7280',
                                        textAlign: 'center',
                                    }}>
                                        Statistical confidence: {result.confidence}
                                    </p>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Tips */}
            <div style={{
                marginTop: '24px',
                padding: '16px',
                backgroundColor: '#FEF3C7',
                borderRadius: '8px',
                border: '1px solid #F59E0B',
            }}>
                <strong>💡 Tips for A/B Testing:</strong>
                <ul style={{ margin: '8px 0 0', paddingLeft: '20px', fontSize: '14px' }}>
                    <li>Wait for at least 100 sends per variant before declaring a winner</li>
                    <li>Test one variable at a time (subject only, not body)</li>
                    <li>Look at click rate, not just open rate</li>
                </ul>
            </div>
        </div>
    )
}
