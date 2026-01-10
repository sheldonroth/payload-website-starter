/**
 * Enhanced Referral Program API
 *
 * Multi-tier commission tracking, milestone rewards, and leaderboard APIs.
 * Extends the base referral system with gamification and viral growth features.
 */

import type { PayloadHandler, PayloadRequest } from 'payload'

// Commission tiers with increasing rewards
const COMMISSION_TIERS = {
    bronze: { minReferrals: 0, commissionRate: 7, bonus: 0 },
    silver: { minReferrals: 3, commissionRate: 14, bonus: 20 },
    gold: { minReferrals: 10, commissionRate: 21, bonus: 50 },
    platinum: { minReferrals: 25, commissionRate: 30, bonus: 100 },
    diamond: { minReferrals: 50, commissionRate: 40, bonus: 250 },
}

// Milestone achievements with rewards
const MILESTONES = [
    { id: 'first_referral', name: 'First Referral', description: 'Got your first successful referral', threshold: 1, reward: 7, rewardType: 'days' },
    { id: 'rising_star', name: 'Rising Star', description: 'Reached 5 successful referrals', threshold: 5, reward: 14, rewardType: 'days' },
    { id: 'influencer', name: 'Influencer', description: 'Reached 10 successful referrals', threshold: 10, reward: 30, rewardType: 'days' },
    { id: 'ambassador', name: 'Ambassador', description: 'Reached 25 successful referrals', threshold: 25, reward: 60, rewardType: 'days' },
    { id: 'legend', name: 'Legend', description: 'Reached 50 successful referrals', threshold: 50, reward: 120, rewardType: 'days' },
    { id: 'centurion', name: 'Centurion', description: 'Reached 100 successful referrals', threshold: 100, reward: 365, rewardType: 'days' },
]

type TierKey = keyof typeof COMMISSION_TIERS

function calculateTier(successfulReferrals: number): TierKey {
    if (successfulReferrals >= COMMISSION_TIERS.diamond.minReferrals) return 'diamond'
    if (successfulReferrals >= COMMISSION_TIERS.platinum.minReferrals) return 'platinum'
    if (successfulReferrals >= COMMISSION_TIERS.gold.minReferrals) return 'gold'
    if (successfulReferrals >= COMMISSION_TIERS.silver.minReferrals) return 'silver'
    return 'bronze'
}

function getAchievedMilestones(successfulReferrals: number): typeof MILESTONES[number][] {
    return MILESTONES.filter((m) => successfulReferrals >= m.threshold)
}

function getNextMilestone(successfulReferrals: number): typeof MILESTONES[number] | null {
    return MILESTONES.find((m) => successfulReferrals < m.threshold) || null
}

/**
 * GET /api/referral/enhanced-stats
 *
 * Get comprehensive referral stats including tier info, milestones, and progress
 */
