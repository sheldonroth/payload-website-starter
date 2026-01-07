/**
 * Scout Profile API Endpoints
 *
 * Public and private endpoints for scout profiles and statistics.
 * The heart of the Scout Program recognition system.
 *
 * Endpoints:
 * - GET /api/scout-profile/:slug - Public profile data
 * - GET /api/my-scout-stats - Personal stats (fingerprint-based)
 * - POST /api/scout-profile/update - Update display name, avatar
 * - POST /api/scout-profile/register-contribution - Called when a scout documents a product
 */

import type { PayloadRequest } from 'payload'

interface ScoutContributor {
    scoutId: string | number
    scoutNumber: number
    fingerprintHash: string
    scoutPosition: number
    contributedAt: string
}

/**
 * Get public scout profile by slug
 * GET /api/scout-profile/:slug
 */
export const getScoutProfileHandler = async (req: PayloadRequest): Promise<Response> => {
    if (req.method !== 'GET') {
        return Response.json({ error: 'Method not allowed' }, { status: 405 })
    }

    try {
        // Extract slug from URL path
        const url = new URL(req.url || '', 'http://localhost')
        const pathParts = url.pathname.split('/')
        const slug = pathParts[pathParts.length - 1]

        if (!slug || slug === 'scout-profile') {
            return Response.json({ error: 'Scout slug is required' }, { status: 400 })
        }

        // Find scout profile by slug
        const profiles = await req.payload.find({
            collection: 'scout-profiles',
            where: {
                shareableSlug: { equals: slug },
            },
            limit: 1,
        })

        if (profiles.docs.length === 0) {
            return Response.json({ error: 'Scout not found' }, { status: 404 })
        }

        const profile = profiles.docs[0] as {
            id: string | number
            displayName: string
            avatar: string
            bio?: string
            scoutNumber: number
            documentsSubmitted: number
            productsTestedFromSubmissions: number
            peopleHelped: number
            firstDiscoveries: number
            scoutLevel: string
            isPublic: boolean
            shareableSlug: string
            badges: string[]
            featuredDiscoveries: string[]
            createdAt: string
        }

        // Check if profile is public
        if (!profile.isPublic) {
            return Response.json({ error: 'This scout profile is private' }, { status: 403 })
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
                'scoutAttribution.scoutContributors': {
                    contains: profile.id.toString(),
                },
            },
            limit: 5,
            sort: '-createdAt',
        })

        return Response.json({
            success: true,
            profile: {
                displayName: profile.displayName,
                avatar: profile.avatar,
                bio: profile.bio,
                scoutNumber: profile.scoutNumber,
                level: profile.scoutLevel,
                shareableSlug: profile.shareableSlug,
                joinedAt: profile.createdAt,
                stats: {
                    documentsSubmitted: profile.documentsSubmitted,
                    productsTestedFromSubmissions: profile.productsTestedFromSubmissions,
                    peopleHelped: profile.peopleHelped,
                    firstDiscoveries: profile.firstDiscoveries,
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
        })
    } catch (error) {
        console.error('[scout-profile] Error:', error)
        return Response.json(
            { error: 'Failed to get scout profile' },
            { status: 500 }
        )
    }
}

/**
 * Get personal scout stats (fingerprint-based)
 * GET /api/my-scout-stats
 */
