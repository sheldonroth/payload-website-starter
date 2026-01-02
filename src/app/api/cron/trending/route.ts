import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { runTrendingEngine } from '@/endpoints/trending-engine'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes

/**
 * Daily Trending Engine Cron Job
 * Runs at 6 AM UTC every day
 * Scans news sources for brand mentions and updates trending scores
 */
export async function GET(request: Request) {
    // Verify cron secret
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
        console.error('[Trending Cron] Unauthorized request')
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        console.log('[Trending Cron] Starting daily trending engine...')

        const payload = await getPayload({ config })

        // Run trending engine with default options
        const result = await runTrendingEngine(payload, {
            fullScan: false, // Only scan brands with products
            daysBack: 7,     // Look back 7 days for news
        })

        console.log(`[Trending Cron] Complete: ${result.brandsUpdated} brands updated, ${result.trendingBrands.length} trending`)

        return NextResponse.json({
            timestamp: new Date().toISOString(),
            ...result,
        })
    } catch (error) {
        console.error('[Trending Cron] Error:', error)
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Cron failed',
            timestamp: new Date().toISOString(),
        }, { status: 500 })
    }
}
