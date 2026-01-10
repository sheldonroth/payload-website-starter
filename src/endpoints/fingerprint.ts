import { PayloadHandler } from 'payload'
import { trackServer, flushServer } from '../lib/analytics/rudderstack-server'
import { validationError, internalError } from '../utilities/api-response'
import { applyRateLimitAsync, RateLimits, getRateLimitKey } from '../utilities/rate-limiter'

// Maximum lengths for input validation
const MAX_FINGERPRINT_HASH_LENGTH = 100
const MAX_BROWSER_LENGTH = 200
const MAX_OS_LENGTH = 100
const VALID_DEVICE_TYPES = ['desktop', 'mobile', 'tablet'] as const

/**
 * Validate and sanitize fingerprint hash
 * @returns sanitized hash or null if invalid
 */
function validateFingerprintHash(hash: unknown): string | null {
    if (typeof hash !== 'string') return null
    const trimmed = hash.trim()
    if (trimmed.length === 0 || trimmed.length > MAX_FINGERPRINT_HASH_LENGTH) return null
    // Only allow alphanumeric, underscores, and hyphens
    if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) return null
    return trimmed
}

/**
 * Validate and sanitize browser string
 */
function validateBrowser(browser: unknown): string | null {
    if (browser === null || browser === undefined) return null
    if (typeof browser !== 'string') return null
    const trimmed = browser.trim().slice(0, MAX_BROWSER_LENGTH)
    // Remove potentially harmful characters
    return trimmed.replace(/[<>"'&]/g, '')
}

/**
 * Validate and sanitize OS string
 */
function validateOS(os: unknown): string | null {
    if (os === null || os === undefined) return null
    if (typeof os !== 'string') return null
    const trimmed = os.trim().slice(0, MAX_OS_LENGTH)
    // Remove potentially harmful characters
    return trimmed.replace(/[<>"'&]/g, '')
}

/**
 * Validate device type
 */
function validateDeviceType(deviceType: unknown): typeof VALID_DEVICE_TYPES[number] | null {
    if (deviceType === null || deviceType === undefined) return null
    if (typeof deviceType !== 'string') return null
    const lower = deviceType.toLowerCase().trim()
    if (VALID_DEVICE_TYPES.includes(lower as typeof VALID_DEVICE_TYPES[number])) {
        return lower as typeof VALID_DEVICE_TYPES[number]
    }
    return null
}

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
 * SECURITY:
 * - Rate limited to prevent device spoofing/abuse
 * - Input validation and sanitization
 * - Respects Global Privacy Control (GPC) signals
 */
export const fingerprintRegisterHandler: PayloadHandler = async (req) => {
    try {
        // Rate limit by IP to prevent abuse (10 registrations per hour per IP)
        const rateLimitKey = getRateLimitKey(req as unknown as Request)
        const rateLimitResponse = await applyRateLimitAsync(
            req as unknown as Request,
            RateLimits.FINGERPRINT_REGISTER,
            `fingerprint:register:${rateLimitKey}`
        )
        if (rateLimitResponse) {
            return rateLimitResponse
        }

        const body = await req.json?.() || {}

        // Check for Global Privacy Control signal from client
        // When GPC is enabled, we don't store fingerprints for tracking
        const secGpcHeader = req.headers.get('sec-gpc')
        const isGpcEnabled = body.gpcEnabled === true || secGpcHeader === '1'

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

        // Validate and sanitize fingerprint hash
        const fingerprintHash = validateFingerprintHash(body.fingerprintHash)
        if (!fingerprintHash) {
            return validationError('fingerprintHash is required and must be a valid alphanumeric string (max 100 characters)')
        }

        // Validate and sanitize other fields
        const browser = validateBrowser(body.browser)
        const os = validateOS(body.os)
        const deviceType = validateDeviceType(body.deviceType)

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

            // Update last seen with sanitized data
            await req.payload.update({
                collection: 'device-fingerprints' as 'users',
                id: existing.id,
                data: {
                    lastSeenAt: now,
                    ...(browser && { browser }),
                    ...(os && { os }),
                    ...(deviceType && { deviceType }),
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

        // Create new fingerprint with sanitized data
        const newFingerprint = await (req.payload.create as Function)({
            collection: 'device-fingerprints',
            data: {
                fingerprintHash,
                browser,
                os,
                deviceType,
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
 *
 * SECURITY:
 * - Rate limited to prevent enumeration attacks
 * - Input validation and sanitization
 */
export const fingerprintCheckHandler: PayloadHandler = async (req) => {
    try {
        let rawHash: unknown = null

        // Support both POST (preferred) and GET (deprecated)
        const method = req.method?.toUpperCase()
        if (method === 'POST') {
            const body = await req.json?.() || {}
            rawHash = body.hash
        } else {
            // GET fallback (deprecated)
            const url = new URL(req.url || '', 'http://localhost')
            rawHash = url.searchParams.get('hash')
        }

        // Validate and sanitize the hash
        const fingerprintHash = validateFingerprintHash(rawHash)
        if (!fingerprintHash) {
            return validationError('hash is required and must be a valid alphanumeric string (max 100 characters)')
        }

        // Rate limit by fingerprint hash to prevent enumeration (30 checks per minute)
        const rateLimitResponse = await applyRateLimitAsync(
            req as unknown as Request,
            RateLimits.FINGERPRINT_CHECK,
            `fingerprint:check:${fingerprintHash}`
        )
        if (rateLimitResponse) {
            return rateLimitResponse
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
