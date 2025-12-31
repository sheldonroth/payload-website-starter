import type { Metadata } from 'next/types'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import React from 'react'
import { ProductRequestList } from './ProductRequestList'
import { ProductRequestForm } from './ProductRequestForm'

export default async function RequestProductPage() {
    const payload = await getPayload({ config: configPromise })

    // Fetch initial product requests sorted by votes
    const requests = await payload.find({
        collection: 'user-submissions',
        where: {
            type: { equals: 'product_request' },
            status: { not_equals: 'rejected' },
        },
        sort: '-voteCount',
        limit: 20,
    })

    const initialRequests = requests.docs.map((doc: any) => ({
        id: doc.id,
        productName: doc.productRequestDetails?.requestedProductName || doc.content || 'Unknown Product',
        brand: doc.productRequestDetails?.requestedBrand,
        productUrl: doc.productRequestDetails?.productUrl,
        reason: doc.productRequestDetails?.reasonForRequest,
        voteCount: doc.voteCount || 0,
        status: doc.status,
        submittedBy: doc.submitterName || 'Anonymous',
        submittedAt: doc.createdAt,
    }))

    return (
        <div className="pt-24 pb-24">
            <div className="container">
                <div className="prose dark:prose-invert max-w-none text-center mb-12">
                    <h1 className="mb-4">Request a Product Review</h1>
                    <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
                        Can&apos;t find the product you&apos;re looking for? Submit a request and vote for products you want us to review next.
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Request Form - Left Column */}
                    <div className="lg:col-span-1">
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 sticky top-24">
                            <h2 className="text-xl font-bold mb-4">Submit a Request</h2>
                            <ProductRequestForm />
                        </div>
                    </div>

                    {/* Request List - Right Column */}
                    <div className="lg:col-span-2">
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-bold">Community Requests</h2>
                                <span className="text-sm text-gray-500">
                                    {requests.totalDocs} requests
                                </span>
                            </div>
                            <ProductRequestList initialRequests={initialRequests} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export function generateMetadata(): Metadata {
    return {
        title: 'Request a Product Review | The Product Report',
        description: 'Submit a product request and vote for products you want reviewed by The Product Report community.',
    }
}
