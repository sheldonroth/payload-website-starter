import type { PayloadRequest } from 'payload'
import {
    validationError,
    methodNotAllowedError,
    notFoundError,
    internalError,
    successResponse,
} from '../utilities/api-response'
import { atomicWeightedVoteUpdate } from '../utilities/atomic-operations'
import {
    checkRateLimitAsync,
    rateLimitResponse,
    RateLimits,
} from '../utilities/rate-limiter'

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
 *
 * @openapi
 * /product-vote:
 *   post:
 *     summary: Register a vote for product testing
 *     description: |
 *       Registers a vote for a product to be tested. Uses weighted voting system:
 *       - search: 1x weight (curiosity signal)
 *       - scan: 5x weight (proof of possession)
 *       - member_scan: 20x weight (premium verified possession)
 *       Votes contribute to funding progress for product testing.
 *     tags: [Voting, Mobile]
 *     security:
 *       - fingerprintAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [barcode]
 *             properties:
 *               barcode:
 *                 type: string
 *                 description: Product barcode (UPC/EAN)
 *                 example: "5000328657950"
 *               voteType:
 *                 type: string
 *                 enum: [search, scan, member_scan]
 *                 default: scan
 *               fingerprint:
 *                 type: string
 *                 description: Device fingerprint hash for unique voter tracking
 *               userId:
 *                 type: string
 *                 description: Optional user ID for authenticated users
 *               productInfo:
 *                 type: object
 *                 properties:
 *                   name:
 *                     type: string
 *                   brand:
 *                     type: string
 *                   imageUrl:
 *                     type: string
 *               notifyOnComplete:
 *                 type: boolean
 *                 description: Subscribe to notification when testing completes
 *     responses:
 *       200:
 *         description: Vote registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 voteRegistered:
 *                   type: boolean
 *                 totalVotes:
 *                   type: integer
 *                   description: Total unique voters
 *                 yourVoteRank:
 *                   type: integer
 *                   description: Your position in the voter queue
 *                 fundingProgress:
 *                   type: integer
 *                   description: Percentage progress toward testing threshold
 *                 fundingThreshold:
 *                   type: integer
 *                 productInfo:
 *                   type: object
 *                   properties:
 *                     barcode:
 *                       type: string
 *                     name:
 *                       type: string
 *                     brand:
 *                       type: string
 *                     imageUrl:
 *                       type: string
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid request (missing barcode or invalid vote type)
 *       405:
 *         description: Method not allowed
 *       500:
 *         description: Server error
 */

// Vote weights
const VOTE_WEIGHTS = {
    search: 1,
    scan: 5,
    member_scan: 20,
    bounty_contribution: 10, // Bonus for adding photos to someone else's request
}

/**
 * Check rate limits for a fingerprint using Vercel KV
 * Returns null if allowed, Response if rate limited
 *
 * Implements three-tier rate limiting:
 * 1. Per-product cooldown (5 seconds between votes on same product)
 * 2. Per-minute limit (10 votes per minute)
 * 3. Per-hour limit (100 votes per hour)
 */
async function checkVoteRateLimit(
    fingerprint: string,
    barcode: string
): Promise<Response | null> {
    if (!fingerprint) return null // Can't rate limit without fingerprint

    // Check 1: Per-product cooldown (5 seconds)
    const cooldownKey = `vote:cooldown:${fingerprint}:${barcode}`
    const cooldownResult = await checkRateLimitAsync(cooldownKey, RateLimits.VOTE_COOLDOWN)
    if (!cooldownResult.allowed) {
        const waitSeconds = Math.ceil((cooldownResult.resetAt - Date.now()) / 1000)
        return Response.json({
            success: false,
            error: `Please wait ${waitSeconds} seconds before voting for this product again`,
            rateLimited: true,
            retryAfter: waitSeconds,
        }, { status: 429 })
    }

    // Check 2: Per-minute rate limit (10 votes per minute)
    const minuteKey = `vote:minute:${fingerprint}`
    const minuteResult = await checkRateLimitAsync(minuteKey, RateLimits.VOTING)
    if (!minuteResult.allowed) {
        return rateLimitResponse(minuteResult.resetAt)
    }

    // Check 3: Per-hour rate limit (100 votes per hour)
    const hourKey = `vote:hour:${fingerprint}`
    const hourResult = await checkRateLimitAsync(hourKey, RateLimits.VOTING_HOURLY)
    if (!hourResult.allowed) {
        return Response.json({
            success: false,
            error: 'Hourly vote limit reached. Please try again later.',
            rateLimited: true,
            retryAfter: Math.ceil((hourResult.resetAt - Date.now()) / 1000),
        }, { status: 429 })
    }

    return null
}

