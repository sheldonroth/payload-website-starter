/**
 * Contributor Profile API Endpoints
 *
 * Public and private endpoints for contributor profiles and statistics.
 * The heart of the My Cases recognition system.
 *
 * Endpoints:
 * - GET /api/contributor-profile/:slug - Public profile data
 * - GET /api/my-contributor-stats - Personal stats (fingerprint-based)
 * - POST /api/contributor-profile/update - Update display name, avatar
 * - POST /api/contributor-profile/register-contribution - Called when a contributor documents a product
 */

import type { PayloadRequest } from 'payload'

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
 * Get public contributor profile by slug
 * GET /api/contributor-profile/:slug
 */
export const getContributorProfileHandler = async (req: PayloadRequest): Promise<Response> => {
    if (req.method !== 'GET') {
        return Response.json({ error: 'Method not allowed' }, { status: 405 })
    }

    try {
        // Extract slug from URL path
        const url = new URL(req.url || '', 'http://localhost')
        const pathParts = url.pathname.split('/')
        const slug = pathParts[pathParts.length - 1]

        if (!slug || slug === 'contributor-profile') {
            return Response.json({ error: 'Contributor slug is required' }, { status: 400 })
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
            return Response.json({ error: 'Contributor not found' }, { status: 404 })
        }

        const profile = profiles.docs[0] as {
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
        }

        // Check if profile is public
        if (!profile.isPublic) {
            return Response.json({ error: 'This contributor profile is private' }, { status: 403 })
        }

        // Get some of their documented products (top 5)
        const contributions = await req.payload.find({
            collection: 'product-votes',
            where: {
                'scoutContributors': {
                    contains: profile.id.toString(),
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
            recentContributions: contributions.docs.map((c) => ({
                barcode: (c as { barcode: string }).barcode,
                productName: (c as { productName?: string }).productName,
                status: (c as { status: string }).status,
            })),
            testedProducts: testedProducts.docs.map((p) => ({
                id: (p as { id: string | number }).id,
                name: (p as { name: string }).name,
                verdict: (p as { verdict: string }).verdict,
            })),
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
        return Response.json(
            { error: 'Failed to get contributor profile' },
            { status: 500 }
        )
    }
}

/**
 * Get personal contributor stats (fingerprint-based)
 * GET /api/my-contributor-stats
 */
export const getMyContributorStatsHandler = async (req: PayloadRequest): Promise<Response> => {
    if (req.method !== 'GET') {
        return Response.json({ error: 'Method not allowed' }, { status: 405 })
    }

    try {
        const fingerprintHash = req.headers.get('x-fingerprint')

        if (!fingerprintHash) {
            return Response.json({ error: 'Fingerprint required' }, { status: 400 })
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

        let profile = profiles.docs[0] as {
            id: string | number
            displayName: string
            avatar: string
            contributorNumber: number
            documentsSubmitted: number
            productsTestedFromSubmissions: number
            peopleHelped: number
            firstCases: number
            contributorLevel: string
            shareableSlug: string
            badges: string[]
            createdAt: string
        } | undefined

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
        const activeCases = await req.payload.find({
            collection: 'product-votes',
            where: {
                and: [
                    {
                        scoutContributors: {
                            contains: profile.id.toString(),
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
            activeCases: activeCases.docs.map((inv) => ({
                barcode: (inv as { barcode: string }).barcode,
                productName: (inv as { productName?: string }).productName,
                status: (inv as { status: string }).status,
                fundingProgress: (inv as { fundingProgress: number }).fundingProgress,
            })),
            completedProducts: completedProducts.docs.map((p) => ({
                id: (p as { id: string | number }).id,
                name: (p as { name: string }).name,
                verdict: (p as { verdict: string }).verdict,
            })),
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
        return Response.json(
            { error: 'Failed to get contributor stats' },
            { status: 500 }
        )
    }
}

/**
 * Update contributor profile (display name, avatar, bio)
 * POST /api/contributor-profile/update
 */
export const updateContributorProfileHandler = async (req: PayloadRequest): Promise<Response> => {
    if (req.method !== 'POST') {
        return Response.json({ error: 'Method not allowed' }, { status: 405 })
    }

    try {
        const fingerprintHash = req.headers.get('x-fingerprint')

        if (!fingerprintHash) {
            return Response.json({ error: 'Fingerprint required' }, { status: 400 })
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
            return Response.json({ error: 'Contributor profile not found' }, { status: 404 })
        }

        const profile = profiles.docs[0] as { id: string | number; shareableSlug?: string }

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

        return Response.json({
            success: true,
            profile: {
                displayName: (updated as { displayName: string }).displayName,
                avatar: (updated as { avatar: string }).avatar,
                bio: (updated as { bio?: string }).bio,
                isPublic: (updated as { isPublic: boolean }).isPublic,
            },
        })
    } catch (error) {
        console.error('[contributor-profile/update] Error:', error)
        return Response.json(
            { error: 'Failed to update contributor profile' },
            { status: 500 }
        )
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
        return Response.json({ error: 'Method not allowed' }, { status: 405 })
    }

    try {
        const body = await req.json?.() as {
            fingerprintHash: string
            barcode: string
            productVoteId: string | number
        }

        if (!body.fingerprintHash || !body.barcode || !body.productVoteId) {
            return Response.json(
                { error: 'fingerprintHash, barcode, and productVoteId are required' },
                { status: 400 }
            )
        }

        // Find or create contributor profile
        let profiles = await req.payload.find({
            collection: 'contributor-profiles',
            where: {
                fingerprintHash: { equals: body.fingerprintHash },
            },
            limit: 1,
        })

        let contributorProfile: {
            id: string | number
            contributorNumber: number
            documentsSubmitted: number
            firstCases: number
        }

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
            contributorProfile = newProfile as typeof contributorProfile
        } else {
            // Update existing profile
            contributorProfile = profiles.docs[0] as typeof contributorProfile
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
        }) as {
            id: string | number
            firstScout?: string | number
            scoutContributors?: CaseContributor[]
            totalScouts?: number
        }

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
        return Response.json(
            { error: 'Failed to register contribution' },
            { status: 500 }
        )
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
