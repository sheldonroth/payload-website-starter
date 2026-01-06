import { PayloadHandler } from 'payload'

/**
 * Generate a unique 6-character referral code
 */
function generateReferralCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let code = ''
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return code
}

/**
 * Fingerprint Registration Endpoint
 *
 * POST /api/fingerprint/register
 *
 * Registers or updates a device fingerprint for the One-Shot Engine.
 * Used by FingerprintJS Pro on the frontend to track devices.
 *
 * PRIVACY: Respects Global Privacy Control (GPC) signals
 */
export const fingerprintRegisterHandler: PayloadHandler = async (req) => {
    try {
        const body = await req.json?.() || {}
        const { fingerprintHash, browser, os, deviceType, gpcEnabled } = body

        // Check for Global Privacy Control signal from client
        // When GPC is enabled, we don't store fingerprints for tracking
        const secGpcHeader = req.headers.get('sec-gpc')
        const isGpcEnabled = gpcEnabled === true || secGpcHeader === '1'

        if (isGpcEnabled) {
            // GPC enabled - don't persist fingerprint, just return anonymous response
            return Response.json({
                success: true,
                fingerprintId: null,
                canUnlock: true,
                remainingCredits: 1,
                gpcRespected: true,
                message: 'Global Privacy Control signal respected. Fingerprint not stored.',
            })
        }

        if (!fingerprintHash) {
            return Response.json(
                { error: 'fingerprintHash is required' },
                { status: 400 }
            )
        }

        // Check if fingerprint already exists
        const existingFingerprint = await req.payload.find({
            collection: 'device-fingerprints' as 'users',
            where: {
                fingerprintHash: {
                    equals: fingerprintHash,
                },
            },
            limit: 1,
        })

        const now = new Date().toISOString()

        if (existingFingerprint.docs.length > 0) {
            // Update existing fingerprint
            const existing = existingFingerprint.docs[0] as {
                id: number
                unlockCreditsUsed?: number
                isBanned?: boolean
                user?: { id: number } | number
            }

            // Update last seen
            await req.payload.update({
                collection: 'device-fingerprints' as 'users',
                id: existing.id,
                data: {
                    lastSeenAt: now,
                    browser: browser || undefined,
                    os: os || undefined,
                    deviceType: deviceType || undefined,
                } as unknown as Record<string, unknown>,
            })

            // Check if banned
            if (existing.isBanned) {
                return Response.json(
                    {
                        success: false,
                        fingerprintId: existing.id,
                        canUnlock: false,
                        remainingCredits: 0,
                        reason: 'Device is banned',
                    },
                    { status: 403 }
                )
            }

            // Calculate remaining credits
            const usedCredits = existing.unlockCreditsUsed || 0
            const remainingCredits = Math.max(0, 1 - usedCredits)

            return Response.json({
                success: true,
                fingerprintId: existing.id,
                canUnlock: remainingCredits > 0,
                remainingCredits,
                isExisting: true,
                userId: typeof existing.user === 'object' ? existing.user?.id : existing.user,
            })
        }

        // Generate unique referral code
        const referralCode = generateReferralCode()

        // Create new fingerprint (collection types regenerated on deployment)
        const newFingerprint = await (req.payload.create as Function)({
            collection: 'device-fingerprints',
            data: {
                fingerprintHash,
                browser: browser || null,
                os: os || null,
                deviceType: deviceType || null,
                firstSeenAt: now,
                lastSeenAt: now,
                unlockCreditsUsed: 0,
                isBanned: false,
                suspiciousActivity: false,
                emailsUsed: [],
                referralCode,
                totalReferrals: 0,
                activeReferrals: 0,
                pendingReferrals: 0,
                totalCommissionEarned: 0,
            },
        })

        return Response.json({
            success: true,
            fingerprintId: newFingerprint.id,
            canUnlock: true,
            remainingCredits: 1,
            isExisting: false,
        })
    } catch (error) {
        console.error('[Fingerprint Register] Error:', error)
        return Response.json(
            { error: 'Failed to register fingerprint' },
            { status: 500 }
        )
    }
}

/**
 * GET /api/fingerprint/check
 *
 * Check fingerprint status without updating.
 */
export const fingerprintCheckHandler: PayloadHandler = async (req) => {
    try {
        const url = new URL(req.url || '', 'http://localhost')
        const fingerprintHash = url.searchParams.get('hash')

        if (!fingerprintHash) {
            return Response.json(
                { error: 'hash query parameter is required' },
                { status: 400 }
            )
        }

        const result = await req.payload.find({
            collection: 'device-fingerprints' as 'users',
            where: {
                fingerprintHash: {
                    equals: fingerprintHash,
                },
            },
            limit: 1,
        })

        if (result.docs.length === 0) {
            return Response.json({
                exists: false,
                canUnlock: true,
                remainingCredits: 1,
            })
        }

        const fingerprint = result.docs[0] as {
            id: number
            unlockCreditsUsed?: number
            isBanned?: boolean
            user?: { id: number } | number
        }

        if (fingerprint.isBanned) {
            return Response.json({
                exists: true,
                fingerprintId: fingerprint.id,
                canUnlock: false,
                remainingCredits: 0,
                reason: 'Device is banned',
            })
        }

        const usedCredits = fingerprint.unlockCreditsUsed || 0
        const remainingCredits = Math.max(0, 1 - usedCredits)

        return Response.json({
            exists: true,
            fingerprintId: fingerprint.id,
            canUnlock: remainingCredits > 0,
            remainingCredits,
            userId: typeof fingerprint.user === 'object' ? fingerprint.user?.id : fingerprint.user,
        })
    } catch (error) {
        console.error('[Fingerprint Check] Error:', error)
        return Response.json(
            { error: 'Failed to check fingerprint' },
            { status: 500 }
        )
    }
}
