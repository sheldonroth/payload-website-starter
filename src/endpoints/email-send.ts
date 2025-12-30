import type { PayloadHandler } from 'payload'

// Email HTML templates
const getWelcomeEmailHtml = (name: string) => `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Georgia, serif; line-height: 1.8; color: #1a1a1a; max-width: 520px; margin: 0 auto; padding: 40px 20px;">
    
    <p style="font-size: 18px; margin-bottom: 24px;">Hi ${name},</p>
    
    <p style="font-size: 18px; margin-bottom: 24px;">Most people trust labels. They trust marketing. They trust that someone, somewhere, is checking.</p>
    
    <p style="font-size: 18px; margin-bottom: 24px;"><strong>You just said no to that.</strong></p>
    
    <p style="font-size: 18px; margin-bottom: 24px;">The Product Report exists because the old system is broken. Brands pay for reviews. Influencers sell trust. And consumers? They're left guessing.</p>
    
    <p style="font-size: 18px; margin-bottom: 24px;">We do things differently.</p>
    
    <p style="font-size: 18px; margin-bottom: 24px;">We buy every product ourselves. Send it to certified labs. Publish real results. Take $0 from brands.</p>
    
    <p style="font-size: 18px; margin-bottom: 24px;">This only works because people like you believe it should exist.</p>
    
    <p style="font-size: 18px; margin-bottom: 32px;">Welcome to the Watchdogs.</p>
    
    <div style="text-align: center; margin: 40px 0;">
        <a href="https://www.theproductreport.org/browse" style="display: inline-block; background: #1a1a1a; color: white; text-decoration: none; padding: 16px 32px; font-family: -apple-system, sans-serif; font-size: 14px; font-weight: 600; letter-spacing: 0.5px;">START EXPLORING</a>
    </div>
    
    <p style="font-size: 16px; color: #666; margin-top: 40px;">—The Product Report Team</p>
    
    <p style="font-size: 14px; color: #999; margin-top: 40px; font-style: italic;">P.S. Reply anytime. We read everything.</p>
    
    <hr style="border: none; border-top: 1px solid #eee; margin: 40px 0;">
    
    <p style="color: #999; font-size: 12px; text-align: center; font-family: -apple-system, sans-serif;">
        The Product Report • Lab-Tested. Member-Funded. Brand-Free.
    </p>
</body>
</html>
`

const getNewsletterEmailHtml = () => `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #334155; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="text-align: center; margin-bottom: 30px;">
        <div style="display: inline-block; background: #059669; color: white; font-weight: bold; padding: 8px 16px; border-radius: 8px; font-size: 18px;">TPR</div>
    </div>
    
    <h1 style="color: #0f172a; font-size: 24px; margin-bottom: 20px;">You're In! 🎉</h1>
    
    <p>Thanks for subscribing to The Product Report newsletter!</p>
    
    <p>Every week, you'll get:</p>
    
    <ul style="padding-left: 20px;">
        <li>🧪 <strong>New lab results</strong> - First look at our latest product tests</li>
        <li>📊 <strong>Top picks</strong> - Curated recommendations based on science</li>
        <li>🎁 <strong>Exclusive deals</strong> - Member-only discounts from trusted brands</li>
        <li>⚠️ <strong>Safety alerts</strong> - Be first to know about product issues</li>
    </ul>
    
    <p>Your first newsletter will arrive soon!</p>
    
    <div style="text-align: center; margin: 30px 0;">
        <a href="https://www.theproductreport.org" style="display: inline-block; background: #059669; color: white; text-decoration: none; padding: 14px 28px; border-radius: 10px; font-weight: bold;">Visit The Product Report →</a>
    </div>
    
    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
    
    <p style="color: #94a3b8; font-size: 12px; text-align: center;">
        The Product Report • Lab-Tested Independent Reviews
    </p>
</body>
</html>
`

