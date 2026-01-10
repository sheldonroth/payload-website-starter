/**
 * Referrals API Routes
 *
 * Proxy routes to map mobile client expected paths to Payload endpoints.
 * Mobile client expects: /api/referrals/...
 * Payload provides: /referral/...
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

// Helper to get API key from request
function getApiKey(request: NextRequest): string | null {
    return request.headers.get('x-api-key')
}

// Validate API key
function validateApiKey(apiKey: string | null): boolean {
    const expectedKey = process.env.PAYLOAD_API_SECRET
    return !!apiKey && !!expectedKey && apiKey === expectedKey
}

/**
 * GET /api/referrals
 * Returns referral stats for a device
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const deviceId = searchParams.get('deviceId')
    const hash = searchParams.get('hash')

    if (!deviceId && !hash) {
        return NextResponse.json(
            { error: 'deviceId or hash parameter required' },
            { status: 400 }
        )
    }

    try {
        const payload = await getPayload({ config })

        // Find referrer by device fingerprint
        const fingerprint = await payload.find({
            collection: 'device-fingerprints',
            where: {
                or: [
                    { fingerprintHash: { equals: deviceId || hash } },
                    { fingerprintHash: { equals: hash || deviceId } },
                ],
            },
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
                },
            })
        }

        const fingerprintId = fingerprint.docs[0].id

        // Find referrals where this device is the referrer
        const referrals = await payload.find({
            collection: 'referrals',
            where: {
                referrerId: { equals: fingerprintId },
            },
            limit: 1000,
        })

        // Calculate stats
        const activeReferrals = referrals.docs.filter((r) => r.status === 'active').length
        const pendingReferrals = referrals.docs.filter((r) => r.status === 'pending').length

        // Get or generate referral code
        const existingReferral = referrals.docs[0]
        const referralCode = existingReferral?.referralCode ||
            `REF-${fingerprintId.toString().slice(-8).toUpperCase()}`

        // Calculate tier
        let currentTier = 'bronze'
        if (activeReferrals >= 50) currentTier = 'diamond'
        else if (activeReferrals >= 25) currentTier = 'platinum'
        else if (activeReferrals >= 10) currentTier = 'gold'
        else if (activeReferrals >= 3) currentTier = 'silver'

        // Calculate earnings based on tier
        const tierRates: Record<string, number> = {
            bronze: 7,
            silver: 14,
            gold: 21,
            platinum: 30,
            diamond: 40,
        }
        const totalEarnings = activeReferrals * (tierRates[currentTier] || 7)

        return NextResponse.json({
            ok: true,
            data: {
                referralCode,
                totalReferrals: referrals.totalDocs,
                activeReferrals,
                pendingReferrals,
                totalEarnings,
                currentTier,
            },
        })
    } catch (error) {
        console.error('[Referrals API] Error fetching stats:', error)
        return NextResponse.json(
            { ok: false, error: 'Failed to fetch referral stats' },
            { status: 500 }
        )
    }
}

/**
 * POST /api/referrals
 * Sync referral data (creates referral code if needed)
 */
export async function POST(request: NextRequest) {
    const apiKey = getApiKey(request)
    if (!validateApiKey(apiKey)) {
        return NextResponse.json(
            { error: 'Invalid API key' },
            { status: 401 }
        )
    }

    try {
        const body = await request.json()
        const { deviceId, referralCode } = body

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
        if (!fingerprint.docs[0]) {
            const newFingerprint = await payload.create({
                collection: 'device-fingerprints',
                data: {
                    fingerprintHash: deviceId,
                    firstSeenAt: new Date().toISOString(),
                    lastSeenAt: new Date().toISOString(),
                },
            })
            fingerprintId = newFingerprint.id
        } else {
            fingerprintId = fingerprint.docs[0].id
            // Update last seen
            await payload.update({
                collection: 'device-fingerprints',
                id: fingerprintId,
                data: {
                    lastSeenAt: new Date().toISOString(),
                },
            })
        }

        // Get or generate referral code and store on fingerprint
        const existingCode = fingerprint.docs[0]?.referralCode
        const generatedCode = existingCode || referralCode || `REF-${String(fingerprintId).slice(-8).toUpperCase()}`

        // Update fingerprint with referral code if needed
        if (!existingCode && generatedCode) {
            await payload.update({
                collection: 'device-fingerprints',
                id: fingerprintId,
                data: {
                    referralCode: generatedCode,
                },
            })
        }

        // Get referral stats for this device as referrer
        const referrals = await payload.find({
            collection: 'referrals',
            where: {
                referrerId: { equals: String(fingerprintId) },
            },
            limit: 1000,
        })

        const activeReferrals = referrals.docs.filter((r) => r.status === 'active').length
        const pendingReferrals = referrals.docs.filter((r) => r.status === 'pending').length

        return NextResponse.json({
            ok: true,
            data: {
                synced: true,
                referralCode: generatedCode,
                deviceId,
                stats: {
                    totalReferrals: referrals.totalDocs,
                    activeReferrals,
                    pendingReferrals,
                },
            },
        })
    } catch (error) {
        console.error('[Referrals API] Error syncing:', error)
        return NextResponse.json(
            { ok: false, error: 'Failed to sync referral data' },
            { status: 500 }
        )
    }
}
