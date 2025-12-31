'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'

export const ProductRequestForm: React.FC = () => {
    const router = useRouter()
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)

    const [formData, setFormData] = useState({
        productName: '',
        brand: '',
        productUrl: '',
        reason: '',
    })

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target
        setFormData(prev => ({ ...prev, [name]: value }))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsSubmitting(true)
        setError(null)

        try {
            const response = await fetch('/api/product-requests', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify(formData),
            })

            const data = await response.json()

            if (!response.ok) {
                if (response.status === 401) {
                    setError('Please log in to submit a product request.')
                } else if (response.status === 409) {
                    setError(`This product has already been requested. Vote for the existing request!`)
                } else {
                    setError(data.error || 'Failed to submit request')
                }
                return
            }

            setSuccess(true)
            setFormData({ productName: '', brand: '', productUrl: '', reason: '' })
            router.refresh()

            // Reset success message after 3 seconds
            setTimeout(() => setSuccess(false), 3000)
        } catch (err) {
            setError('An error occurred. Please try again.')
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
                    {error}
                </div>
            )}

            {success && (
                <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-600 dark:text-green-400 text-sm">
                    Request submitted successfully! Your vote has been counted.
                </div>
            )}

            <div>
                <label htmlFor="productName" className="block text-sm font-medium mb-1">
                    Product Name <span className="text-red-500">*</span>
                </label>
                <input
                    type="text"
                    id="productName"
                    name="productName"
                    value={formData.productName}
                    onChange={handleChange}
                    required
                    placeholder="e.g., Liquid Death Mountain Water"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
            </div>

            <div>
                <label htmlFor="brand" className="block text-sm font-medium mb-1">
                    Brand
                </label>
                <input
                    type="text"
                    id="brand"
                    name="brand"
                    value={formData.brand}
                    onChange={handleChange}
                    placeholder="e.g., Liquid Death"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
            </div>

            <div>
                <label htmlFor="productUrl" className="block text-sm font-medium mb-1">
                    Product URL
                </label>
                <input
                    type="url"
                    id="productUrl"
                    name="productUrl"
                    value={formData.productUrl}
                    onChange={handleChange}
                    placeholder="https://amazon.com/..."
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">Link to Amazon or retailer page</p>
            </div>

            <div>
                <label htmlFor="reason" className="block text-sm font-medium mb-1">
                    Why should we review this?
                </label>
                <textarea
                    id="reason"
                    name="reason"
                    value={formData.reason}
                    onChange={handleChange}
                    rows={3}
                    placeholder="Tell us why you want this product reviewed..."
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                />
            </div>

            <button
                type="submit"
                disabled={isSubmitting || !formData.productName}
                className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors duration-200"
            >
                {isSubmitting ? 'Submitting...' : 'Submit Request'}
            </button>

            <p className="text-xs text-gray-500 text-center">
                You must be logged in to submit a request. Your vote is automatically counted.
            </p>
        </form>
    )
}
