'use client'

import React, { useEffect, useState } from 'react'

interface WatchlistConflict {
    ingredientId: string
    ingredientName: string
    reason?: string
}

interface WatchlistAlertProps {
    productId: string
    compact?: boolean
}

export const WatchlistAlert: React.FC<WatchlistAlertProps> = ({ productId, compact = false }) => {
    const [conflicts, setConflicts] = useState<WatchlistConflict[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isExpanded, setIsExpanded] = useState(false)

    useEffect(() => {
        const checkConflicts = async () => {
            try {
                const response = await fetch('/api/users/me/watchlist/check', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    credentials: 'include',
                    body: JSON.stringify({ productId }),
                })

                if (!response.ok) {
                    // User not logged in or other error - just hide the component
                    setIsLoading(false)
                    return
                }

                const data = await response.json()
                setConflicts(data.conflicts || [])
            } catch (error) {
                console.error('Failed to check watchlist conflicts:', error)
            } finally {
                setIsLoading(false)
            }
        }

        checkConflicts()
    }, [productId])

    if (isLoading || conflicts.length === 0) {
        return null
    }

    if (compact) {
        return (
            <div
                className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 rounded-full text-xs font-medium cursor-pointer"
                title={`Contains ${conflicts.length} ingredient(s) from your watchlist`}
            >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                </svg>
                <span>{conflicts.length}</span>
            </div>
        )
    }

    return (
        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center justify-between w-full text-left"
            >
                <div className="flex items-center gap-2">
                    <svg
                        className="w-5 h-5 text-orange-600 dark:text-orange-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                        />
                    </svg>
                    <span className="font-medium text-orange-800 dark:text-orange-300">
                        Contains {conflicts.length} ingredient{conflicts.length !== 1 ? 's' : ''} from your watchlist
                    </span>
                </div>
                <svg
                    className={`w-5 h-5 text-orange-600 dark:text-orange-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {isExpanded && (
                <div className="mt-3 space-y-2">
                    {conflicts.map((conflict) => (
                        <div
                            key={conflict.ingredientId}
                            className="flex items-start gap-2 text-sm text-orange-700 dark:text-orange-400"
                        >
                            <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path
                                    fillRule="evenodd"
                                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                    clipRule="evenodd"
                                />
                            </svg>
                            <div>
                                <span className="font-medium">{conflict.ingredientName}</span>
                                {conflict.reason && (
                                    <span className="text-orange-600 dark:text-orange-500"> - {conflict.reason}</span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