export const referralEnhancedStatsHandler: PayloadHandler = async (req: PayloadRequest) => {
    if (req.method !== 'GET') {
        return Response.json({ error: 'Method not allowed' }, { status: 405 })
    }

    try {
        const url = new URL(req.url || '', 'http://localhost')
        const deviceId = url.searchParams.get('deviceId')
        const fingerprint = req.headers.get('x-fingerprint') || deviceId

        if (!fingerprint) {
            return Response.json({ error: 'Device ID or fingerprint required' }, { status: 400 })
        }

        // Find the device
        const { docs: devices } = await req.payload.find({
            collection: 'device-fingerprints',
            where: {
                or: [
                    { visitorId: { equals: fingerprint } },
                    { fingerprintHash: { equals: fingerprint } },
                ],
            },
            limit: 1,
        })

        if (devices.length === 0) {
            return Response.json({ error: 'Device not found' }, { status: 404 })
        }

        const device = devices[0] as { id: string | number; referralCode?: string }

        // Get all referrals for this device
        const { docs: referrals } = await req.payload.find({
            collection: 'referrals',
            where: { referrerId: { equals: String(device.id) } },
            limit: 1000,
        })

        // Calculate stats
        const successfulReferrals = referrals.filter((r: { status: string }) =>
            r.status === 'active' || r.status === 'completed'
        ).length
        const pendingReferrals = referrals.filter((r: { status: string }) =>
            r.status === 'pending'
        ).length
        const churnedReferrals = referrals.filter((r: { status: string }) =>
            r.status === 'churned'
        ).length

        // Calculate tier and commission info
        const tier = calculateTier(successfulReferrals)
        const tierInfo = COMMISSION_TIERS[tier]
        const nextTier = Object.entries(COMMISSION_TIERS).find(
            ([, info]) => info.minReferrals > successfulReferrals
        )

        // Calculate total earnings
        const totalCommission = referrals.reduce((sum: number, r: any) =>
            sum + (r.totalCommissionPaid || 0), 0)

        // Get milestone progress
        const achievedMilestones = getAchievedMilestones(successfulReferrals)
        const nextMilestone = getNextMilestone(successfulReferrals)

        // Calculate milestone rewards earned
        const milestoneRewardsEarned = achievedMilestones.reduce((sum, m) => sum + m.reward, 0)

        return Response.json({
            success: true,
            referralCode: device.referralCode,
            stats: {
                totalReferrals: referrals.length,
                successfulReferrals,
                pendingReferrals,
                churnedReferrals,
                conversionRate: referrals.length > 0
                    ? Math.round((successfulReferrals / referrals.length) * 100)
                    : 0,
            },
            tier: {
                current: tier,
                name: tier.charAt(0).toUpperCase() + tier.slice(1),
                commissionRate: tierInfo.commissionRate,
                tierBonus: tierInfo.bonus,
                nextTier: nextTier ? {
                    name: nextTier[0].charAt(0).toUpperCase() + nextTier[0].slice(1),
                    referralsNeeded: nextTier[1].minReferrals - successfulReferrals,
                    commissionRate: nextTier[1].commissionRate,
                } : null,
            },
            earnings: {
                totalCommission,
                pendingCommission: pendingReferrals * tierInfo.commissionRate,
                milestoneRewards: milestoneRewardsEarned,
            },
            milestones: {
                achieved: achievedMilestones.map((m) => ({
                    ...m,
                    achievedAt: true,
                })),
                next: nextMilestone ? {
                    ...nextMilestone,
                    progress: successfulReferrals,
                    remaining: nextMilestone.threshold - successfulReferrals,
                    progressPercent: Math.round((successfulReferrals / nextMilestone.threshold) * 100),
                } : null,
                total: MILESTONES.length,
                completedCount: achievedMilestones.length,
            },
        })
    } catch (error) {
        console.error('[Referral Enhanced Stats] Error:', error)
        return Response.json({
            error: error instanceof Error ? error.message : 'Failed to get stats',
        }, { status: 500 })
    }
}

/**
 * GET /api/referral/leaderboard
 *
 * Get the top referrers leaderboard
 */
export const referralLeaderboardHandler: PayloadHandler = async (req: PayloadRequest) => {
    if (req.method !== 'GET') {
        return Response.json({ error: 'Method not allowed' }, { status: 405 })
    }

    try {
        const url = new URL(req.url || '', 'http://localhost')
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 100)
        const period = url.searchParams.get('period') || 'all' // all, month, week

        // Build date filter based on period
        let dateFilter = {}
        const now = new Date()
        if (period === 'week') {
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
            dateFilter = { createdAt: { greater_than: weekAgo.toISOString() } }
        } else if (period === 'month') {
            const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
            dateFilter = { createdAt: { greater_than: monthAgo.toISOString() } }
        }

        // Aggregate referrals by referrer
        const { docs: allReferrals } = await req.payload.find({
            collection: 'referrals',
            where: {
                status: { in: ['active', 'completed'] },
                ...dateFilter,
            },
            limit: 10000, // Get all for aggregation
        })

        // Group by referrer
        const referrerStats = new Map<string, {
            referrerId: string
            count: number
            totalCommission: number
        }>()

        for (const referral of allReferrals as Array<{
            referrerId: string
            totalCommissionPaid?: number
        }>) {
            const current = referrerStats.get(referral.referrerId) || {
                referrerId: referral.referrerId,
                count: 0,
                totalCommission: 0,
            }
            current.count++
            current.totalCommission += referral.totalCommissionPaid || 0
            referrerStats.set(referral.referrerId, current)
        }

        // Sort by count and take top N
        const sorted = Array.from(referrerStats.values())
            .sort((a, b) => b.count - a.count)
            .slice(0, limit)

        // Fetch referrer details (anonymized)
        const leaderboard = await Promise.all(
            sorted.map(async (entry, index) => {
                // Get device info for referral code
                const { docs: devices } = await req.payload.find({
                    collection: 'device-fingerprints',
                    where: { id: { equals: parseInt(entry.referrerId, 10) } },
                    limit: 1,
                    select: { referralCode: true },
                })

                const tier = calculateTier(entry.count)

                return {
                    rank: index + 1,
                    referralCode: devices[0]
                        ? (devices[0] as { referralCode?: string }).referralCode?.slice(0, 3) + '***'
                        : '***',
                    successfulReferrals: entry.count,
                    tier,
                    tierName: tier.charAt(0).toUpperCase() + tier.slice(1),
                    // Hide exact commission for privacy
                    earningsTier: entry.totalCommission > 500 ? 'high' :
                        entry.totalCommission > 100 ? 'medium' : 'starter',
                }
            })
        )

        return Response.json({
            success: true,
            period,
            leaderboard,
            totalReferrers: referrerStats.size,
            totalReferrals: allReferrals.length,
            updatedAt: new Date().toISOString(),
        })
    } catch (error) {
        console.error('[Referral Leaderboard] Error:', error)
        return Response.json({
            error: error instanceof Error ? error.message : 'Failed to get leaderboard',
        }, { status: 500 })
    }
}