export const getMyScoutStatsHandler = async (req: PayloadRequest): Promise<Response> => {
    if (req.method !== 'GET') {
        return Response.json({ error: 'Method not allowed' }, { status: 405 })
    }

    try {
        const fingerprintHash = req.headers.get('x-fingerprint')

        if (!fingerprintHash) {
            return Response.json({ error: 'Fingerprint required' }, { status: 400 })
        }

        // Find or create scout profile
        let profiles = await req.payload.find({
            collection: 'scout-profiles',
            where: {
                fingerprintHash: { equals: fingerprintHash },
            },
            limit: 1,
        })

        let profile = profiles.docs[0] as {
            id: string | number
            displayName: string
            avatar: string
            scoutNumber: number
            documentsSubmitted: number
            productsTestedFromSubmissions: number
            peopleHelped: number
            firstDiscoveries: number
            scoutLevel: string
            shareableSlug: string
            badges: string[]
            createdAt: string
        } | undefined

        // If no profile exists, this scout hasn't documented anything yet
        if (!profile) {
            return Response.json({
                success: true,
                hasProfile: false,
                stats: {
                    documentsSubmitted: 0,
                    productsTestedFromSubmissions: 0,
                    peopleHelped: 0,
                    firstDiscoveries: 0,
                    level: 'new',
                },
                message: 'Document your first product to become a scout!',
            })
        }

        // Get their active investigations (pending products)
        const activeInvestigations = await req.payload.find({
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
                'scoutAttribution.scoutContributors': {
                    contains: profile.id.toString(),
                },
            },
            limit: 10,
            sort: '-createdAt',
        })

        return Response.json({
            success: true,
            hasProfile: true,
            profile: {
                displayName: profile.displayName,
                avatar: profile.avatar,
                scoutNumber: profile.scoutNumber,
                level: profile.scoutLevel,
                shareableSlug: profile.shareableSlug,
                shareableUrl: `https://theproductreport.org/scout/${profile.shareableSlug}`,
                joinedAt: profile.createdAt,
            },
            stats: {
                documentsSubmitted: profile.documentsSubmitted,
                productsTestedFromSubmissions: profile.productsTestedFromSubmissions,
                peopleHelped: profile.peopleHelped,
                firstDiscoveries: profile.firstDiscoveries,
                level: profile.scoutLevel,
            },
            badges: profile.badges || [],
            activeInvestigations: activeInvestigations.docs.map((inv) => ({
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
        })
    } catch (error) {
        console.error('[my-scout-stats] Error:', error)
        return Response.json(
            { error: 'Failed to get scout stats' },
            { status: 500 }
        )
    }
}

/**
 * Update scout profile (display name, avatar, bio)
 * POST /api/scout-profile/update
 */
export const updateScoutProfileHandler = async (req: PayloadRequest): Promise<Response> => {
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
            collection: 'scout-profiles',
            where: {
                fingerprintHash: { equals: fingerprintHash },
            },
            limit: 1,
        })

        if (profiles.docs.length === 0) {
            return Response.json({ error: 'Scout profile not found' }, { status: 404 })
        }

        const profile = profiles.docs[0] as { id: string | number }

        // Update profile
        const updateData: Record<string, unknown> = {}
        if (body.displayName) updateData.displayName = body.displayName.slice(0, 50)
        if (body.avatar) updateData.avatar = body.avatar.slice(0, 10) // emoji or short URL
        if (body.bio !== undefined) updateData.bio = body.bio.slice(0, 280)
        if (body.isPublic !== undefined) updateData.isPublic = body.isPublic

        const updated = await req.payload.update({
            collection: 'scout-profiles',
            id: profile.id,
            data: updateData,
        })

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
        console.error('[scout-profile/update] Error:', error)
        return Response.json(
            { error: 'Failed to update scout profile' },
            { status: 500 }
        )
    }
}

/**
 * Register a scout contribution when they document a product
 * POST /api/scout-profile/register-contribution
 *
 * Called by the product-vote endpoint when a scout submits photos
 */
