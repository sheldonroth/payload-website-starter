'use client'

import React, { useState, useOptimistic, useTransition } from 'react'
import { useRouter } from 'next/navigation'

interface ProductRequest {
    id: string
    productName: string
    brand?: string
    productUrl?: string
    reason?: string
    voteCount: number
    status: string
    submittedBy: string
    submittedAt: string
}

interface ProductRequestListProps {
    initialRequests: ProductRequest[]
}

export const ProductRequestList: React.FC<ProductRequestListProps> = ({ initialRequests }) => {
    const router = useRouter()
    const [requests, setRequests] = useState(initialRequests)
    const [votingId, setVotingId] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()

    const handleVote = async (requestId: string) => {
        setVotingId(requestId)
        setError(null)

        try {
            const response = await fetch('/api/product-requests/vote', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({ requestId }),
            })

            const data = await response.json()

            if (!response.ok) {
                if (response.status === 401) {
                    setError('Please log in to vote.')
                } else {
                    setError(data.error || 'Failed to vote')
                }
                return
            }

            // Update local state optimistically
            setRequests(prev =>
                prev.map(req =>
                    req.id === requestId
                        ? { ...req, voteCount: data.voteCount }
                        : req
                ).sort((a, b) => b.voteCount - a.voteCount)
            )

            startTransition(() => {
                router.refresh()
            })
        } catch (err) {
            setError('An error occurred. Please try again.')
        } finally {
            setVotingId(null)
        }
    }

    const formatDate = (dateString: string) => {
        const date = new Date(dateString)
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        })
    }

    const getStatusBadge = (status: string) => {
        const statusColors: Record<string, string> = {
            pending: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300',
            approved: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300',
            in_progress: 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300',
            completed: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
        }

        const statusLabels: Record<string, string> = {
            pending: 'Pending',
            approved: 'Approved',
            in_progress: 'In Progress',
            completed: 'Reviewed',
        }

        return (
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusColors[status] || statusColors.pending}`}>
                {statusLabels[status] || status}
            </span>
        )
    }

    if (requests.length === 0) {
        return (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
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
                        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                    />
                </svg>
                <h3 className="mt-2 text-sm font-medium">No requests yet</h3>
                <p className="mt-1 text-sm">Be the first to request a product review!</p>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
                    {error}
                </div>
            )}

            {requests.map((request, index) => (
                <div
                    key={request.id}
                    className="flex gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                    {/* Vote Button */}
                    <div className="flex flex-col items-center">
                        <button
                            onClick={() => handleVote(request.id)}
                            disabled={votingId === request.id}
                            className="flex flex-col items-center p-2 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors group disabled:opacity-50"
                            title="Vote for this request"
                        >
                            <svg
                                className={`w-6 h-6 transition-colors ${
                                    votingId === request.id
                                        ? 'text-gray-400'
                                        : 'text-gray-400 group-hover:text-green-600 dark:group-hover:text-green-400'
                                }`}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M5 15l7-7 7 7"
                                />
                            </svg>
                            <span className="text-lg font-bold text-gray-900 dark:text-white">
                                {request.voteCount}
                            </span>
                            <span className="text-xs text-gray-500">
                                {request.voteCount === 1 ? 'vote' : 'votes'}
                            </span>
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                            <div>
                                <h3 className="font-semibold text-gray-900 dark:text-white">
                                    {request.productName}
                                </h3>
                                {request.brand && (
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                        by {request.brand}
                                    </p>
                                )}
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                                {getStatusBadge(request.status)}
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                    #{index + 1}
                                </span>
                            </div>
                        </div>

                        {request.reason && (
                            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                                {request.reason}
                            </p>
                        )}

                        <div className="mt-2 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                            <span>Requested by {request.submittedBy}</span>
                            <span>{formatDate(request.submittedAt)}</span>
                            {request.productUrl && (
                                <a
                                    href={request.productUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-green-600 dark:text-green-400 hover:underline"
                                >
                                    View Product
                                </a>
                            )}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    )
}
