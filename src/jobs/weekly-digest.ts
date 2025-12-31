import type { Payload } from 'payload'

interface DigestContent {
    newProducts: Array<{
        id: string
        name: string
        slug: string
        verdict?: string
        category?: string
    }>
    watchlistAlerts: Array<{
        productName: string
        ingredientName: string
    }>
    communityHighlights: {
        topRequest?: {
            productName: string
            voteCount: number
        }
        newSubmissions: number
    }
    stats: {
        totalProducts: number
        productsReviewedThisWeek: number
    }
}

/**
 * Weekly Digest Job
 *
 * Sends personalized weekly digest emails to users who have opted in.
 * Scheduled for Tuesday 10 AM UTC (optimal open rates based on research).
 */
export async function sendWeeklyDigest(payload: Payload): Promise<{ sent: number; skipped: number; errors: number }> {
    console.log('[Weekly Digest] Starting weekly digest job...')

    const oneWeekAgo = new Date()
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

    // Get all users who have opted in
    const eligibleUsers = await payload.find({
        collection: 'users',
        where: {
            and: [
                { weeklyDigestEnabled: { equals: true } },
                { 'privacyConsent.marketingOptIn': { equals: true } },
                { email: { exists: true } },
            ],
        },
        limit: 500, // Process in batches if needed
    })

    console.log(`[Weekly Digest] Found ${eligibleUsers.totalDocs} eligible users`)

    if (eligibleUsers.totalDocs === 0) {
        return { sent: 0, skipped: 0, errors: 0 }
    }

    // Fetch new products from past week
    const newProducts = await payload.find({
        collection: 'products',
        where: {
            and: [
                { status: { equals: 'published' } },
                { createdAt: { greater_than: oneWeekAgo.toISOString() } },
            ],
        },
        sort: '-createdAt',
        limit: 5,
        depth: 1,
    })

    // Fetch community stats
    const productRequests = await payload.find({
        collection: 'user-submissions',
        where: {
            and: [
                { type: { equals: 'product_request' } },
                { status: { not_equals: 'rejected' } },
            ],
        },
        sort: '-voteCount',
        limit: 1,
    })

    const recentSubmissions = await payload.find({
        collection: 'user-submissions',
        where: {
            createdAt: { greater_than: oneWeekAgo.toISOString() },
        },
        limit: 0, // Just get count
    })

    const totalProducts = await payload.find({
        collection: 'products',
        where: { status: { equals: 'published' } },
        limit: 0,
    })

    let sent = 0
    let skipped = 0
    let errors = 0

    for (const user of eligibleUsers.docs) {
        try {
            // Get user's watchlist categories
            const watchlistCategories = (user as any).watchlistCategories || []

            // Build personalized content
            const digestContent: DigestContent = {
                newProducts: newProducts.docs.map((p: any) => ({
                    id: p.id,
                    name: p.name,
                    slug: p.slug,
                    verdict: p.verdict,
                    category: typeof p.categories?.[0] === 'object' ? p.categories[0]?.title : undefined,
                })),
                watchlistAlerts: [], // Would need more logic to populate
                communityHighlights: {
                    topRequest: productRequests.docs[0] ? {
                        productName: (productRequests.docs[0] as any).productRequestDetails?.requestedProductName || 'Unknown',
                        voteCount: (productRequests.docs[0] as any).voteCount || 0,
                    } : undefined,
                    newSubmissions: recentSubmissions.totalDocs,
                },
                stats: {
                    totalProducts: totalProducts.totalDocs,
                    productsReviewedThisWeek: newProducts.totalDocs,
                },
            }

            // Skip if no content to send
            if (digestContent.newProducts.length === 0 && !digestContent.communityHighlights.topRequest) {
                skipped++
                continue
            }

            // Generate email HTML
            const emailHtml = generateDigestEmail(digestContent, (user as any).name)

            // Send email
            await payload.sendEmail({
                to: user.email,
                subject: `Weekly Digest: ${digestContent.stats.productsReviewedThisWeek} new products reviewed this week`,
                html: emailHtml,
            })

            sent++
        } catch (error) {
            console.error(`[Weekly Digest] Error sending to ${user.email}:`, error)
            errors++
        }
    }

    console.log(`[Weekly Digest] Complete: ${sent} sent, ${skipped} skipped, ${errors} errors`)
    return { sent, skipped, errors }
}

