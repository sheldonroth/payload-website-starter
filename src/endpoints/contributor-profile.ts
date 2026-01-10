/**
 * Contributor Profile API Endpoints
 *
 * Public and private endpoints for contributor profiles and statistics.
 * The heart of the My Cases recognition system.
 *
 * @openapi
 * /contributor-profile/{slug}:
 *   get:
 *     summary: Get public contributor profile
 *     description: |
 *       Returns public profile data for a contributor by their shareable slug.
 *       Includes display name, avatar, bio, stats, badges, and recent contributions.
 *       Profile must be marked as public to be accessible.
 *     tags: [Contributors]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *         description: Contributor's shareable slug
 *     responses:
 *       200:
 *         description: Contributor profile found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 profile:
 *                   type: object
 *                   properties:
 *                     displayName:
 *                       type: string
 *                     avatar:
 *                       type: string
 *                     bio:
 *                       type: string
 *                     contributorNumber:
 *                       type: integer
 *                     level:
 *                       type: string
 *                       enum: [new, builder, veteran, champion]
 *                     shareableSlug:
 *                       type: string
 *                     joinedAt:
 *                       type: string
 *                       format: date-time
 *                     stats:
 *                       type: object
 *                       properties:
 *                         documentsSubmitted:
 *                           type: integer
 *                         productsTestedFromSubmissions:
 *                           type: integer
 *                         peopleHelped:
 *                           type: integer
 *                         firstCases:
 *                           type: integer
 *                     badges:
 *                       type: array
 *                       items:
 *                         type: string
 *                 recentContributions:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       barcode:
 *                         type: string
 *                       productName:
 *                         type: string
 *                       status:
 *                         type: string
 *                 testedProducts:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       verdict:
 *                         type: string
 *                 cached:
 *                   type: boolean
 *       400:
 *         description: Contributor slug is required
 *       403:
 *         description: This contributor profile is private
 *       404:
 *         description: Contributor not found
 *       500:
 *         description: Failed to get contributor profile
 *
 * @openapi
 * /my-contributor-stats:
 *   get:
 *     summary: Get personal contributor statistics
 *     description: |
 *       Returns personalized stats for the requesting device based on fingerprint.
 *       Includes profile info, badges, active cases, and completed products.
 *     tags: [Contributors]
 *     parameters:
 *       - in: header
 *         name: x-fingerprint
 *         required: true
 *         schema:
 *           type: string
 *         description: Device fingerprint hash
 *     responses:
 *       200:
 *         description: Contributor stats retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 hasProfile:
 *                   type: boolean
 *                 profile:
 *                   type: object
 *                   nullable: true
 *                   properties:
 *                     displayName:
 *                       type: string
 *                     avatar:
 *                       type: string
 *                     contributorNumber:
 *                       type: integer
 *                     level:
 *                       type: string
 *                     shareableSlug:
 *                       type: string
 *                     shareableUrl:
 *                       type: string
 *                 stats:
 *                   type: object
 *                   properties:
 *                     documentsSubmitted:
 *                       type: integer
 *                     productsTestedFromSubmissions:
 *                       type: integer
 *                     peopleHelped:
 *                       type: integer
 *                     firstCases:
 *                       type: integer
 *                     level:
 *                       type: string
 *                 badges:
 *                   type: array
 *                   items:
 *                     type: string
 *                 activeCases:
 *                   type: array
 *                   items:
 *                     type: object
 *                 completedProducts:
 *                   type: array
 *                   items:
 *                     type: object
 *                 nextMilestone:
 *                   type: object
 *                   properties:
 *                     nextLevel:
 *                       type: string
 *                     remaining:
 *                       type: integer
 *                     message:
 *                       type: string
 *                 cached:
 *                   type: boolean
 *       400:
 *         description: Fingerprint required
 *       500:
 *         description: Failed to get contributor stats
 *
 * @openapi
 * /contributor-profile/update:
 *   post:
 *     summary: Update contributor profile
 *     description: Update display name, avatar, bio, or privacy settings for your profile
 *     tags: [Contributors]
 *     parameters:
 *       - in: header
 *         name: x-fingerprint
 *         required: true
 *         schema:
 *           type: string
 *         description: Device fingerprint hash
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               displayName:
 *                 type: string
 *                 maxLength: 50
 *               avatar:
 *                 type: string
 *                 maxLength: 10
 *                 description: Emoji or short URL
 *               bio:
 *                 type: string
 *                 maxLength: 280
 *               isPublic:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 profile:
 *                   type: object
 *                   properties:
 *                     displayName:
 *                       type: string
 *                     avatar:
 *                       type: string
 *                     bio:
 *                       type: string
 *                     isPublic:
 *                       type: boolean
 *       400:
 *         description: Fingerprint required
 *       404:
 *         description: Contributor profile not found
 *       500:
 *         description: Failed to update contributor profile
 *
 * @openapi
 * /contributor-profile/register-contribution:
 *   post:
 *     summary: Register a contribution
 *     description: |
 *       Internal endpoint called when a contributor documents a product.
 *       Creates or updates contributor profile and records the contribution.
 *     tags: [Contributors]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fingerprintHash, barcode, productVoteId]
 *             properties:
 *               fingerprintHash:
 *                 type: string
 *               barcode:
 *                 type: string
 *               productVoteId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Contribution registered
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 contributorNumber:
 *                   type: integer
 *                 casePosition:
 *                   type: integer
 *                 isFirstContributor:
 *                   type: boolean
 *                 totalContributors:
 *                   type: integer
 *                 stats:
 *                   type: object
 *                   properties:
 *                     documentsSubmitted:
 *                       type: integer
 *                     level:
 *                       type: string
 *       400:
 *         description: Missing required fields
 *       500:
 *         description: Failed to register contribution
 */

