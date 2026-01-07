/**
 * Email Event Trigger Endpoint
 * 
 * Called by mobile app or other services to trigger event-based emails.
 * Events: badge_unlocked, product_retested, year_in_clean_ready, etc.
 */

import { Endpoint } from 'payload';
import { sendEmail } from '../lib/email-sender';

interface EventTriggerRequest {
    event: string;
    userId?: string;
    userEmail?: string;
    deviceFingerprint?: string;
    data: Record<string, any>;
}

export const emailEventTriggerHandler: Endpoint = {
    path: '/email-trigger',
    method: 'post',
    handler: async (req) => {
        const payload = req.payload;

        try {
            const body = await req.json?.() as EventTriggerRequest || {} as EventTriggerRequest;
            const { event, userId, userEmail, deviceFingerprint, data } = body;

            if (!event) {
                return Response.json({ error: 'Event type required' }, { status: 400 });
            }

            console.log(`[EmailTrigger] Event: ${event}`, { userId, userEmail });

            // Get user email if not provided
            let email = userEmail;
            if (!email && userId) {
                const user = await payload.findByID({
                    collection: 'users',
                    id: userId,
                });
                email = user?.email;
            }

            // Try to get email from device fingerprint
            if (!email && deviceFingerprint) {
                const fingerprint = await payload.find({
                    collection: 'device-fingerprints',
                    where: { fingerprint: { equals: deviceFingerprint } },
                    limit: 1,
                });
                if (fingerprint.docs.length > 0 && fingerprint.docs[0].user) {
                    const user = await payload.findByID({
                        collection: 'users',
                        id: String(fingerprint.docs[0].user),
                    });
                    email = user?.email;
                }
            }

            if (!email) {
                return Response.json({
                    success: false,
                    error: 'No email found for user',
                    skipped: true
                });
            }

            // Find the appropriate template for this event
            let templateQuery: any = {};
            let variables: Record<string, string> = {};

            switch (event) {
                case 'badge_unlocked':
                    templateQuery = {
                        and: [
                            { sequence: { equals: 'fomo_trigger' } },
                            { triggerEvent: { equals: 'badge_unlocked' } },
                            { status: { equals: 'active' } },
                        ],
                    };
                    variables = {
                        badge_name: data.badgeName || 'Achievement Badge',
                        badge_emoji: data.badgeEmoji || '🏅',
                        badge_description: data.badgeDescription || 'Congratulations on your achievement!',
                    };
                    break;

                case 'product_retested':
                    templateQuery = {
                        and: [
                            { sequence: { equals: 'fomo_trigger' } },
                            { triggerEvent: { equals: 'product_retested' } },
                            { status: { equals: 'active' } },
                        ],
                    };
                    variables = {
                        product_name: data.productName || 'A product you scanned',
                        product_id: data.productId || '',
                    };
                    break;

                case 'year_in_clean_ready':
                    templateQuery = {
                        and: [
                            { sequence: { equals: 'fomo_trigger' } },
                            { triggerEvent: { equals: 'year_in_clean_ready' } },
                            { status: { equals: 'active' } },
                        ],
                    };
                    variables = {
                        year: data.year || new Date().getFullYear().toString(),
                    };
                    break;

                case 'brand_news':
                    templateQuery = {
                        and: [
                            { sequence: { equals: 'fomo_trigger' } },
                            { triggerEvent: { equals: 'brand_news' } },
                            { status: { equals: 'active' } },
                        ],
                    };
                    variables = {
                        brand_name: data.brandName || 'A brand',
                        news_headline: data.headline || 'is trending',
                    };
                    break;

                case 'new_category_tests':
                    templateQuery = {
                        and: [
                            { sequence: { equals: 'fomo_trigger' } },
                            { triggerEvent: { equals: 'new_category_tests' } },
                            { status: { equals: 'active' } },
                        ],
                    };
                    variables = {
                        category_name: data.categoryName || 'your favorite category',
                        test_count: data.testCount?.toString() || '5',
                    };
                    break;

                default:
                    return Response.json({
                        success: false,
                        error: `Unknown event type: ${event}`
                    }, { status: 400 });
            }

            // Find template
            const templates = await payload.find({
                collection: 'email-templates' as any,
                where: templateQuery,
                limit: 1,
            });

            if (templates.docs.length === 0) {
                console.log(`[EmailTrigger] No active template for event: ${event}`);
                return Response.json({
                    success: false,
                    error: 'No active template for this event',
                    skipped: true
                });
            }

            const template = templates.docs[0];

            // Check if we've already sent this email recently (within 24 hours)
            const recentSends = await payload.find({
                collection: 'email-sends' as any,
                where: {
                    and: [
                        { template: { equals: template.id } },
                        { recipient: { equals: email } },
                        {
                            sentAt: {
                                greater_than: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
                            }
                        },
                    ],
                },
                limit: 1,
            });

            if (recentSends.docs.length > 0) {
                console.log(`[EmailTrigger] Already sent ${event} email to ${email} within 24 hours`);
                return Response.json({
                    success: true,
                    skipped: true,
                    reason: 'Already sent within 24 hours'
                });
            }

            // Send the email
            const result = await sendEmail(payload, {
                to: email,
                templateId: String(template.id),
                variables,
                abTest: { enabled: true, variantId: Math.random() > 0.5 ? 'b' : 'a' },
            });

            return Response.json({
                success: result.success,
                messageId: result.messageId,
                error: result.error,
            });

        } catch (error) {
            console.error('[EmailTrigger] Error:', error);
            return Response.json({ error: 'Internal server error' }, { status: 500 });
        }
    },
};

export default emailEventTriggerHandler;