/**
 * GET /api/referral/milestones
 *
 * Get all available milestones and their requirements
 */
export const referralMilestonesHandler: PayloadHandler = async (req: PayloadRequest) => {
    if (req.method !== 'GET') {
        return Response.json({ error: 'Method not allowed' }, { status: 405 })
    }

    return Response.json({
        success: true,
        milestones: MILESTONES,
        tiers: Object.entries(COMMISSION_TIERS).map(([name, info]) => ({
            name,
            displayName: name.charAt(0).toUpperCase() + name.slice(1),
            ...info,
        })),
    })
}

/**
 * GET /api/referral/history
 *
 * Get referral history for a user
 */
export const referralHistoryHandler: PayloadHandler = async (req: PayloadRequest) => {
    if (req.method !== 'GET') {
        return Response.json({ error: 'Method not allowed' }, { status: 405 })
    }

    try {
        const url = new URL(req.url || '', 'http://localhost')
        const deviceId = url.searchParams.get('deviceId')
        const fingerprint = req.headers.get('x-fingerprint') || deviceId
        const page = parseInt(url.searchParams.get('page') || '1', 10)
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 50)

        if (!fingerprint) {
            return Response.json({ error: 'Device ID required' }, { status: 400 })
        }

        // Find the device
        const { docs: devices } = await req.payload.find({
            collection: 'device-fingerprints',
            where: {
                or: [
                    { visitorId: { equals: fingerprint } },
                    { fingerprintHash: { equals: fingerprint } },
                ],
            },
            limit: 1,
        })

        if (devices.length === 0) {
            return Response.json({ error: 'Device not found' }, { status: 404 })
        }

        const device = devices[0] as { id: string | number }

        // Get paginated referral history
        const { docs: referrals, totalDocs, totalPages } = await req.payload.find({
            collection: 'referrals',
            where: { referrerId: { equals: String(device.id) } },
            sort: '-createdAt',
            page,
            limit,
        })

        // Transform for privacy (hide referred device IDs)
        const history = referrals.map((r: any, index: number) => ({
            id: r.id,
            referralNumber: (page - 1) * limit + index + 1,
            status: r.status,
            statusLabel: r.status === 'active' ? 'Active Subscriber' :
                r.status === 'pending' ? 'Pending' :
                    r.status === 'churned' ? 'Cancelled' : r.status,
            subscribedAt: r.firstSubscriptionDate,
            commissionEarned: r.totalCommissionPaid || 0,
            yearsActive: r.yearsActive || 0,
            createdAt: r.createdAt,
        }))

        return Response.json({
            success: true,
            history,
            pagination: {
                page,
                limit,
                totalDocs,
                totalPages,
            },
        })
    } catch (error) {
        console.error('[Referral History] Error:', error)
        return Response.json({
            error: error instanceof Error ? error.message : 'Failed to get history',
        }, { status: 500 })
    }
}

/**
 * POST /api/referral/attribute
 *
 * Attribute a referral to a device when they install via referral link.
 * This is called when the app first opens with a referral code in the URL.
 */
