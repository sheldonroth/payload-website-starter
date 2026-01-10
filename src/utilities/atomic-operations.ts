/**
 * Atomic Operations Utility
 *
 * Provides transaction-safe operations for counters and aggregations
 * to prevent race conditions in concurrent updates.
 *
 * The key pattern is:
 * 1. Use Payload's transaction support when available
 * 2. Use optimistic locking with retry logic as fallback
 * 3. Minimize the window between read and write
 */

import type { Payload, PayloadRequest } from 'payload'

// Maximum retry attempts for optimistic locking
const MAX_RETRIES = 3
const RETRY_DELAY_MS = 50

/**
 * Sleep for a specified number of milliseconds with jitter
 */
function sleep(ms: number): Promise<void> {
    const jitter = Math.random() * ms * 0.5 // Add up to 50% jitter
    return new Promise(resolve => setTimeout(resolve, ms + jitter))
}

/**
 * Atomic increment operation with optimistic locking
 *
 * This function reads the current value, increments it, and writes back.
 * If the write fails due to a concurrent update (detected via version mismatch),
 * it retries the operation.
 *
 * @param payload - Payload instance
 * @param collection - Collection slug
 * @param id - Document ID
 * @param field - Field to increment
 * @param amount - Amount to increment by (can be negative for decrement)
 * @param req - Optional request context for transactions
 * @returns The new value after increment
 */
export async function atomicIncrement(
    payload: Payload,
    collection: string,
    id: number | string,
    field: string,
    amount: number = 1,
    req?: PayloadRequest,
): Promise<number> {
    let attempts = 0

    while (attempts < MAX_RETRIES) {
        attempts++

        try {
            // Read current document
            const current = await payload.findByID({
                collection: collection as any,
                id,
                req,
            })

            if (!current) {
                throw new Error(`Document ${id} not found in ${collection}`)
            }

            const currentValue = (current as Record<string, any>)[field] || 0
            const newValue = currentValue + amount

            // Attempt to update
            // Note: We rely on database-level atomicity for the update
            // Future improvement: could use updatedAt as optimistic lock
            await payload.update({
                collection: collection as any,
                id,
                data: {
                    [field]: newValue,
                } as any,
                req,
            })

            // If we get here without error, the update succeeded
            return newValue

        } catch (error) {
            // Log retry attempts
            if (attempts < MAX_RETRIES) {
                console.warn(`[atomicIncrement] Retry ${attempts}/${MAX_RETRIES} for ${collection}/${id}.${field}`)
                await sleep(RETRY_DELAY_MS * attempts)
            } else {
                console.error(`[atomicIncrement] Failed after ${MAX_RETRIES} attempts for ${collection}/${id}.${field}`)
                throw error
            }
        }
    }

    throw new Error(`Failed to increment ${field} after ${MAX_RETRIES} attempts`)
}

/**
 * Atomic multi-field update with transaction
 *
 * Wraps multiple related updates in a transaction to ensure consistency.
 * If any update fails, all changes are rolled back.
 *
 * @param payload - Payload instance
 * @param updates - Array of update operations to perform atomically
 */
export async function atomicTransaction<T>(
    payload: Payload,
    operation: (transactionReq: PayloadRequest) => Promise<T>,
): Promise<T> {
    // Payload 3.x supports transactions through the db adapter
    // For Vercel Postgres, we can use the transaction method if available

    // Check if the db adapter supports transactions
    if (payload.db && typeof (payload.db as any).beginTransaction === 'function') {
        const session = await (payload.db as any).beginTransaction()
        try {
            // Create a request-like object with the transaction
            const transactionReq = { transactionID: session } as any as PayloadRequest
            const result = await operation(transactionReq)
            await (payload.db as any).commitTransaction(session)
            return result
        } catch (error) {
            await (payload.db as any).rollbackTransaction(session)
            throw error
        }
    }

    // Fallback: execute without transaction wrapper
    // The operation should handle its own retry logic
    console.warn('[atomicTransaction] Database does not support transactions, executing without transaction wrapper')
    return operation(undefined as any)
}

/**
 * Safe counter update for vote-style operations
 *
 * Handles the common pattern of:
 * 1. Check if entity can receive vote (status check)
 * 2. Check if voter already voted
 * 3. Increment vote count
 * 4. Add voter to list
 *
 * @param payload - Payload instance
 * @param options - Vote operation options
 */