// Fraud detection patterns
interface FraudSignals {
    isRapidVoting: boolean
    isSuspiciousPattern: boolean
    riskScore: number // 0-100, higher = more suspicious
    flags: string[]
}

/**
 * Analyze voting patterns for potential fraud
 * NOTE: Since rate limiting is now handled by Vercel KV, fraud detection
 * is based on the vote record data (timestamps stored in DB) rather than
 * in-memory state.
 */
function detectFraudSignals(
    fingerprint: string | undefined,
    voteRecord: {
        voterFingerprints: string[]
        scanTimestamps?: number[]
        totalWeightedVotes: number
    }
): FraudSignals {
    const flags: string[] = []
    let riskScore = 0

    // Check rapid voting within the vote record
    const timestamps = voteRecord.scanTimestamps || []
    const now = Date.now()
    const recentVotes = timestamps.filter((ts) => now - ts < 60 * 1000).length

    if (recentVotes > 5) {
        flags.push('rapid_voting_detected')
        riskScore += 30
    }

    // Check for suspiciously high fingerprint occurrence in voter list
    // (This could indicate vote manipulation if same fingerprint appears too often)
    if (fingerprint) {
        const fingerprintOccurrences = voteRecord.voterFingerprints.filter(
            (fp) => fp === fingerprint
        ).length
        if (fingerprintOccurrences > 3) {
            flags.push('high_volume_voter')
            riskScore += 20
        }
    }

    // Check for burst patterns (many votes in quick succession)
    if (timestamps.length >= 10) {
        const recentTimestamps = timestamps.slice(-10)
        const timeSpan = recentTimestamps[recentTimestamps.length - 1] - recentTimestamps[0]
        if (timeSpan < 30 * 1000) { // 10 votes in 30 seconds
            flags.push('burst_pattern')
            riskScore += 40
        }
    }

    return {
        isRapidVoting: recentVotes > 5,
        isSuspiciousPattern: riskScore > 50,
        riskScore: Math.min(100, riskScore),
        flags,
    }
}

/**
 * Log fraud detection events for monitoring
 */
