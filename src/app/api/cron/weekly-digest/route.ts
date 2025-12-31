import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { sendWeeklyDigest } from '@/jobs/weekly-digest'

/**
 * Weekly Digest Cron Job
 * Triggered by Vercel Cron every Tuesday at 10 AM UTC
 */
export async function GET(request: Request) {
    // Verify authorization via CRON_SECRET
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const payload = await getPayload({ config: configPromise })
        const result = await sendWeeklyDigest(payload)

        return NextResponse.json({
            success: true,
            timestamp: new Date().toISOString(),
            ...result,
        })
    } catch (error) {
        console.error('[Weekly Digest Cron] Error:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Job failed' },
            { status: 500 }
        )
    }
}
