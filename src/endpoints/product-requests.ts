import type { PayloadHandler, PayloadRequest, Where } from 'payload'
import type { User, UserSubmission } from '../payload-types'
import { checkRateLimit, rateLimitResponse, getRateLimitKey, RateLimits } from '../utilities/rate-limiter'
import {
    successResponse,
    internalError,
    unauthorizedError,
    validationError,
    notFoundError,
    badRequestError,
    conflictError,
} from '../utilities/api-response'

/**
 * Extended User type with the name field for authenticated requests
 */
interface AuthenticatedUser extends User {
    id: number
    email: string
    name?: string | null
}

/**
 * Product request submission data for creating new requests
 */
interface ProductRequestCreateData {
    type: 'product_request'
    submitterEmail: string
    submitterName?: string
    productRequestDetails: {
        requestedProductName: string
        requestedBrand?: string
        productUrl?: string
        reasonForRequest?: string
    }
    voteCount: number
    voters: string[]
    status: 'pending' | 'reviewing' | 'verified' | 'rejected' | 'duplicate' | 'spam'
}

/**
 * Vote update data for product requests
 */
interface VoteUpdateData {
    voters: string[]
    voteCount: number
}

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
        const requests = results.docs.map((doc: UserSubmission) => {
            // Parse voters - can be array of strings, JSON array, or other formats
            const voters: string[] = Array.isArray(doc.voters)
                ? doc.voters.map(String)
                : []

            return {
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
                hasVoted: req.user ? voters.includes(String(req.user.id)) : false,
            }
        })

        return successResponse({
            requests,
            totalDocs: results.totalDocs,
            totalPages: results.totalPages,
            page: results.page,
            hasNextPage: results.hasNextPage,
            hasPrevPage: results.hasPrevPage,
        })
    } catch (error) {
        console.error('Product requests list error:', error)
        return internalError('Failed to fetch product requests')
    }
}

export const productRequestsCreateHandler: PayloadHandler = async (req: PayloadRequest) => {
    // Rate limiting - 20 requests per minute
    const user = req.user as AuthenticatedUser | undefined
    const rateLimitKey = getRateLimitKey(req as unknown as Request, user?.id)
    const rateLimit = checkRateLimit(rateLimitKey, RateLimits.CONTENT_GENERATION)
    if (!rateLimit.allowed) {
        return rateLimitResponse(rateLimit.resetAt)
    }

    // Require authentication
    if (!user) {
        return unauthorizedError('Login required to submit a product request')
    }

    try {
        const body = await req.json?.()
        const { productName, brand, productUrl, reason } = body || {}

        if (!productName) {
            return validationError('Product name is required')
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
            const existingDoc = existing.docs[0] as UserSubmission
            return conflictError('A request for this product already exists', {
                existingRequest: {
                    id: existingDoc.id,
                    voteCount: existingDoc.voteCount || 0,
                },
            })
        }

        // Create the request
        const createData: ProductRequestCreateData = {
            type: 'product_request',
            submitterEmail: user.email,
            submitterName: user.name || undefined,
            productRequestDetails: {
                requestedProductName: productName,
                requestedBrand: brand || undefined,
                productUrl: productUrl || undefined,
                reasonForRequest: reason || undefined,
            },
            voteCount: 1, // Creator's vote counts
            voters: [String(user.id)],
            status: 'pending',
        }

        const newRequest = await payload.create({
            collection: 'user-submissions',
            data: createData,
        })

        return successResponse({
            request: {
                id: newRequest.id,
                productName,
                brand,
                voteCount: 1,
            },
        }, 201)
    } catch (error) {
        console.error('Product request create error:', error)
        return internalError('Failed to submit product request')
    }
}

/**
 * Vote/Unvote Endpoints
 *
 * POST /api/product-requests/vote - Vote for a request (login required)
 * DELETE /api/product-requests/vote - Remove vote (login required)
 */
export const productRequestVoteHandler: PayloadHandler = async (req: PayloadRequest) => {
    // Rate limiting - 20 votes per minute
    const user = req.user as AuthenticatedUser | undefined
    const rateLimitKey = getRateLimitKey(req as unknown as Request, user?.id)
    const rateLimit = checkRateLimit(rateLimitKey, RateLimits.CONTENT_GENERATION)
    if (!rateLimit.allowed) {
        return rateLimitResponse(rateLimit.resetAt)
    }

    // Require authentication
    if (!user) {
        return unauthorizedError('Login required to vote')
    }

    try {
        const body = await req.json?.()
        const { requestId, action = 'add' } = body || {} // action: 'add' or 'remove'

        if (!requestId) {
            return validationError('requestId is required')
        }

        const payload = req.payload
        const userId = String(user.id)

        // Get the request
        const request = await payload.findByID({
            collection: 'user-submissions',
            id: requestId,
        }) as UserSubmission | null

        if (!request) {
            return notFoundError('Request')
        }

        if (request.type !== 'product_request') {
            return badRequestError('Invalid request type')
        }

        // Parse voters array from the document
        const currentVoters: string[] = Array.isArray(request.voters)
            ? request.voters.map(String)
            : []
        const hasVoted = currentVoters.includes(userId)

        if (action === 'add' && hasVoted) {
            return badRequestError('You have already voted for this request')
        }

        if (action === 'remove' && !hasVoted) {
            return badRequestError('You have not voted for this request')
        }

        // Update vote
        let newVoters: string[]
        let newVoteCount: number

        if (action === 'remove') {
            newVoters = currentVoters.filter(v => v !== userId)
            newVoteCount = Math.max(0, (request.voteCount || 1) - 1)
        } else {
            newVoters = [...currentVoters, userId]
            newVoteCount = (request.voteCount || 0) + 1
        }

        const updateData: VoteUpdateData = {
            voters: newVoters,
            voteCount: newVoteCount,
        }

        await payload.update({
            collection: 'user-submissions',
            id: requestId,
            data: updateData,
        })

        return successResponse({
            voteCount: newVoteCount,
            hasVoted: action === 'add',
        })
    } catch (error) {
        console.error('Product request vote error:', error)
        return internalError('Failed to update vote')
    }
}
