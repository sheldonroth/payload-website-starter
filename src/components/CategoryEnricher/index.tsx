'use client'

import React, { useState, useEffect } from 'react'

interface Category {
    id: number
    name: string
    lastEnrichedAt?: string
}

interface EnrichmentResult {
    categoryName: string
    videosAnalyzed: number
    harmfulIngredients: number
    qualityIndicators: number
    productsChecked: number
    productsRecommended: number
}

const CategoryEnricher: React.FC = () => {
    const [categories, setCategories] = useState<Category[]>([])
    const [selectedCategory, setSelectedCategory] = useState<string>('')
    const [checkProducts, setCheckProducts] = useState(true)
    const [loading, setLoading] = useState(false)
    const [result, setResult] = useState<EnrichmentResult | null>(null)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const response = await fetch('/api/categories?limit=100&sort=name')
                const data = await response.json()
                setCategories(data.docs || [])
            } catch (err) {
                console.error('Failed to fetch categories:', err)
            }
        }
        fetchCategories()
    }, [])

    const handleEnrich = async () => {
        if (!selectedCategory) {
            setError('Please select a category')
            return
        }

        setLoading(true)
        setError(null)
        setResult(null)

        try {
            const response = await fetch('/api/category/enrich', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    categoryId: selectedCategory,
                    checkProducts,
                }),
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || 'Enrichment failed')
            }

            setResult(data)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to enrich category')
        } finally {
            setLoading(false)
        }
    }

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        })
    }

    return (
        <div
            style={{
                background: '#fff',
                borderRadius: '8px',
                border: '1px solid #e5e5e5',
                padding: '24px',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <span style={{ fontSize: '24px' }}>🔬</span>
                <div>
                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Category Enricher</h3>
                    <p style={{ margin: 0, fontSize: '14px', color: '#6e6e73' }}>
                        Extract research from video transcripts
                    </p>
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* Category Selector */}
                <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    style={{
                        padding: '10px 12px',
                        borderRadius: '6px',
                        border: '1px solid #d1d5db',
                        fontSize: '14px',
                        background: '#fff',
                    }}
                >
                    <option value="">Select a category...</option>
                    {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                            {cat.name}
                            {cat.lastEnrichedAt && ` (enriched ${formatDate(cat.lastEnrichedAt)})`}
                        </option>
                    ))}
                </select>

                {/* Options */}
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#374151' }}>
                    <input
                        type="checkbox"
                        checked={checkProducts}
                        onChange={(e) => setCheckProducts(e.target.checked)}
                    />
                    Also check products for harmful ingredients & mark as recommended
                </label>

                {/* Action Button */}
                <button
                    onClick={handleEnrich}
                    disabled={loading || !selectedCategory}
                    style={{
                        padding: '12px',
                        background: loading ? '#9ca3af' : '#8b5cf6',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '14px',
                        fontWeight: 600,
                        cursor: loading || !selectedCategory ? 'not-allowed' : 'pointer',
                    }}
                >
                    {loading ? '🔄 Analyzing Transcripts...' : '🔬 Enrich Category'}
                </button>
            </div>

            {/* Error Display */}
            {error && (
                <div
                    style={{
                        marginTop: '16px',
                        padding: '12px',
                        background: '#fee2e2',
                        color: '#dc2626',
                        borderRadius: '6px',
                        fontSize: '13px',
                    }}
                >
                    ❌ {error}
                </div>
            )}

            {/* Success Result */}
            {result && (
                <div
                    style={{
                        marginTop: '16px',
                        padding: '16px',
                        background: '#ecfdf5',
                        borderRadius: '6px',
                    }}
                >
                    <p style={{ margin: 0, fontWeight: 600, color: '#059669', fontSize: '14px' }}>
                        ✅ Enriched "{result.categoryName}"
                    </p>
                    <div style={{ marginTop: '8px', fontSize: '13px', color: '#047857' }}>
                        <p style={{ margin: '4px 0' }}>📹 Videos analyzed: {result.videosAnalyzed}</p>
                        <p style={{ margin: '4px 0' }}>⚠️ Harmful ingredients found: {result.harmfulIngredients}</p>
                        <p style={{ margin: '4px 0' }}>✅ Quality indicators found: {result.qualityIndicators}</p>
                        {result.productsChecked > 0 && (
                            <>
                                <p style={{ margin: '4px 0' }}>📦 Products checked: {result.productsChecked}</p>
                                <p style={{ margin: '4px 0' }}>🏆 Products recommended: {result.productsRecommended}</p>
                            </>
                        )}
                    </div>
                    <a
                        href={`/admin/collections/categories/${selectedCategory}`}
                        style={{
                            display: 'inline-block',
                            marginTop: '8px',
                            fontSize: '13px',
                            color: '#059669',
                        }}
                    >
                        View Category →
                    </a>
                </div>
            )}

            <p style={{ marginTop: '12px', fontSize: '11px', color: '#9ca3af' }}>
                Analyzes video transcripts with AI to find harmful ingredients and quality indicators.
            </p>
        </div>
    )
}

export default CategoryEnricher
