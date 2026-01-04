import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { runRecallWatchdog } from '@/endpoints/recall-watchdog'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes

/**
 * Daily Recall Watchdog Cron Job
 * Runs at 8 AM UTC every day
 * Checks FDA recalls and updates affected products
 */
export async function GET(request: Request) {
    // Verify cron secret
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
        console.error('[Recall Cron] Unauthorized request')
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        console.log('[Recall Cron] Starting daily recall check...')

        const payload = await getPayload({ config })

        const result = await runRecallWatchdog(payload)

        console.log(`[Recall Cron] Complete: ${result.productsFlagged} products flagged, ${result.recallsChecked} recalls checked`)

        return NextResponse.json({
            timestamp: new Date().toISOString(),
            ...result,
        })
    } catch (error) {
        console.error('[Recall Cron] Error:', error)
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Cron failed',
            timestamp: new Date().toISOString(),
        }, { status: 500 })
    }
}
