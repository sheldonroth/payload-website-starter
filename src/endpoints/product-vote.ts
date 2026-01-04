import type { PayloadRequest } from 'payload'

/**
 * Product Vote API Endpoint
 *
 * "Proof of Possession" voting system for untested products.
 *
 * Weighted Voting System:
 * - Search = 1x weight (curiosity signal)
 * - Scan = 5x weight (proof of possession)
 * - Member Scan = 20x weight (premium verified possession)
 *
 * POST /api/product-vote
 * Body: { barcode, voteType, fingerprint?, userId?, productInfo? }
 */

// Vote weights
const VOTE_WEIGHTS = {
    search: 1,
    scan: 5,
    member_scan: 20,
}

interface VoteRequest {
    barcode: string
    voteType: 'search' | 'scan' | 'member_scan'
    fingerprint?: string
    userId?: string
    productInfo?: {
        name?: string
        brand?: string
        imageUrl?: string
    }
    notifyOnComplete?: boolean
}

interface VoteResponse {
    success: boolean
    voteRegistered: boolean
    totalVotes: number
    yourVoteRank: number
    fundingProgress: number
    fundingThreshold: number
    productInfo: {
        barcode: string
        name?: string
        brand?: string
        imageUrl?: string
    }
    message: string
}

export const productVoteHandler = async (req: PayloadRequest): Promise<Response> => {
    if (req.method !== 'POST') {
        return Response.json({ error: 'Method not allowed' }, { status: 405 })
    }

    try {
        const body = await req.json?.() as VoteRequest

        if (!body?.barcode) {
            return Response.json({ error: 'Barcode is required' }, { status: 400 })
        }

        const { barcode, voteType = 'scan', fingerprint, userId, productInfo, notifyOnComplete } = body

        // Validate vote type
        if (!['search', 'scan', 'member_scan'].includes(voteType)) {
            return Response.json({ error: 'Invalid vote type' }, { status: 400 })
        }

        const voteWeight = VOTE_WEIGHTS[voteType]

        // Try to find existing vote record for this barcode
        const existingVotes = await req.payload.find({
            collection: 'product-votes',
            where: { barcode: { equals: barcode } },
            limit: 1,
        })

        let voteRecord: {
            id: number
            barcode: string
            productName?: string
            brand?: string
            imageUrl?: string
            totalWeightedVotes: number
            searchCount: number
            scanCount: number
            memberScanCount: number
            uniqueVoters: number
            fundingProgress: number
            fundingThreshold: number
            status: string
            voterFingerprints: string[]
            notifyOnComplete: string[]
        }
        let isNewVoter = true
        let yourVoteRank = 1

        if (existingVotes.docs.length > 0) {
            // Update existing record
            const existing = existingVotes.docs[0] as typeof voteRecord

            // Check if this fingerprint already voted (for unique voter tracking)
            const existingFingerprints = existing.voterFingerprints || []
            if (fingerprint && existingFingerprints.includes(fingerprint)) {
                isNewVoter = false
            }

            // Calculate new vote counts
            const newSearchCount = existing.searchCount + (voteType === 'search' ? 1 : 0)
            const newScanCount = existing.scanCount + (voteType === 'scan' ? 1 : 0)
            const newMemberScanCount = existing.memberScanCount + (voteType === 'member_scan' ? 1 : 0)
            const newTotalVotes = existing.totalWeightedVotes + voteWeight
            const newUniqueVoters = isNewVoter ? existing.uniqueVoters + 1 : existing.uniqueVoters

            // Add fingerprint to tracking array if new
            const newFingerprints = isNewVoter && fingerprint
                ? [...existingFingerprints, fingerprint]
                : existingFingerprints

            // Add to notification list if requested
            const notifyList = existing.notifyOnComplete || []
            const notifyId = userId || fingerprint
            if (notifyOnComplete && notifyId && !notifyList.includes(notifyId)) {
                notifyList.push(notifyId)
            }

            // Update product info if provided and missing
            const updatedProductName = existing.productName || productInfo?.name
            const updatedBrand = existing.brand || productInfo?.brand
            const updatedImageUrl = existing.imageUrl || productInfo?.imageUrl

            // Check if threshold was just reached
            const threshold = existing.fundingThreshold
            const wasUnderThreshold = existing.totalWeightedVotes < threshold
            const nowOverThreshold = newTotalVotes >= threshold

            const updateData: Record<string, unknown> = {
                searchCount: newSearchCount,
                scanCount: newScanCount,
                memberScanCount: newMemberScanCount,
                totalWeightedVotes: newTotalVotes,
                uniqueVoters: newUniqueVoters,
                voterFingerprints: newFingerprints,
                notifyOnComplete: notifyList,
                productName: updatedProductName,
                brand: updatedBrand,
                imageUrl: updatedImageUrl,
            }

            // Update status if threshold just reached
            if (wasUnderThreshold && nowOverThreshold) {
                updateData.status = 'threshold_reached'
                updateData.thresholdReachedAt = new Date().toISOString()
            }

            const updated = await req.payload.update({
                collection: 'product-votes',
                id: existing.id,
                data: updateData,
            })

            voteRecord = updated as typeof voteRecord
            yourVoteRank = newUniqueVoters

        } else {
            // Create new vote record
            const notifyList: string[] = []
            const notifyId = userId || fingerprint
            if (notifyOnComplete && notifyId) {
                notifyList.push(notifyId)
            }

            const created = await req.payload.create({
                collection: 'product-votes',
                data: {
                    barcode,
                    productName: productInfo?.name,
                    brand: productInfo?.brand,
                    imageUrl: productInfo?.imageUrl,
                    totalWeightedVotes: voteWeight,
                    searchCount: voteType === 'search' ? 1 : 0,
                    scanCount: voteType === 'scan' ? 1 : 0,
                    memberScanCount: voteType === 'member_scan' ? 1 : 0,
                    uniqueVoters: 1,
                    voterFingerprints: fingerprint ? [fingerprint] : [],
                    notifyOnComplete: notifyList,
                    status: 'collecting_votes',
                },
            })

            voteRecord = created as typeof voteRecord
        }

        // Calculate funding progress
        const fundingProgress = Math.min(100, Math.round(
            (voteRecord.totalWeightedVotes / voteRecord.fundingThreshold) * 100
        ))

        // Generate appropriate message based on vote type and progress
        let message: string
        if (fundingProgress >= 100) {
            message = `This product has reached its funding goal! Testing will begin soon.`
        } else if (fundingProgress >= 75) {
            message = `Almost there! This product is ${fundingProgress}% funded for testing.`
        } else if (voteType === 'member_scan') {
            message = `Your premium vote counts 20x! You're voter #${yourVoteRank}.`
        } else if (voteType === 'scan') {
            message = `Vote registered! Your scan counts 5x. You're voter #${yourVoteRank}.`
        } else {
            message = `Vote registered! You're voter #${yourVoteRank} for this product.`
        }

        const response: VoteResponse = {
            success: true,
            voteRegistered: true,
            totalVotes: voteRecord.uniqueVoters,
            yourVoteRank,
            fundingProgress,
            fundingThreshold: voteRecord.fundingThreshold,
            productInfo: {
                barcode: voteRecord.barcode,
                name: voteRecord.productName,
                brand: voteRecord.brand,
                imageUrl: voteRecord.imageUrl,
            },
            message,
        }

        return Response.json(response)

    } catch (error) {
        console.error('[product-vote] Error:', error)
        return Response.json(
            { error: 'Failed to register vote', details: String(error) },
            { status: 500 }
        )
    }
}