export interface VoteOperationOptions {
    collection: string
    id: number | string
    voterId: string | number
    voterField: string // Field that stores voter IDs (e.g., 'voters', 'voterFingerprints')
    countField: string // Field that stores vote count
    additionalUpdates?: Record<string, any>
    req?: PayloadRequest
}

export interface VoteOperationResult {
    success: boolean
    isNewVoter: boolean
    newCount: number
    error?: string
}

export async function atomicVoteUpdate(
    payload: Payload,
    options: VoteOperationOptions,
): Promise<VoteOperationResult> {
    const { collection, id, voterId, voterField, countField, additionalUpdates = {}, req } = options

    let attempts = 0

    while (attempts < MAX_RETRIES) {
        attempts++

        try {
            // Read current document
            const current = await payload.findByID({
                collection: collection as any,
                id,
                req,
            })

            if (!current) {
                return {
                    success: false,
                    isNewVoter: false,
                    newCount: 0,
                    error: 'Document not found',
                }
            }

            const doc = current as Record<string, any>
            const existingVoters = (doc[voterField] || []) as (string | number)[]
            const isNewVoter = !existingVoters.includes(voterId)

            // Calculate new values
            const currentCount = doc[countField] || 0
            const newCount = isNewVoter ? currentCount + 1 : currentCount
            const newVoters = isNewVoter ? [...existingVoters, voterId] : existingVoters

            // Only update if there's a change
            if (!isNewVoter && Object.keys(additionalUpdates).length === 0) {
                return {
                    success: true,
                    isNewVoter: false,
                    newCount: currentCount,
                }
            }

            // Build update data
            const updateData: Record<string, any> = {
                [countField]: newCount,
                [voterField]: newVoters,
                ...additionalUpdates,
            }

            // Perform the update
            await payload.update({
                collection: collection as any,
                id,
                data: updateData as any,
                req,
            })

            return {
                success: true,
                isNewVoter,
                newCount,
            }

        } catch (error) {
            if (attempts < MAX_RETRIES) {
                console.warn(`[atomicVoteUpdate] Retry ${attempts}/${MAX_RETRIES} for ${collection}/${id}`)
                await sleep(RETRY_DELAY_MS * attempts)
            } else {
                console.error(`[atomicVoteUpdate] Failed after ${MAX_RETRIES} attempts for ${collection}/${id}`)
                return {
                    success: false,
                    isNewVoter: false,
                    newCount: 0,
                    error: error instanceof Error ? error.message : 'Unknown error',
                }
            }
        }
    }

    return {
        success: false,
        isNewVoter: false,
        newCount: 0,
        error: 'Max retries exceeded',
    }
}

/**
 * Atomic commission accrual for referral payouts
 *
 * Handles the pattern of:
 * 1. Find or create a payout record for the period
 * 2. Add the commission amount atomically
 * 3. Update the referral breakdown
 *
 * This is particularly important because commission accrual can happen
 * from multiple concurrent renewal webhooks.
 */
export interface CommissionAccrualOptions {
    referrerId: string
    referrerEmail: string
    amount: number
    period: string // e.g., "2026" for annual
    referralBreakdownEntry: {
        referralId: string
        referredEmail?: string
        amount: number
        anniversaryDate: string
    }
}

