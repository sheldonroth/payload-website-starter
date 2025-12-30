import type { PayloadHandler } from 'payload'

// Shared email components
const emailHeader = `
    <div style="background: #1A4D2E; padding: 24px; text-align: center;">
        <h1 style="margin: 0; color: white; font-family: Georgia, serif; font-size: 24px; font-weight: bold; letter-spacing: 1px;">
            THE PRODUCT REPORT
        </h1>
        <p style="margin: 8px 0 0 0; color: #86EFAC; font-family: -apple-system, sans-serif; font-size: 12px; text-transform: uppercase; letter-spacing: 2px;">
            Lab-Tested • Member-Funded • Brand-Free
        </p>
    </div>
`

const emailFooter = `
    <div style="margin-top: 40px; padding: 24px; background: #F8FAFC; border-top: 1px solid #E2E8F0;">
        <div style="text-align: center; margin-bottom: 20px;">
            <a href="https://x.com/theproductreport" style="display: inline-block; margin: 0 8px;">
                <img src="https://www.theproductreport.org/icons/x-logo.png" alt="X" width="24" height="24" style="opacity: 0.6;">
            </a>
            <a href="https://instagram.com/theproductreport" style="display: inline-block; margin: 0 8px;">
                <img src="https://www.theproductreport.org/icons/instagram.png" alt="Instagram" width="24" height="24" style="opacity: 0.6;">
            </a>
            <a href="https://youtube.com/@theproductreport" style="display: inline-block; margin: 0 8px;">
                <img src="https://www.theproductreport.org/icons/youtube.png" alt="YouTube" width="24" height="24" style="opacity: 0.6;">
            </a>
        </div>
        <p style="color: #64748B; font-size: 12px; text-align: center; font-family: -apple-system, sans-serif; margin: 0;">
            © 2025 The Product Report. All rights reserved.<br>
            <a href="https://www.theproductreport.org/account" style="color: #64748B;">Manage Preferences</a> • 
            <a href="https://www.theproductreport.org/privacy" style="color: #64748B;">Privacy Policy</a>
        </p>
    </div>
`

