import { PayloadHandler } from 'payload'
import { renderOneShotReceipt, emailSubjects } from '../email'

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

        if (isPremiumMember) {
            unlockType = 'subscription'
        } else {
            // Check if free credit is available
            const usedCredits = fingerprint?.unlockCreditsUsed || 0
            if (usedCredits >= 1) {
                // No free credits - requires subscription
                return Response.json({
                    success: false,
                    requiresUpgrade: true,
                    memberState,
                    message: 'You have used your free unlock. Subscribe for unlimited access.',
                })
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
            // Already unlocked - return success
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

        // Update fingerprint credits used (for free unlocks)
        if (unlockType === 'free_credit' && fingerprint) {
            await req.payload.update({
                collection: 'device-fingerprints' as 'users',
                id: fingerprint.id,
                data: {
                    unlockCreditsUsed: (fingerprint.unlockCreditsUsed || 0) + 1,
                } as unknown as Record<string, unknown>,
            })
        }

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

        // Send One-Shot receipt email for free credit unlocks
        if (unlockType === 'free_credit' && email) {
            try {
                const productName = (product as { name: string }).name
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

        return Response.json({
            success: true,
            unlockType,
            memberState,
            product: {
                id: product.id,
                name: (product as { name: string }).name,
            },
            remainingCredits: unlockType === 'subscription' ? 'unlimited' : 0,
        })
    } catch (error) {
        console.error('[Product Unlock] Error:', error)
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

        // Build query conditions
        const conditions: { product: { equals: number } }[] = [
            { product: { equals: parseInt(productId) } },
        ]

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
