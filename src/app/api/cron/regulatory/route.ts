import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { runRegulatoryMonitor } from '@/endpoints/regulatory-monitor'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes

/**
 * Weekly Regulatory Monitor Cron Job
 * Runs at 7 AM UTC every Monday
 * Checks FDA Federal Register, Prop 65, and EU EFSA for regulatory changes
 */
export async function GET(request: Request) {
    // Verify cron secret
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
        console.error('[Regulatory Cron] Unauthorized request')
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        console.log('[Regulatory Cron] Starting weekly regulatory scan...')

        const payload = await getPayload({ config })

        const result = await runRegulatoryMonitor(payload)

        console.log(`[Regulatory Cron] Complete: ${result.updatesFound} updates found, ${result.newRecords} new records`)

        return NextResponse.json({
            timestamp: new Date().toISOString(),
            ...result,
        })
    } catch (error) {
        console.error('[Regulatory Cron] Error:', error)
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Cron failed',
            timestamp: new Date().toISOString(),
        }, { status: 500 })
    }
}