import type { PayloadRequest } from 'payload'
import {
    validationError,
    notFoundError,
    forbiddenError,
    internalError,
    methodNotAllowedError,
} from '../utilities/api-response'

// ============================================================================
// Cache Configuration
// ============================================================================

interface CacheEntry<T> {
    data: T
    timestamp: number
    ttl: number
}

class ContributorCache {
    private cache = new Map<string, CacheEntry<unknown>>()

    /**
     * Get cached data if valid
     */
    get<T>(key: string): T | null {
        const entry = this.cache.get(key)
        if (!entry) return null

        const now = Date.now()
        if (now - entry.timestamp > entry.ttl) {
            this.cache.delete(key)
            return null
        }

        return entry.data as T
    }

    /**
     * Set data with TTL
     */
    set<T>(key: string, data: T, ttlMs: number): void {
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            ttl: ttlMs,
        })
    }

    /**
     * Delete a specific key
     */
    delete(key: string): void {
        this.cache.delete(key)
    }

    /**
     * Delete all keys matching a pattern (prefix)
     */
    deleteByPrefix(prefix: string): void {
        for (const key of this.cache.keys()) {
            if (key.startsWith(prefix)) {
                this.cache.delete(key)
            }
        }
    }

    /**
     * Cleanup expired entries
     */
    cleanup(): number {
        const now = Date.now()
        let cleaned = 0

        for (const [key, entry] of this.cache.entries()) {
            if (now - entry.timestamp > entry.ttl) {
                this.cache.delete(key)
                cleaned++
            }
        }

        return cleaned
    }
}

// Singleton cache instance
const contributorCache = new ContributorCache()

// Cache TTL constants (in milliseconds)
const CACHE_TTL = {
    PROFILE: 5 * 60 * 1000, // 5 minutes for public profiles
    STATS: 2 * 60 * 1000, // 2 minutes for personal stats
} as const

// Cache key prefixes
const CACHE_KEYS = {
    PROFILE: 'contributor:profile:',
    STATS: 'contributor:stats:',
} as const

// Start cleanup interval (every 5 minutes)
if (typeof setInterval !== 'undefined') {
    setInterval(() => {
        const cleaned = contributorCache.cleanup()
        if (cleaned > 0) {
            console.log(`[ContributorCache] Cleaned ${cleaned} expired entries`)
        }
    }, 5 * 60 * 1000)
}

/**
 * Invalidate cache for a specific profile
 */
export function invalidateContributorCache(slug?: string, fingerprintHash?: string): void {
    if (slug) {
        contributorCache.delete(`${CACHE_KEYS.PROFILE}${slug}`)
    }
    if (fingerprintHash) {
        contributorCache.delete(`${CACHE_KEYS.STATS}${fingerprintHash}`)
    }
}

