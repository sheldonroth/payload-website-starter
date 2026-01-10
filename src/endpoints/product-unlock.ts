import { PayloadHandler } from 'payload'
import { renderOneShotReceipt, emailSubjects } from '../email'
import { trackServer, identifyServer, flushServer } from '../lib/analytics/rudderstack-server'
import { atomicIncrement } from '../utilities/atomic-operations'

/**
 * Product Unlock Endpoint
 *
 * POST /api/products/unlock
 *
 * Unlocks a product for a user using their free credit or subscription.
 * This is the core of the One-Shot Engine.
 */
export const productUnlockHandler: PayloadHandler = async (req) => {
    try {
        const body = await req.json?.() || {}
        const {
            productId,
            fingerprintHash,
            email,
            archetype,
            sessionId,
            referralSource,
            sourceProductId,
        } = body

        // Validate required fields
        if (!productId) {
            return Response.json(
                { error: 'productId is required' },
                { status: 400 }
            )
        }

        if (!fingerprintHash) {
            return Response.json(
                { error: 'fingerprintHash is required' },
                { status: 400 }
            )
        }

        // Validate email format if provided
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return Response.json(
                { error: 'Invalid email format' },
                { status: 400 }
            )
        }

        // Verify product exists
        const product = await req.payload.findByID({
            collection: 'products',
            id: productId,
        })

        if (!product) {
            return Response.json(
                { error: 'Product not found' },
                { status: 404 }
            )
        }

        // Get or create device fingerprint
        const fingerprintResult = await req.payload.find({
            collection: 'device-fingerprints' as 'users',
            where: {
                fingerprintHash: {
                    equals: fingerprintHash,
                },
            },
            limit: 1,
        })

        let fingerprint = fingerprintResult.docs[0] as {
            id: number
            unlockCreditsUsed?: number
            isBanned?: boolean
            user?: { id: number } | number | null
            emailsUsed?: string[]
        } | undefined

        // Create fingerprint if it doesn't exist (collection types regenerated on deployment)
        if (!fingerprint) {
            const now = new Date().toISOString()
            const newFp = await (req.payload.create as Function)({
                collection: 'device-fingerprints',
                data: {
                    fingerprintHash,
                    firstSeenAt: now,
                    lastSeenAt: now,
                    unlockCreditsUsed: 0,
                    isBanned: false,
                    emailsUsed: email ? [email] : [],
                },
            })
            fingerprint = newFp as typeof fingerprint
        }

        // Check if device is banned
        if (fingerprint?.isBanned) {
            return Response.json(
                {
                    success: false,
                    error: 'Device is banned from unlocking products',
                },
                { status: 403 }
            )
        }

        // Check if user is logged in (via Payload auth)
        let userId: number | null = null
        let memberState: 'virgin' | 'trial' | 'member' = 'virgin'
        let isPremiumMember = false

        if (req.user) {
            userId = (req.user as { id: number }).id
            const userData = req.user as { memberState?: string; subscriptionStatus?: string }
            memberState = (userData.memberState as typeof memberState) || 'virgin'
            isPremiumMember = (memberState as string) === 'member' || userData.subscriptionStatus === 'premium'
        }

        // Determine unlock type
        let unlockType: 'free_credit' | 'subscription' | 'admin_grant' = 'free_credit'
        const now = new Date().toISOString()
        let creditIncrementedAtomically = false // Track if we've atomically incremented

        if (isPremiumMember) {
            unlockType = 'subscription'
        } else {
            // RACE CONDITION FIX: Use atomic increment to reserve the credit FIRST
            // This prevents two concurrent requests from both using the "free" credit
            if (fingerprint) {
                const newCreditsUsed = await atomicIncrement(
                    req.payload,
                    'device-fingerprints',
                    fingerprint.id,
                    'unlockCreditsUsed',
                    1,
                )
                creditIncrementedAtomically = true

                // If new value > 1, another request already used the credit
                // We need to decrement and return upgrade required
                if (newCreditsUsed > 1) {
                    // Rollback the increment since this request lost the race
                    await atomicIncrement(
                        req.payload,
                        'device-fingerprints',
                        fingerprint.id,
                        'unlockCreditsUsed',
                        -1, // Decrement
                    )
                    creditIncrementedAtomically = false

                    // Track upgrade required event - important for conversion funnel
                    trackServer('Upgrade Required', {
                        product_id: productId,
                        product_name: (product as { name: string }).name,
                        member_state: memberState,
                        credits_used: newCreditsUsed - 1, // The actual used count before our failed attempt
                    }, { anonymousId: fingerprintHash })
                    await flushServer()

                    // No free credits - requires subscription
                    return Response.json({
                        success: false,
                        requiresUpgrade: true,
                        memberState,
                        message: 'You have used your free unlock. Subscribe for unlimited access.',
                    })
                }
            } else {
                // No fingerprint yet - this is fine, we'll create one
                // The credit will be used when we create it
            }
        }

        // Check if product is already unlocked
        const existingUnlock = await req.payload.find({
            collection: 'product-unlocks' as 'users',
            where: {
                and: [
                    { product: { equals: productId } },
                    {
                        or: [
                            { user: { equals: userId } },
                            { deviceFingerprint: { equals: fingerprint?.id } },
                        ],
                    },
                ],
            },
            limit: 1,
        })

        if (existingUnlock.docs.length > 0) {
            // Already unlocked - rollback the credit increment if we did one
            if (creditIncrementedAtomically && fingerprint) {
                await atomicIncrement(
                    req.payload,
                    'device-fingerprints',
                    fingerprint.id,
                    'unlockCreditsUsed',
                    -1, // Decrement - rollback the reservation
                )
            }
            // Return success - product was already unlocked
            return Response.json({
                success: true,
                alreadyUnlocked: true,
                product: {
                    id: product.id,
                    name: (product as { name: string }).name,
                },
                memberState,
            })
        }

        // Create or find user if email provided and not logged in
        if (email && !userId) {
            // Check if user exists with this email
            const existingUser = await req.payload.find({
                collection: 'users',
                where: {
                    email: {
                        equals: email,
                    },
                },
                limit: 1,
            })

            if (existingUser.docs.length > 0) {
                const existingUserDoc = existingUser.docs[0] as { id: number; memberState?: string }
                userId = existingUserDoc.id
                memberState = (existingUserDoc.memberState as typeof memberState) || 'virgin'
            } else {
                // Create new user
                // SECURITY: Use crypto.randomUUID() for strong password entropy
                const newUser = await req.payload.create({
                    collection: 'users',
                    data: {
                        email,
                        password: crypto.randomUUID() + crypto.randomUUID(), // 256-bit entropy
                        memberState: 'trial', // First unlock moves to trial
                        freeUnlockCredits: 0, // Used their one credit
                    },
                })
                userId = (newUser as { id: number }).id
                memberState = 'trial'
            }

            // Update fingerprint with user association
            if (fingerprint) {
                const emailsUsed = fingerprint.emailsUsed || []
                if (!emailsUsed.includes(email)) {
                    emailsUsed.push(email)
                }

                // Check for suspicious activity (multiple emails)
                const suspicious = emailsUsed.length > 2

                await req.payload.update({
                    collection: 'device-fingerprints' as 'users',
                    id: fingerprint.id,
                    data: {
                        user: userId,
                        emailsUsed,
                        suspiciousActivity: suspicious,
                    } as unknown as Record<string, unknown>,
                })
            }
        }

        // Create unlock record (collection types regenerated on deployment)
        await (req.payload.create as Function)({
            collection: 'product-unlocks',
            data: {
                user: userId || undefined,
                deviceFingerprint: fingerprint?.id,
                email: email || undefined,
                product: productId,
                unlockType,
                archetypeShown: archetype || undefined,
                unlockedAt: now,
                sourceProductId: sourceProductId || undefined,
                sessionId: sessionId || undefined,
                referralSource: referralSource || undefined,
            },
        })

        // NOTE: unlockCreditsUsed was already atomically incremented above
        // at the start of the free credit flow to prevent race conditions.
        // No need to update it again here.

        // Update user stats if logged in
        if (userId) {
            // Get current user data
            const userData = await req.payload.findByID({
                collection: 'users',
                id: userId,
            })

            const currentUnlockedProducts = ((userData as { unlockedProducts?: number[] }).unlockedProducts || []) as number[]
            const totalUnlocks = ((userData as { totalUnlocks?: number }).totalUnlocks || 0) + 1

            // Add to unlocked products array
            if (!currentUnlockedProducts.includes(productId)) {
                currentUnlockedProducts.push(productId)
            }

            // Update memberState if this is first unlock
            const newMemberState = memberState === 'virgin' ? 'trial' : memberState

            await req.payload.update({
                collection: 'users',
                id: userId,
                data: {
                    unlockedProducts: currentUnlockedProducts,
                    totalUnlocks,
                    lastUnlockAt: now,
                    memberState: newMemberState,
                    freeUnlockCredits: unlockType === 'free_credit' ? 0 : undefined,
                },
            })

            memberState = newMemberState
        }

        // Track product unlock - this is the core conversion event
        const productName = (product as { name: string }).name
        const trackingProps = {
            product_id: productId,
            product_name: productName,
            unlock_type: unlockType,
            member_state: memberState,
            archetype: archetype || undefined,
            referral_source: referralSource || undefined,
            source_product_id: sourceProductId || undefined,
            session_id: sessionId || undefined,
            has_email: !!email,
        }

        trackServer('Product Unlocked', trackingProps, {
            anonymousId: fingerprintHash,
            userId: userId ? String(userId) : undefined,
        })

        // If we have a user, update their traits
        if (userId) {
            identifyServer(String(userId), {
                email: email || undefined,
                member_state: memberState,
                total_unlocks: ((await req.payload.findByID({
                    collection: 'users',
                    id: userId,
                }) as { totalUnlocks?: number }).totalUnlocks || 0),
                last_unlock_at: now,
            })
        }

        // Send One-Shot receipt email for free credit unlocks
        if (unlockType === 'free_credit' && email) {
            try {
                const productSlug = (product as { slug: string }).slug
                const userName = email.split('@')[0]

                const html = await renderOneShotReceipt({
                    userName,
                    productName,
                    productSlug,
                })

                await req.payload.sendEmail({
                    to: email,
                    subject: emailSubjects.oneShotReceipt(productName),
                    html,
                })

                console.log(`[One-Shot] Receipt email sent to ${email}`)
            } catch (emailError) {
                // Don't fail the unlock if email fails
                console.error('[One-Shot] Failed to send receipt email:', emailError)
            }
        }

        await flushServer()

        return Response.json({
            success: true,
            unlockType,
            memberState,
            product: {
                id: product.id,
                name: productName,
            },
            remainingCredits: unlockType === 'subscription' ? 'unlimited' : 0,
        })
    } catch (error) {
        console.error('[Product Unlock] Error:', error)
        // NOTE: If an error occurred after atomic credit increment, the credit may remain
        // incremented. This is acceptable for error cases - the user can retry and the
        // credit will still be considered "used". For a more robust solution in high-traffic
        // scenarios, consider using database transactions.
        return Response.json(
            { error: 'Failed to unlock product' },
            { status: 500 }
        )
    }
}

