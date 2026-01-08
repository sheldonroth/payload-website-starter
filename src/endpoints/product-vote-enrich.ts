/**
 * Product Vote Enrichment Endpoint
 *
 * Enriches product-votes that are missing product names/images
 * by looking up barcodes in Open Food Facts and UPCitemdb.
 *
 * POST /api/product-vote-enrich - Enrich missing product info
 */

import type { PayloadRequest } from 'payload'
import { lookupBarcode } from '../utilities/barcode-lookup'
import {
    internalError,
    successResponse,
    methodNotAllowedError,
} from '../utilities/api-response'

interface EnrichResult {
    barcode: string
    enriched: boolean
    productName?: string
    brand?: string
    source?: string
    error?: string
}

/**
 * @openapi
 * /product-vote-enrich:
 *   post:
 *     summary: Enrich product votes with missing product info
 *     description: |
 *       Looks up barcodes for product-votes missing names/images
 *       using Open Food Facts and UPCitemdb APIs.
 *       Processes up to 20 products per request.
 *     tags: [Admin, Voting]
 *     responses:
 *       200:
 *         description: Enrichment completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 processed:
 *                   type: integer
 *                 enriched:
 *                   type: integer
 *                 results:
 *                   type: array
 *                   items:
 *                     type: object
 */
export const productVoteEnrichHandler = async (req: PayloadRequest): Promise<Response> => {
    if (req.method !== 'POST') {
        return methodNotAllowedError()
    }

    try {
        // Find product-votes missing product names
        const missingProducts = await req.payload.find({
            collection: 'product-votes',
            where: {
                or: [
                    { productName: { exists: false } },
                    { productName: { equals: null } },
                    { productName: { equals: '' } },
                ],
            },
            limit: 20, // Process in batches to avoid timeout
            sort: '-totalWeightedVotes', // Prioritize most voted
        })

        if (missingProducts.docs.length === 0) {
            return successResponse({
                success: true,
                message: 'No products need enrichment',
                processed: 0,
                enriched: 0,
                results: [],
            })
        }

        const results: EnrichResult[] = []
        let enrichedCount = 0

        for (const vote of missingProducts.docs) {
            const voteDoc = vote as { id: number; barcode: string }
            const result: EnrichResult = { barcode: voteDoc.barcode, enriched: false }

            try {
                // Lookup barcode in external databases
                const lookupResult = await lookupBarcode(voteDoc.barcode, req.payload, {
                    skipLocal: true, // We already know it's not in our DB
                })

                if (lookupResult.found && lookupResult.product) {
                    // Update the product-vote with found info
                    await req.payload.update({
                        collection: 'product-votes',
                        id: voteDoc.id,
                        data: {
                            productName: lookupResult.product.name,
                            brand: lookupResult.product.brand,
                            imageUrl: lookupResult.product.imageUrl,
                            openFoodFactsData: lookupResult.product,
                        },
                    })

                    result.enriched = true
                    result.productName = lookupResult.product.name
                    result.brand = lookupResult.product.brand
                    result.source = lookupResult.product.source
                    enrichedCount++
                } else {
                    result.error = 'Product not found in external databases'
                }
            } catch (error) {
                result.error = error instanceof Error ? error.message : 'Lookup failed'
            }

            results.push(result)

            // Small delay between lookups to respect rate limits
            await new Promise(resolve => setTimeout(resolve, 200))
        }

        return successResponse({
            success: true,
            processed: missingProducts.docs.length,
            enriched: enrichedCount,
            remaining: missingProducts.totalDocs - missingProducts.docs.length,
            results,
        })

    } catch (error) {
        console.error('[product-vote-enrich] Error:', error)
        return internalError('Failed to enrich products')
    }
}

export default productVoteEnrichHandler
