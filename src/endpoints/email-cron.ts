/**
 * Email Cron Job Handler
 * 
 * Handles scheduled email sends:
 * - Weekly Digest: Tuesdays 9 AM
 * - Week 1 Sequence: Days 0, 1, 3, 5, 7 after signup
 * - Win-Back: Days 14, 30 after last activity
 */

import { Endpoint } from 'payload';
import { sendEmail, sendBulkEmail } from '../lib/email-sender';

export const emailCronHandler: Endpoint = {
    path: '/email-cron',
    method: 'post',
    handler: async (req) => {
        // Verify cron secret
        const authHeader = req.headers.get('authorization');
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const payload = req.payload;
        const body = await req.json().catch(() => ({}));
        const { job } = body;

        console.log(`[EmailCron] Running job: ${job}`);

        try {
            switch (job) {
                case 'weekly_digest':
                    return await sendWeeklyDigest(payload);

                case 'week1_sequence':
                    return await sendWeek1Sequence(payload);

                case 'winback_sequence':
                    return await sendWinBackSequence(payload);

                default:
                    return Response.json({ error: 'Unknown job type' }, { status: 400 });
            }
        } catch (error) {
            console.error('[EmailCron] Error:', error);
            return Response.json({ error: String(error) }, { status: 500 });
        }
    },
};

/**
 * Send Weekly Digest to all active subscribers
 */
async function sendWeeklyDigest(payload: any) {
    // Get weekly digest template
    const templates = await payload.find({
        collection: 'email-templates',
        where: {
            and: [
                { sequence: { equals: 'weekly_digest' } },
                { status: { equals: 'active' } },
            ],
        },
        limit: 1,
    });

    if (templates.docs.length === 0) {
        return Response.json({ error: 'No active weekly digest template' }, { status: 404 });
    }

    const template = templates.docs[0];

    // Get recent test results for digest content
    const recentProducts = await payload.find({
        collection: 'products',
        where: {
            updatedAt: {
                greater_than: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
            },
        },
        limit: 5,
        sort: '-updatedAt',
    });

    const testSummary = recentProducts.docs
        .map((p: any) => `🔬 ${p.name} — ${p.verdict === 'recommended' ? '✅' : '❌'} ${p.verdict}`)
        .join('\n');

    // Get all active subscribers with email preferences
    const users = await payload.find({
        collection: 'users',
        where: {
            and: [
                { email: { exists: true } },
                { 'emailPreferences.weeklyDigest': { equals: true } },
            ],
        },
        limit: 1000,
    });

    if (users.docs.length === 0) {
        return Response.json({ sent: 0, message: 'No subscribers for weekly digest' });
    }

    const recipients = users.docs.map((user: any) => ({
        email: user.email,
        variables: {
            first_name: user.name?.split(' ')[0] || 'there',
            test_count: String(recentProducts.docs.length),
            weekly_test_summary: testSummary,
            surprise_story: recentProducts.docs[0]?.name
                ? `This week, we tested ${recentProducts.docs[0].name}...`
                : 'Check out what we found this week.',
            community_avoid_count: '2,847', // Would calculate from actual data
        },
    }));

    // Send with A/B testing enabled
    const result = await sendBulkEmail(payload, template.id, recipients, true);

    console.log(`[EmailCron] Weekly digest sent: ${result.sent} success, ${result.failed} failed`);

    return Response.json({
        job: 'weekly_digest',
        ...result,
    });
}

/**
 * Send Week 1 sequence emails (value discovery)
 */
async function sendWeek1Sequence(payload: any) {
    const now = new Date();
    let totalSent = 0;
    let totalFailed = 0;

    // Day mapping: signup day -> which email to send
    const dayMapping = [
        { day: 0, daysSinceSignup: 0 },
        { day: 1, daysSinceSignup: 1 },
        { day: 3, daysSinceSignup: 3 },
        { day: 5, daysSinceSignup: 5 },
        { day: 7, daysSinceSignup: 7 },
    ];

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
        });

        if (templates.docs.length === 0) continue;

        const template = templates.docs[0];

        // Find users who signed up exactly X days ago
        const targetDate = new Date(now);
        targetDate.setDate(targetDate.getDate() - daysSinceSignup);
        const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
        const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

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
        });

        if (users.docs.length === 0) continue;

        // Get each user's scan stats
        const recipients = [];
        for (const user of users.docs) {
            // Check if we already sent this email
            const alreadySent = await payload.find({
                collection: 'email-sends',
                where: {
                    and: [
                        { template: { equals: template.id } },
                        { recipient: { equals: user.email } },
                    ],
                },
                limit: 1,
            });

            if (alreadySent.docs.length > 0) continue;

            recipients.push({
                email: user.email,
                variables: {
                    first_name: user.name?.split(' ')[0] || 'there',
                    scan_count: String(user.totalScans || 0),
                    recommended_count: String(user.recommendedCount || 0),
                    avoid_count: String(user.avoidCount || 0),
                },
            });
        }

        if (recipients.length > 0) {
            const result = await sendBulkEmail(payload, template.id, recipients, true);
            totalSent += result.sent;
            totalFailed += result.failed;
        }
    }

    return Response.json({
        job: 'week1_sequence',
        sent: totalSent,
        failed: totalFailed,
    });
}

/**
 * Send Win-Back sequence for inactive users
 */
async function sendWinBackSequence(payload: any) {
    const now = new Date();
    let totalSent = 0;
    let totalFailed = 0;

    const winbackDays = [14, 30];

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
        });

        if (templates.docs.length === 0) continue;

        const template = templates.docs[0];

        // Find users whose last activity was exactly X days ago
        const targetDate = new Date(now);
        targetDate.setDate(targetDate.getDate() - daysInactive);
        const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
        const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

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
        });

        if (users.docs.length === 0) continue;

        const recipients = [];
        for (const user of users.docs) {
            // Check if we already sent this email
            const alreadySent = await payload.find({
                collection: 'email-sends',
                where: {
                    and: [
                        { template: { equals: template.id } },
                        { recipient: { equals: user.email } },
                    ],
                },
                limit: 1,
            });

            if (alreadySent.docs.length > 0) continue;

            // Get product count since they left
            const newProducts = await payload.count({
                collection: 'products',
                where: {
                    createdAt: { greater_than: user.lastActiveAt },
                },
            });

            recipients.push({
                email: user.email,
                variables: {
                    first_name: user.name?.split(' ')[0] || 'there',
                    new_test_count: String(newProducts.totalDocs),
                },
            });
        }

        if (recipients.length > 0) {
            const result = await sendBulkEmail(payload, template.id, recipients, true);
            totalSent += result.sent;
            totalFailed += result.failed;
        }
    }

    return Response.json({
        job: 'winback_sequence',
        sent: totalSent,
        failed: totalFailed,
    });
}

export default emailCronHandler;
