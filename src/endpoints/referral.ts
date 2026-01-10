/**
 * Referral Endpoint
 * 
 * Handles referral code validation, tracking, and reward distribution.
 * 
 * Endpoints:
 * - POST /api/referral/validate - Validate a referral code
 * - POST /api/referral/register - Register a new referral
 * - GET /api/referral/stats - Get referral stats for a user
 */

import type { Endpoint } from 'payload'
import { trackServer, flushServer } from '../lib/analytics/rudderstack-server'
import { atomicIncrement } from '../utilities/atomic-operations'

interface ValidateRequest {
    code: string
}

interface RegisterRequest {
    referrerCode: string
    referredUserId: string
    referredDeviceId: string
}

interface ReferralStats {
    code: string
    totalReferrals: number
    successfulReferrals: number
    pendingReferrals: number
    rewardsEarned: number
    tier: 'bronze' | 'silver' | 'gold' | 'platinum'
}

const TIER_THRESHOLDS = {
    bronze: 0,
    silver: 3,
    gold: 10,
    platinum: 25,
}

const REWARDS_PER_REFERRAL = {
    bronze: 7,
    silver: 14,
    gold: 21,
    platinum: 30,
}

function calculateTier(count: number): 'bronze' | 'silver' | 'gold' | 'platinum' {
    if (count >= TIER_THRESHOLDS.platinum) return 'platinum'
    if (count >= TIER_THRESHOLDS.gold) return 'gold'
    if (count >= TIER_THRESHOLDS.silver) return 'silver'
    return 'bronze'
}

// Validate referral code endpoint
export const validateReferralCode: Endpoint = {
    path: '/referral/validate',
    method: 'post',
    handler: async (req) => {
        const payload = req.payload
        const body = (typeof req.body === 'object' && req.body !== null ? req.body : {}) as ValidateRequest

        if (!body?.code) {
            return Response.json({ valid: false, error: 'Code is required' }, { status: 400 })
        }

        try {
            // Look up the referral code in DeviceFingerprints
            const devices = await payload.find({
                collection: 'device-fingerprints',
                where: {
                    referralCode: { equals: body.code.toUpperCase() },
                },
                limit: 1,
            })

            if (devices.docs.length === 0) {
                // Track failed validation
                trackServer('Referral Code Validated', {
                    code: body.code.toUpperCase(),
                    valid: false,
                    error: 'not_found',
                }, { anonymousId: `code_${body.code.toUpperCase()}` })
                await flushServer()
                return Response.json({ valid: false, error: 'Invalid referral code' }, { status: 404 })
            }

            // Track successful validation
            trackServer('Referral Code Validated', {
                code: body.code.toUpperCase(),
                valid: true,
                referrer_id: String(devices.docs[0].id),
            }, { anonymousId: `code_${body.code.toUpperCase()}` })
            await flushServer()

            return Response.json({
                valid: true,
                referrerId: devices.docs[0].id,
            })
        } catch (error) {
            console.error('[Referral] Validate error:', error)
            return Response.json({ valid: false, error: 'Server error' }, { status: 500 })
        }
    },
}