interface CaseContributor {
    contributorId: string | number
    contributorNumber: number
    fingerprintHash: string
    casePosition: number
    contributedAt: string
}

/**
 * Contributor profile record from database
 */
interface ContributorProfileRecord {
    id: string | number
    displayName: string
    avatar: string
    bio?: string
    contributorNumber: number
    documentsSubmitted: number
    productsTestedFromSubmissions: number
    peopleHelped: number
    firstCases: number
    contributorLevel: string
    isPublic: boolean
    shareableSlug: string
    badges: string[]
    featuredCases: string[]
    createdAt: string
    fingerprintHash?: string
}

/**
 * Product vote record for contributor tracking
 */
interface ContributorProductVote {
    id: string | number
    barcode: string
    productName?: string
    status: string
    fundingProgress?: number
    firstScout?: string | number
    scoutContributors?: CaseContributor[]
    totalScouts?: number
}

/**
 * Tested product record
 */
interface ContributorTestedProduct {
    id: string | number
    name: string
    verdict: string
}

/**
 * Updated profile response data
 */
interface UpdatedProfileResponse {
    displayName: string
    avatar: string
    bio?: string
    isPublic: boolean
}

/**
 * Minimal contributor profile for registration
 */
interface ContributorProfileMinimal {
    id: string | number
    contributorNumber: number
    documentsSubmitted: number
    firstCases: number
}

/**
 * Get public contributor profile by slug
 * GET /api/contributor-profile/:slug
 */
export const getContributorProfileHandler = async (req: PayloadRequest): Promise<Response> => {
    if (req.method !== 'GET') {
        return methodNotAllowedError()
    }

    try {
        // Extract slug from URL path
        const url = new URL(req.url || '', 'http://localhost')
        const pathParts = url.pathname.split('/')
        const slug = pathParts[pathParts.length - 1]

        if (!slug || slug === 'contributor-profile') {
            return validationError('Contributor slug is required')
        }

        // Check cache first
        const cacheKey = `${CACHE_KEYS.PROFILE}${slug}`
        const cachedResponse = contributorCache.get<object>(cacheKey)
        if (cachedResponse) {
            return new Response(JSON.stringify({ ...cachedResponse, cached: true }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'public, max-age=300', // 5 minutes
                    'X-Cache': 'HIT',
                },
            })
        }

        // Find contributor profile by slug
        const profiles = await req.payload.find({
            collection: 'contributor-profiles',
            where: {
                shareableSlug: { equals: slug },
            },
            limit: 1,
        })

        if (profiles.docs.length === 0) {
            return notFoundError('Contributor')
        }

        const profile = profiles.docs[0] as ContributorProfileRecord

        // Check if profile is public
        if (!profile.isPublic) {
            return forbiddenError('This contributor profile is private')
        }

        // Get some of their documented products (top 5)
        // Note: scoutContributors is a JSON field, so we use 'like' to search for fingerprintHash
        // Sanitize fingerprintHash to prevent injection - only allow alphanumeric and dashes
        const sanitizedFingerprintHash = (profile.fingerprintHash || '')
            .replace(/[^a-zA-Z0-9\-]/g, '')
            .substring(0, 64);
        const contributions = await req.payload.find({
            collection: 'product-votes',
            where: {
                'scoutContributors': {
                    like: `%"fingerprintHash":"${sanitizedFingerprintHash}"%`,
                },
            },
            limit: 5,
            sort: '-createdAt',
        })

        // Get tested products they contributed to
        const testedProducts = await req.payload.find({
            collection: 'products',
            where: {
                'scoutAttribution.firstScout': {
                    equals: profile.id,
                },
            },
            limit: 5,
            sort: '-createdAt',
        })

        const responseData = {
            success: true,
            profile: {
                displayName: profile.displayName,
                avatar: profile.avatar,
                bio: profile.bio,
                contributorNumber: profile.contributorNumber,
                level: profile.contributorLevel,
                shareableSlug: profile.shareableSlug,
                joinedAt: profile.createdAt,
                stats: {
                    documentsSubmitted: profile.documentsSubmitted,
                    productsTestedFromSubmissions: profile.productsTestedFromSubmissions,
                    peopleHelped: profile.peopleHelped,
                    firstCases: profile.firstCases,
                },
                badges: profile.badges || [],
            },
            recentContributions: contributions.docs.map((doc) => {
                const c = doc as ContributorProductVote
                return {
                    barcode: c.barcode,
                    productName: c.productName,
                    status: c.status,
                }
            }),
            testedProducts: testedProducts.docs.map((doc) => {
                const p = doc as ContributorTestedProduct
                return {
                    id: p.id,
                    name: p.name,
                    verdict: p.verdict,
                }
            }),
            generatedAt: new Date().toISOString(),
        }

        // Cache the response
        contributorCache.set(cacheKey, responseData, CACHE_TTL.PROFILE)

        return new Response(JSON.stringify({ ...responseData, cached: false }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'public, max-age=300', // 5 minutes
                'X-Cache': 'MISS',
            },
        })
    } catch (error) {
        console.error('[contributor-profile] Error:', error)
        return internalError('Failed to get contributor profile')
    }
}

