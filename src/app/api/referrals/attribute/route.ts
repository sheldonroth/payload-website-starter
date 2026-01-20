/**
 * POST /api/referrals/attribute
 *
 * Attribute a referral when a user opens the app via deep link.
 * Records that deviceB was referred by the owner of referralCode.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

function validateApiKey(request: NextRequest): boolean {
    const apiKey = request.headers.get('x-api-key')
    const expectedKey = process.env.PAYLOAD_API_SECRET
    return !!apiKey && !!expectedKey && apiKey === expectedKey
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
        const { referralCode, referredDeviceId, source = 'link' } = body

        if (!referralCode || !referredDeviceId) {
            return NextResponse.json(
                { error: 'referralCode and referredDeviceId required' },
                { status: 400 }
            )
        }

        const payload = await getPayload({ config })

        // Find the referrer by their code
        const referrerLookup = await payload.find({
            collection: 'referrals',
            where: {
                referralCode: { equals: referralCode },
            },
            limit: 1,
        })

        if (!referrerLookup.docs[0]) {
            return NextResponse.json(
                { ok: false, error: 'Invalid referral code' },
                { status: 404 }
            )
        }

        const referrerId = referrerLookup.docs[0].referrerId

        // Run self-referral check and existing attribution check in parallel
        const [referredFingerprint, existingAttribution] = await Promise.all([
            // Prevent self-referral - check the referred device fingerprint
            payload.find({
                collection: 'device-fingerprints',
                where: { fingerprintHash: { equals: referredDeviceId } },
                limit: 1,
            }),
            // Check if this device was already referred
            payload.find({
                collection: 'referrals',
                where: {
                    referredDeviceId: { equals: referredDeviceId },
                },
                limit: 1,
            }),
        ])

        // Check if the referred device is the same as the referrer
        if (referredFingerprint.docs[0]?.fingerprintHash === referrerId) {
            return NextResponse.json(
                { ok: false, error: 'Cannot refer yourself' },
                { status: 400 }
            )
        }

        if (existingAttribution.docs[0]) {
            return NextResponse.json({
                ok: true,
                data: {
                    alreadyAttributed: true,
                    referralId: existingAttribution.docs[0].id,
                },
            })
        }

        // Create the referral attribution
        const referral = await payload.create({
            collection: 'referrals',
            data: {
                referrerId,
                referralCode,
                referredDeviceId,
                status: 'pending',
                source,
            },
        })

        return NextResponse.json({
            ok: true,
            data: {
                referralId: referral.id,
                attributed: true,
            },
        })
    } catch (error) {
        console.error('[Referrals] Attribution error:', error)
        return NextResponse.json(
            { ok: false, error: 'Failed to attribute referral' },
            { status: 500 }
        )
    }
}