export const referralAttributeHandler: PayloadHandler = async (req: PayloadRequest) => {
    if (req.method !== 'POST') {
        return Response.json({ error: 'Method not allowed' }, { status: 405 })
    }

    try {
        const body = await req.json?.()
        const { referralCode, referredDeviceId, source } = body || {}

        if (!referralCode || !referredDeviceId) {
            return Response.json({
                error: 'referralCode and referredDeviceId are required',
            }, { status: 400 })
        }

        // Check if device was already attributed
        const { docs: existingReferrals } = await req.payload.find({
            collection: 'referrals',
            where: { referredDeviceId: { equals: referredDeviceId } },
            limit: 1,
        })

        if (existingReferrals.length > 0) {
            return Response.json({
                success: false,
                error: 'Device already attributed to a referral',
                existingReferralId: existingReferrals[0].id,
            }, { status: 409 })
        }

        // Find the referrer by code
        const { docs: referrers } = await req.payload.find({
            collection: 'device-fingerprints',
            where: { referralCode: { equals: referralCode.toUpperCase() } },
            limit: 1,
        })

        if (referrers.length === 0) {
            return Response.json({
                success: false,
                error: 'Invalid referral code',
            }, { status: 404 })
        }

        const referrer = referrers[0] as { id: string | number; referralCode: string }

        // Prevent self-referral
        if (String(referrer.id) === referredDeviceId) {
            return Response.json({
                success: false,
                error: 'Self-referral is not allowed',
            }, { status: 400 })
        }

        // Create the referral attribution
        const referral = await req.payload.create({
            collection: 'referrals',
            data: {
                referrerId: String(referrer.id),
                referralCode: referralCode.toUpperCase(),
                referredDeviceId,
                status: 'pending',
                source: source || 'mobile',
            },
        })

        return Response.json({
            success: true,
            referralId: referral.id,
            message: 'Referral attributed successfully',
        })
    } catch (error) {
        console.error('[Referral Attribute] Error:', error)
        return Response.json({
            error: error instanceof Error ? error.message : 'Failed to attribute referral',
        }, { status: 500 })
    }
}

/**
 * POST /api/referral/convert
 *
 * Convert a pending referral to active when the referred user subscribes.
 * Called from RevenueCat webhook or subscription confirmation flow.
 */
export const referralConvertHandler: PayloadHandler = async (req: PayloadRequest) => {
    if (req.method !== 'POST') {
        return Response.json({ error: 'Method not allowed' }, { status: 405 })
    }

    try {
        const body = await req.json?.()
        const { referredDeviceId, revenuecatSubscriberId, referredEmail } = body || {}

        if (!referredDeviceId && !revenuecatSubscriberId) {
            return Response.json({
                error: 'referredDeviceId or revenuecatSubscriberId is required',
            }, { status: 400 })
        }

        // Find the pending referral
        const whereConditions: Array<{ [key: string]: unknown }> = [
            { status: { equals: 'pending' } }
        ]
        if (referredDeviceId) {
            whereConditions.push({ referredDeviceId: { equals: referredDeviceId } })
        }
        if (revenuecatSubscriberId) {
            whereConditions.push({ revenuecatSubscriberId: { equals: revenuecatSubscriberId } })
        }

        const { docs: pendingReferrals } = await req.payload.find({
            collection: 'referrals',
            where: { and: whereConditions } as any,
            limit: 1,
        })

        if (pendingReferrals.length === 0) {
            return Response.json({
                success: false,
                error: 'No pending referral found for this device',
            }, { status: 404 })
        }

        const referral = pendingReferrals[0] as {
            id: number
            referrerId: string
            totalCommissionPaid?: number
        }

        // Calculate commission based on referrer's tier
        const { docs: allReferrals } = await req.payload.find({
            collection: 'referrals',
            where: {
                referrerId: { equals: referral.referrerId },
                status: { in: ['active', 'completed'] },
            },
            limit: 1000,
        })

        const successfulCount = allReferrals.length
        const tier = calculateTier(successfulCount)
        const commissionRate = COMMISSION_TIERS[tier].commissionRate

        // Update referral to active
        const now = new Date()
        const nextCommissionDate = new Date(now)
        nextCommissionDate.setFullYear(nextCommissionDate.getFullYear() + 1)

        await req.payload.update({
            collection: 'referrals',
            id: referral.id,
            data: {
                status: 'active',
                firstSubscriptionDate: now.toISOString(),
                lastRenewalDate: now.toISOString(),
                nextCommissionDate: nextCommissionDate.toISOString(),
                revenuecatSubscriberId: revenuecatSubscriberId || undefined,
                referredEmail: referredEmail || undefined,
                yearsActive: 1,
            } as any,
        })

        // Check for milestone achievements
        const newSuccessfulCount = successfulCount + 1
        const achievedMilestones = getAchievedMilestones(newSuccessfulCount)
        const previousMilestones = getAchievedMilestones(successfulCount)
        const newMilestones = achievedMilestones.filter(
            (m) => !previousMilestones.some((pm) => pm.id === m.id)
        )

        return Response.json({
            success: true,
            referralId: referral.id,
            status: 'active',
            tier,
            commissionRate,
            newMilestones: newMilestones.map((m) => ({
                id: m.id,
                name: m.name,
                reward: m.reward,
                rewardType: m.rewardType,
            })),
            message: `Referral converted! Tier: ${tier}, Commission: $${commissionRate}/year`,
        })
    } catch (error) {
        console.error('[Referral Convert] Error:', error)
        return Response.json({
            error: error instanceof Error ? error.message : 'Failed to convert referral',
        }, { status: 500 })
    }
}