export const registerScoutContributionHandler = async (req: PayloadRequest): Promise<Response> => {
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

        // Find or create scout profile
        let profiles = await req.payload.find({
            collection: 'scout-profiles',
            where: {
                fingerprintHash: { equals: body.fingerprintHash },
            },
            limit: 1,
        })

        let scoutProfile: {
            id: string | number
            scoutNumber: number
            documentsSubmitted: number
            firstDiscoveries: number
        }

        if (profiles.docs.length === 0) {
            // Create new scout profile
            const newProfile = await req.payload.create({
                collection: 'scout-profiles',
                data: {
                    fingerprintHash: body.fingerprintHash,
                    displayName: 'Anonymous Scout',
                    avatar: '🔍',
                    documentsSubmitted: 1,
                },
            })
            scoutProfile = newProfile as typeof scoutProfile
        } else {
            // Update existing profile
            scoutProfile = profiles.docs[0] as typeof scoutProfile
            await req.payload.update({
                collection: 'scout-profiles',
                id: scoutProfile.id,
                data: {
                    documentsSubmitted: (scoutProfile.documentsSubmitted || 0) + 1,
                },
            })
            scoutProfile.documentsSubmitted = (scoutProfile.documentsSubmitted || 0) + 1
        }

        // Get the ProductVote to update scout attribution
        const productVote = await req.payload.findByID({
            collection: 'product-votes',
            id: body.productVoteId,
        }) as {
            id: string | number
            firstScout?: string | number
            scoutContributors?: ScoutContributor[]
            totalScouts?: number
        }

        const existingContributors = productVote.scoutContributors || []
        const isFirstScout = !productVote.firstScout
        const alreadyContributed = existingContributors.some(
            (c: ScoutContributor) => c.fingerprintHash === body.fingerprintHash
        )

        if (!alreadyContributed) {
            // Add to contributors
            const newContributor: ScoutContributor = {
                scoutId: scoutProfile.id,
                scoutNumber: scoutProfile.scoutNumber,
                fingerprintHash: body.fingerprintHash,
                scoutPosition: existingContributors.length + 1,
                contributedAt: new Date().toISOString(),
            }

            const updateData: Record<string, unknown> = {
                scoutContributors: [...existingContributors, newContributor],
                totalScouts: existingContributors.length + 1,
            }

            // Set first scout if this is the first contribution
            if (isFirstScout) {
                updateData.firstScout = scoutProfile.id
                updateData.firstScoutNumber = scoutProfile.scoutNumber

                // Update scout's firstDiscoveries count
                await req.payload.update({
                    collection: 'scout-profiles',
                    id: scoutProfile.id,
                    data: {
                        firstDiscoveries: (scoutProfile.firstDiscoveries || 0) + 1,
                    },
                })
            }

            await req.payload.update({
                collection: 'product-votes',
                id: body.productVoteId,
                data: updateData,
            })
        }

        return Response.json({
            success: true,
            scoutNumber: scoutProfile.scoutNumber,
            scoutPosition: alreadyContributed
                ? existingContributors.findIndex(
                    (c: ScoutContributor) => c.fingerprintHash === body.fingerprintHash
                  ) + 1
                : existingContributors.length + 1,
            isFirstScout,
            totalScouts: alreadyContributed
                ? existingContributors.length
                : existingContributors.length + 1,
            stats: {
                documentsSubmitted: scoutProfile.documentsSubmitted,
                level: getScoutLevel(scoutProfile.documentsSubmitted),
            },
        })
    } catch (error) {
        console.error('[scout-profile/register-contribution] Error:', error)
        return Response.json(
            { error: 'Failed to register contribution' },
            { status: 500 }
        )
    }
}

// Helper functions
function getScoutLevel(documentsSubmitted: number): string {
    if (documentsSubmitted >= 50) return 'pioneer'
    if (documentsSubmitted >= 15) return 'pathfinder'
    if (documentsSubmitted >= 5) return 'explorer'
    return 'new'
}

function getNextMilestone(documentsSubmitted: number): {
    nextLevel: string
    remaining: number
    message: string
} {
    if (documentsSubmitted >= 50) {
        return {
            nextLevel: 'pioneer',
            remaining: 0,
            message: "You're building the map.",
        }
    }
    if (documentsSubmitted >= 15) {
        return {
            nextLevel: 'pioneer',
            remaining: 50 - documentsSubmitted,
            message: `${50 - documentsSubmitted} more to Pioneer`,
        }
    }
    if (documentsSubmitted >= 5) {
        return {
            nextLevel: 'pathfinder',
            remaining: 15 - documentsSubmitted,
            message: `${15 - documentsSubmitted} more to Pathfinder`,
        }
    }
    return {
        nextLevel: 'explorer',
        remaining: 5 - documentsSubmitted,
        message: `${5 - documentsSubmitted} more to Explorer`,
    }
}
