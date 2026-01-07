import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { sendBulkEmail } from '@/lib/email-sender'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes

/**
 * Email Cron Job Handler
 *
 * Handles scheduled email sends via Vercel Cron:
 * - weekly_digest: Weekly digest with recent test results
 * - week1_sequence: Days 0, 1, 3, 5, 7 after signup
 * - winback_sequence: Days 14, 30 after last activity
 */
export async function GET(request: Request) {
    // Verify cron secret
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
        console.error('[EmailCron] Unauthorized request')
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get job type from query params
    const { searchParams } = new URL(request.url)
    const job = searchParams.get('job')

    console.log(`[EmailCron] Starting job: ${job}`)

    try {
        const payload = await getPayload({ config })

        switch (job) {
            case 'weekly_digest':
                return await sendWeeklyDigestEmails(payload)

            case 'week1_sequence':
                return await sendWeek1Sequence(payload)

            case 'winback_sequence':
                return await sendWinBackSequence(payload)

            default:
                return NextResponse.json({ error: 'Unknown job type' }, { status: 400 })
        }
    } catch (error) {
        console.error('[EmailCron] Error:', error)
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Job failed',
            timestamp: new Date().toISOString(),
        }, { status: 500 })
    }
}

/**
 * Send Weekly Digest using the template-based email system
 */
async function sendWeeklyDigestEmails(payload: any) {
    // Get active weekly digest template
    const templates = await payload.find({
        collection: 'email-templates',
        where: {
            and: [
                { sequence: { equals: 'weekly_digest' } },
                { status: { equals: 'active' } },
            ],
        },
        limit: 1,
    })

    if (templates.docs.length === 0) {
        console.log('[EmailCron] No active weekly digest template found')
        return NextResponse.json({
            success: false,
            error: 'No active weekly digest template',
            sent: 0,
        })
    }

    const template = templates.docs[0]

    // Get recent products for content
    const recentProducts = await payload.find({
        collection: 'products',
        where: {
            and: [
                { status: { equals: 'published' } },
                { updatedAt: { greater_than: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() } },
            ],
        },
        limit: 5,
        sort: '-updatedAt',
    })

    const testSummary = recentProducts.docs
        .map((p: any) => `🔬 ${p.name} — ${p.verdict === 'recommend' ? '✅' : p.verdict === 'avoid' ? '❌' : '⚠️'} ${p.verdict || 'pending'}`)
        .join('\n')

    // Get subscribers who opted in to weekly digest
    const users = await payload.find({
        collection: 'users',
        where: {
            and: [
                { email: { exists: true } },
                { 'emailPreferences.weeklyDigest': { equals: true } },
            ],
        },
        limit: 1000,
    })

    if (users.docs.length === 0) {
        console.log('[EmailCron] No subscribers for weekly digest')
        return NextResponse.json({
            success: true,
            job: 'weekly_digest',
            sent: 0,
            message: 'No subscribers',
        })
    }

    // Prepare recipients with personalized variables
    const recipients = users.docs.map((user: any) => ({
        email: user.email,
        variables: {
            first_name: user.name?.split(' ')[0] || 'there',
            test_count: String(recentProducts.docs.length),
            weekly_test_summary: testSummary,
            surprise_story: recentProducts.docs[0]?.name
                ? `This week, we tested ${recentProducts.docs[0].name}...`
                : 'Check out what we found this week.',
            community_avoid_count: '2,847',
        },
    }))

    // Send with A/B testing
    const result = await sendBulkEmail(payload, template.id, recipients, true)

    console.log(`[EmailCron] Weekly digest complete: ${result.sent} sent, ${result.failed} failed`)

    return NextResponse.json({
        success: true,
        job: 'weekly_digest',
        ...result,
        timestamp: new Date().toISOString(),
    })
}

/**
 * Send Week 1 value discovery sequence (days 0, 1, 3, 5, 7)
 */