/**
 * POST /api/referral/apply-reward
 *
 * Apply a milestone or tier reward to a referrer.
 * Creates a payout record and can credit subscription time.
 */
export const referralApplyRewardHandler: PayloadHandler = async (req: PayloadRequest) => {
    if (req.method !== 'POST') {
        return Response.json({ error: 'Method not allowed' }, { status: 405 })
    }

    try {
        const body = await req.json?.()
        const { referrerId, rewardType, rewardValue, milestoneId, period } = body || {}

        if (!referrerId || !rewardType) {
            return Response.json({
                error: 'referrerId and rewardType are required',
            }, { status: 400 })
        }

        // Find the referrer
        const { docs: devices } = await req.payload.find({
            collection: 'device-fingerprints',
            where: {
                or: [
                    { id: { equals: parseInt(referrerId, 10) } },
                    { visitorId: { equals: referrerId } },
                    { fingerprintHash: { equals: referrerId } },
                ],
            },
            limit: 1,
        })

        if (devices.length === 0) {
            return Response.json({
                success: false,
                error: 'Referrer not found',
            }, { status: 404 })
        }

        const device = devices[0] as { id: number; email?: string }

        // Get referrer's email
        let referrerEmail = device.email
        if (!referrerEmail) {
            // Try to find email from referral records
            const { docs: referrals } = await req.payload.find({
                collection: 'referrals',
                where: { referrerId: { equals: String(device.id) } },
                limit: 1,
            })
            referrerEmail = (referrals[0] as { referrerEmail?: string })?.referrerEmail
        }

        if (!referrerEmail && rewardType === 'payout') {
            return Response.json({
                success: false,
                error: 'Email required for payout rewards',
            }, { status: 400 })
        }

        // Create reward/payout record
        if (rewardType === 'payout' || rewardType === 'commission') {
            // Get referral breakdown for this period
            const { docs: activeReferrals } = await req.payload.find({
                collection: 'referrals',
                where: {
                    referrerId: { equals: String(device.id) },
                    status: { in: ['active', 'completed'] },
                },
                limit: 1000,
            })

            const payout = await req.payload.create({
                collection: 'referral-payouts',
                data: {
                    referrerId: String(device.id),
                    referrerEmail: referrerEmail || 'pending@collection.com',
                    amount: rewardValue || 0,
                    referralCount: activeReferrals.length,
                    period: period || new Date().toISOString().slice(0, 7),
                    status: 'pending',
                    paymentMethod: 'paypal',
                    referralBreakdown: activeReferrals.slice(0, 50).map((r: any) => ({
                        referralId: String(r.id),
                        referredEmail: r.referredEmail,
                        amount: 25, // Annual commission per referral
                        anniversaryDate: r.nextCommissionDate,
                    })),
                },
            })

            return Response.json({
                success: true,
                payoutId: payout.id,
                amount: rewardValue,
                status: 'pending',
                message: 'Payout created and pending processing',
            })
        }

        // For subscription credit rewards (milestone bonuses)
        if (rewardType === 'days' || rewardType === 'subscription_credit') {
            // This would integrate with RevenueCat to credit subscription time
            // For now, we'll just log it
            console.log(`[Referral Reward] Crediting ${rewardValue} days to ${referrerId}`)

            return Response.json({
                success: true,
                rewardType: 'subscription_credit',
                daysCredited: rewardValue,
                milestoneId,
                message: `Credited ${rewardValue} days of premium subscription`,
            })
        }

        return Response.json({
            success: false,
            error: 'Invalid reward type',
        }, { status: 400 })
    } catch (error) {
        console.error('[Referral Apply Reward] Error:', error)
        return Response.json({
            error: error instanceof Error ? error.message : 'Failed to apply reward',
        }, { status: 500 })
    }
}
