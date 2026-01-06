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
    bounty_contribution: 10, // Bonus for adding photos to someone else's request
}

// Time constants for velocity tracking
const ONE_DAY_MS = 24 * 60 * 60 * 1000
const SEVEN_DAYS_MS = 7 * ONE_DAY_MS
const MAX_TIMESTAMPS = 500 // Prevent unbounded growth

/**
 * Calculate scan velocity metrics for prioritization
 * Trending products get tested faster
 */
function calculateVelocity(
    existingTimestamps: number[],
    totalWeightedVotes: number
): {
    scanTimestamps: number[]
    scansLast24h: number
    scansLast7d: number
    velocityScore: number
    urgencyFlag: 'normal' | 'trending' | 'urgent'
} {
    const now = Date.now()

    // Filter to last 7 days + add current timestamp
    const timestamps = (existingTimestamps || [])
        .filter((ts) => now - ts < SEVEN_DAYS_MS)
        .concat([now])
        .slice(-MAX_TIMESTAMPS) // Keep max 500 timestamps

    // Calculate counts
    const scansLast24h = timestamps.filter((ts) => now - ts < ONE_DAY_MS).length
    const scansLast7d = timestamps.length

    // Velocity score = weighted combination
    // 24h scans are 5x more valuable (recency matters)
    const velocityScore = scansLast24h * 5 + scansLast7d + totalWeightedVotes

    // Auto-flag urgency based on thresholds
    let urgencyFlag: 'normal' | 'trending' | 'urgent' = 'normal'
    if (scansLast24h >= 100 || scansLast7d >= 500) {
        urgencyFlag = 'urgent'
    } else if (scansLast24h >= 20 || scansLast7d >= 100) {
        urgencyFlag = 'trending'
    }

    return {
        scanTimestamps: timestamps,
        scansLast24h,
        scansLast7d,
        velocityScore,
        urgencyFlag,
    }
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
            // Velocity tracking (Scout Program)
            scanTimestamps?: number[]
            scansLast24h?: number
            scansLast7d?: number
            velocityScore?: number
            urgencyFlag?: 'normal' | 'trending' | 'urgent'
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

            // Calculate velocity metrics (Scout Program)
            // Only track scans for velocity (not searches) - proof of possession matters
            const trackVelocity = voteType === 'scan' || voteType === 'member_scan'
            const velocity = trackVelocity
                ? calculateVelocity(existing.scanTimestamps || [], newTotalVotes)
                : null

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
                // Add velocity data if tracking scans
                ...(velocity && {
                    scanTimestamps: velocity.scanTimestamps,
                    scansLast24h: velocity.scansLast24h,
                    scansLast7d: velocity.scansLast7d,
                    velocityScore: velocity.velocityScore,
                    urgencyFlag: velocity.urgencyFlag,
                }),
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

            // Initialize velocity for scans (Scout Program)
            const trackVelocity = voteType === 'scan' || voteType === 'member_scan'
            const initialVelocity = trackVelocity
                ? calculateVelocity([], voteWeight)
                : null

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
                    // Initialize velocity data if tracking scans
                    ...(initialVelocity && {
                        scanTimestamps: initialVelocity.scanTimestamps,
                        scansLast24h: initialVelocity.scansLast24h,
                        scansLast7d: initialVelocity.scansLast7d,
                        velocityScore: initialVelocity.velocityScore,
                        urgencyFlag: initialVelocity.urgencyFlag,
                    }),
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
            // Only select fields needed for leaderboard (avoids querying new columns not yet in DB)
            select: {
                barcode: true,
                productName: true,
                brand: true,
                imageUrl: true,
                totalWeightedVotes: true,
                uniqueVoters: true,
                fundingProgress: true,
                status: true,
            },
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

/**
 * POST /api/product-vote/contribute
 * Bounty vote - add photos to someone else's request for +10x bonus
 */
interface ContributeRequest {
    barcode: string
    fingerprintId: string
    userId?: string
    submissionId: number
}

interface PhotoContributor {
    fingerprintId: string
    userId?: string
    submissionId: number
    contributedAt: string
    bonusWeight: number
}

export const productVoteContributeHandler = async (req: PayloadRequest): Promise<Response> => {
    if (req.method !== 'POST') {
        return Response.json({ error: 'Method not allowed' }, { status: 405 })
    }

    try {
        const body = await req.json?.() as ContributeRequest

        if (!body?.barcode || !body?.fingerprintId || !body?.submissionId) {
            return Response.json(
                { error: 'barcode, fingerprintId, and submissionId are required' },
                { status: 400 }
            )
        }

        const { barcode, fingerprintId, userId, submissionId } = body

        // Find existing vote record
        const existingVotes = await req.payload.find({
            collection: 'product-votes',
            where: { barcode: { equals: barcode } },
            limit: 1,
        })

        if (existingVotes.docs.length === 0) {
            return Response.json(
                { error: 'No vote record found for this barcode. Vote first before contributing photos.' },
                { status: 404 }
            )
        }

        const voteRecord = existingVotes.docs[0] as {
            id: number
            barcode: string
            totalWeightedVotes: number
            fundingThreshold: number
            fundingProgress: number
            voterFingerprints: string[]
            photoContributors: PhotoContributor[]
            totalContributors: number
            status: string
        }

        const existingFingerprints = voteRecord.voterFingerprints || []
        const existingContributors = voteRecord.photoContributors || []

        // Check if this user already contributed photos
        const alreadyContributed = existingContributors.some(
            (c) => c.fingerprintId === fingerprintId
        )

        if (alreadyContributed) {
            return Response.json({
                success: false,
                bountyAwarded: false,
                bonusWeight: 0,
                newTotalVotes: voteRecord.totalWeightedVotes,
                fundingProgress: voteRecord.fundingProgress,
                message: 'You have already contributed photos to this product.',
            })
        }

        // Check if this is the original voter (bounty only for different users)
        const isOriginalVoter = existingFingerprints.includes(fingerprintId)
        const bountyWeight = isOriginalVoter ? 0 : VOTE_WEIGHTS.bounty_contribution

        // Create new contributor entry
        const newContributor: PhotoContributor = {
            fingerprintId,
            userId,
            submissionId,
            contributedAt: new Date().toISOString(),
            bonusWeight: bountyWeight,
        }

        // Calculate new totals
        const newTotalVotes = voteRecord.totalWeightedVotes + bountyWeight
        const newTotalContributors = (voteRecord.totalContributors || 0) + 1
        const newContributors = [...existingContributors, newContributor]

        // Check if threshold was just reached
        const threshold = voteRecord.fundingThreshold
        const wasUnderThreshold = voteRecord.totalWeightedVotes < threshold
        const nowOverThreshold = newTotalVotes >= threshold

        const updateData: Record<string, unknown> = {
            totalWeightedVotes: newTotalVotes,
            photoContributors: newContributors,
            totalContributors: newTotalContributors,
        }

        // Update status if threshold just reached
        if (wasUnderThreshold && nowOverThreshold) {
            updateData.status = 'threshold_reached'
            updateData.thresholdReachedAt = new Date().toISOString()
        }

        await req.payload.update({
            collection: 'product-votes',
            id: voteRecord.id,
            data: updateData,
        })

        const newFundingProgress = Math.min(100, Math.round((newTotalVotes / threshold) * 100))

        const message = bountyWeight > 0
            ? `Bounty earned! Your photos added +${bountyWeight} votes to this request.`
            : `Photos added! Since you're the original voter, no bounty bonus applies.`

        return Response.json({
            success: true,
            bountyAwarded: bountyWeight > 0,
            bonusWeight: bountyWeight,
            newTotalVotes,
            fundingProgress: newFundingProgress,
            message,
        })

    } catch (error) {
        console.error('[product-vote-contribute] Error:', error)
        return Response.json(
            { error: 'Failed to register photo contribution', details: String(error) },
            { status: 500 }
        )
    }
}

/**
 * GET /api/product-vote/queue
 * Get the product testing queue with filters and pagination
 */
export const productVoteQueueHandler = async (req: PayloadRequest): Promise<Response> => {
    if (req.method !== 'GET') {
        return Response.json({ error: 'Method not allowed' }, { status: 405 })
    }

    try {
        const url = new URL(req.url || '', 'http://localhost')
        const filter = url.searchParams.get('filter') || 'most_voted'
        const page = parseInt(url.searchParams.get('page') || '1', 10)
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 50)

        // Build sort based on filter
        let sort: string
        switch (filter) {
            case 'newest':
                sort = '-createdAt'
                break
            case 'almost_funded':
                sort = '-fundingProgress'
                break
            case 'most_voted':
            default:
                sort = '-totalWeightedVotes'
        }

        const results = await req.payload.find({
            collection: 'product-votes',
            where: {
                status: { in: ['collecting_votes', 'threshold_reached'] },
            },
            sort,
            page,
            limit,
        })

        const products = results.docs.map((doc) => {
            const vote = doc as {
                barcode: string
                productName?: string
                brand?: string
                imageUrl?: string
                totalWeightedVotes: number
                uniqueVoters: number
                fundingProgress: number
                fundingThreshold: number
                totalContributors?: number
                status: string
                createdAt: string
            }

            return {
                barcode: vote.barcode,
                productName: vote.productName || 'Unknown Product',
                brand: vote.brand,
                imageUrl: vote.imageUrl,
                totalVoters: vote.uniqueVoters,
                totalContributors: vote.totalContributors || 0,
                totalWeightedVotes: vote.totalWeightedVotes,
                fundingProgress: vote.fundingProgress,
                fundingThreshold: vote.fundingThreshold,
                status: vote.status,
                createdAt: vote.createdAt,
            }
        })

        return Response.json({
            products,
            total: results.totalDocs,
            page: results.page,
            totalPages: results.totalPages,
        })

    } catch (error) {
        console.error('[product-vote-queue] Error:', error)
        return Response.json(
            { error: 'Failed to get queue', details: String(error) },
            { status: 500 }
        )
    }
}