/**
 * GET /api/product-vote/:barcode
 * Get vote status for a specific barcode
 */
export const productVoteStatusHandler = async (req: PayloadRequest): Promise<Response> => {
    if (req.method !== 'GET') {
        return Response.json({ error: 'Method not allowed' }, { status: 405 })
    }

    try {
        // Extract barcode from URL
        const url = new URL(req.url || '', 'http://localhost')
        const barcode = url.searchParams.get('barcode')

        if (!barcode) {
            return Response.json({ error: 'Barcode is required' }, { status: 400 })
        }

        const votes = await req.payload.find({
            collection: 'product-votes',
            where: { barcode: { equals: barcode } },
            limit: 1,
        })

        if (votes.docs.length === 0) {
            return Response.json({
                exists: false,
                barcode,
                totalVotes: 0,
                fundingProgress: 0,
            })
        }

        const voteRecord = votes.docs[0] as {
            barcode: string
            productName?: string
            brand?: string
            imageUrl?: string
            totalWeightedVotes: number
            uniqueVoters: number
            fundingProgress: number
            fundingThreshold: number
            status: string
        }

        return Response.json({
            exists: true,
            barcode: voteRecord.barcode,
            productName: voteRecord.productName,
            brand: voteRecord.brand,
            imageUrl: voteRecord.imageUrl,
            totalVotes: voteRecord.uniqueVoters,
            totalWeightedVotes: voteRecord.totalWeightedVotes,
            fundingProgress: voteRecord.fundingProgress,
            fundingThreshold: voteRecord.fundingThreshold,
            status: voteRecord.status,
        })

    } catch (error) {
        console.error('[product-vote-status] Error:', error)
        return Response.json(
            { error: 'Failed to get vote status', details: String(error) },
            { status: 500 }
        )
    }
}

/**
 * GET /api/product-vote/leaderboard
 * Get top voted products waiting for testing
 */
export const productVoteLeaderboardHandler = async (req: PayloadRequest): Promise<Response> => {
    if (req.method !== 'GET') {
        return Response.json({ error: 'Method not allowed' }, { status: 405 })
    }

    try {
        const url = new URL(req.url || '', 'http://localhost')
        const limit = parseInt(url.searchParams.get('limit') || '10', 10)

        const topVoted = await req.payload.find({
            collection: 'product-votes',
            where: {
                status: { in: ['collecting_votes', 'threshold_reached'] },
            },
            sort: '-totalWeightedVotes',
            limit: Math.min(limit, 50),
        })

        const leaderboard = topVoted.docs.map((doc, index) => {
            const vote = doc as {
                barcode: string
                productName?: string
                brand?: string
                imageUrl?: string
                totalWeightedVotes: number
                uniqueVoters: number
                fundingProgress: number
                status: string
            }

            return {
                rank: index + 1,
                barcode: vote.barcode,
                productName: vote.productName || 'Unknown Product',
                brand: vote.brand,
                imageUrl: vote.imageUrl,
                totalVoters: vote.uniqueVoters,
                fundingProgress: vote.fundingProgress,
                status: vote.status,
            }
        })

        return Response.json({
            leaderboard,
            total: topVoted.totalDocs,
        })

    } catch (error) {
        console.error('[product-vote-leaderboard] Error:', error)
        return Response.json(
            { error: 'Failed to get leaderboard', details: String(error) },
            { status: 500 }
        )
    }
}
