import type { PayloadHandler, PayloadRequest, Payload } from 'payload'
import { createAuditLog } from '../collections/AuditLog'
import { findPotentialDuplicates } from '../utilities/fuzzy-match'

/**
 * Recall Watchdog Endpoint
 * POST /api/recall/check
 *
 * Checks FDA and CPSC recall databases for products in our catalog.
 * Can be triggered manually or via cron job.
 *
 * Data Sources:
 * - FDA Food Recalls: https://api.fda.gov/food/enforcement.json
 * - FDA Drug Recalls: https://api.fda.gov/drug/enforcement.json
 * - CPSC Recalls: https://www.saferproducts.gov/RestWebServices/
 */

interface RecallInfo {
    source: 'fda_food' | 'fda_drug' | 'cpsc'
    recallNumber: string
    productDescription: string
    recallingFirm: string
    reason: string
    classification?: string
    status: string
    recallDate: string
    url?: string
}

interface MatchedProduct {
    productId: number
    productName: string
    matchScore: number
    recall: RecallInfo
    action: 'flagged' | 'already_flagged' | 'error'
}

interface WatchdogResult {
    success: boolean
    recallsChecked: number
    productsMatched: number
    productsFlagged: number
    matches: MatchedProduct[]
    errors: string[]
}

// Fetch FDA Food Recalls (recent 30 days)
async function fetchFDAFoodRecalls(): Promise<RecallInfo[]> {
    try {
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
        const dateStr = thirtyDaysAgo.toISOString().split('T')[0].replace(/-/g, '')

        const response = await fetch(
            `https://api.fda.gov/food/enforcement.json?search=report_date:[${dateStr}+TO+*]&limit=100`,
            { headers: { 'User-Agent': 'ProductReportCMS/1.0' } }
        )

        if (!response.ok) {
            console.error('FDA Food API error:', response.status)
            return []
        }

        const data = await response.json()
        return (data.results || []).map((recall: any) => ({
            source: 'fda_food' as const,
            recallNumber: recall.recall_number || recall.event_id || 'unknown',
            productDescription: recall.product_description || '',
            recallingFirm: recall.recalling_firm || '',
            reason: recall.reason_for_recall || '',
            classification: recall.classification,
            status: recall.status || 'Ongoing',
            recallDate: recall.report_date || '',
            url: `https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts`,
        }))
    } catch (error) {
        console.error('Failed to fetch FDA food recalls:', error)
        return []
    }
}

// Fetch FDA Drug Recalls (recent 30 days)
async function fetchFDADrugRecalls(): Promise<RecallInfo[]> {
    try {
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
        const dateStr = thirtyDaysAgo.toISOString().split('T')[0].replace(/-/g, '')

        const response = await fetch(
            `https://api.fda.gov/drug/enforcement.json?search=report_date:[${dateStr}+TO+*]&limit=100`,
            { headers: { 'User-Agent': 'ProductReportCMS/1.0' } }
        )

        if (!response.ok) {
            console.error('FDA Drug API error:', response.status)
            return []
        }

        const data = await response.json()
        return (data.results || []).map((recall: any) => ({
            source: 'fda_drug' as const,
            recallNumber: recall.recall_number || recall.event_id || 'unknown',
            productDescription: recall.product_description || '',
            recallingFirm: recall.recalling_firm || '',
            reason: recall.reason_for_recall || '',
            classification: recall.classification,
            status: recall.status || 'Ongoing',
            recallDate: recall.report_date || '',
            url: `https://www.fda.gov/drugs/drug-safety-and-availability`,
        }))
    } catch (error) {
        console.error('Failed to fetch FDA drug recalls:', error)
        return []
    }
}

// Match recalls against our product catalog
async function matchRecallToProducts(
    recall: RecallInfo,
    payload: Payload
): Promise<MatchedProduct[]> {
    const matches: MatchedProduct[] = []

    // Extract potential product name and brand from recall description
    const description = recall.productDescription.toLowerCase()
    const brand = recall.recallingFirm

    // Try fuzzy matching against our products
    try {
        const potentialMatches = await findPotentialDuplicates(
            { name: recall.productDescription, brand },
            payload,
            { threshold: 0.7, limit: 5 }
        )

        for (const match of potentialMatches) {
            matches.push({
                productId: match.id,
                productName: match.name,
                matchScore: match.score,
                recall,
                action: 'flagged',
            })
        }
    } catch (error) {
        console.error('Error matching recall:', error)
    }

    return matches
}

