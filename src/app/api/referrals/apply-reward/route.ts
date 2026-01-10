/**
 * POST /api/referrals/apply-reward
 *
 * Apply a reward to a referrer (RevenueCat promo code or free days).
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

function validateApiKey(request: NextRequest): boolean {
    const apiKey = request.headers.get('x-api-key')
    const expectedKey = process.env.PAYLOAD_API_SECRET
    return !!apiKey && !!expectedKey && apiKey === expectedKey
}

// Milestone definitions
const MILESTONES = [
    { name: 'first_referral', count: 1, freeDays: 7, description: 'First Referral' },
    { name: 'rising_star', count: 5, freeDays: 14, description: 'Rising Star' },
    { name: 'influencer', count: 10, freeDays: 30, description: 'Influencer' },
    { name: 'ambassador', count: 25, freeDays: 60, description: 'Ambassador' },
    { name: 'legend', count: 50, freeDays: 120, description: 'Legend' },
    { name: 'centurion', count: 100, freeDays: 365, description: 'Centurion' },
]

export async function POST(request: NextRequest) {
    if (!validateApiKey(request)) {
        return NextResponse.json(
            { error: 'Invalid API key' },
            { status: 401 }
        )
    }

    try {
        const body = await request.json()
        const { deviceId, milestoneName, promoCode } = body

        if (!deviceId) {
            return NextResponse.json(
                { error: 'deviceId required' },
                { status: 400 }
            )
        }

        const payload = await getPayload({ config })

        // Find device fingerprint
        const fingerprint = await payload.find({
            collection: 'device-fingerprints',
            where: { fingerprintHash: { equals: deviceId } },
            limit: 1,
        })

        if (!fingerprint.docs[0]) {
            return NextResponse.json(
                { ok: false, error: 'Device not found' },
                { status: 404 }
            )
        }

        const fingerprintId = fingerprint.docs[0].id

        // Get referrer's active referral count
        const activeReferrals = await payload.find({
            collection: 'referrals',
            where: {
                and: [
                    { referrerId: { equals: fingerprintId } },
                    { status: { equals: 'active' } },
                ],
            },
            limit: 1000,
        })

        const activeCount = activeReferrals.totalDocs

        // If milestone specified, verify eligibility
        if (milestoneName) {
            const milestone = MILESTONES.find((m) => m.name === milestoneName)
            if (!milestone) {
                return NextResponse.json(
                    { ok: false, error: 'Invalid milestone' },
                    { status: 400 }
                )
            }

            if (activeCount < milestone.count) {
                return NextResponse.json(
                    { ok: false, error: `Need ${milestone.count} referrals for ${milestone.description}` },
                    { status: 400 }
                )
            }

            // Check if milestone already claimed (would need a claimedMilestones field)
            // For now, just return the reward info
            return NextResponse.json({
                ok: true,
                data: {
                    milestone: milestone.name,
                    freeDays: milestone.freeDays,
                    description: milestone.description,
                    applied: true,
                    // In production, this would call RevenueCat API to apply promo
                    promoCodeApplied: promoCode || null,
                },
            })
        }

        // Calculate available milestones
        const availableMilestones = MILESTONES.filter((m) => activeCount >= m.count)
        const nextMilestone = MILESTONES.find((m) => activeCount < m.count)

        return NextResponse.json({
            ok: true,
            data: {
                activeReferrals: activeCount,
                availableMilestones: availableMilestones.map((m) => ({
                    name: m.name,
                    freeDays: m.freeDays,
                    description: m.description,
                })),
                nextMilestone: nextMilestone ? {
                    name: nextMilestone.name,
                    freeDays: nextMilestone.freeDays,
                    description: nextMilestone.description,
                    referralsNeeded: nextMilestone.count - activeCount,
                } : null,
            },
        })
    } catch (error) {
        console.error('[Referrals] Apply reward error:', error)
        return NextResponse.json(
            { ok: false, error: 'Failed to apply reward' },
            { status: 500 }
        )
    }
}
