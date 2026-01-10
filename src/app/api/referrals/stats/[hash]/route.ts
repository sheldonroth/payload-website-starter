/**
 * GET /api/referrals/stats/:hash
 *
 * Get referral stats for a specific device/user hash.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ hash: string }> }
) {
    const { hash } = await params

    if (!hash) {
        return NextResponse.json(
            { error: 'hash parameter required' },
            { status: 400 }
        )
    }

    try {
        const payload = await getPayload({ config })

        // Find device fingerprint
        const fingerprint = await payload.find({
            collection: 'device-fingerprints',
            where: { fingerprintHash: { equals: hash } },
            limit: 1,
        })

        if (!fingerprint.docs[0]) {
            return NextResponse.json({
                ok: true,
                data: {
                    referralCode: null,
                    totalReferrals: 0,
                    activeReferrals: 0,
                    pendingReferrals: 0,
                    totalEarnings: 0,
                    currentTier: 'bronze',
                    milestones: [],
                },
            })
        }

        const fingerprintId = fingerprint.docs[0].id

        // Find all referrals for this device
        const referrals = await payload.find({
            collection: 'referrals',
            where: {
                referrerId: { equals: fingerprintId },
            },
            limit: 1000,
        })

        const activeReferrals = referrals.docs.filter((r) => r.status === 'active').length
        const pendingReferrals = referrals.docs.filter((r) => r.status === 'pending').length

        // Get referral code
        const referralCode = referrals.docs[0]?.referralCode ||
            `REF-${String(fingerprintId).slice(-8).toUpperCase()}`

        // Calculate tier
        let currentTier = 'bronze'
        let tierRate = 7
        if (activeReferrals >= 50) { currentTier = 'diamond'; tierRate = 40 }
        else if (activeReferrals >= 25) { currentTier = 'platinum'; tierRate = 30 }
        else if (activeReferrals >= 10) { currentTier = 'gold'; tierRate = 21 }
        else if (activeReferrals >= 3) { currentTier = 'silver'; tierRate = 14 }

        // Calculate earnings (based on tier rate * active referrals)
        // Total commission is tracked on DeviceFingerprints.totalCommissionEarned
        const totalEarnings = activeReferrals * tierRate

        // Calculate milestones
        const milestones = [
            { name: 'first_referral', count: 1, achieved: activeReferrals >= 1 },
            { name: 'rising_star', count: 5, achieved: activeReferrals >= 5 },
            { name: 'influencer', count: 10, achieved: activeReferrals >= 10 },
            { name: 'ambassador', count: 25, achieved: activeReferrals >= 25 },
            { name: 'legend', count: 50, achieved: activeReferrals >= 50 },
            { name: 'centurion', count: 100, achieved: activeReferrals >= 100 },
        ]

        return NextResponse.json({
            ok: true,
            data: {
                referralCode,
                totalReferrals: referrals.totalDocs,
                activeReferrals,
                pendingReferrals,
                totalEarnings,
                currentTier,
                tierRate,
                milestones,
                nextMilestone: milestones.find((m) => !m.achieved) || null,
            },
        })
    } catch (error) {
        console.error('[Referrals] Stats error:', error)
        return NextResponse.json(
            { ok: false, error: 'Failed to fetch stats' },
            { status: 500 }
        )
    }
}
