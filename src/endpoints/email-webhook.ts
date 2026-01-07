/**
 * Resend Webhook Handler
 *
 * Receives webhooks from Resend for email events:
 * - email.delivered
 * - email.opened
 * - email.clicked
 * - email.bounced
 * - email.complained
 *
 * Updates EmailSends collection and calculates A/B test results.
 */

import { Endpoint } from 'payload'
import crypto from 'crypto'
import { trackServer, flushServer } from '../lib/analytics/rudderstack-server'

// Verify Resend webhook signature
function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
    const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

    return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
    );
}

export const resendWebhookHandler: Endpoint = {
    path: '/email-webhook',
    method: 'post',
    handler: async (req) => {
        const payload = req.payload;

        try {
            const rawBody = await req.text?.() || '';
            const signature = req.headers.get('resend-signature') || '';
            const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;

            // Verify signature if secret is configured
            if (webhookSecret && signature) {
                if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
                    console.error('[ResendWebhook] Invalid signature');
                    return Response.json({ error: 'Invalid signature' }, { status: 401 });
                }
            }

            const body = JSON.parse(rawBody);
            const { type, data } = body;

            console.log(`[ResendWebhook] Received event: ${type}`);

            // Find the email send record by message ID
            const emailSends = await payload.find({
                collection: 'email-sends' as any,
                where: {
                    messageId: { equals: data.email_id || data.message_id },
                },
                limit: 1,
            });

            if (emailSends.docs.length === 0) {
                console.log(`[ResendWebhook] No matching email send for message: ${data.email_id}`);
                return Response.json({ received: true, matched: false });
            }

            const emailSend = emailSends.docs[0];
            const now = new Date().toISOString();

            // Get recipient info for tracking
            const recipientEmail = (emailSend as any).recipient || data.to?.[0]
            const templateName = (emailSend as any).templateName || 'unknown'
            const campaign = (emailSend as any).campaign || templateName

            // Update based on event type
            switch (type) {
                case 'email.delivered':
                    await payload.update({
                        collection: 'email-sends' as any,
                        id: emailSend.id,
                        data: {
                            status: 'delivered',
                        },
                    })
                    // Track in RudderStack
                    trackServer(
                        'Email Delivered',
                        {
                            email_id: data.email_id,
                            campaign,
                            template: templateName,
                            recipient: recipientEmail,
                        },
                        { anonymousId: recipientEmail || data.email_id },
                    )
                    break

                case 'email.opened':
                    // Only update if not already opened (first open matters for stats)
                    if ((emailSend as any).status !== 'opened' && (emailSend as any).status !== 'clicked') {
                        await payload.update({
                            collection: 'email-sends' as any,
                            id: emailSend.id,
                            data: {
                                status: 'opened',
                                openedAt: now,
                            },
                        })

                        // Update template stats
                        await updateTemplateStats(payload, String((emailSend as any).template), 'opened')

                        // Track in RudderStack
                        trackServer(
                            'Email Opened',
                            {
                                email_id: data.email_id,
                                campaign,
                                template: templateName,
                                recipient: recipientEmail,
                            },
                            { anonymousId: recipientEmail || data.email_id },
                        )
                    }
                    break

                case 'email.clicked':
                    await payload.update({
                        collection: 'email-sends' as any,
                        id: emailSend.id,
                        data: {
                            status: 'clicked',
                            clickedAt: now,
                            clickedUrl: data.link || data.url,
                        },
                    })

                    // Update template stats
                    await updateTemplateStats(payload, String((emailSend as any).template), 'clicked')

                    // Track in RudderStack
                    trackServer(
                        'Email Clicked',
                        {
                            email_id: data.email_id,
                            campaign,
                            template: templateName,
                            recipient: recipientEmail,
                            clicked_url: data.link || data.url,
                        },
                        { anonymousId: recipientEmail || data.email_id },
                    )
                    break

                case 'email.bounced':
                    await payload.update({
                        collection: 'email-sends' as any,
                        id: emailSend.id,
                        data: {
                            status: 'bounced',
                        },
                    })
                    // Track in RudderStack
                    trackServer(
                        'Email Bounced',
                        {
                            email_id: data.email_id,
                            campaign,
                            template: templateName,
                            recipient: recipientEmail,
                            bounce_type: data.bounce_type,
                        },
                        { anonymousId: recipientEmail || data.email_id },
                    )
                    break

                case 'email.complained':
                    await payload.update({
                        collection: 'email-sends' as any,
                        id: emailSend.id,
                        data: {
                            status: 'complained',
                        },
                    })
                    // Track in RudderStack
                    trackServer(
                        'Email Complained',
                        {
                            email_id: data.email_id,
                            campaign,
                            template: templateName,
                            recipient: recipientEmail,
                        },
                        { anonymousId: recipientEmail || data.email_id },
                    )
                    break
            }

            // Flush events before responding
            await flushServer()

            return Response.json({ received: true, matched: true })

        } catch (error) {
            console.error('[ResendWebhook] Error:', error);
            return Response.json({ error: String(error) }, { status: 500 });
        }
    },
};