/**
 * GET /api/product-vote/my-investigations
 * Get products the user has voted on (Scout Program)
 *
 * Uses fingerprint to identify user's investigations
 */
export const myInvestigationsHandler = async (req: PayloadRequest): Promise<Response> => {
    if (req.method !== 'GET') {
        return Response.json({ error: 'Method not allowed' }, { status: 405 })
    }

    try {
        // Get fingerprint from header (set by mobile app)
        const fingerprint = req.headers.get('x-fingerprint')

        if (!fingerprint) {
            return Response.json(
                { error: 'Fingerprint header required' },
                { status: 400 }
            )
        }

        // Find all products this user has voted on
        const userVotes = await req.payload.find({
            collection: 'product-votes',
            where: {
                voterFingerprints: { contains: fingerprint },
            },
            sort: '-updatedAt',
            limit: 100, // Max 100 investigations
        })

        if (userVotes.docs.length === 0) {
            return Response.json({
                investigations: [],
                totalInvestigations: 0,
                resultsReady: 0,
            })
        }

        // Get global queue for ranking (only active products)
        const globalQueue = await req.payload.find({
            collection: 'product-votes',
            where: {
                status: { in: ['collecting_votes', 'threshold_reached', 'queued', 'testing'] },
            },
            sort: '-velocityScore', // Use velocity for ranking
            limit: 500,
            select: {
                barcode: true,
                velocityScore: true,
            },
        })

        // Build barcode -> queue position map
        const queuePositionMap = new Map<string, number>()
        globalQueue.docs.forEach((doc, index) => {
            const vote = doc as { barcode: string }
            queuePositionMap.set(vote.barcode, index + 1)
        })

        // Transform into investigation objects
        const investigations = userVotes.docs.map((doc) => {
            const vote = doc as {
                barcode: string
                productName?: string
                brand?: string
                imageUrl?: string
                totalWeightedVotes: number
                uniqueVoters: number
                fundingProgress: number
                status: string
                voterFingerprints: string[]
                photoContributors?: { fingerprintId: string }[]
                scansLast24h?: number
                urgencyFlag?: string
                linkedProduct?: { id: string } | string
                createdAt: string
                updatedAt: string
            }

            // Calculate user's scout number (their position in voter list)
            const voterIndex = (vote.voterFingerprints || []).indexOf(fingerprint)
            const yourScoutNumber = voterIndex >= 0 ? voterIndex + 1 : 1
            const isFirstScout = yourScoutNumber === 1

            // Check if user contributed photos
            const didContributePhotos = (vote.photoContributors || []).some(
                (c) => c.fingerprintId === fingerprint
            )

            // Map status to user-friendly format
            let status: 'waiting' | 'testing' | 'complete'
            switch (vote.status) {
                case 'complete':
                    status = 'complete'
                    break
                case 'testing':
                case 'queued':
                    status = 'testing'
                    break
                default:
                    status = 'waiting'
            }

            // Get queue position (only for waiting/testing)
            const queuePosition = status !== 'complete'
                ? queuePositionMap.get(vote.barcode) || null
                : null

            // Check if trending (high 24h velocity)
            const isTrending = vote.urgencyFlag === 'trending' || vote.urgencyFlag === 'urgent'
            const velocityChange24h = vote.scansLast24h || 0

            return {
                barcode: vote.barcode,
                productName: vote.productName || 'Unknown Product',
                brand: vote.brand,
                imageUrl: vote.imageUrl,
                status,
                queuePosition,
                fundingProgress: vote.fundingProgress,
                yourScoutNumber,
                totalScouts: vote.uniqueVoters,
                isFirstScout,
                didContributePhotos,
                isTrending,
                velocityChange24h,
                linkedProductId: typeof vote.linkedProduct === 'object'
                    ? vote.linkedProduct?.id
                    : vote.linkedProduct,
                createdAt: vote.createdAt,
                updatedAt: vote.updatedAt,
            }
        })

        // Count results ready
        const resultsReady = investigations.filter((i) => i.status === 'complete').length

        return Response.json({
            investigations,
            totalInvestigations: investigations.length,
            resultsReady,
        })

    } catch (error) {
        console.error('[my-investigations] Error:', error)
        return Response.json(
            { error: 'Failed to get investigations', details: String(error) },
            { status: 500 }
        )
    }
}
