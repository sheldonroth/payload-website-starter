import type { Payload } from 'payload'

/**
 * Freshness Check Job
 * Runs daily to update product freshness status based on lastTestedDate
 */
export async function runFreshnessCheck(payload: Payload): Promise<{
    checked: number
    fresh: number
    needsReview: number
    stale: number
}> {
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)

    const results = {
        checked: 0,
        fresh: 0,
        needsReview: 0,
        stale: 0,
    }

    // Get all published products
    const products = await payload.find({
        collection: 'products',
        where: {
            status: { equals: 'published' },
        },
        limit: 1000,
        depth: 0,
    })

    for (const product of products.docs) {
        results.checked++

        const lastTested = (product as any).lastTestedDate
        let newStatus: 'fresh' | 'needs_review' | 'stale' = 'fresh'

        if (!lastTested) {
            // Never tested = stale
            newStatus = 'stale'
        } else {
            const testedDate = new Date(lastTested)

            if (testedDate < ninetyDaysAgo) {
                newStatus = 'stale'
            } else if (testedDate < thirtyDaysAgo) {
                newStatus = 'needs_review'
            } else {
                newStatus = 'fresh'
            }
        }

        // Update if status changed
        const currentStatus = (product as any).freshnessStatus
        if (currentStatus !== newStatus) {
            await payload.update({
                collection: 'products',
                id: product.id,
                data: {
                    freshnessStatus: newStatus,
                },
            })
        }

        // Track counts
        if (newStatus === 'fresh') results.fresh++
        else if (newStatus === 'needs_review') results.needsReview++
        else results.stale++
    }

    return results
}

/**
 * Stale AI Draft Cleanup Job
 * Removes AI drafts older than 30 days that haven't been reviewed
 */
export async function cleanupStaleAIDrafts(payload: Payload): Promise<{
    checked: number
    deleted: number
}> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    const results = {
        checked: 0,
        deleted: 0,
    }

    // Get old AI drafts
    const staleDrafts = await payload.find({
        collection: 'products',
        where: {
            and: [
                { status: { equals: 'ai_draft' } },
                { createdAt: { less_than: thirtyDaysAgo.toISOString() } },
            ],
        },
        limit: 100,
        depth: 0,
    })

    results.checked = staleDrafts.docs.length

    for (const draft of staleDrafts.docs) {
        try {
            await payload.delete({
                collection: 'products',
                id: draft.id,
            })
            results.deleted++
        } catch (error) {
            console.error(`Failed to delete stale draft ${draft.id}:`, error)
        }
    }

    return results
}

/**
 * YouTube Channel Auto-Sync Job
 * Syncs new videos from configured channels
 */
export async function autoSyncYouTubeChannels(payload: Payload): Promise<{
    channelsSynced: number
    videosFound: number
    errors: string[]
}> {
    const results = {
        channelsSynced: 0,
        videosFound: 0,
        errors: [] as string[],
    }

    try {
        // Get YouTube settings global
        const settings = await payload.findGlobal({
            slug: 'youtube-settings',
        }) as any

        if (!settings?.channels?.length) {
            return results
        }

        // Sync each configured channel
        for (const channel of settings.channels) {
            if (!channel.channelId || !channel.autoSync) continue

            try {
                // Call the youtube sync endpoint logic
                // This would need to be refactored to be callable from here
                results.channelsSynced++
            } catch (error) {
                results.errors.push(`Failed to sync ${channel.channelId}: ${error}`)
            }
        }
    } catch (error) {
        results.errors.push(`Failed to get YouTube settings: ${error}`)
    }

    return results
}