/**
 * Update template stats with open/click data
 */
async function updateTemplateStats(
    payload: any,
    templateId: string,
    eventType: 'opened' | 'clicked'
) {
    try {
        const template = await payload.findByID({
            collection: 'email-templates' as any,
            id: templateId,
        });

        if (!template) return;

        const currentStats = template.stats || { sent: 0, opened: 0, clicked: 0 };

        const updates: any = {
            ...currentStats,
        };

        if (eventType === 'opened') {
            updates.opened = (currentStats.opened || 0) + 1;
        } else if (eventType === 'clicked') {
            updates.clicked = (currentStats.clicked || 0) + 1;
        }

        // Calculate rates
        if (updates.sent > 0) {
            updates.openRate = `${((updates.opened / updates.sent) * 100).toFixed(1)}%`;
            updates.clickRate = `${((updates.clicked / updates.sent) * 100).toFixed(1)}%`;
        }

        await payload.update({
            collection: 'email-templates' as any,
            id: templateId,
            data: {
                stats: updates,
            },
        });

    } catch (error) {
        console.error('[ResendWebhook] Failed to update template stats:', error);
    }
}

/**
 * Get A/B test results for a template
 */
export async function getABTestResults(
    payload: any,
    templateId: string
): Promise<{
    variantA: { sent: number; opened: number; clicked: number; openRate: string };
    variantB: { sent: number; opened: number; clicked: number; openRate: string };
    winner: 'A' | 'B' | 'tie';
}> {
    // Get all sends for this template
    const allSends = await payload.find({
        collection: 'email-sends' as any,
        where: {
            template: { equals: templateId },
        },
        limit: 10000,
    });

    const variantA = { sent: 0, opened: 0, clicked: 0 };
    const variantB = { sent: 0, opened: 0, clicked: 0 };

    for (const send of allSends.docs) {
        const variant = send.abVariant === 'B' ? variantB : variantA;
        variant.sent++;
        if (send.status === 'opened' || send.status === 'clicked') {
            variant.opened++;
        }
        if (send.status === 'clicked') {
            variant.clicked++;
        }
    }

    const openRateA = variantA.sent > 0 ? variantA.opened / variantA.sent : 0;
    const openRateB = variantB.sent > 0 ? variantB.opened / variantB.sent : 0;

    let winner: 'A' | 'B' | 'tie' = 'tie';
    if (openRateA > openRateB + 0.05) winner = 'A';
    else if (openRateB > openRateA + 0.05) winner = 'B';

    return {
        variantA: {
            ...variantA,
            openRate: `${(openRateA * 100).toFixed(1)}%`,
        },
        variantB: {
            ...variantB,
            openRate: `${(openRateB * 100).toFixed(1)}%`,
        },
        winner,
    };
}

export default resendWebhookHandler;