/**
 * Get personal contributor stats (fingerprint-based)
 * GET /api/my-contributor-stats
 */
export const getMyContributorStatsHandler = async (req: PayloadRequest): Promise<Response> => {
    if (req.method !== 'GET') {
        return methodNotAllowedError()
    }

    try {
        const fingerprintHash = req.headers.get('x-fingerprint')

        if (!fingerprintHash) {
            return validationError('Fingerprint required')
        }

        // Check cache first
        const cacheKey = `${CACHE_KEYS.STATS}${fingerprintHash}`
        const cachedResponse = contributorCache.get<object>(cacheKey)
        if (cachedResponse) {
            return new Response(JSON.stringify({ ...cachedResponse, cached: true }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'private, max-age=120', // 2 minutes
                    'X-Cache': 'HIT',
                },
            })
        }

        // Find or create contributor profile
        let profiles = await req.payload.find({
            collection: 'contributor-profiles',
            where: {
                fingerprintHash: { equals: fingerprintHash },
            },
            limit: 1,
        })

        let profile = profiles.docs[0] as ContributorProfileRecord | undefined

        // If no profile exists, this contributor hasn't documented anything yet
        if (!profile) {
            const noProfileResponse = {
                success: true,
                hasProfile: false,
                stats: {
                    documentsSubmitted: 0,
                    productsTestedFromSubmissions: 0,
                    peopleHelped: 0,
                    firstCases: 0,
                    level: 'new',
                },
                message: 'Document your first product to open a case!',
                generatedAt: new Date().toISOString(),
            }
            // Cache the no-profile response too (short TTL)
            contributorCache.set(cacheKey, noProfileResponse, CACHE_TTL.STATS)
            return new Response(JSON.stringify({ ...noProfileResponse, cached: false }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'private, max-age=120', // 2 minutes
                    'X-Cache': 'MISS',
                },
            })
        }

        // Get their active cases (pending products)
        // Note: scoutContributors is a JSON field, so we use 'like' to search for fingerprintHash
        const activeCases = await req.payload.find({
            collection: 'product-votes',
            where: {
                and: [
                    {
                        scoutContributors: {
                            like: `%"fingerprintHash":"${fingerprintHash}"%`,
                        },
                    },
                    {
                        status: {
                            in: ['collecting_votes', 'threshold_reached', 'queued', 'testing'],
                        },
                    },
                ],
            },
            limit: 10,
            sort: '-updatedAt',
        })

        // Get their completed products (tested)
        const completedProducts = await req.payload.find({
            collection: 'products',
            where: {
                'scoutAttribution.firstScout': {
                    equals: profile.id,
                },
            },
            limit: 10,
            sort: '-createdAt',
        })

        const responseData = {
            success: true,
            hasProfile: true,
            profile: {
                displayName: profile.displayName,
                avatar: profile.avatar,
                contributorNumber: profile.contributorNumber,
                level: profile.contributorLevel,
                shareableSlug: profile.shareableSlug,
                shareableUrl: `https://theproductreport.org/contributor/${profile.shareableSlug}`,
                joinedAt: profile.createdAt,
            },
            stats: {
                documentsSubmitted: profile.documentsSubmitted,
                productsTestedFromSubmissions: profile.productsTestedFromSubmissions,
                peopleHelped: profile.peopleHelped,
                firstCases: profile.firstCases,
                level: profile.contributorLevel,
            },
            badges: profile.badges || [],
            activeCases: activeCases.docs.map((doc, index) => {
                const inv = doc as ContributorProductVote
                return {
                    barcode: inv.barcode,
                    productName: inv.productName,
                    status: inv.status,
                    fundingProgress: inv.fundingProgress,
                    queuePosition: index + 1,
                }
            }),
            completedProducts: completedProducts.docs.map((doc) => {
                const p = doc as ContributorTestedProduct
                return {
                    id: p.id,
                    name: p.name,
                    verdict: p.verdict,
                }
            }),
            nextMilestone: getNextMilestone(profile.documentsSubmitted),
            generatedAt: new Date().toISOString(),
        }

        // Cache the response
        contributorCache.set(cacheKey, responseData, CACHE_TTL.STATS)

        return new Response(JSON.stringify({ ...responseData, cached: false }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'private, max-age=120', // 2 minutes
                'X-Cache': 'MISS',
            },
        })
    } catch (error) {
        console.error('[my-contributor-stats] Error:', error)
        return internalError('Failed to get contributor stats')
    }
}

