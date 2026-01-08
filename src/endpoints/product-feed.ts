/**
 * Product Feed Endpoint
 * 
 * Returns paginated products for TikTok-style discovery feed
 * with verdict-colored backgrounds
 */

import type { PayloadHandler } from 'payload'

interface ProductFeedItem {
    id: string
    productName: string
    brand: string | null
    imageUrl: string | null
    verdict: 'CLEAN' | 'CAUTION' | 'AVOID' | 'UNKNOWN'
    score: number
    summary: string
}

interface ProductFeedResponse {
    products: ProductFeedItem[]
    page: number
    hasMore: boolean
    total: number
}

export const productFeedHandler: PayloadHandler = async (req) => {
    const { payload } = req

    try {
        // Parse query params
        const url = new URL(req.url || '', `http://${req.headers.get('host') || 'localhost'}`)
        const page = parseInt(url.searchParams.get('page') || '1', 10)
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '10', 10), 20)

        // Fetch published products, paginated
        const products = await payload.find({
            collection: 'products',
            limit,
            page,
            where: {
                _status: { equals: 'published' },
            },
            sort: '-createdAt', // Newest first
        })

        // Map to feed items
        const feedItems: ProductFeedItem[] = products.docs.map((product: any) => {
            // Get first image
            let imageUrl: string | null = null
            if (product.images && product.images.length > 0) {
                const firstImage = product.images[0]
                if (typeof firstImage === 'object' && firstImage.url) {
                    imageUrl = firstImage.url
                } else if (typeof firstImage === 'string') {
                    imageUrl = firstImage
                }
            }

            // Get verdict summary
            let summary = 'No analysis available'
            if (product.verdict === 'CLEAN') {
                summary = 'No harmful ingredients detected'
            } else if (product.verdict === 'CAUTION') {
                summary = 'Some ingredients require caution'
            } else if (product.verdict === 'AVOID') {
                summary = 'Contains harmful ingredients'
            }

            if (product.shortDescription) {
                summary = product.shortDescription
            }

            return {
                id: product.id,
                productName: product.productName || 'Unknown Product',
                brand: product.brand || null,
                imageUrl,
                verdict: product.verdict || 'UNKNOWN',
                score: product.overallScore || 0,
                summary,
            }
        })

        const response: ProductFeedResponse = {
            products: feedItems,
            page,
            hasMore: products.hasNextPage,
            total: products.totalDocs,
        }

        return Response.json(response)

    } catch (error) {
        console.error('[product-feed] Error:', error)
        // Log to Sentry for monitoring
        if (typeof require !== 'undefined') {
            try {
                const Sentry = require('@sentry/nextjs')
                Sentry.captureException(error, { tags: { endpoint: 'product-feed' } })
            } catch { } // Sentry not available in all contexts
        }
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        return Response.json(
            { error: 'Failed to fetch product feed', details: errorMessage },
            { status: 500 }
        )
    }
}

export default productFeedHandler