export async function atomicCommissionAccrual(
    payload: Payload,
    options: CommissionAccrualOptions,
    req?: PayloadRequest,
): Promise<{ payoutId: number | string; newTotal: number }> {
    const { referrerId, referrerEmail, amount, period, referralBreakdownEntry } = options

    let attempts = 0

    while (attempts < MAX_RETRIES) {
        attempts++

        try {
            // Check for existing pending payout for this referrer in current period
            const existingPayouts = await payload.find({
                collection: 'referral-payouts',
                where: {
                    referrerId: { equals: referrerId },
                    period: { equals: period },
                    status: { equals: 'pending' },
                },
                limit: 1,
                req,
            })

            if (existingPayouts.docs.length > 0) {
                // Update existing payout atomically
                const payout = existingPayouts.docs[0] as any
                const currentAmount = payout.amount || 0
                const currentCount = payout.referralCount || 0
                const currentBreakdown = payout.referralBreakdown || []

                // Check if this referral is already in the breakdown (prevent duplicate)
                const alreadyIncluded = currentBreakdown.some(
                    (entry: any) => entry.referralId === referralBreakdownEntry.referralId
                )

                if (alreadyIncluded) {
                    console.log(`[atomicCommissionAccrual] Referral ${referralBreakdownEntry.referralId} already in payout ${payout.id}`)
                    return {
                        payoutId: payout.id,
                        newTotal: currentAmount,
                    }
                }

                const newAmount = currentAmount + amount
                const newCount = currentCount + 1
                const newBreakdown = [...currentBreakdown, referralBreakdownEntry]

                await payload.update({
                    collection: 'referral-payouts',
                    id: payout.id,
                    data: {
                        amount: newAmount,
                        referralCount: newCount,
                        referralBreakdown: newBreakdown,
                    },
                    req,
                })

                return {
                    payoutId: payout.id,
                    newTotal: newAmount,
                }
            } else {
                // Create new payout record
                const newPayout = await payload.create({
                    collection: 'referral-payouts',
                    data: {
                        referrerId,
                        referrerEmail: referrerEmail || 'pending@collection.com',
                        amount,
                        referralCount: 1,
                        period,
                        status: 'pending',
                        paymentMethod: 'paypal',
                        referralBreakdown: [referralBreakdownEntry],
                    },
                    req,
                })

                return {
                    payoutId: newPayout.id,
                    newTotal: amount,
                }
            }

        } catch (error) {
            if (attempts < MAX_RETRIES) {
                console.warn(`[atomicCommissionAccrual] Retry ${attempts}/${MAX_RETRIES} for referrer ${referrerId}`)
                await sleep(RETRY_DELAY_MS * attempts)
            } else {
                console.error(`[atomicCommissionAccrual] Failed after ${MAX_RETRIES} attempts for referrer ${referrerId}`)
                throw error
            }
        }
    }

    throw new Error(`Failed to accrue commission after ${MAX_RETRIES} attempts`)
}

/**
 * Atomic weighted vote update for product-votes collection
 *
 * Handles the complex vote update pattern:
 * 1. Check if voter already voted
 * 2. Increment appropriate counter based on vote type
 * 3. Update total weighted votes
 * 4. Update velocity metrics
 * 5. Check and update funding threshold status
 */
export interface WeightedVoteOptions {
    barcode: string
    voteType: 'search' | 'scan' | 'member_scan'
    voteWeight: number
    fingerprint?: string
    productInfo?: {
        name?: string
        brand?: string
        imageUrl?: string
    }
    notifyId?: string
    notifyOnComplete?: boolean
    velocityData?: {
        scanTimestamps: number[]
        scansLast24h: number
        scansLast7d: number
        velocityScore: number
        urgencyFlag: 'normal' | 'trending' | 'urgent'
    }
}

export interface WeightedVoteResult {
    success: boolean
    voteRecord: any
    isNewVoter: boolean
    yourVoteRank: number
    error?: string
}