function logFraudEvent(
    fingerprint: string | undefined,
    barcode: string,
    signals: FraudSignals
): void {
    if (signals.riskScore > 30) {
        console.warn('[Fraud Detection]', {
            fingerprint: fingerprint?.slice(0, 8) + '...',
            barcode,
            riskScore: signals.riskScore,
            flags: signals.flags,
            timestamp: new Date().toISOString(),
        })
    }
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
        return methodNotAllowedError()
    }

    try {
        const body = await req.json?.() as VoteRequest

        if (!body?.barcode) {
            return validationError('Barcode is required')
        }

        const { barcode, voteType = 'scan', fingerprint, userId, productInfo, notifyOnComplete } = body

        // Validate vote type
        if (!['search', 'scan', 'member_scan'].includes(voteType)) {
            return validationError('Invalid vote type')
        }

        // Rate limiting check using Vercel KV
        if (fingerprint) {
            const rateLimitResponse = await checkVoteRateLimit(fingerprint, barcode)
            if (rateLimitResponse) {
                return rateLimitResponse
            }
        }

        const voteWeight = VOTE_WEIGHTS[voteType]

        // Calculate velocity metrics if tracking scans (My Cases)
        // Only track scans for velocity (not searches) - proof of possession matters
        const trackVelocity = voteType === 'scan' || voteType === 'member_scan'

        // Get existing vote record for velocity calculation
        let velocityData: {
            scanTimestamps: number[]
            scansLast24h: number
            scansLast7d: number
            velocityScore: number
            urgencyFlag: 'normal' | 'trending' | 'urgent'
        } | undefined

        if (trackVelocity) {
            // Fetch existing record to get current timestamps for velocity calculation
            const existingVotes = await req.payload.find({
                collection: 'product-votes',
                where: { barcode: { equals: barcode } },
                limit: 1,
                select: { scanTimestamps: true, totalWeightedVotes: true },
            })

            const existingTimestamps = existingVotes.docs.length > 0
                ? ((existingVotes.docs[0] as any).scanTimestamps || [])
                : []
            const existingTotal = existingVotes.docs.length > 0
                ? ((existingVotes.docs[0] as any).totalWeightedVotes || 0)
                : 0

            velocityData = calculateVelocity(existingTimestamps, existingTotal + voteWeight)
        }

        // Use atomic operation to prevent race conditions
        // This handles the read-modify-write cycle with retry logic
        const atomicResult = await atomicWeightedVoteUpdate(
            req.payload,
            {
                barcode,
                voteType,
                voteWeight,
                fingerprint,
                productInfo,
                notifyId: userId || fingerprint,
                notifyOnComplete,
                velocityData,
            },
            req,
        )

        if (!atomicResult.success) {
            console.error('[product-vote] Atomic update failed:', atomicResult.error)
            return internalError('Failed to register vote due to concurrent update')
        }

        const voteRecord = atomicResult.voteRecord
        const isNewVoter = atomicResult.isNewVoter
        const yourVoteRank = atomicResult.yourVoteRank

        // Fraud detection - analyze patterns after update
        if (voteRecord) {
            const fraudSignals = detectFraudSignals(fingerprint, {
                voterFingerprints: voteRecord.voterFingerprints || [],
                scanTimestamps: voteRecord.scanTimestamps || [],
                totalWeightedVotes: voteRecord.totalWeightedVotes || 0,
            })
            logFraudEvent(fingerprint, barcode, fraudSignals)
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
        return internalError('Failed to register vote')
    }
}

/**
 * @openapi
 * /product-vote/status:
 *   get:
 *     summary: Get vote status for a barcode
 *     description: Returns voting statistics for a specific product barcode
 *     tags: [Voting, Mobile]
 *     parameters:
 *       - in: query
 *         name: barcode
 *         required: true
 *         schema:
 *           type: string
 *         description: Product barcode (UPC/EAN)
 *         example: "5000328657950"
 *     responses:
 *       200:
 *         description: Vote status retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 exists:
 *                   type: boolean
 *                 barcode:
 *                   type: string
 *                 productName:
 *                   type: string
 *                 brand:
 *                   type: string
 *                 totalVotes:
 *                   type: integer
 *                 totalWeightedVotes:
 *                   type: integer
 *                 fundingProgress:
 *                   type: integer
 *                 fundingThreshold:
 *                   type: integer
 *                 status:
 *                   type: string
 *                   enum: [collecting_votes, threshold_reached, queued, testing, complete]
 *       400:
 *         description: Missing barcode parameter
 */
