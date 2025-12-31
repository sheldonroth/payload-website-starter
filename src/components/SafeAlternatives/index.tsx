'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'

interface ProductAlternative {
    id: string
    name: string
    slug: string
    verdict?: string
    overallScore?: number
    priceRange?: string
    brand?: string
    image?: {
        url?: string
        alt?: string
    }
    score: number
    improvements: string[]
}

interface SafeAlternativesProps {
    productId: string
    productName?: string
}

export const SafeAlternatives: React.FC<SafeAlternativesProps> = ({ productId, productName }) => {
    const [alternatives, setAlternatives] = useState<ProductAlternative[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const fetchAlternatives = async () => {
            try {
                const response = await fetch(`/api/products/alternatives?productId=${productId}&limit=5`)

                if (!response.ok) {
                    throw new Error('Failed to fetch alternatives')
                }

                const data = await response.json()
                setAlternatives(data.alternatives || [])
            } catch (err) {
                console.error('Failed to fetch alternatives:', err)
                setError('Unable to load alternatives')
            } finally {
                setIsLoading(false)
            }
        }

        fetchAlternatives()
    }, [productId])

    if (isLoading) {
        return (
            <div className="animate-pulse space-y-4">
                <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-48" />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded-lg" />
                    ))}
                </div>
            </div>
        )
    }

    if (error || alternatives.length === 0) {
        return null // Don't show anything if no alternatives found
    }

    const getVerdictColor = (verdict?: string) => {
        switch (verdict?.toLowerCase()) {
            case 'recommend':
                return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-200 dark:border-green-800'
            case 'consider':
                return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800'
            case 'caution':
                return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800'
            default:
                return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-600'
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2">
                <svg
                    className="w-5 h-5 text-green-600 dark:text-green-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                    />
                </svg>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Safer Alternatives
                </h3>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-400">
                {productName ? `Better options compared to ${productName}` : 'Products with better safety profiles in the same category'}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {alternatives.map((alt) => (
                    <Link
                        key={alt.id}
                        href={`/products/${alt.slug}`}
                        className="block bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-green-300 dark:hover:border-green-700 transition-colors overflow-hidden group"
                    >
                        {/* Image */}
                        <div className="aspect-video bg-gray-100 dark:bg-gray-700 relative overflow-hidden">
                            {alt.image?.url ? (
                                <img
                                    src={alt.image.url}
                                    alt={alt.image.alt || alt.name}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                    <svg className="w-12 h-12 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                </div>
                            )}
                            {/* Verdict Badge */}
                            {alt.verdict && (
                                <div className={`absolute top-2 right-2 px-2 py-0.5 rounded text-xs font-medium border ${getVerdictColor(alt.verdict)}`}>
                                    {alt.verdict.charAt(0).toUpperCase() + alt.verdict.slice(1)}
                                </div>
                            )}
                        </div>

                        {/* Content */}
                        <div className="p-3">
                            <h4 className="font-medium text-gray-900 dark:text-white truncate group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">
                                {alt.name}
                            </h4>
                            {alt.brand && (
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                    {alt.brand}
                                </p>
                            )}

                            {/* Improvements */}
                            {alt.improvements.length > 0 && (
                                <div className="mt-2 space-y-1">
                                    {alt.improvements.slice(0, 2).map((improvement, idx) => (
                                        <div key={idx} className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                                            <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                            </svg>
                                            <span>{improvement}</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Score indicator */}
                            {alt.overallScore && (
                                <div className="mt-2 flex items-center gap-1">
                                    <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-green-500 rounded-full"
                                            style={{ width: `${Math.min(100, alt.overallScore)}%` }}
                                        />
                                    </div>
                                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                                        {alt.overallScore.toFixed(0)}
                                    </span>
                                </div>
                            )}
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    )
}
