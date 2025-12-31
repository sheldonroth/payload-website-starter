import type { PayloadHandler, PayloadRequest, Where } from 'payload'

/**
 * Product Request Queue Endpoints
 *
 * GET /api/product-requests - List product requests (sorted by votes)
 * POST /api/product-requests - Submit a new product request (login required)
 */
export const productRequestsListHandler: PayloadHandler = async (req: PayloadRequest) => {
    try {
        const url = new URL(req.url || '', 'http://localhost')
        const sort = url.searchParams.get('sort') || 'votes' // 'votes', 'newest', 'oldest'
        const status = url.searchParams.get('status') || 'pending' // 'pending', 'verified', 'all'
        const page = parseInt(url.searchParams.get('page') || '1', 10)
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 50)
        const userId = url.searchParams.get('userId') // Filter by user's requests

        const payload = req.payload

        // Build where clause
        const whereConditions: Where[] = [
            { type: { equals: 'product_request' } },
        ]

        if (status !== 'all') {
            whereConditions.push({ status: { equals: status } })
        }

        if (userId) {
            whereConditions.push({ submitterEmail: { equals: userId } })
        }

        const where: Where = { and: whereConditions }

        // Determine sort order
        let sortField = '-voteCount' // Default: most votes first
        if (sort === 'newest') sortField = '-createdAt'
        if (sort === 'oldest') sortField = 'createdAt'

        const results = await payload.find({
            collection: 'user-submissions',
            where,
            sort: sortField,
            page,
            limit,
        })

        // Transform results for cleaner response
        const requests = results.docs.map((doc: any) => ({
            id: doc.id,
            productName: doc.productRequestDetails?.requestedProductName || doc.content,
            brand: doc.productRequestDetails?.requestedBrand,
            productUrl: doc.productRequestDetails?.productUrl,
            reason: doc.productRequestDetails?.reasonForRequest,
            voteCount: doc.voteCount || 0,
            status: doc.status,
            submittedBy: doc.submitterName || 'Anonymous',
            submittedAt: doc.createdAt,
            // Include voter list only if user is authenticated (for checking if they voted)
            hasVoted: req.user ? ((doc.voters || []) as string[]).includes(String(req.user.id)) : false,
        }))

        return Response.json({
            requests,
            totalDocs: results.totalDocs,
            totalPages: results.totalPages,
            page: results.page,
            hasNextPage: results.hasNextPage,
            hasPrevPage: results.hasPrevPage,
        })
    } catch (error) {
        console.error('Product requests list error:', error)
        return Response.json(
            { error: 'Failed to fetch product requests' },
            { status: 500 }
        )
    }
}

export const productRequestsCreateHandler: PayloadHandler = async (req: PayloadRequest) => {
    // Require authentication
    if (!req.user) {
        return Response.json(
            { error: 'Login required to submit a product request' },
            { status: 401 }
        )
    }

    try {
        const body = await req.json?.()
        const { productName, brand, productUrl, reason } = body || {}

        if (!productName) {
            return Response.json(
                { error: 'Product name is required' },
                { status: 400 }
            )
        }

        const payload = req.payload

        // Check for duplicate requests (same product name + brand)
        const existing = await payload.find({
            collection: 'user-submissions',
            where: {
                type: { equals: 'product_request' },
                'productRequestDetails.requestedProductName': { equals: productName },
                ...(brand ? { 'productRequestDetails.requestedBrand': { equals: brand } } : {}),
                status: { not_equals: 'rejected' },
            },
            limit: 1,
        })

        if (existing.docs.length > 0) {
            return Response.json({
                error: 'A request for this product already exists',
                existingRequest: {
                    id: existing.docs[0].id,
                    voteCount: (existing.docs[0] as any).voteCount || 0,
                },
            }, { status: 409 })
        }

        // Create the request
        const newRequest = await payload.create({
            collection: 'user-submissions',
            data: {
                type: 'product_request',
                submitterEmail: req.user.email,
                submitterName: (req.user as any).name || undefined,
                productRequestDetails: {
                    requestedProductName: productName,
                    requestedBrand: brand || undefined,
                    productUrl: productUrl || undefined,
                    reasonForRequest: reason || undefined,
                },
                voteCount: 1, // Creator's vote counts
                voters: [String(req.user.id)],
                status: 'pending',
            } as any,
        })

        return Response.json({
            success: true,
            request: {
                id: newRequest.id,
                productName,
                brand,
                voteCount: 1,
            },
        }, { status: 201 })
    } catch (error) {
        console.error('Product request create error:', error)
        return Response.json(
            { error: 'Failed to submit product request' },
            { status: 500 }
        )
    }
}

/**
 * Vote/Unvote Endpoints
 *
 * POST /api/product-requests/vote - Vote for a request (login required)
 * DELETE /api/product-requests/vote - Remove vote (login required)
 */
export const productRequestVoteHandler: PayloadHandler = async (req: PayloadRequest) => {
    // Require authentication
    if (!req.user) {
        return Response.json(
            { error: 'Login required to vote' },
            { status: 401 }
        )
    }

    try {
        const body = await req.json?.()
        const { requestId, action = 'add' } = body || {} // action: 'add' or 'remove'

        if (!requestId) {
            return Response.json(
                { error: 'requestId is required' },
                { status: 400 }
            )
        }

        const payload = req.payload
        const userId = String(req.user.id)

        // Get the request
        const request = await payload.findByID({
            collection: 'user-submissions',
            id: requestId,
        })

        if (!request) {
            return Response.json(
                { error: 'Request not found' },
                { status: 404 }
            )
        }

        if ((request as any).type !== 'product_request') {
            return Response.json(
                { error: 'Invalid request type' },
                { status: 400 }
            )
        }

        const currentVoters = ((request as any).voters || []) as string[]
        const hasVoted = currentVoters.includes(userId)

        if (action === 'add' && hasVoted) {
            return Response.json(
                { error: 'You have already voted for this request' },
                { status: 400 }
            )
        }

        if (action === 'remove' && !hasVoted) {
            return Response.json(
                { error: 'You have not voted for this request' },
                { status: 400 }
            )
        }

        // Update vote
        let newVoters: string[]
        let newVoteCount: number

        if (action === 'remove') {
            newVoters = currentVoters.filter(v => v !== userId)
            newVoteCount = Math.max(0, ((request as any).voteCount || 1) - 1)
        } else {
            newVoters = [...currentVoters, userId]
            newVoteCount = ((request as any).voteCount || 0) + 1
        }

        await payload.update({
            collection: 'user-submissions',
            id: requestId,
            data: {
                voters: newVoters,
                voteCount: newVoteCount,
            } as any,
        })

        return Response.json({
            success: true,
            voteCount: newVoteCount,
            hasVoted: action === 'add',
        })
    } catch (error) {
        console.error('Product request vote error:', error)
        return Response.json(
            { error: 'Failed to update vote' },
            { status: 500 }
        )
    }
}