export const productVoteStatusHandler = async (req: PayloadRequest): Promise<Response> => {
    if (req.method !== 'GET') {
        return methodNotAllowedError()
    }

    try {
        // Extract barcode from URL
        const url = new URL(req.url || '', 'http://localhost')
        const barcode = url.searchParams.get('barcode')

        if (!barcode) {
            return validationError('Barcode is required')
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
        return internalError('Failed to get vote status')
    }
}

/**
 * @openapi
 * /product-vote/leaderboard:
 *   get:
 *     summary: Get top voted products
 *     description: Returns leaderboard of products with most votes waiting for testing
 *     tags: [Voting, Mobile]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *           maximum: 50
 *         description: Maximum number of products to return
 *     responses:
 *       200:
 *         description: Leaderboard retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 leaderboard:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       rank:
 *                         type: integer
 *                       barcode:
 *                         type: string
 *                       productName:
 *                         type: string
 *                       brand:
 *                         type: string
 *                       imageUrl:
 *                         type: string
 *                       totalVoters:
 *                         type: integer
 *                       fundingProgress:
 *                         type: integer
 *                       status:
 *                         type: string
 *                 total:
 *                   type: integer
 */
export const productVoteLeaderboardHandler = async (req: PayloadRequest): Promise<Response> => {
    if (req.method !== 'GET') {
        return methodNotAllowedError()
    }

    try {
        const url = new URL(req.url || '', 'http://localhost')
        const limit = parseInt(url.searchParams.get('limit') || '10', 10)

        const topVoted = await req.payload.find({
            collection: 'product-votes',
            where: {
                status: { in: ['collecting_votes', 'threshold_reached'] },
                // Only show products with names - hide "Unknown Product" entries
                productName: { exists: true },
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
        return internalError('Failed to get leaderboard')
    }
}

/**
 * @openapi
 * /product-vote/contribute:
 *   post:
 *     summary: Contribute photos for bounty bonus
 *     description: |
 *       Add photos to another user's product request for +10x vote bonus.
 *       Bounty is only awarded if contributor is different from original voter.
 *     tags: [Voting, Mobile]
 *     security:
 *       - fingerprintAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [barcode, fingerprintId, submissionId]
 *             properties:
 *               barcode:
 *                 type: string
 *                 description: Product barcode
 *               fingerprintId:
 *                 type: string
 *                 description: Device fingerprint hash
 *               userId:
 *                 type: string
 *                 description: Optional authenticated user ID
 *               submissionId:
 *                 type: integer
 *                 description: ID of the photo submission
 *     responses:
 *       200:
 *         description: Contribution processed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 bountyAwarded:
 *                   type: boolean
 *                 bonusWeight:
 *                   type: integer
 *                 newTotalVotes:
 *                   type: integer
 *                 fundingProgress:
 *                   type: integer
 *                 message:
 *                   type: string
 *       400:
 *         description: Missing required fields
 *       404:
 *         description: Vote record not found
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
        return methodNotAllowedError()
    }

    try {
        const body = await req.json?.() as ContributeRequest

        if (!body?.barcode || !body?.fingerprintId || !body?.submissionId) {
            return validationError('barcode, fingerprintId, and submissionId are required')
        }

        const { barcode, fingerprintId, userId, submissionId } = body

        // Find existing vote record
        const existingVotes = await req.payload.find({
            collection: 'product-votes',
            where: { barcode: { equals: barcode } },
            limit: 1,
        })

        if (existingVotes.docs.length === 0) {
            return notFoundError('No vote record found for this barcode. Vote first before contributing photos.')
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
        return internalError('Failed to register photo contribution')
    }
}

/**
 * @openapi
 * /product-vote/queue:
 *   get:
 *     summary: Get product testing queue
 *     description: Returns paginated list of products in the testing queue with filtering options
 *     tags: [Voting, Mobile]
 *     parameters:
 *       - in: query
 *         name: filter
 *         schema:
 *           type: string
 *           enum: [most_voted, newest, almost_funded]
 *           default: most_voted
 *         description: Sort filter for queue
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 50
 *         description: Items per page
 *     responses:
 *       200:
 *         description: Queue retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 products:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       barcode:
 *                         type: string
 *                       productName:
 *                         type: string
 *                       brand:
 *                         type: string
 *                       imageUrl:
 *                         type: string
 *                       totalVoters:
 *                         type: integer
 *                       totalContributors:
 *                         type: integer
 *                       totalWeightedVotes:
 *                         type: integer
 *                       fundingProgress:
 *                         type: integer
 *                       fundingThreshold:
 *                         type: integer
 *                       status:
 *                         type: string
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                 total:
 *                   type: integer
 *                 page:
 *                   type: integer
 *                 totalPages:
 *                   type: integer
 */
export const productVoteQueueHandler = async (req: PayloadRequest): Promise<Response> => {
    if (req.method !== 'GET') {
        return methodNotAllowedError()
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
        return internalError('Failed to get queue')
    }
}

/**
 * @openapi
 * /product-vote/my-investigations:
 *   get:
 *     summary: Get user's voted products (My Cases)
 *     description: |
 *       Returns paginated list of products the user has voted on, with status and queue position.
 *       Requires fingerprint header for device identification.
 *     tags: [Voting, Mobile, Scout]
 *     security:
 *       - fingerprintAuth: []
 *     parameters:
 *       - in: header
 *         name: x-fingerprint
 *         required: true
 *         schema:
 *           type: string
 *         description: Device fingerprint hash
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *           minimum: 1
 *         description: Page number (1-indexed)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           minimum: 1
 *           maximum: 100
 *         description: Number of items per page (max 100)
 *     responses:
 *       200:
 *         description: User investigations retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 investigations:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       barcode:
 *                         type: string
 *                       productName:
 *                         type: string
 *                       brand:
 *                         type: string
 *                       imageUrl:
 *                         type: string
 *                       status:
 *                         type: string
 *                         enum: [waiting, testing, complete]
 *                       queuePosition:
 *                         type: integer
 *                         nullable: true
 *                       fundingProgress:
 *                         type: integer
 *                       yourScoutNumber:
 *                         type: integer
 *                       totalScouts:
 *                         type: integer
 *                       isFirstScout:
 *                         type: boolean
 *                       didContributePhotos:
 *                         type: boolean
 *                       isTrending:
 *                         type: boolean
 *                       velocityChange24h:
 *                         type: integer
 *                       linkedProductId:
 *                         type: string
 *                         nullable: true
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       updatedAt:
 *                         type: string
 *                         format: date-time
 *                 totalInvestigations:
 *                   type: integer
 *                   description: Total number of investigations across all pages
 *                 resultsReady:
 *                   type: integer
 *                   description: Number of completed investigations on current page
 *                 page:
 *                   type: integer
 *                   description: Current page number
 *                 totalPages:
 *                   type: integer
 *                   description: Total number of pages
 *                 hasNextPage:
 *                   type: boolean
 *                 hasPrevPage:
 *                   type: boolean
 *       400:
 *         description: Missing fingerprint header
 */
export const myInvestigationsHandler = async (req: PayloadRequest): Promise<Response> => {
    if (req.method !== 'GET') {
        return methodNotAllowedError()
    }

    try {
        // Get fingerprint from header (set by mobile app)
        const fingerprint = req.headers.get('x-fingerprint')

        if (!fingerprint) {
            return validationError('Fingerprint header required')
        }

        // Parse pagination parameters
        const url = new URL(req.url || '', 'http://localhost')
        const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10))
        const limit = Math.min(Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)), 100)

        // Find all products this user has voted on with pagination
        const userVotes = await req.payload.find({
            collection: 'product-votes',
            where: {
                voterFingerprints: { contains: fingerprint },
            },
            sort: '-updatedAt',
            page,
            limit,
        })

        if (userVotes.docs.length === 0) {
            return Response.json({
                investigations: [],
                totalInvestigations: 0,
                resultsReady: 0,
                page: 1,
                totalPages: 0,
                hasNextPage: false,
                hasPrevPage: false,
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

        // Count results ready (on current page)
        const resultsReady = investigations.filter((i) => i.status === 'complete').length

        return Response.json({
            investigations,
            totalInvestigations: userVotes.totalDocs,
            resultsReady,
            page: userVotes.page || page,
            totalPages: userVotes.totalPages || 1,
            hasNextPage: userVotes.hasNextPage || false,
            hasPrevPage: userVotes.hasPrevPage || false,
        })

    } catch (error) {
        console.error('[my-investigations] Error:', error)
        return internalError('Failed to get investigations')
    }
}
