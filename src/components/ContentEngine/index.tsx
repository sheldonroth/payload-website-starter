'use client'

import React, { useState } from 'react'

/**
 * Content Engine Admin Component
 * 
 * Generate AI content (listicles, TikTok scripts, comparisons, controversy)
 * that gets saved to GeneratedContent collection for review.
 */

interface GenerationResult {
    success: boolean
    contentId?: string
    preview?: {
        title: string
        content: string
    }
    message?: string
    error?: string
}

export default function ContentEngine() {
    const [contentType, setContentType] = useState<string>('listicle')
    const [category, setCategory] = useState<string>('')
    const [customTitle, setCustomTitle] = useState<string>('')
    const [productIds, setProductIds] = useState<string>('')
    const [context, setContext] = useState<string>('')
    const [loading, setLoading] = useState<boolean>(false)
    const [result, setResult] = useState<GenerationResult | null>(null)

    const handleGenerate = async () => {
        setLoading(true)
        setResult(null)

        try {
            const response = await fetch('/api/content/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: contentType,
                    category: category || undefined,
                    products: productIds ? productIds.split(',').map(id => id.trim()) : undefined,
                    title: customTitle || undefined,
                    context: context || undefined,
                }),
            })

            const data = await response.json()
            setResult(data)
        } catch (error) {
            setResult({ success: false, error: String(error) })
        } finally {
            setLoading(false)
        }
    }

    return (
        <div style={{ padding: '20px', maxWidth: '800px' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '20px' }}>
                🚀 Content Engine
            </h1>
            <p style={{ color: '#666', marginBottom: '24px' }}>
                Generate AI content that gets saved for your review before publishing.
                All content includes legal compliance checks.
            </p>

            {/* Content Type */}
            <div style={{ marginBottom: '16px' }}>
                <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>
                    Content Type
                </label>
                <select
                    value={contentType}
                    onChange={(e) => setContentType(e.target.value)}
                    style={{
                        width: '100%',
                        padding: '10px',
                        borderRadius: '6px',
                        border: '1px solid #ddd',
                        fontSize: '14px',
                    }}
                >
                    <option value="listicle">📝 Listicle (e.g., "10 Sunscreens We Recommend")</option>
                    <option value="tiktok_script">🎬 TikTok/Shorts Script</option>
                    <option value="comparison">⚖️ Product Comparison</option>
                    <option value="controversy">⚠️ Controversy Article</option>
                    <option value="product_review">📄 Product Review Page (SEO)</option>
                </select>
            </div>

            {/* Category */}
            <div style={{ marginBottom: '16px' }}>
                <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>
                    Category (optional)
                </label>
                <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="e.g., sunscreen, moisturizer, baby-products"
                    style={{
                        width: '100%',
                        padding: '10px',
                        borderRadius: '6px',
                        border: '1px solid #ddd',
                        fontSize: '14px',
                    }}
                />
                <small style={{ color: '#999' }}>
                    Enter a category slug to auto-pull products from that category
                </small>
            </div>

            {/* Product IDs */}
            <div style={{ marginBottom: '16px' }}>
                <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>
                    Specific Product IDs (optional)
                </label>
                <input
                    type="text"
                    value={productIds}
                    onChange={(e) => setProductIds(e.target.value)}
                    placeholder="product-id-1, product-id-2"
                    style={{
                        width: '100%',
                        padding: '10px',
                        borderRadius: '6px',
                        border: '1px solid #ddd',
                        fontSize: '14px',
                    }}
                />
                <small style={{ color: '#999' }}>
                    Comma-separated product IDs for specific products
                </small>
            </div>

            {/* Custom Title */}
            <div style={{ marginBottom: '16px' }}>
                <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>
                    Title Direction (optional)
                </label>
                <input
                    type="text"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    placeholder="e.g., Clean brands that disappointed us"
                    style={{
                        width: '100%',
                        padding: '10px',
                        borderRadius: '6px',
                        border: '1px solid #ddd',
                        fontSize: '14px',
                    }}
                />
            </div>

            {/* Context */}
            <div style={{ marginBottom: '24px' }}>
                <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>
                    Additional Context (optional)
                </label>
                <textarea
                    value={context}
                    onChange={(e) => setContext(e.target.value)}
                    placeholder="Any additional context for the AI..."
                    rows={3}
                    style={{
                        width: '100%',
                        padding: '10px',
                        borderRadius: '6px',
                        border: '1px solid #ddd',
                        fontSize: '14px',
                        resize: 'vertical',
                    }}
                />
            </div>

            {/* Generate Button */}
            <button
                onClick={handleGenerate}
                disabled={loading}
                style={{
                    backgroundColor: loading ? '#ccc' : '#7C3AED',
                    color: 'white',
                    padding: '12px 24px',
                    borderRadius: '6px',
                    border: 'none',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    width: '100%',
                }}
            >
                {loading ? '⏳ Generating...' : '✨ Generate Content'}
            </button>

            {/* Legal Notice */}
            <div style={{
                marginTop: '16px',
                padding: '12px',
                backgroundColor: '#FEF3C7',
                borderRadius: '6px',
                border: '1px solid #F59E0B',
            }}>
                <strong>⚖️ Legal Notice:</strong> All generated content includes compliance checks.
                Review in the <a href="/admin/collections/generated-content" style={{ color: '#7C3AED' }}>Generated Content</a> collection before publishing.
            </div>

            {/* Result */}
            {result && (
                <div style={{
                    marginTop: '24px',
                    padding: '16px',
                    backgroundColor: result.success ? '#ECFDF5' : '#FEF2F2',
                    borderRadius: '8px',
                    border: `1px solid ${result.success ? '#10B981' : '#EF4444'}`,
                }}>
                    <h3 style={{ fontWeight: 'bold', marginBottom: '12px' }}>
                        {result.success ? '✅ Content Generated' : '❌ Generation Failed'}
                    </h3>

                    {result.success && result.preview && (
                        <>
                            <p><strong>Title:</strong> {result.preview.title}</p>
                            <p style={{ marginTop: '8px' }}><strong>Preview:</strong></p>
                            <div style={{
                                backgroundColor: 'white',
                                padding: '12px',
                                borderRadius: '6px',
                                marginTop: '8px',
                                whiteSpace: 'pre-wrap',
                                fontSize: '14px',
                                maxHeight: '300px',
                                overflow: 'auto',
                            }}>
                                {result.preview.content}
                            </div>
                            <p style={{ marginTop: '12px' }}>
                                <a
                                    href={`/admin/collections/generated-content/${result.contentId}`}
                                    style={{
                                        color: '#7C3AED',
                                        textDecoration: 'underline',
                                    }}
                                >
                                    → Review and Edit in CMS
                                </a>
                            </p>
                        </>
                    )}

                    {result.error && (
                        <p style={{ color: '#EF4444' }}>{result.error}</p>
                    )}
                </div>
            )}

            {/* Quick Actions */}
            <div style={{ marginTop: '32px' }}>
                <h3 style={{ fontWeight: 'bold', marginBottom: '12px' }}>Quick Actions</h3>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <a
                        href="/admin/collections/generated-content"
                        style={{
                            padding: '10px 16px',
                            backgroundColor: '#F3F4F6',
                            borderRadius: '6px',
                            textDecoration: 'none',
                            color: '#1F2937',
                            fontSize: '14px',
                        }}
                    >
                        📋 Review Pending Content
                    </a>
                    <a
                        href="/admin/collections/daily-discoveries"
                        style={{
                            padding: '10px 16px',
                            backgroundColor: '#F3F4F6',
                            borderRadius: '6px',
                            textDecoration: 'none',
                            color: '#1F2937',
                            fontSize: '14px',
                        }}
                    >
                        🔔 Schedule Daily Discovery
                    </a>
                    <a
                        href="/admin/collections/products"
                        style={{
                            padding: '10px 16px',
                            backgroundColor: '#F3F4F6',
                            borderRadius: '6px',
                            textDecoration: 'none',
                            color: '#1F2937',
                            fontSize: '14px',
                        }}
                    >
                        📦 Browse Products
                    </a>
                </div>
            </div>
        </div>
    )
}
