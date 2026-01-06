/**
 * Email Sender with A/B Testing
 * 
 * Sends emails using Resend with:
 * - A/B testing for subject lines
 * - Open/click tracking
 * - Template variable substitution
 */

import { Resend } from 'resend';
import { Payload } from 'payload';

const resend = new Resend(process.env.RESEND_API_KEY);

interface SendEmailOptions {
    to: string;
    templateId: string;
    variables?: Record<string, string>;
    abTest?: {
        enabled: boolean;
        variantId: 'a' | 'b';
    };
}

interface EmailTemplate {
    id: string;
    subject: string;
    subjectVariantB?: string;
    preheader?: string;
    headline?: string;
    body: any;
    ctaText?: string;
    ctaUrl?: string;
}

/**
 * Substitute variables in text: {{variable}} -> value
 */
function substituteVariables(text: string, variables: Record<string, string>): string {
    let result = text;
    for (const [key, value] of Object.entries(variables)) {
        result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }
    return result;
}

/**
 * Convert rich text body to HTML
 */
function richTextToHtml(body: any): string {
    if (!body?.root?.children) return '';

    return body.root.children.map((node: any) => {
        if (node.type === 'paragraph') {
            const text = node.children?.map((c: any) => c.text || '').join('') || '';
            return `<p style="margin: 0 0 16px 0; line-height: 1.6;">${text}</p>`;
        }
        if (node.type === 'heading') {
            const text = node.children?.map((c: any) => c.text || '').join('') || '';
            return `<h3 style="margin: 24px 0 12px 0; font-size: 18px;">${text}</h3>`;
        }
        return '';
    }).join('\n');
}

/**
 * Generate email HTML with brand styling
 */
function generateEmailHtml(template: EmailTemplate, variables: Record<string, string>): string {
    const bodyHtml = substituteVariables(richTextToHtml(template.body), variables);
    const headline = template.headline ? substituteVariables(template.headline, variables) : '';
    const ctaText = template.ctaText ? substituteVariables(template.ctaText, variables) : '';
    const ctaUrl = template.ctaUrl ? substituteVariables(template.ctaUrl, variables) : '';

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${headline}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f7; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="background-color: #1d1d1f; padding: 24px; text-align: center;">
              <img src="https://theproductreport.org/logo-white.png" alt="The Product Report" width="180" style="max-width: 180px;">
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 32px;">
              ${headline ? `<h1 style="margin: 0 0 24px 0; font-size: 24px; color: #1d1d1f;">${headline}</h1>` : ''}
              
              <div style="color: #3a3a3c; font-size: 16px;">
                ${bodyHtml}
              </div>
              
              ${ctaText && ctaUrl ? `
              <div style="margin-top: 32px; text-align: center;">
                <a href="${ctaUrl}" style="display: inline-block; background-color: #12B981; color: #ffffff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">
                  ${ctaText}
                </a>
              </div>
              ` : ''}
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f5f5f7; padding: 24px 32px; text-align: center; font-size: 12px; color: #86868b;">
              <p style="margin: 0 0 8px 0;">The Product Report — Lab-tested product transparency</p>
              <p style="margin: 0;">
                <a href="https://theproductreport.org/unsubscribe" style="color: #86868b;">Unsubscribe</a> · 
                <a href="https://theproductreport.org/privacy" style="color: #86868b;">Privacy</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Send an email using Resend
 */
export async function sendEmail(
    payload: Payload,
    options: SendEmailOptions
): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
        // Fetch template
        const templateDoc = await payload.findByID({
            collection: 'email-templates' as any,
            id: options.templateId,
        });

        if (!templateDoc) {
            return { success: false, error: 'Template not found' };
        }

        const template = templateDoc as unknown as EmailTemplate;
        const variables = options.variables || {};

        // Determine subject (A/B test if enabled)
        let subject = template.subject;
        let isVariantB = false;

        if (options.abTest?.enabled && template.subjectVariantB) {
            // 50/50 split or use specified variant
            if (options.abTest.variantId === 'b') {
                subject = template.subjectVariantB;
                isVariantB = true;
            }
        }

        subject = substituteVariables(subject, variables);

        // Generate HTML
        const html = generateEmailHtml(template, variables);

        // Send via Resend
        const { data, error } = await resend.emails.send({
            from: 'The Product Report <noreply@theproductreport.org>',
            to: options.to,
            subject: subject,
            html: html,
            headers: {
                'X-Template-Id': options.templateId,
                'X-AB-Variant': isVariantB ? 'B' : 'A',
            },
        });

        if (error) {
            console.error('[EmailSender] Resend error:', error);
            return { success: false, error: error.message };
        }

        // Log send for stats
        await payload.create({
            collection: 'email-sends' as any,
            data: {
                template: options.templateId,
                recipient: options.to,
                subject: subject,
                abVariant: isVariantB ? 'B' : 'A',
                messageId: data?.id,
                sentAt: new Date().toISOString(),
                status: 'sent',
            } as any,
        });

        // Update template stats
        const currentStats = (templateDoc as any).stats || { sent: 0 };
        await payload.update({
            collection: 'email-templates' as any,
            id: options.templateId,
            data: {
                stats: {
                    ...currentStats,
                    sent: (currentStats.sent || 0) + 1,
                },
            },
        });

        console.log(`[EmailSender] Sent to ${options.to}, messageId: ${data?.id}`);
        return { success: true, messageId: data?.id };

    } catch (error) {
        console.error('[EmailSender] Error:', error);
        return { success: false, error: String(error) };
    }
}

/**
 * Send email to multiple recipients
 */
export async function sendBulkEmail(
    payload: Payload,
    templateId: string,
    recipients: Array<{ email: string; variables: Record<string, string> }>,
    abTestEnabled = false
): Promise<{ sent: number; failed: number }> {
    let sent = 0;
    let failed = 0;

    for (let i = 0; i < recipients.length; i++) {
        const recipient = recipients[i];

        // A/B test: alternate between variants
        const abVariant = abTestEnabled ? (i % 2 === 0 ? 'a' : 'b') as 'a' | 'b' : 'a';

        const result = await sendEmail(payload, {
            to: recipient.email,
            templateId,
            variables: recipient.variables,
            abTest: abTestEnabled ? { enabled: true, variantId: abVariant } : undefined,
        });

        if (result.success) {
            sent++;
        } else {
            failed++;
        }

        // Rate limit: 10 emails per second (Resend limit)
        if (i % 10 === 9) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    return { sent, failed };
}