const getSubscriptionEmailHtml = (planName: string) => `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #334155; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="text-align: center; margin-bottom: 30px;">
        <div style="display: inline-block; background: #059669; color: white; font-weight: bold; padding: 8px 16px; border-radius: 8px; font-size: 18px;">TPR</div>
    </div>
    
    <h1 style="color: #0f172a; font-size: 24px; margin-bottom: 20px;">Welcome to ${planName}! 🎉</h1>
    
    <p>Thank you for becoming a member of The Product Report! Your subscription is now active.</p>
    
    <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 20px; margin: 20px 0;">
        <h3 style="color: #166534; margin: 0 0 10px 0;">What you now have access to:</h3>
        <ul style="margin: 0; padding-left: 20px; color: #166534;">
            <li>Full lab test results and certificates</li>
            <li>Complete ingredient analysis</li>
            <li>Contamination & safety data</li>
            <li>Expert video reviews</li>
            <li>Product comparison tools</li>
        </ul>
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
        <a href="https://www.theproductreport.org/browse" style="display: inline-block; background: #059669; color: white; text-decoration: none; padding: 14px 28px; border-radius: 10px; font-weight: bold;">Start Exploring →</a>
    </div>
    
    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
    
    <p style="color: #94a3b8; font-size: 12px; text-align: center;">
        Manage your subscription at <a href="https://www.theproductreport.org/account" style="color: #94a3b8;">theproductreport.org/account</a><br><br>
        The Product Report • Lab-Tested Independent Reviews
    </p>
</body>
</html>
`

const getPasswordResetEmailHtml = () => `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #334155; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="text-align: center; margin-bottom: 30px;">
        <div style="display: inline-block; background: #059669; color: white; font-weight: bold; padding: 8px 16px; border-radius: 8px; font-size: 18px;">TPR</div>
    </div>
    
    <h1 style="color: #0f172a; font-size: 24px; margin-bottom: 20px;">Reset Your Password</h1>
    
    <p>We received a request to reset your password. Click the button below to create a new password:</p>
    
    <div style="text-align: center; margin: 30px 0;">
        <a href="https://www.theproductreport.org/reset-password?token=test-token" style="display: inline-block; background: #059669; color: white; text-decoration: none; padding: 14px 28px; border-radius: 10px; font-weight: bold;">Reset Password</a>
    </div>
    
    <p style="color: #64748b; font-size: 14px;">This link will expire in 1 hour. If you didn't request this, you can safely ignore this email.</p>
    
    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
    
    <p style="color: #94a3b8; font-size: 12px; text-align: center;">
        The Product Report • Lab-Tested Independent Reviews
    </p>
</body>
</html>
`

export const emailSend: PayloadHandler = async (req) => {
    try {
        // Check if user is authenticated
        if (!req.user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await req.json?.()
        const { template, email, name } = body || {}

        if (!email) {
            return Response.json({ error: 'Email is required' }, { status: 400 })
        }

        const recipientName = name || email.split('@')[0]

        let subject: string
        let html: string

        switch (template) {
            case 'welcome':
                subject = 'You just took back control'
                html = getWelcomeEmailHtml(recipientName)
                break
            case 'newsletter':
                subject = "✅ You're subscribed to The Product Report newsletter!"
                html = getNewsletterEmailHtml()
                break
            case 'subscription':
                subject = '🎉 Welcome to The Product Report Premium!'
                html = getSubscriptionEmailHtml('Premium')
                break
            case 'password_reset':
                subject = 'Reset your password - The Product Report'
                html = getPasswordResetEmailHtml()
                break
            default:
                subject = 'You just took back control'
                html = getWelcomeEmailHtml(recipientName)
        }

        // Use Payload's built-in email
        await req.payload.sendEmail({
            to: email,
            subject,
            html,
        })

        return Response.json({
            success: true,
            message: `${template || 'welcome'} email sent to ${email}`,
        })
    } catch (error) {
        console.error('Email send error:', error)
        return Response.json(
            { error: error instanceof Error ? error.message : 'Failed to send email' },
            { status: 500 }
        )
    }
}