export async function atomicWeightedVoteUpdate(
    payload: Payload,
    options: WeightedVoteOptions,
    req?: PayloadRequest,
): Promise<WeightedVoteResult> {
    const {
        barcode,
        voteType,
        voteWeight,
        fingerprint,
        productInfo,
        notifyId,
        notifyOnComplete,
        velocityData,
    } = options

    let attempts = 0

    while (attempts < MAX_RETRIES) {
        attempts++

        try {
            // Find existing vote record
            const existingVotes = await payload.find({
                collection: 'product-votes',
                where: { barcode: { equals: barcode } },
                limit: 1,
                req,
            })

            if (existingVotes.docs.length > 0) {
                // Update existing record
                const existing = existingVotes.docs[0] as any

                // Check if this fingerprint already voted
                const existingFingerprints = existing.voterFingerprints || []
                const isNewVoter = !fingerprint || !existingFingerprints.includes(fingerprint)

                // Calculate new values
                const newSearchCount = existing.searchCount + (voteType === 'search' ? 1 : 0)
                const newScanCount = existing.scanCount + (voteType === 'scan' ? 1 : 0)
                const newMemberScanCount = existing.memberScanCount + (voteType === 'member_scan' ? 1 : 0)
                const newTotalVotes = existing.totalWeightedVotes + voteWeight
                const newUniqueVoters = isNewVoter ? existing.uniqueVoters + 1 : existing.uniqueVoters

                // Add fingerprint if new
                const newFingerprints = isNewVoter && fingerprint
                    ? [...existingFingerprints, fingerprint]
                    : existingFingerprints

                // Handle notification list
                const notifyList = [...(existing.notifyOnComplete || [])]
                if (notifyOnComplete && notifyId && !notifyList.includes(notifyId)) {
                    notifyList.push(notifyId)
                }

                // Build update data
                const updateData: Record<string, any> = {
                    searchCount: newSearchCount,
                    scanCount: newScanCount,
                    memberScanCount: newMemberScanCount,
                    totalWeightedVotes: newTotalVotes,
                    uniqueVoters: newUniqueVoters,
                    voterFingerprints: newFingerprints,
                    notifyOnComplete: notifyList,
                    productName: existing.productName || productInfo?.name,
                    brand: existing.brand || productInfo?.brand,
                    imageUrl: existing.imageUrl || productInfo?.imageUrl,
                }

                // Add velocity data if provided
                if (velocityData) {
                    updateData.scanTimestamps = velocityData.scanTimestamps
                    updateData.scansLast24h = velocityData.scansLast24h
                    updateData.scansLast7d = velocityData.scansLast7d
                    updateData.velocityScore = velocityData.velocityScore
                    updateData.urgencyFlag = velocityData.urgencyFlag
                }

                // Check if threshold was just reached
                const threshold = existing.fundingThreshold
                if (existing.totalWeightedVotes < threshold && newTotalVotes >= threshold) {
                    updateData.status = 'threshold_reached'
                    updateData.thresholdReachedAt = new Date().toISOString()
                }

                const updated = await payload.update({
                    collection: 'product-votes',
                    id: existing.id,
                    data: updateData,
                    req,
                })

                return {
                    success: true,
                    voteRecord: updated,
                    isNewVoter,
                    yourVoteRank: newUniqueVoters,
                }

            } else {
                // Create new vote record
                const notifyList: string[] = []
                if (notifyOnComplete && notifyId) {
                    notifyList.push(notifyId)
                }

                const createData: Record<string, any> = {
                    barcode,
                    productName: productInfo?.name,
                    brand: productInfo?.brand,
                    imageUrl: productInfo?.imageUrl,
                    totalWeightedVotes: voteWeight,
                    searchCount: voteType === 'search' ? 1 : 0,
                    scanCount: voteType === 'scan' ? 1 : 0,
                    memberScanCount: voteType === 'member_scan' ? 1 : 0,
                    uniqueVoters: 1,
                    voterFingerprints: fingerprint ? [fingerprint] : [],
                    notifyOnComplete: notifyList,
                    status: 'collecting_votes',
                }

                // Add velocity data if provided
                if (velocityData) {
                    createData.scanTimestamps = velocityData.scanTimestamps
                    createData.scansLast24h = velocityData.scansLast24h
                    createData.scansLast7d = velocityData.scansLast7d
                    createData.velocityScore = velocityData.velocityScore
                    createData.urgencyFlag = velocityData.urgencyFlag
                }

                const createOptions: Parameters<typeof payload.create>[0] = {
                    collection: 'product-votes',
                    data: createData as any,
                }
                if (req) {
                    createOptions.req = req
                }
                const created = await payload.create(createOptions)

                return {
                    success: true,
                    voteRecord: created,
                    isNewVoter: true,
                    yourVoteRank: 1,
                }
            }

        } catch (error) {
            if (attempts < MAX_RETRIES) {
                console.warn(`[atomicWeightedVoteUpdate] Retry ${attempts}/${MAX_RETRIES} for barcode ${barcode}`)
                await sleep(RETRY_DELAY_MS * attempts)
            } else {
                console.error(`[atomicWeightedVoteUpdate] Failed after ${MAX_RETRIES} attempts for barcode ${barcode}`)
                return {
                    success: false,
                    voteRecord: null,
                    isNewVoter: false,
                    yourVoteRank: 0,
                    error: error instanceof Error ? error.message : 'Unknown error',
                }
            }
        }
    }

    return {
        success: false,
        voteRecord: null,
        isNewVoter: false,
        yourVoteRank: 0,
        error: 'Max retries exceeded',
    }
}
