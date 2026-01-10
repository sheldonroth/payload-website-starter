/**
 * POST /api/referrals/sync
 *
 * Sync referral state from mobile client to server.
 * Creates referral code if needed, updates last seen, returns current state.
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
        const { deviceId, localReferralCode, wasReferred, referredBy } = body

        if (!deviceId) {
            return NextResponse.json(
                { error: 'deviceId required' },
                { status: 400 }
            )
        }

        const payload = await getPayload({ config })

        // Find or create device fingerprint
        let fingerprint = await payload.find({
            collection: 'device-fingerprints',
            where: { fingerprintHash: { equals: deviceId } },
            limit: 1,
        })

        let fingerprintId: string | number
        const now = new Date().toISOString()

        if (!fingerprint.docs[0]) {
            const newFingerprint = await payload.create({
                collection: 'device-fingerprints',
                data: {
                    fingerprintHash: deviceId,
                    firstSeenAt: now,
                    lastSeenAt: now,
                },
            })
            fingerprintId = newFingerprint.id
        } else {
            fingerprintId = fingerprint.docs[0].id
            await payload.update({
                collection: 'device-fingerprints',
                id: fingerprintId,
                data: { lastSeenAt: now },
            })
        }

        // Generate or validate referral code
        const existingCode = fingerprint.docs[0]?.referralCode
        const referralCode = existingCode || localReferralCode ||
            `REF-${String(fingerprintId).slice(-8).toUpperCase()}`

        // Store referral code on device fingerprint if not already set
        if (!existingCode && referralCode) {
            await payload.update({
                collection: 'device-fingerprints',
                id: fingerprintId,
                data: {
                    referralCode,
                },
            })
        }

        // If device was referred by someone, create that attribution
        if (wasReferred && referredBy) {
            // Check if attribution already exists
            const existingAttribution = await payload.find({
                collection: 'referrals',
                where: {
                    referredDeviceId: { equals: deviceId },
                },
                limit: 1,
            })

            if (!existingAttribution.docs[0]) {
                // Find the referrer by their referral code on device-fingerprints
                const referrerLookup = await payload.find({
                    collection: 'device-fingerprints',
                    where: {
                        referralCode: { equals: referredBy },
                    },
                    limit: 1,
                })

                if (referrerLookup.docs[0]) {
                    await payload.create({
                        collection: 'referrals',
                        data: {
                            referrerId: referrerLookup.docs[0].fingerprintHash,
                            referralCode: referredBy,
                            referredDeviceId: deviceId,
                            status: 'pending',
                            source: 'mobile',
                        },
                    })
                }
            }
        }

        // Get current referral stats (referrerId stores fingerprintHash, not id)
        const allReferrals = await payload.find({
            collection: 'referrals',
            where: {
                referrerId: { equals: deviceId },
            },
            limit: 1000,
        })

        const activeReferrals = allReferrals.docs.filter((r) => r.status === 'active').length
        const pendingReferrals = allReferrals.docs.filter((r) => r.status === 'pending').length

        // Calculate tier
        let currentTier = 'bronze'
        if (activeReferrals >= 50) currentTier = 'diamond'
        else if (activeReferrals >= 25) currentTier = 'platinum'
        else if (activeReferrals >= 10) currentTier = 'gold'
        else if (activeReferrals >= 3) currentTier = 'silver'

        return NextResponse.json({
            ok: true,
            data: {
                synced: true,
                referralCode,
                deviceId,
                stats: {
                    totalReferrals: allReferrals.totalDocs,
                    activeReferrals,
                    pendingReferrals,
                    currentTier,
                },
                lastSyncedAt: now,
            },
        })
    } catch (error) {
        console.error('[Referrals] Sync error:', error)
        return NextResponse.json(
            { ok: false, error: 'Failed to sync referral data' },
            { status: 500 }
        )
    }
}