// Flag a product with recall information
async function flagProductWithRecall(
    productId: number,
    recall: RecallInfo,
    payload: Payload
): Promise<'flagged' | 'already_flagged' | 'error'> {
    try {
        // Get current product state
        const product = await payload.findByID({
            collection: 'products',
            id: productId,
        }) as { verdict?: string; conflicts?: { detected?: string[] } }

        // Check if already flagged for this recall
        const existingConflicts = product.conflicts?.detected || []
        const alreadyFlagged = existingConflicts.some(c =>
            c.includes(recall.recallNumber) || c.includes('RECALL')
        )

        if (alreadyFlagged) {
            return 'already_flagged'
        }

        // Add recall warning to conflicts
        const recallWarning = `RECALL ALERT [${recall.recallNumber}]: ${recall.reason} (${recall.recallingFirm})`

        await payload.update({
            collection: 'products',
            id: productId,
            data: {
                verdict: 'avoid',
                verdictOverride: true,
                verdictOverrideReason: `FDA/CPSC Recall: ${recall.reason}`,
                freshnessStatus: 'needs_review',
                conflicts: {
                    detected: [...existingConflicts, recallWarning],
                    lastChecked: new Date().toISOString(),
                },
            } as Record<string, unknown>,
        })

        return 'flagged'
    } catch (error) {
        console.error('Failed to flag product:', error)
        return 'error'
    }
}

export const recallWatchdogHandler: PayloadHandler = async (req: PayloadRequest) => {
    // Verify authentication (cron jobs use bearer token)
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    const isAuthenticated = req.user ||
        (cronSecret && authHeader === `Bearer ${cronSecret}`)

    if (!isAuthenticated) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result: WatchdogResult = {
        success: true,
        recallsChecked: 0,
        productsMatched: 0,
        productsFlagged: 0,
        matches: [],
        errors: [],
    }

    try {
        // Fetch recalls from all sources in parallel
        const [fdaFoodRecalls, fdaDrugRecalls] = await Promise.all([
            fetchFDAFoodRecalls(),
            fetchFDADrugRecalls(),
        ])

        const allRecalls = [...fdaFoodRecalls, ...fdaDrugRecalls]
        result.recallsChecked = allRecalls.length

        console.log(`Recall Watchdog: Checking ${allRecalls.length} recalls`)

        // Process each recall
        for (const recall of allRecalls) {
            try {
                const matches = await matchRecallToProducts(recall, req.payload)

                for (const match of matches) {
                    // Flag the product
                    const action = await flagProductWithRecall(
                        match.productId,
                        recall,
                        req.payload
                    )

                    match.action = action

                    if (action === 'flagged') {
                        result.productsFlagged++

                        // Create audit log
                        await createAuditLog(req.payload, {
                            action: 'conflict_detected',
                            sourceType: 'system',
                            sourceId: recall.recallNumber,
                            sourceUrl: recall.url,
                            targetCollection: 'products',
                            targetId: match.productId,
                            targetName: match.productName,
                            metadata: {
                                recallSource: recall.source,
                                recallReason: recall.reason,
                                recallingFirm: recall.recallingFirm,
                                matchScore: match.matchScore,
                                classification: recall.classification,
                            },
                        })
                    }

                    result.matches.push(match)
                }

                result.productsMatched += matches.length
            } catch (recallError) {
                const errorMsg = recallError instanceof Error ? recallError.message : 'Unknown error'
                result.errors.push(`Error processing recall ${recall.recallNumber}: ${errorMsg}`)
            }
        }

        // Log summary
        console.log(`Recall Watchdog Complete: ${result.recallsChecked} recalls checked, ${result.productsMatched} products matched, ${result.productsFlagged} flagged`)

        // Create summary audit log
        await createAuditLog(req.payload, {
            action: 'freshness_check',
            sourceType: 'system',
            metadata: {
                type: 'recall_watchdog',
                recallsChecked: result.recallsChecked,
                productsMatched: result.productsMatched,
                productsFlagged: result.productsFlagged,
                sources: ['fda_food', 'fda_drug'],
            },
        })

        return Response.json(result)
    } catch (error) {
        console.error('Recall Watchdog error:', error)
        return Response.json({
            ...result,
            success: false,
            error: error instanceof Error ? error.message : 'Watchdog failed',
        }, { status: 500 })
    }
}

/**
 * Cron job wrapper - call this from cron-jobs.ts
 */
export async function runRecallWatchdog(payload: Payload): Promise<WatchdogResult> {
    const result: WatchdogResult = {
        success: true,
        recallsChecked: 0,
        productsMatched: 0,
        productsFlagged: 0,
        matches: [],
        errors: [],
    }

    try {
        const [fdaFoodRecalls, fdaDrugRecalls] = await Promise.all([
            fetchFDAFoodRecalls(),
            fetchFDADrugRecalls(),
        ])

        const allRecalls = [...fdaFoodRecalls, ...fdaDrugRecalls]
        result.recallsChecked = allRecalls.length

        for (const recall of allRecalls) {
            const matches = await matchRecallToProducts(recall, payload)

            for (const match of matches) {
                const action = await flagProductWithRecall(match.productId, recall, payload)
                match.action = action
                if (action === 'flagged') result.productsFlagged++
                result.matches.push(match)
            }

            result.productsMatched += matches.length
        }

        return result
    } catch (error) {
        result.success = false
        result.errors.push(error instanceof Error ? error.message : 'Unknown error')
        return result
    }
}