function generateDigestEmail(content: DigestContent, userName?: string): string {
    const greeting = userName ? `Hi ${userName}` : 'Hi there'

    const productRows = content.newProducts.map(p => {
        const verdictColor = p.verdict === 'recommend' ? '#059669' :
            p.verdict === 'consider' ? '#2563eb' :
                p.verdict === 'caution' ? '#d97706' :
                    p.verdict === 'avoid' ? '#dc2626' : '#6b7280'

        return `
            <tr>
                <td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">
                    <a href="https://www.theproductreport.org/products/${p.slug}" style="color: #0f172a; text-decoration: none; font-weight: 500;">
                        ${p.name}
                    </a>
                    ${p.category ? `<br><span style="font-size: 12px; color: #64748b;">${p.category}</span>` : ''}
                </td>
                <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: right;">
                    ${p.verdict ? `<span style="display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; color: white; background: ${verdictColor};">${p.verdict.charAt(0).toUpperCase() + p.verdict.slice(1)}</span>` : ''}
                </td>
            </tr>
        `
    }).join('')

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Your Weekly Digest</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc;">
            <table width="100%" cellpadding="0" cellspacing="0" style="padding: 40px 20px;">
                <tr>
                    <td align="center">
                        <table width="100%" style="max-width: 600px; background: white; border-radius: 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); overflow: hidden;">
                            <!-- Header -->
                            <tr>
                                <td style="background: linear-gradient(135deg, #065f46 0%, #047857 100%); padding: 32px; text-align: center;">
                                    <div style="font-size: 24px; font-weight: 800; color: white; letter-spacing: -0.5px;">The Product Report</div>
                                    <div style="font-size: 14px; color: rgba(255,255,255,0.8); margin-top: 4px;">Weekly Digest</div>
                                </td>
                            </tr>

                            <!-- Greeting -->
                            <tr>
                                <td style="padding: 32px 32px 16px;">
                                    <h1 style="margin: 0; font-size: 22px; font-weight: 700; color: #0f172a;">${greeting}!</h1>
                                    <p style="margin: 8px 0 0; font-size: 16px; color: #475569;">
                                        Here's what's new at The Product Report this week.
                                    </p>
                                </td>
                            </tr>

                            <!-- Stats Bar -->
                            <tr>
                                <td style="padding: 0 32px;">
                                    <table width="100%" style="background: #f1f5f9; border-radius: 8px; padding: 16px;" cellpadding="0" cellspacing="0">
                                        <tr>
                                            <td style="text-align: center; padding: 8px;">
                                                <div style="font-size: 24px; font-weight: 700; color: #059669;">${content.stats.productsReviewedThisWeek}</div>
                                                <div style="font-size: 12px; color: #64748b;">New Reviews</div>
                                            </td>
                                            <td style="text-align: center; padding: 8px; border-left: 1px solid #e2e8f0;">
                                                <div style="font-size: 24px; font-weight: 700; color: #0f172a;">${content.stats.totalProducts}</div>
                                                <div style="font-size: 12px; color: #64748b;">Total Products</div>
                                            </td>
                                            <td style="text-align: center; padding: 8px; border-left: 1px solid #e2e8f0;">
                                                <div style="font-size: 24px; font-weight: 700; color: #6366f1;">${content.communityHighlights.newSubmissions}</div>
                                                <div style="font-size: 12px; color: #64748b;">Community Submissions</div>
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>

                            ${content.newProducts.length > 0 ? `
                            <!-- New Products -->
                            <tr>
                                <td style="padding: 24px 32px 8px;">
                                    <h2 style="margin: 0; font-size: 18px; font-weight: 700; color: #0f172a;">
                                        New Product Reviews
                                    </h2>
                                </td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 32px 24px;">
                                    <table width="100%" style="border: 1px solid #e2e8f0; border-radius: 8px; border-collapse: collapse;">
                                        ${productRows}
                                    </table>
                                </td>
                            </tr>
                            ` : ''}

                            ${content.communityHighlights.topRequest ? `
                            <!-- Community Highlight -->
                            <tr>
                                <td style="padding: 0 32px 24px;">
                                    <div style="background: #eff6ff; border-radius: 8px; padding: 16px; border-left: 4px solid #3b82f6;">
                                        <div style="font-size: 12px; font-weight: 600; color: #3b82f6; text-transform: uppercase; margin-bottom: 4px;">
                                            Most Requested
                                        </div>
                                        <div style="font-size: 16px; font-weight: 600; color: #1e3a8a;">
                                            ${content.communityHighlights.topRequest.productName}
                                        </div>
                                        <div style="font-size: 14px; color: #64748b; margin-top: 4px;">
                                            ${content.communityHighlights.topRequest.voteCount} community votes
                                        </div>
                                    </div>
                                </td>
                            </tr>
                            ` : ''}

                            <!-- CTA -->
                            <tr>
                                <td style="padding: 0 32px 32px; text-align: center;">
                                    <a href="https://www.theproductreport.org/products" style="display: inline-block; padding: 14px 32px; background: #059669; color: white; text-decoration: none; font-weight: 600; font-size: 16px; border-radius: 8px;">
                                        Browse All Products
                                    </a>
                                </td>
                            </tr>

                            <!-- Footer -->
                            <tr>
                                <td style="padding: 24px 32px; background: #f8fafc; border-top: 1px solid #e2e8f0;">
                                    <p style="margin: 0 0 12px; font-size: 12px; color: #94a3b8; text-align: center;">
                                        You received this email because you opted in to weekly digests.
                                        <a href="https://www.theproductreport.org/account/settings" style="color: #64748b;">Manage preferences</a>
                                    </p>
                                    <p style="margin: 0; font-size: 12px; color: #94a3b8; text-align: center;">
                                        &copy; ${new Date().getFullYear()} The Product Report. All rights reserved.
                                    </p>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
        </body>
        </html>
    `
}

export default sendWeeklyDigest
