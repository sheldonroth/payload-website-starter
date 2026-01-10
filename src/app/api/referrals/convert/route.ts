/**
 * POST /api/referrals/convert
 *
 * Convert a pending referral to active when the referred user subscribes.
 * Called by RevenueCat webhook or after purchase verification.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

function validateApiKey(request: NextRequest): boolean {
    const apiKey = request.headers.get('x-api-key')
    const webhookSecret = request.headers.get('x-webhook-secret')
    const expectedKey = process.env.PAYLOAD_API_SECRET
    const expectedWebhook = process.env.REVENUECAT_WEBHOOK_SECRET

    return (
        (!!apiKey && !!expectedKey && apiKey === expectedKey) ||
        (!!webhookSecret && !!expectedWebhook && webhookSecret === expectedWebhook)
    )
}

export async function POST(request: NextRequest) {
    if (!validateApiKey(request)) {
        return NextResponse.json(
            { error: 'Invalid API key' },
            { status: 401 }
        )
    }

    try {
        const body = await request.json()
        const { referredDeviceId, subscriptionId } = body

        if (!referredDeviceId) {
            return NextResponse.json(
                { error: 'referredDeviceId required' },
                { status: 400 }
            )
        }

        const payload = await getPayload({ config })

        // Find pending referral for this device
        const pendingReferral = await payload.find({
            collection: 'referrals',
            where: {
                and: [
                    { referredDeviceId: { equals: referredDeviceId } },
                    { status: { equals: 'pending' } },
                ],
            },
            limit: 1,
        })

        if (!pendingReferral.docs[0]) {
            return NextResponse.json({
                ok: true,
                data: {
                    converted: false,
                    reason: 'No pending referral found',
                },
            })
        }

        const referral = pendingReferral.docs[0]

        // Update referral to active
        await payload.update({
            collection: 'referrals',
            id: referral.id,
            data: {
                status: 'active',
                firstSubscriptionDate: new Date().toISOString(),
                revenuecatSubscriberId: subscriptionId || undefined,
            },
        })

        // Get referrer stats for tier calculation
        const referrerReferrals = await payload.find({
            collection: 'referrals',
            where: {
                and: [
                    { referrerId: { equals: referral.referrerId } },
                    { status: { equals: 'active' } },
                ],
            },
            limit: 1000,
        })

        const activeCount = referrerReferrals.totalDocs + 1 // +1 for the one we just converted

        // Calculate tier and commission
        let tier = 'bronze'
        let commission = 7
        if (activeCount >= 50) { tier = 'diamond'; commission = 40 }
        else if (activeCount >= 25) { tier = 'platinum'; commission = 30 }
        else if (activeCount >= 10) { tier = 'gold'; commission = 21 }
        else if (activeCount >= 3) { tier = 'silver'; commission = 14 }

        // Update the device fingerprint with referral stats
        // (commission tracking is handled via DeviceFingerprints.totalCommissionEarned)
        if (referral.referrerId) {
            const referrerFp = await payload.find({
                collection: 'device-fingerprints',
                where: { fingerprintHash: { equals: String(referral.referrerId) } },
                limit: 1,
            })
            if (referrerFp.docs[0]) {
                await payload.update({
                    collection: 'device-fingerprints',
                    id: referrerFp.docs[0].id,
                    data: {
                        activeReferrals: activeCount,
                    },
                })
            }
        }

        return NextResponse.json({
            ok: true,
            data: {
                converted: true,
                referralId: referral.id,
                referrerId: referral.referrerId,
                tier,
                commission,
                totalActiveReferrals: activeCount,
            },
        })
    } catch (error) {
        console.error('[Referrals] Conversion error:', error)
        return NextResponse.json(
            { ok: false, error: 'Failed to convert referral' },
            { status: 500 }
        )
    }
}