/**
 * Update contributor profile (display name, avatar, bio)
 * POST /api/contributor-profile/update
 */
export const updateContributorProfileHandler = async (req: PayloadRequest): Promise<Response> => {
    if (req.method !== 'POST') {
        return methodNotAllowedError()
    }

    try {
        const fingerprintHash = req.headers.get('x-fingerprint')

        if (!fingerprintHash) {
            return validationError('Fingerprint required')
        }

        const body = await req.json?.() as {
            displayName?: string
            avatar?: string
            bio?: string
            isPublic?: boolean
        }

        // Find existing profile
        const profiles = await req.payload.find({
            collection: 'contributor-profiles',
            where: {
                fingerprintHash: { equals: fingerprintHash },
            },
            limit: 1,
        })

        if (profiles.docs.length === 0) {
            return notFoundError('Contributor profile')
        }

        const profile = profiles.docs[0] as ContributorProfileRecord

        // Update profile
        const updateData: Record<string, unknown> = {}
        if (body.displayName) updateData.displayName = body.displayName.slice(0, 50)
        if (body.avatar) updateData.avatar = body.avatar.slice(0, 10) // emoji or short URL
        if (body.bio !== undefined) updateData.bio = body.bio.slice(0, 280)
        if (body.isPublic !== undefined) updateData.isPublic = body.isPublic

        const updated = await req.payload.update({
            collection: 'contributor-profiles',
            id: profile.id,
            data: updateData,
        })

        // Invalidate cache for this profile (both by slug and fingerprint)
        invalidateContributorCache(profile.shareableSlug, fingerprintHash)

        const updatedProfile = updated as UpdatedProfileResponse

        return Response.json({
            success: true,
            profile: {
                displayName: updatedProfile.displayName,
                avatar: updatedProfile.avatar,
                bio: updatedProfile.bio,
                isPublic: updatedProfile.isPublic,
            },
        })
    } catch (error) {
        console.error('[contributor-profile/update] Error:', error)
        return internalError('Failed to update contributor profile')
    }
}

/**
 * Register a contributor contribution when they document a product
 * POST /api/contributor-profile/register-contribution
 *
 * Called by the product-vote endpoint when a contributor submits photos
 */
