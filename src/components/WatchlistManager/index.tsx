'use client'

import React, { useEffect, useState, useCallback } from 'react'

interface WatchlistItem {
    ingredientId: string
    ingredientName: string
    reason?: string
    dateAdded: string
}

interface IngredientSearchResult {
    id: string
    name: string
    safetyCategory?: string
}

export const WatchlistManager: React.FC = () => {
    const [watchlist, setWatchlist] = useState<WatchlistItem[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [searchResults, setSearchResults] = useState<IngredientSearchResult[]>([])
    const [isSearching, setIsSearching] = useState(false)
    const [addingId, setAddingId] = useState<string | null>(null)
    const [removingId, setRemovingId] = useState<string | null>(null)
    const [customReason, setCustomReason] = useState('')

    // Fetch current watchlist
    const fetchWatchlist = useCallback(async () => {
        try {
            const response = await fetch('/api/users/me/watchlist', {
                credentials: 'include',
            })

            if (!response.ok) {
                if (response.status === 401) {
                    setError('Please log in to manage your watchlist.')
                    return
                }
                throw new Error('Failed to fetch watchlist')
            }

            const data = await response.json()
            setWatchlist(data.watchlist || [])
        } catch (err) {
            setError('Failed to load watchlist')
        } finally {
            setIsLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchWatchlist()
    }, [fetchWatchlist])

    // Search for ingredients
    useEffect(() => {
        if (!searchQuery || searchQuery.length < 2) {
            setSearchResults([])
            return
        }

        const searchTimeout = setTimeout(async () => {
            setIsSearching(true)
            try {
                const response = await fetch(`/api/ingredients?where[name][contains]=${encodeURIComponent(searchQuery)}&limit=10`, {
                    credentials: 'include',
                })

                if (response.ok) {
                    const data = await response.json()
                    // Filter out ingredients already in watchlist
                    const filtered = (data.docs || []).filter(
                        (ing: IngredientSearchResult) => !watchlist.some(w => w.ingredientId === ing.id)
                    )
                    setSearchResults(filtered)
                }
            } catch (err) {
                console.error('Search failed:', err)
            } finally {
                setIsSearching(false)
            }
        }, 300)

        return () => clearTimeout(searchTimeout)
    }, [searchQuery, watchlist])

    const addToWatchlist = async (ingredient: IngredientSearchResult) => {
        setAddingId(ingredient.id)
        setError(null)

        try {
            const response = await fetch('/api/users/me/watchlist', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    ingredientId: ingredient.id,
                    ingredientName: ingredient.name,
                    reason: customReason || undefined,
                }),
            })

            if (!response.ok) {
                const data = await response.json()
                setError(data.error || 'Failed to add ingredient')
                return
            }

            const data = await response.json()
            setWatchlist(data.watchlist)
            setSearchQuery('')
            setSearchResults([])
            setCustomReason('')
        } catch (err) {
            setError('Failed to add ingredient')
        } finally {
            setAddingId(null)
        }
    }

    const removeFromWatchlist = async (ingredientId: string) => {
        setRemovingId(ingredientId)
        setError(null)

        try {
            const response = await fetch('/api/users/me/watchlist', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({ ingredientId }),
            })

            if (!response.ok) {
                const data = await response.json()
                setError(data.error || 'Failed to remove ingredient')
                return
            }

            const data = await response.json()
            setWatchlist(data.watchlist)
        } catch (err) {
            setError('Failed to remove ingredient')
        } finally {
            setRemovingId(null)
        }
    }

    const getSafetyCategoryColor = (category?: string) => {
        switch (category?.toLowerCase()) {
            case 'avoid':
                return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
            case 'caution':
                return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300'
            case 'safe':
                return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
            default:
                return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
        }
    }

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        })
    }

    if (isLoading) {
        return (
            <div className="animate-pulse space-y-4">
                <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded" />
                <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
                    {error}
                </div>
            )}

            {/* Search Section */}
            <div className="space-y-3">
                <label className="block text-sm font-medium">
                    Add ingredient to avoid
                </label>
                <div className="relative">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search ingredients..."
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                    {isSearching && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <svg className="animate-spin h-5 w-5 text-gray-400" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                        </div>
                    )}
                </div>

                {/* Search Results */}
                {searchResults.length > 0 && (
                    <div className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
                        {searchResults.map((ingredient) => (
                            <div
                                key={ingredient.id}
                                className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-200 dark:border-gray-600 last:border-b-0"
                            >
                                <div className="flex items-center gap-2">
                                    <span className="font-medium">{ingredient.name}</span>
                                    {ingredient.safetyCategory && (
                                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${getSafetyCategoryColor(ingredient.safetyCategory)}`}>
                                            {ingredient.safetyCategory}
                                        </span>
                                    )}
                                </div>
                                <button
                                    onClick={() => addToWatchlist(ingredient)}
                                    disabled={addingId === ingredient.id}
                                    className="px-3 py-1 text-sm bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg transition-colors"
                                >
                                    {addingId === ingredient.id ? 'Adding...' : 'Add'}
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Optional Reason Input */}
                {searchResults.length > 0 && (
                    <input
                        type="text"
                        value={customReason}
                        onChange={(e) => setCustomReason(e.target.value)}
                        placeholder="Optional: Why are you avoiding this? (e.g., allergy, preference)"
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 text-sm"
                    />
                )}
            </div>

            {/* Current Watchlist */}
            <div className="space-y-3">
                <h3 className="text-sm font-medium">
                    Your Ingredient Watchlist ({watchlist.length})
                </h3>

                {watchlist.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        <svg
                            className="mx-auto h-12 w-12 text-gray-400"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={1.5}
                                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                            />
                        </svg>
                        <p className="mt-2 text-sm">No ingredients in your watchlist yet.</p>
                        <p className="text-xs">Search above to add ingredients you want to avoid.</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {watchlist.map((item) => (
                            <div
                                key={item.ingredientId}
                                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                            >
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium text-gray-900 dark:text-white">
                                            {item.ingredientName}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
                                        {item.reason && (
                                            <span className="italic">{item.reason}</span>
                                        )}
                                        <span>Added {formatDate(item.dateAdded)}</span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => removeFromWatchlist(item.ingredientId)}
                                    disabled={removingId === item.ingredientId}
                                    className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors disabled:opacity-50"
                                    title="Remove from watchlist"
                                >
                                    {removingId === item.ingredientId ? (
                                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                    ) : (
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
