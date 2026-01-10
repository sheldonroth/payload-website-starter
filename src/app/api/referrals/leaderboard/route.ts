/**
 * GET /api/referrals/leaderboard
 *
 * Public leaderboard of top referrers.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 100)

    try {
        const payload = await getPayload({ config })

        // Get all referrals grouped by referrer
        const allReferrals = await payload.find({
            collection: 'referrals',
            where: {
                status: { equals: 'active' },
            },
            limit: 10000,
        })

        // Aggregate by referrer
        const referrerCounts = new Map<string, number>()
        allReferrals.docs.forEach((referral) => {
            const referrerId = String(referral.referrerId)
            referrerCounts.set(referrerId, (referrerCounts.get(referrerId) || 0) + 1)
        })

        // Sort by count descending
        const sortedReferrers = Array.from(referrerCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit)

        // Get fingerprint details for display names
        const leaderboard = await Promise.all(
            sortedReferrers.map(async ([referrerId, count], index) => {
                // Try to get contributor profile for display name
                const profile = await payload.find({
                    collection: 'contributor-profiles',
                    where: {
                        fingerprintHash: { equals: referrerId },
                    },
                    limit: 1,
                })

                const displayName = profile.docs[0]?.displayName ||
                    `Contributor #${referrerId.slice(-4)}`

                // Calculate tier
                let tier = 'bronze'
                if (count >= 50) tier = 'diamond'
                else if (count >= 25) tier = 'platinum'
                else if (count >= 10) tier = 'gold'
                else if (count >= 3) tier = 'silver'

                return {
                    rank: index + 1,
                    displayName,
                    referralCount: count,
                    tier,
                }
            })
        )

        return NextResponse.json({
            ok: true,
            data: {
                leaderboard,
                totalReferrers: referrerCounts.size,
                updatedAt: new Date().toISOString(),
            },
        })
    } catch (error) {
        console.error('[Referrals] Leaderboard error:', error)
        return NextResponse.json(
            { ok: false, error: 'Failed to fetch leaderboard' },
            { status: 500 }
        )
    }
}