async function sendWeek1Sequence(payload: any) {
    const now = new Date()
    let totalSent = 0
    let totalFailed = 0

    const dayMapping = [
        { day: 0, daysSinceSignup: 0 },
        { day: 1, daysSinceSignup: 1 },
        { day: 3, daysSinceSignup: 3 },
        { day: 5, daysSinceSignup: 5 },
        { day: 7, daysSinceSignup: 7 },
    ]

    for (const { day, daysSinceSignup } of dayMapping) {
        // Get template for this day
        const templates = await payload.find({
            collection: 'email-templates',
            where: {
                and: [
                    { sequence: { equals: 'week1_value' } },
                    { dayInSequence: { equals: day } },
                    { status: { equals: 'active' } },
                ],
            },
            limit: 1,
        })

        if (templates.docs.length === 0) continue

        const template = templates.docs[0]

        // Find users who signed up exactly X days ago
        const targetDate = new Date(now)
        targetDate.setDate(targetDate.getDate() - daysSinceSignup)
        const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0))
        const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999))

        const users = await payload.find({
            collection: 'users',
            where: {
                and: [
                    { email: { exists: true } },
                    { createdAt: { greater_than: startOfDay.toISOString() } },
                    { createdAt: { less_than: endOfDay.toISOString() } },
                ],
            },
            limit: 500,
        })

        if (users.docs.length === 0) continue

        // Filter out users who already received this email
        const recipients = []
        for (const user of users.docs) {
            const alreadySent = await payload.find({
                collection: 'email-sends',
                where: {
                    and: [
                        { template: { equals: template.id } },
                        { recipient: { equals: user.email } },
                    ],
                },
                limit: 1,
            })

            if (alreadySent.docs.length > 0) continue

            recipients.push({
                email: user.email,
                variables: {
                    first_name: user.name?.split(' ')[0] || 'there',
                    scan_count: String((user as any).totalScans || 0),
                    recommended_count: String((user as any).recommendedCount || 0),
                    avoid_count: String((user as any).avoidCount || 0),
                },
            })
        }

        if (recipients.length > 0) {
            console.log(`[EmailCron] Week1 Day ${day}: Sending to ${recipients.length} users`)
            const result = await sendBulkEmail(payload, template.id, recipients, true)
            totalSent += result.sent
            totalFailed += result.failed
        }
    }

    console.log(`[EmailCron] Week1 sequence complete: ${totalSent} sent, ${totalFailed} failed`)

    return NextResponse.json({
        success: true,
        job: 'week1_sequence',
        sent: totalSent,
        failed: totalFailed,
        timestamp: new Date().toISOString(),
    })
}

/**
 * Send Win-Back sequence for inactive users (days 14, 30)
 */
async function sendWinBackSequence(payload: any) {
    const now = new Date()
    let totalSent = 0
    let totalFailed = 0

    const winbackDays = [14, 30]

    for (const daysInactive of winbackDays) {
        // Get template for this day
        const templates = await payload.find({
            collection: 'email-templates',
            where: {
                and: [
                    { sequence: { equals: 'winback' } },
                    { dayInSequence: { equals: daysInactive } },
                    { status: { equals: 'active' } },
                ],
            },
            limit: 1,
        })

        if (templates.docs.length === 0) continue

        const template = templates.docs[0]

        // Find users whose last activity was exactly X days ago
        const targetDate = new Date(now)
        targetDate.setDate(targetDate.getDate() - daysInactive)
        const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0))
        const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999))

        const users = await payload.find({
            collection: 'users',
            where: {
                and: [
                    { email: { exists: true } },
                    { lastActiveAt: { greater_than: startOfDay.toISOString() } },
                    { lastActiveAt: { less_than: endOfDay.toISOString() } },
                ],
            },
            limit: 500,
        })

        if (users.docs.length === 0) continue

        // Filter out users who already received this email
        const recipients = []
        for (const user of users.docs) {
            const alreadySent = await payload.find({
                collection: 'email-sends',
                where: {
                    and: [
                        { template: { equals: template.id } },
                        { recipient: { equals: user.email } },
                    ],
                },
                limit: 1,
            })

            if (alreadySent.docs.length > 0) continue

            // Count new products since they left
            const newProducts = await payload.count({
                collection: 'products',
                where: {
                    and: [
                        { status: { equals: 'published' } },
                        { createdAt: { greater_than: (user as any).lastActiveAt } },
                    ],
                },
            })

            recipients.push({
                email: user.email,
                variables: {
                    first_name: user.name?.split(' ')[0] || 'there',
                    new_test_count: String(newProducts.totalDocs),
                },
            })
        }

        if (recipients.length > 0) {
            console.log(`[EmailCron] Winback Day ${daysInactive}: Sending to ${recipients.length} users`)
            const result = await sendBulkEmail(payload, template.id, recipients, true)
            totalSent += result.sent
            totalFailed += result.failed
        }
    }

    console.log(`[EmailCron] Winback sequence complete: ${totalSent} sent, ${totalFailed} failed`)

    return NextResponse.json({
        success: true,
        job: 'winback_sequence',
        sent: totalSent,
        failed: totalFailed,
        timestamp: new Date().toISOString(),
    })
}
