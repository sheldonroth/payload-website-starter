import type { PayloadHandler } from 'payload'
import { runFreshnessCheck, cleanupStaleAIDrafts } from '../jobs/freshness-check'
import { sendWeeklyDigest } from '../jobs/weekly-digest'

/**
 * Cron Jobs Endpoint
 * Triggered by Vercel Cron or manually by admins
 *
 * Available jobs:
 * - freshness: Check product freshness status
 * - cleanup: Remove stale AI drafts (30+ days old)
 * - weekly-digest: Send weekly digest emails (scheduled Tuesdays 10 AM UTC)
 * - all: Run all jobs
 */
export const cronJobsHandler: PayloadHandler = async (req) => {
    // Verify authorization (cron secret or admin user)
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    const isAuthorized =
        req.user ||
        (cronSecret && authHeader === `Bearer ${cronSecret}`)

    if (!isAuthorized) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const body = await req.json?.() || {}
        const { job = 'all' } = body

        const results: Record<string, unknown> = {
            timestamp: new Date().toISOString(),
            jobsRun: [] as string[],
        }

        // Run freshness check
        if (job === 'freshness' || job === 'all') {
            const freshnessResult = await runFreshnessCheck(req.payload)
            results.freshness = freshnessResult
            ;(results.jobsRun as string[]).push('freshness')
        }

        // Run AI draft cleanup
        if (job === 'cleanup' || job === 'all') {
            const cleanupResult = await cleanupStaleAIDrafts(req.payload)
            results.cleanup = cleanupResult
            ;(results.jobsRun as string[]).push('cleanup')
        }

        // Run weekly digest (only when explicitly called, not with 'all')
        if (job === 'weekly-digest') {
            const digestResult = await sendWeeklyDigest(req.payload)
            results.weeklyDigest = digestResult
            ;(results.jobsRun as string[]).push('weekly-digest')
        }

        return Response.json({
            success: true,
            ...results,
        })
    } catch (error) {
        console.error('Cron job error:', error)
        return Response.json(
            { error: error instanceof Error ? error.message : 'Job failed' },
            { status: 500 }
        )
    }
}