export const registerContributorContributionHandler = async (req: PayloadRequest): Promise<Response> => {
    if (req.method !== 'POST') {
        return methodNotAllowedError()
    }

    try {
        const body = await req.json?.() as {
            fingerprintHash: string
            barcode: string
            productVoteId: string | number
        }

        if (!body.fingerprintHash || !body.barcode || !body.productVoteId) {
            return validationError('fingerprintHash, barcode, and productVoteId are required')
        }

        // Find or create contributor profile
        let profiles = await req.payload.find({
            collection: 'contributor-profiles',
            where: {
                fingerprintHash: { equals: body.fingerprintHash },
            },
            limit: 1,
        })

        let contributorProfile: ContributorProfileMinimal

        if (profiles.docs.length === 0) {
            // Create new contributor profile
            const newProfile = await req.payload.create({
                collection: 'contributor-profiles',
                data: {
                    fingerprintHash: body.fingerprintHash,
                    displayName: 'Anonymous Contributor',
                    avatar: '🔬',
                    documentsSubmitted: 1,
                },
            })
            contributorProfile = newProfile as ContributorProfileMinimal
        } else {
            // Update existing profile
            contributorProfile = profiles.docs[0] as ContributorProfileMinimal
            await req.payload.update({
                collection: 'contributor-profiles',
                id: contributorProfile.id,
                data: {
                    documentsSubmitted: (contributorProfile.documentsSubmitted || 0) + 1,
                },
            })
            contributorProfile.documentsSubmitted = (contributorProfile.documentsSubmitted || 0) + 1
        }

        // Get the ProductVote to update case attribution
        const productVote = await req.payload.findByID({
            collection: 'product-votes',
            id: body.productVoteId,
        }) as ContributorProductVote

        const existingContributors = productVote.scoutContributors || []
        const isFirstContributor = !productVote.firstScout
        const alreadyContributed = existingContributors.some(
            (c: CaseContributor) => c.fingerprintHash === body.fingerprintHash
        )

        if (!alreadyContributed) {
            // Add to contributors
            const newContributor: CaseContributor = {
                contributorId: contributorProfile.id,
                contributorNumber: contributorProfile.contributorNumber,
                fingerprintHash: body.fingerprintHash,
                casePosition: existingContributors.length + 1,
                contributedAt: new Date().toISOString(),
            }

            const updateData: Record<string, unknown> = {
                scoutContributors: [...existingContributors, newContributor],
                totalScouts: existingContributors.length + 1,
            }

            // Set first contributor if this is the first contribution
            if (isFirstContributor) {
                updateData.firstScout = contributorProfile.id
                updateData.firstScoutNumber = contributorProfile.contributorNumber

                // Update contributor's firstCases count
                await req.payload.update({
                    collection: 'contributor-profiles',
                    id: contributorProfile.id,
                    data: {
                        firstCases: (contributorProfile.firstCases || 0) + 1,
                    },
                })
            }

            await req.payload.update({
                collection: 'product-votes',
                id: body.productVoteId,
                data: updateData,
            })
        }

        // Invalidate stats cache for this fingerprint (their stats have changed)
        invalidateContributorCache(undefined, body.fingerprintHash)

        return Response.json({
            success: true,
            contributorNumber: contributorProfile.contributorNumber,
            casePosition: alreadyContributed
                ? existingContributors.findIndex(
                    (c: CaseContributor) => c.fingerprintHash === body.fingerprintHash
                ) + 1
                : existingContributors.length + 1,
            isFirstContributor,
            totalContributors: alreadyContributed
                ? existingContributors.length
                : existingContributors.length + 1,
            stats: {
                documentsSubmitted: contributorProfile.documentsSubmitted,
                level: getContributorLevel(contributorProfile.documentsSubmitted),
            },
        })
    } catch (error) {
        console.error('[contributor-profile/register-contribution] Error:', error)
        return internalError('Failed to register contribution')
    }
}

// Helper functions
function getContributorLevel(documentsSubmitted: number): string {
    if (documentsSubmitted >= 50) return 'champion'
    if (documentsSubmitted >= 15) return 'veteran'
    if (documentsSubmitted >= 5) return 'builder'
    return 'new'
}

function getNextMilestone(documentsSubmitted: number): {
    nextLevel: string
    remaining: number
    message: string
} {
    if (documentsSubmitted >= 50) {
        return {
            nextLevel: 'champion',
            remaining: 0,
            message: "You're building the database.",
        }
    }
    if (documentsSubmitted >= 15) {
        return {
            nextLevel: 'champion',
            remaining: 50 - documentsSubmitted,
            message: `${50 - documentsSubmitted} more to Champion`,
        }
    }
    if (documentsSubmitted >= 5) {
        return {
            nextLevel: 'veteran',
            remaining: 15 - documentsSubmitted,
            message: `${15 - documentsSubmitted} more to Veteran`,
        }
    }
    return {
        nextLevel: 'builder',
        remaining: 5 - documentsSubmitted,
        message: `${5 - documentsSubmitted} more to Builder`,
    }
}
