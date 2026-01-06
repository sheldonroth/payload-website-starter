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
import { Payload } from 'payload'

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
                return Response.json({ valid: false, error: 'Invalid referral code' }, { status: 404 })
            }

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

            // Create referral record
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

            // Update referrer's pending count
            const currentPending = (referrer as any).pendingReferrals || 0
            await payload.update({
                collection: 'device-fingerprints',
                id: referrer.id,
                data: {
                    pendingReferrals: currentPending + 1,
                } as any,
            })

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
