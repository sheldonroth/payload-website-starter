import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { runArchetypeCalculation } from '@/utilities/archetype-calculator'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes

/**
 * Nightly Archetype Calculator Cron Job
 * Runs at 3 AM UTC every day
 *
 * Automatically calculates and assigns:
 * - ARCHETYPE_PREMIUM: Highest price in category
 * - ARCHETYPE_VALUE: Best score/price ratio in category
 */
export async function GET(request: Request) {
    // Verify cron secret
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
        console.error('[Archetype Cron] Unauthorized request')
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        console.log('[Archetype Cron] Starting nightly archetype calculation...')

        const payload = await getPayload({ config })

        const result = await runArchetypeCalculation(payload)

        console.log(
            `[Archetype Cron] Complete: ${result.categoriesProcessed} categories processed, ` +
                `${result.productsUpdated} products updated, ${result.productsCleared} badges cleared`
        )

        if (result.errors.length > 0) {
            console.warn(`[Archetype Cron] ${result.errors.length} errors occurred:`, result.errors)
        }

        return NextResponse.json({
            success: true,
            timestamp: new Date().toISOString(),
            ...result,
        })
    } catch (error) {
        console.error('[Archetype Cron] Error:', error)
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Cron failed',
                timestamp: new Date().toISOString(),
            },
            { status: 500 }
        )
    }
}