// Email HTML templates
const getWelcomeEmailHtml = (name: string) => `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background: #F8FAFC;">
    <div style="max-width: 600px; margin: 0 auto; background: white;">
        ${emailHeader}
        
        <div style="padding: 40px 32px; font-family: Georgia, serif; line-height: 1.8; color: #1a1a1a;">
            <p style="font-size: 18px; margin-bottom: 24px;">Hi ${name},</p>
            
            <p style="font-size: 18px; margin-bottom: 24px;">Most people trust labels. They trust marketing. They trust that someone, somewhere, is checking.</p>
            
            <p style="font-size: 18px; margin-bottom: 24px;"><strong>You just said no to that.</strong></p>
            
            <p style="font-size: 18px; margin-bottom: 24px;">The Product Report exists because the old system is broken. Brands pay for reviews. Influencers sell trust. And consumers? They're left guessing.</p>
            
            <p style="font-size: 18px; margin-bottom: 24px;">We do things differently.</p>
            
            <p style="font-size: 18px; margin-bottom: 24px;">We buy every product ourselves. Send it to certified labs. Publish real results. Take $0 from brands.</p>
            
            <p style="font-size: 18px; margin-bottom: 24px;">This only works because people like you believe it should exist.</p>
            
            <p style="font-size: 18px; margin-bottom: 32px;">Welcome to the Watchdogs.</p>
            
            <div style="text-align: center; margin: 40px 0;">
                <a href="https://www.theproductreport.org/browse" style="display: inline-block; background: #1A4D2E; color: white; text-decoration: none; padding: 16px 32px; font-family: -apple-system, sans-serif; font-size: 14px; font-weight: 600; letter-spacing: 0.5px; border-radius: 8px;">START EXPLORING</a>
            </div>
            
            <p style="font-size: 16px; color: #666; margin-top: 40px;">—The Product Report Team</p>
            
            <p style="font-size: 14px; color: #999; margin-top: 24px; font-style: italic;">P.S. Reply anytime. We read everything.</p>
        </div>
        
        ${emailFooter}
    </div>
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
<body style="margin: 0; padding: 0; background: #F8FAFC;">
    <div style="max-width: 600px; margin: 0 auto; background: white;">
        ${emailHeader}
        
        <div style="padding: 40px 32px; font-family: Georgia, serif; line-height: 1.8; color: #334155;">
            <h1 style="color: #0f172a; font-size: 24px; margin-bottom: 20px; font-family: Georgia, serif;">You're In! 🎉</h1>
            
            <p style="font-size: 17px;">Thanks for subscribing to The Product Report newsletter!</p>
            
            <p style="font-size: 17px;">Every week, you'll get:</p>
            
            <ul style="padding-left: 20px; font-size: 17px;">
                <li style="margin-bottom: 12px;">🧪 <strong>New lab results</strong> - First look at our latest product tests</li>
                <li style="margin-bottom: 12px;">📊 <strong>Top picks</strong> - Curated recommendations based on science</li>
                <li style="margin-bottom: 12px;">🎁 <strong>Exclusive deals</strong> - Member-only discounts from trusted brands</li>
                <li style="margin-bottom: 12px;">⚠️ <strong>Safety alerts</strong> - Be first to know about product issues</li>
            </ul>
            
            <p style="font-size: 17px;">Your first newsletter will arrive soon!</p>
            
            <div style="text-align: center; margin: 32px 0;">
                <a href="https://www.theproductreport.org" style="display: inline-block; background: #1A4D2E; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: bold; font-family: -apple-system, sans-serif;">Visit The Product Report →</a>
            </div>
        </div>
        
        ${emailFooter}
    </div>
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
<body style="margin: 0; padding: 0; background: #F8FAFC;">
    <div style="max-width: 600px; margin: 0 auto; background: white;">
        ${emailHeader}
        
        <div style="padding: 40px 32px; font-family: Georgia, serif; line-height: 1.8; color: #334155;">
            <h1 style="color: #0f172a; font-size: 24px; margin-bottom: 20px; font-family: Georgia, serif;">Welcome to ${planName}! 🎉</h1>
            
            <p style="font-size: 17px;">Thank you for becoming a member of The Product Report! Your subscription is now active.</p>
            
            <div style="background: #f0fdf4; border: 2px solid #1A4D2E; border-radius: 12px; padding: 24px; margin: 24px 0;">
                <h3 style="color: #1A4D2E; margin: 0 0 16px 0; font-family: -apple-system, sans-serif;">What you now have access to:</h3>
                <ul style="margin: 0; padding-left: 20px; color: #166534; font-size: 16px;">
                    <li style="margin-bottom: 8px;">Full lab test results and certificates</li>
                    <li style="margin-bottom: 8px;">Complete ingredient analysis</li>
                    <li style="margin-bottom: 8px;">Contamination & safety data</li>
                    <li style="margin-bottom: 8px;">Expert video reviews</li>
                    <li style="margin-bottom: 8px;">Product comparison tools</li>
                </ul>
            </div>
            
            <div style="text-align: center; margin: 32px 0;">
                <a href="https://www.theproductreport.org/browse" style="display: inline-block; background: #1A4D2E; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: bold; font-family: -apple-system, sans-serif;">Start Exploring →</a>
            </div>
        </div>
        
        ${emailFooter}
    </div>
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
<body style="margin: 0; padding: 0; background: #F8FAFC;">
    <div style="max-width: 600px; margin: 0 auto; background: white;">
        ${emailHeader}
        
        <div style="padding: 40px 32px; font-family: Georgia, serif; line-height: 1.8; color: #334155;">
            <h1 style="color: #0f172a; font-size: 24px; margin-bottom: 20px; font-family: Georgia, serif;">Reset Your Password</h1>
            
            <p style="font-size: 17px;">We received a request to reset your password. Click the button below to create a new password:</p>
            
            <div style="text-align: center; margin: 32px 0;">
                <a href="https://www.theproductreport.org/reset-password?token=test-token" style="display: inline-block; background: #1A4D2E; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: bold; font-family: -apple-system, sans-serif;">Reset Password</a>
            </div>
            
            <p style="color: #64748b; font-size: 15px;">This link will expire in 1 hour. If you didn't request this, you can safely ignore this email.</p>
        </div>
        
        ${emailFooter}
    </div>
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
