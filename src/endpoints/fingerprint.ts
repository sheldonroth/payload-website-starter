import { PayloadHandler } from 'payload'
import { trackServer, identifyServer, flushServer } from '../lib/analytics/rudderstack-server'
import { validationError, internalError } from '../utilities/api-response'

/**
 * @openapi
 * /fingerprint/register:
 *   post:
 *     summary: Register device fingerprint
 *     description: |
 *       Registers or updates a device fingerprint for the One-Shot Engine.
 *       Used by FingerprintJS Pro on the frontend to track devices.
 *       Respects Global Privacy Control (GPC) signals - when enabled,
 *       fingerprints are not stored.
 *     tags: [Fingerprint, Mobile]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fingerprintHash]
 *             properties:
 *               fingerprintHash:
 *                 type: string
 *                 description: Unique device fingerprint hash
 *               browser:
 *                 type: string
 *                 description: Browser name/version
 *               os:
 *                 type: string
 *                 description: Operating system
 *               deviceType:
 *                 type: string
 *                 description: Device type (mobile, tablet, desktop)
 *               gpcEnabled:
 *                 type: boolean
 *                 description: Global Privacy Control flag from client
 *     responses:
 *       200:
 *         description: Fingerprint registered/updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 fingerprintId:
 *                   type: integer
 *                   nullable: true
 *                   description: Null when GPC is enabled
 *                 canUnlock:
 *                   type: boolean
 *                   description: Whether device can unlock content
 *                 remainingCredits:
 *                   type: integer
 *                 isExisting:
 *                   type: boolean
 *                 userId:
 *                   type: integer
 *                   nullable: true
 *                 gpcRespected:
 *                   type: boolean
 *                   description: Present when GPC signal was honored
 *       400:
 *         description: Missing fingerprintHash
 *       403:
 *         description: Device is banned
 *       500:
 *         description: Registration failed
 *
 * @openapi
 * /fingerprint/check:
 *   post:
 *     summary: Check fingerprint status
 *     description: Check device fingerprint status without updating last seen time. POST is preferred over GET to avoid logging sensitive hashes in URLs.
 *     tags: [Fingerprint, Mobile]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [hash]
 *             properties:
 *               hash:
 *                 type: string
 *                 description: Device fingerprint hash
 *   get:
 *     summary: Check fingerprint status (deprecated)
 *     description: |
 *       DEPRECATED: Use POST instead to avoid logging fingerprint hash in URLs.
 *       Check device fingerprint status without updating last seen time.
 *     tags: [Fingerprint, Mobile]
 *     deprecated: true
 *     parameters:
 *       - in: query
 *         name: hash
 *         required: true
 *         schema:
 *           type: string
 *         description: Device fingerprint hash
 *     responses:
 *       200:
 *         description: Fingerprint status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 exists:
 *                   type: boolean
 *                 fingerprintId:
 *                   type: integer
 *                 canUnlock:
 *                   type: boolean
 *                 remainingCredits:
 *                   type: integer
 *                 userId:
 *                   type: integer
 *                   nullable: true
 *                 reason:
 *                   type: string
 *                   description: Present if device cannot unlock (banned)
 *       400:
 *         description: Missing hash parameter
 */

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
            return validationError('fingerprintHash is required')
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

        // Track new device registration
        trackServer('Device Registered', {
            fingerprint_id: newFingerprint.id,
            referral_code: referralCode,
            browser,
            os,
            device_type: deviceType,
            platform: 'web',
        }, { anonymousId: fingerprintHash })
        await flushServer()

        return Response.json({
            success: true,
            fingerprintId: newFingerprint.id,
            canUnlock: true,
            remainingCredits: 1,
            isExisting: false,
        })
    } catch (error) {
        console.error('[Fingerprint Register] Error:', error)
        return internalError('Failed to register fingerprint')
    }
}

/**
 * GET/POST /api/fingerprint/check
 *
 * Check fingerprint status without updating.
 * POST is preferred to avoid logging fingerprint hash in URLs/server logs.
 * GET is deprecated but maintained for backward compatibility.
 */
export const fingerprintCheckHandler: PayloadHandler = async (req) => {
    try {
        let fingerprintHash: string | null = null

        // Support both POST (preferred) and GET (deprecated)
        const method = req.method?.toUpperCase()
        if (method === 'POST') {
            const body = await req.json?.() || {}
            fingerprintHash = body.hash || null
        } else {
            // GET fallback (deprecated)
            const url = new URL(req.url || '', 'http://localhost')
            fingerprintHash = url.searchParams.get('hash')
        }

        if (!fingerprintHash) {
            return validationError('hash is required (POST body or query parameter)')
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
        return internalError('Failed to check fingerprint')
    }
}
