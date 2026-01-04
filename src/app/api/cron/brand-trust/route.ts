import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { runBrandTrustCalculation } from '@/endpoints/brand-trust'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes

/**
 * Weekly Brand Trust Index Cron Job
 * Runs at 9 AM UTC every Sunday
 * Recalculates trust scores for all brands based on their products
 */
export async function GET(request: Request) {
    // Verify cron secret
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
        console.error('[Brand Trust Cron] Unauthorized request')
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        console.log('[Brand Trust Cron] Starting weekly brand trust calculation...')

        const payload = await getPayload({ config })

        const result = await runBrandTrustCalculation(payload)

        const avgScore = result.calculations.length > 0
            ? Math.round(result.calculations.reduce((sum, c) => sum + c.trustScore, 0) / result.calculations.length)
            : 0

        console.log(`[Brand Trust Cron] Complete: ${result.brandsProcessed} brands updated, avg score: ${avgScore}`)

        return NextResponse.json({
            timestamp: new Date().toISOString(),
            brandsProcessed: result.brandsProcessed,
            averageTrustScore: avgScore,
            errors: result.errors,
        })
    } catch (error) {
        console.error('[Brand Trust Cron] Error:', error)
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Cron failed',
            timestamp: new Date().toISOString(),
        }, { status: 500 })
    }
}
