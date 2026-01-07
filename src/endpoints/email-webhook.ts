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
 *
 * @openapi
 * /email-webhook:
 *   post:
 *     summary: Resend email event webhook
 *     description: |
 *       Receives webhook events from Resend for email tracking.
 *
 *       **Supported Events:**
 *       - `email.delivered` - Email successfully delivered
 *       - `email.opened` - Recipient opened the email
 *       - `email.clicked` - Recipient clicked a link
 *       - `email.bounced` - Email bounced (hard/soft)
 *       - `email.complained` - Recipient marked as spam
 *
 *       **Security:**
 *       Webhooks are verified using HMAC-SHA256 signature in the `resend-signature` header.
 *       The signature is validated against `RESEND_WEBHOOK_SECRET`.
 *
 *       **Configure in Resend:**
 *       Dashboard > Webhooks > Add Endpoint > `https://cms.theproductreport.org/api/email-webhook`
 *     tags: [Webhooks, Email]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [email.delivered, email.opened, email.clicked, email.bounced, email.complained]
 *               data:
 *                 type: object
 *                 properties:
 *                   email_id:
 *                     type: string
 *                     description: Resend message ID
 *                   to:
 *                     type: array
 *                     items:
 *                       type: string
 *                   link:
 *                     type: string
 *                     description: Clicked URL (for click events)
 *     responses:
 *       200:
 *         description: Webhook processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 received:
 *                   type: boolean
 *                   example: true
 *                 matched:
 *                   type: boolean
 *                   description: Whether email was found in database
 *       401:
 *         description: Invalid or missing webhook signature
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */

import { Endpoint, Payload } from 'payload'
import crypto from 'crypto'
import { trackServer, flushServer } from '../lib/analytics/rudderstack-server'
import type { EmailSend, EmailTemplate } from '../payload-types'

// Interface for email template stats (allows null to match Payload types)
interface TemplateStats {
  sent?: number | null
  opened?: number | null
  clicked?: number | null
  openRate?: string | null
  clickRate?: string | null
}

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
            const isProduction = process.env.NODE_ENV === 'production';

            // In production, require both secret and signature
            if (isProduction) {
                if (!webhookSecret) {
                    console.error('[ResendWebhook] RESEND_WEBHOOK_SECRET is required in production');
                    return Response.json({ error: 'Webhook authentication not configured' }, { status: 500 });
                }
                if (!signature) {
                    console.error('[ResendWebhook] Missing resend-signature header');
                    return Response.json({ error: 'Missing signature' }, { status: 401 });
                }
                if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
                    console.error('[ResendWebhook] Invalid signature');
                    return Response.json({ error: 'Invalid signature' }, { status: 401 });
                }
            } else if (webhookSecret && signature) {
                // In development, verify if both are provided
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
                collection: 'email-sends',
                where: {
                    messageId: { equals: data.email_id || data.message_id },
                },
                limit: 1,
            });

            if (emailSends.docs.length === 0) {
                console.log(`[ResendWebhook] No matching email send for message: ${data.email_id}`);
                return Response.json({ received: true, matched: false });
            }

            const emailSend = emailSends.docs[0] as EmailSend;
            const now = new Date().toISOString();

            // Get recipient info for tracking
            const recipientEmail = emailSend.recipient || data.to?.[0]
            const templateName = emailSend.subject || 'unknown'
            const campaign = templateName

            // Get template ID for stats updates
            const templateId = typeof emailSend.template === 'object'
                ? emailSend.template.id
                : emailSend.template

            // Update based on event type
            switch (type) {
                case 'email.delivered':
                    await payload.update({
                        collection: 'email-sends',
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
                    if (emailSend.status !== 'opened' && emailSend.status !== 'clicked') {
                        await payload.update({
                            collection: 'email-sends',
                            id: emailSend.id,
                            data: {
                                status: 'opened',
                                openedAt: now,
                            },
                        })

                        // Update template stats
                        await updateTemplateStats(payload, String(templateId), 'opened')

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
                        collection: 'email-sends',
                        id: emailSend.id,
                        data: {
                            status: 'clicked',
                            clickedAt: now,
                            clickedUrl: data.link || data.url,
                        },
                    })

                    // Update template stats
                    await updateTemplateStats(payload, String(templateId), 'clicked')

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
                        collection: 'email-sends',
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
                        collection: 'email-sends',
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
            return Response.json({ error: 'Internal server error' }, { status: 500 });
        }
    },
};

/**
 * Update template stats with open/click data
 */
async function updateTemplateStats(
    payload: Payload,
    templateId: string,
    eventType: 'opened' | 'clicked'
): Promise<void> {
    try {
        const template = await payload.findByID({
            collection: 'email-templates',
            id: templateId,
        }) as EmailTemplate | null;

        if (!template) return;

        const currentStats: TemplateStats = template.stats || { sent: 0, opened: 0, clicked: 0 };

        const updates: TemplateStats = {
            ...currentStats,
        };

        if (eventType === 'opened') {
            updates.opened = (currentStats.opened || 0) + 1;
        } else if (eventType === 'clicked') {
            updates.clicked = (currentStats.clicked || 0) + 1;
        }

        // Calculate rates
        if (updates.sent && updates.sent > 0) {
            updates.openRate = `${(((updates.opened || 0) / updates.sent) * 100).toFixed(1)}%`;
            updates.clickRate = `${(((updates.clicked || 0) / updates.sent) * 100).toFixed(1)}%`;
        }

        await payload.update({
            collection: 'email-templates',
            id: templateId,
            data: {
                stats: updates,
            },
        });

    } catch (error) {
        console.error('[ResendWebhook] Failed to update template stats:', error);
    }
}

// Result type for A/B test results
interface ABTestResults {
    variantA: { sent: number; opened: number; clicked: number; openRate: string };
    variantB: { sent: number; opened: number; clicked: number; openRate: string };
    winner: 'A' | 'B' | 'tie';
}

/**
 * Get A/B test results for a template
 */
export async function getABTestResults(
    payload: Payload,
    templateId: string
): Promise<ABTestResults> {
    // Get all sends for this template
    const allSends = await payload.find({
        collection: 'email-sends',
        where: {
            template: { equals: templateId },
        },
        limit: 10000,
    });

    const variantA = { sent: 0, opened: 0, clicked: 0 };
    const variantB = { sent: 0, opened: 0, clicked: 0 };

    for (const send of allSends.docs) {
        const emailSend = send as EmailSend;
        const variant = emailSend.abVariant === 'B' ? variantB : variantA;
        variant.sent++;
        if (emailSend.status === 'opened' || emailSend.status === 'clicked') {
            variant.opened++;
        }
        if (emailSend.status === 'clicked') {
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