// Register a new referral
export const registerReferral: Endpoint = {
    path: '/referral/register',
    method: 'post',
    handler: async (req) => {
        const payload = req.payload
        const body = (typeof req.body === 'object' && req.body !== null ? req.body : {}) as RegisterRequest

        if (!body?.referrerCode || !body?.referredDeviceId) {
            return Response.json({ success: false, error: 'Missing required fields' }, { status: 400 })
        }

        try {
            // Find the referrer
            const referrers = await payload.find({
                collection: 'device-fingerprints',
                where: {
                    referralCode: { equals: body.referrerCode.toUpperCase() },
                },
                limit: 1,
            })

            if (referrers.docs.length === 0) {
                return Response.json({ success: false, error: 'Invalid referrer code' }, { status: 404 })
            }

            const referrer = referrers.docs[0]

            // Check if this device has already been referred
            const existingReferrals = await payload.find({
                collection: 'referrals',
                where: {
                    referredDeviceId: { equals: body.referredDeviceId },
                },
                limit: 1,
            })

            if (existingReferrals.docs.length > 0) {
                return Response.json({ success: false, error: 'Device already referred' }, { status: 409 })
            }

            // Create referral record with race condition protection
            // Even if two requests pass the check above, the unique constraint will catch duplicates
            try {
                await payload.create({
                    collection: 'referrals',
                    data: {
                        referrerId: String(referrer.id),
                        referralCode: body.referrerCode.toUpperCase(),
                        referredDeviceId: body.referredDeviceId,
                        referredUserId: body.referredUserId || null,
                        status: 'pending',
                    },
                })
            } catch (createError: any) {
                // Handle unique constraint violation (PostgreSQL error code 23505)
                if (createError?.code === '23505' || createError?.message?.includes('unique constraint') || createError?.message?.includes('duplicate')) {
                    console.warn(`[Referral] Race condition caught - device ${body.referredDeviceId} already referred`)
                    return Response.json({ success: false, error: 'Device already referred' }, { status: 409 })
                }
                throw createError // Re-throw other errors
            }

            // Update referrer's pending count atomically to prevent race conditions
            const newPendingCount = await atomicIncrement(
                payload,
                'device-fingerprints',
                referrer.id,
                'pendingReferrals',
                1,
            )

            // Track referral registration
            trackServer('Referral Registered', {
                referrer_id: String(referrer.id),
                referrer_code: body.referrerCode.toUpperCase(),
                referred_device_id: body.referredDeviceId,
                reward_days: 7,
            }, { anonymousId: body.referredDeviceId })

            // Also track for the referrer
            trackServer('Referral Received', {
                referrer_id: String(referrer.id),
                referrer_code: body.referrerCode.toUpperCase(),
                referred_device_id: body.referredDeviceId,
                pending_count: newPendingCount,
            }, { anonymousId: String(referrer.id) })

            await flushServer()

            return Response.json({
                success: true,
                rewardDays: 7, // Both parties get 7 days
                message: 'Referral registered successfully',
            })
        } catch (error) {
            console.error('[Referral] Register error:', error)
            return Response.json({ success: false, error: 'Server error' }, { status: 500 })
        }
    },
}

// Get referral stats for a user
export const getReferralStats: Endpoint = {
    path: '/referral/stats',
    method: 'get',
    handler: async (req) => {
        const payload = req.payload
        const deviceId = req.query?.deviceId as string

        if (!deviceId) {
            return Response.json({ error: 'Device ID required' }, { status: 400 })
        }

        try {
            // Find the device
            const devices = await payload.find({
                collection: 'device-fingerprints',
                where: {
                    visitorId: { equals: deviceId },
                },
                limit: 1,
            })

            if (devices.docs.length === 0) {
                return Response.json({ error: 'Device not found' }, { status: 404 })
            }

            const device = devices.docs[0] as any

            // Get referral counts
            const referrals = await payload.find({
                collection: 'referrals',
                where: {
                    referrerId: { equals: String(device.id) },
                },
            })

            const successfulReferrals = referrals.docs.filter((r: any) => r.status === 'completed').length
            const pendingReferrals = referrals.docs.filter((r: any) => r.status === 'pending').length
            const tier = calculateTier(successfulReferrals)
            const rewardsEarned = successfulReferrals * REWARDS_PER_REFERRAL[tier]

            const stats: ReferralStats = {
                code: device.referralCode || '',
                totalReferrals: referrals.docs.length,
                successfulReferrals,
                pendingReferrals,
                rewardsEarned,
                tier,
            }

            // Track stats view
            trackServer('Referral Stats Viewed', {
                device_id: deviceId,
                referral_code: device.referralCode,
                total_referrals: referrals.docs.length,
                successful_referrals: successfulReferrals,
                pending_referrals: pendingReferrals,
                tier,
                rewards_earned: rewardsEarned,
            }, { anonymousId: deviceId })
            await flushServer()

            return Response.json(stats)
        } catch (error) {
            console.error('[Referral] Stats error:', error)
            return Response.json({ error: 'Server error' }, { status: 500 })
        }
    },
}

export const referralEndpoints = [
    validateReferralCode,
    registerReferral,
    getReferralStats,
]