/**
 * GET /api/products/unlock/status
 *
 * Check if a product is unlocked for the current user/device.
 */
export const productUnlockStatusHandler: PayloadHandler = async (req) => {
    try {
        const url = new URL(req.url || '', 'http://localhost')
        const productId = url.searchParams.get('productId')
        const fingerprintHash = url.searchParams.get('fingerprintHash')

        if (!productId) {
            return Response.json(
                { error: 'productId query parameter is required' },
                { status: 400 }
            )
        }

        // Check by user if logged in
        if (req.user) {
            const userId = (req.user as { id: number }).id
            const result = await req.payload.find({
                collection: 'product-unlocks' as 'users',
                where: {
                    and: [
                        { product: { equals: parseInt(productId) } },
                        { user: { equals: userId } },
                    ],
                },
                limit: 1,
            })

            if (result.docs.length > 0) {
                return Response.json({
                    isUnlocked: true,
                    unlockType: (result.docs[0] as unknown as { unlockType: string }).unlockType,
                })
            }

            // Check if premium member (they can access all)
            const userData = req.user as { memberState?: string; subscriptionStatus?: string }
            if (userData.memberState === 'member' || userData.subscriptionStatus === 'premium') {
                return Response.json({
                    isUnlocked: true,
                    unlockType: 'subscription',
                    isPremium: true,
                })
            }
        }

        // Check by fingerprint
        if (fingerprintHash) {
            // Get fingerprint ID
            const fpResult = await req.payload.find({
                collection: 'device-fingerprints' as 'users',
                where: {
                    fingerprintHash: {
                        equals: fingerprintHash,
                    },
                },
                limit: 1,
            })

            if (fpResult.docs.length > 0) {
                const fingerprintId = (fpResult.docs[0] as { id: number }).id

                const unlockResult = await req.payload.find({
                    collection: 'product-unlocks' as 'users',
                    where: {
                        and: [
                            { product: { equals: parseInt(productId) } },
                            { deviceFingerprint: { equals: fingerprintId } },
                        ],
                    },
                    limit: 1,
                })

                if (unlockResult.docs.length > 0) {
                    return Response.json({
                        isUnlocked: true,
                        unlockType: (unlockResult.docs[0] as unknown as { unlockType: string }).unlockType,
                    })
                }
            }
        }

        // Not unlocked
        return Response.json({
            isUnlocked: false,
        })
    } catch (error) {
        console.error('[Product Unlock Status] Error:', error)
        return Response.json(
            { error: 'Failed to check unlock status' },
            { status: 500 }
        )
    }
}
