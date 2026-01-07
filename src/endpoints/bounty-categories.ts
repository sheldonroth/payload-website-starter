/**
 * Bounty Categories API Endpoints
 *
 * Returns active category bounties for My Cases.
 * Used by the mobile BountyBoard component.
 */

import type { PayloadRequest } from 'payload'

interface BountyCategory {
    id: string | number
    category: string
    headline?: string
    description?: string
    keywords?: Array<{ keyword: string }>
    multiplier: number
    icon?: string
    isActive: boolean
    startsAt?: string
    endsAt?: string
    totalScansThisWeek?: number
    totalContributors?: number
}

/**
 * GET /api/bounty-categories/active
 *
 * Get currently active bounty categories
 */
export const activeBountiesHandler = async (req: PayloadRequest): Promise<Response> => {
    if (req.method !== 'GET') {
        return Response.json({ error: 'Method not allowed' }, { status: 405 })
    }

    try {
        const now = new Date().toISOString()

        // Find active bounties
        const bounties = await req.payload.find({
            collection: 'bounty-categories',
            where: {
                and: [
                    { isActive: { equals: true } },
                    {
                        or: [
                            { startsAt: { equals: null } },
                            { startsAt: { less_than_equal: now } },
                        ],
                    },
                    {
                        or: [
                            { endsAt: { equals: null } },
                            { endsAt: { greater_than_equal: now } },
                        ],
                    },
                ],
            },
            sort: '-multiplier', // Highest multiplier first
            limit: 10,
        })

        // Transform for mobile consumption
        const activeBounties = (bounties.docs as BountyCategory[]).map((bounty) => ({
            id: bounty.id,
            category: bounty.category,
            headline: bounty.headline,
            description: bounty.description,
            keywords: (bounty.keywords || []).map((k) => k.keyword),
            multiplier: bounty.multiplier,
            icon: bounty.icon || '📦',
            totalScansThisWeek: bounty.totalScansThisWeek || 0,
            totalContributors: bounty.totalContributors || 0,
        }))

        // Calculate total contributors across all bounties (for "87 contributors this week")
        const totalWeeklyContributors = activeBounties.reduce(
            (sum, b) => sum + b.totalContributors,
            0
        )

        return Response.json({
            bounties: activeBounties,
            totalWeeklyContributors,
            headline: activeBounties[0]?.headline || "We're looking for products to test",
        })
    } catch (error) {
        console.error('[bounty-categories] Error:', error)
        return Response.json(
            { error: 'Failed to get active bounties', details: String(error) },
            { status: 500 }
        )
    }
}

/**
 * POST /api/bounty-categories/check
 *
 * Check if a product matches any active bounty categories
 * Returns the applicable multiplier
 *
 * Body: { productName: string, category?: string }
 */
export const checkBountyHandler = async (req: PayloadRequest): Promise<Response> => {
    if (req.method !== 'POST') {
        return Response.json({ error: 'Method not allowed' }, { status: 405 })
    }

    try {
        const body = (await req.json?.()) as { productName?: string; category?: string }

        if (!body?.productName && !body?.category) {
            return Response.json(
                { error: 'productName or category is required' },
                { status: 400 }
            )
        }

        const { productName, category } = body
        const searchText = `${productName || ''} ${category || ''}`.toLowerCase()

        const now = new Date().toISOString()

        // Get all active bounties
        const bounties = await req.payload.find({
            collection: 'bounty-categories',
            where: {
                and: [
                    { isActive: { equals: true } },
                    {
                        or: [
                            { startsAt: { equals: null } },
                            { startsAt: { less_than_equal: now } },
                        ],
                    },
                    {
                        or: [
                            { endsAt: { equals: null } },
                            { endsAt: { greater_than_equal: now } },
                        ],
                    },
                ],
            },
            sort: '-multiplier',
        })

        // Check each bounty for keyword matches
        let highestMultiplier = 1
        let matchedBounty: BountyCategory | null = null

        for (const bounty of bounties.docs as BountyCategory[]) {
            const keywords = (bounty.keywords || []).map((k) => k.keyword.toLowerCase())

            // Check if any keyword matches
            const hasMatch =
                keywords.some((keyword) => searchText.includes(keyword)) ||
                bounty.category.toLowerCase() === category?.toLowerCase()

            if (hasMatch && bounty.multiplier > highestMultiplier) {
                highestMultiplier = bounty.multiplier
                matchedBounty = bounty
            }
        }

        return Response.json({
            hasBounty: highestMultiplier > 1,
            multiplier: highestMultiplier,
            matchedCategory: matchedBounty?.category || null,
            icon: matchedBounty?.icon || null,
            message: highestMultiplier > 1
                ? `${highestMultiplier}x priority - ${matchedBounty?.category} is in focus!`
                : null,
        })
    } catch (error) {
        console.error('[bounty-categories/check] Error:', error)
        return Response.json(
            { error: 'Failed to check bounty', details: String(error) },
            { status: 500 }
        )
    }
}
