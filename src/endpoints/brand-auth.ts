/**
 * Brand Portal Authentication Endpoints
 *
 * Handles authentication for the Brand Intelligence Portal:
 * - Login: Email/password authentication for brand users
 * - Signup: New brand user registration with verification queue
 * - Verify Email: Confirm email address ownership
 * - Forgot Password: Password reset flow
 * - Refresh Token: Extend session
 */

import type { Endpoint } from 'payload'
import crypto from 'crypto'

// Verification token expiration (24 hours)
const VERIFICATION_TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000

// Password reset token expiration (1 hour)
const RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000

/**
 * Generate a secure random token
 */
function generateToken(): string {
    return crypto.randomBytes(32).toString('hex')
}

/**
 * Hash a token for storage (we don't store plaintext tokens)
 */
function hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex')
}

/**
 * Brand Login Endpoint
 * POST /api/brand-auth/login
 */
export const brandLoginHandler: Endpoint = {
    path: '/brand-auth/login',
    method: 'post',
    handler: async (req) => {
        try {
            const body = await req.json?.() || {}
            const { email, password } = body

            if (!email || !password) {
                return Response.json(
                    { error: 'Email and password are required' },
                    { status: 400 }
                )
            }

            // Attempt login via Payload's auth
            const result = await req.payload.login({
                collection: 'brand-users',
                data: { email, password },
                req,
            })

            if (!result.user) {
                return Response.json(
                    { error: 'Invalid credentials' },
                    { status: 401 }
                )
            }

            const user = result.user as {
                id: number
                email: string
                name: string
                brand: any
                role: string
                subscription: string
                isVerified: boolean
                features: any
            }

            // Check if user is verified
            if (!user.isVerified) {
                return Response.json(
                    {
                        error: 'Account not verified',
                        code: 'UNVERIFIED',
                        message: 'Please check your email and verify your account',
                    },
                    { status: 403 }
                )
            }

            // Get brand details
            let brandData = null
            if (user.brand) {
                const brand = typeof user.brand === 'object'
                    ? user.brand
                    : await req.payload.findByID({
                        collection: 'brands',
                        id: user.brand,
                    })
                brandData = brand ? {
                    id: brand.id,
                    name: brand.name,
                    slug: brand.slug,
                    trustScore: brand.trustScore,
                    trustGrade: brand.trustGrade,
                } : null
            }

            console.log(`[BrandAuth] Login: ${email} (Brand: ${brandData?.name || 'Unknown'})`)

            return Response.json({
                success: true,
                token: result.token,
                exp: result.exp,
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role,
                    subscription: user.subscription,
                    features: user.features,
                    brand: brandData,
                },
            })
        } catch (error) {
            console.error('[BrandAuth] Login error:', error)
            return Response.json(
                { error: 'Authentication failed' },
                { status: 401 }
            )
        }
    },
}

/**
 * Brand Signup Endpoint
 * POST /api/brand-auth/signup
 */
export const brandSignupHandler: Endpoint = {
    path: '/brand-auth/signup',
    method: 'post',
    handler: async (req) => {
        try {
            const body = await req.json?.() || {}
            const {
                email,
                password,
                name,
                jobTitle,
                phone,
                brandName,
                companyWebsite,
            } = body

            // Validate required fields
            if (!email || !password || !name) {
                return Response.json(
                    { error: 'Email, password, and name are required' },
                    { status: 400 }
                )
            }

            // Check if email already exists
            const existingUsers = await req.payload.find({
                collection: 'brand-users',
                where: { email: { equals: email.toLowerCase() } },
                limit: 1,
            })

            if (existingUsers.docs.length > 0) {
                return Response.json(
                    { error: 'An account with this email already exists' },
                    { status: 409 }
                )
            }

            // Find or suggest brand based on email domain
            const emailDomain = email.split('@')[1]?.toLowerCase()
            let matchedBrand = null

            // Try to find brand by domain
            const brands = await req.payload.find({
                collection: 'brands',
                where: {
                    or: [
                        { name: { contains: brandName || '' } },
                        { website: { contains: emailDomain || '' } },
                    ],
                },
                limit: 5,
            })

            if (brands.docs.length === 1) {
                matchedBrand = brands.docs[0]
            }

            // Generate verification token
            const verificationToken = generateToken()
            const hashedToken = hashToken(verificationToken)

            // Create the brand user (unverified)
            const newUser = await req.payload.create({
                collection: 'brand-users',
                data: {
                    email: email.toLowerCase(),
                    password,
                    name,
                    jobTitle: jobTitle || null,
                    phone: phone || null,
                    brand: matchedBrand?.id || null,
                    role: 'analyst', // Default role
                    subscription: 'free',
                    isVerified: false,
                    verificationNotes: `
                        Signup requested for brand: ${brandName || 'Not specified'}
                        Company website: ${companyWebsite || 'Not specified'}
                        Email domain: ${emailDomain}
                        Matched brand: ${matchedBrand?.name || 'None - requires manual assignment'}
                        Verification token hash: ${hashedToken}
                        Token expires: ${new Date(Date.now() + VERIFICATION_TOKEN_EXPIRY_MS).toISOString()}
                    `.trim(),
                },
            })

            // Send verification email
            const verificationUrl = `https://brands.theproductreport.org/verify?token=${verificationToken}&email=${encodeURIComponent(email)}`

            try {
                await req.payload.sendEmail({
                    to: email,
                    subject: 'Verify your Brand Portal account',
                    html: `
                        <h1>Welcome to The Product Report Brand Portal</h1>
                        <p>Hi ${name},</p>
                        <p>Thank you for signing up! Please verify your email address by clicking the link below:</p>
                        <p><a href="${verificationUrl}" style="display: inline-block; padding: 12px 24px; background: #059669; color: white; text-decoration: none; border-radius: 6px;">Verify Email</a></p>
                        <p>This link expires in 24 hours.</p>
                        <p>If you didn't create this account, you can safely ignore this email.</p>
                        <p>Best,<br>The Product Report Team</p>
                    `,
                })
            } catch (emailError) {
                console.error('[BrandAuth] Failed to send verification email:', emailError)
            }

            console.log(`[BrandAuth] Signup: ${email} (User ID: ${newUser.id})`)

            return Response.json({
                success: true,
                message: 'Account created. Please check your email to verify your account.',
                userId: newUser.id,
                requiresVerification: true,
                matchedBrand: matchedBrand ? {
                    id: matchedBrand.id,
                    name: matchedBrand.name,
                } : null,
                suggestedBrands: !matchedBrand && brands.docs.length > 0
                    ? brands.docs.map((b: any) => ({ id: b.id, name: b.name }))
                    : null,
            })
        } catch (error) {
            console.error('[BrandAuth] Signup error:', error)
            return Response.json(
                { error: 'Failed to create account' },
                { status: 500 }
            )
        }
    },
}

/**
 * Email Verification Endpoint
 * POST /api/brand-auth/verify-email
 */
export const brandVerifyEmailHandler: Endpoint = {
    path: '/brand-auth/verify-email',
    method: 'post',
    handler: async (req) => {
        try {
            const body = await req.json?.() || {}
            const { email, token } = body

            if (!email || !token) {
                return Response.json(
                    { error: 'Email and token are required' },
                    { status: 400 }
                )
            }

            // Find user by email
            const users = await req.payload.find({
                collection: 'brand-users',
                where: { email: { equals: email.toLowerCase() } },
                limit: 1,
            })

            if (users.docs.length === 0) {
                return Response.json(
                    { error: 'User not found' },
                    { status: 404 }
                )
            }

            const user = users.docs[0] as {
                id: number
                isVerified: boolean
                verificationNotes?: string
            }

            if (user.isVerified) {
                return Response.json({
                    success: true,
                    message: 'Email already verified',
                    alreadyVerified: true,
                })
            }

            // Verify the token
            const hashedToken = hashToken(token)
            const notes = user.verificationNotes || ''

            if (!notes.includes(hashedToken)) {
                return Response.json(
                    { error: 'Invalid or expired verification token' },
                    { status: 400 }
                )
            }

            // Check token expiration (parse from notes)
            const expiresMatch = notes.match(/Token expires: (.+)/)
            if (expiresMatch) {
                const expiresAt = new Date(expiresMatch[1])
                if (expiresAt < new Date()) {
                    return Response.json(
                        { error: 'Verification token has expired. Please request a new one.' },
                        { status: 400 }
                    )
                }
            }

            // Mark as verified
            await req.payload.update({
                collection: 'brand-users',
                id: user.id,
                data: {
                    isVerified: true,
                    verifiedAt: new Date().toISOString(),
                    verificationMethod: 'email_domain',
                    verificationNotes: notes + '\n\nVerified via email link.',
                },
            })

            console.log(`[BrandAuth] Email verified: ${email}`)

            return Response.json({
                success: true,
                message: 'Email verified successfully. You can now log in.',
            })
        } catch (error) {
            console.error('[BrandAuth] Verify email error:', error)
            return Response.json(
                { error: 'Verification failed' },
                { status: 500 }
            )
        }
    },
}

/**
 * Forgot Password Endpoint
 * POST /api/brand-auth/forgot-password
 */
export const brandForgotPasswordHandler: Endpoint = {
    path: '/brand-auth/forgot-password',
    method: 'post',
    handler: async (req) => {
        try {
            const body = await req.json?.() || {}
            const { email } = body

            if (!email) {
                return Response.json(
                    { error: 'Email is required' },
                    { status: 400 }
                )
            }

            // Find user by email
            const users = await req.payload.find({
                collection: 'brand-users',
                where: { email: { equals: email.toLowerCase() } },
                limit: 1,
            })

            // Always return success to prevent email enumeration
            if (users.docs.length === 0) {
                return Response.json({
                    success: true,
                    message: 'If an account exists with this email, you will receive a password reset link.',
                })
            }

            const user = users.docs[0]

            // Generate reset token using Payload's built-in method
            const token = await req.payload.forgotPassword({
                collection: 'brand-users',
                data: { email: email.toLowerCase() },
                disableEmail: true, // We'll send our own email
            })

            // Send password reset email
            const resetUrl = `https://brands.theproductreport.org/reset-password?token=${token}`

            try {
                await req.payload.sendEmail({
                    to: email,
                    subject: 'Reset your Brand Portal password',
                    html: `
                        <h1>Password Reset Request</h1>
                        <p>Hi,</p>
                        <p>We received a request to reset your Brand Portal password. Click the link below to set a new password:</p>
                        <p><a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background: #059669; color: white; text-decoration: none; border-radius: 6px;">Reset Password</a></p>
                        <p>This link expires in 1 hour.</p>
                        <p>If you didn't request this, you can safely ignore this email.</p>
                        <p>Best,<br>The Product Report Team</p>
                    `,
                })
            } catch (emailError) {
                console.error('[BrandAuth] Failed to send reset email:', emailError)
            }

            console.log(`[BrandAuth] Password reset requested: ${email}`)

            return Response.json({
                success: true,
                message: 'If an account exists with this email, you will receive a password reset link.',
            })
        } catch (error) {
            console.error('[BrandAuth] Forgot password error:', error)
            return Response.json(
                { error: 'Failed to process request' },
                { status: 500 }
            )
        }
    },
}

/**
 * Reset Password Endpoint
 * POST /api/brand-auth/reset-password
 */
export const brandResetPasswordHandler: Endpoint = {
    path: '/brand-auth/reset-password',
    method: 'post',
    handler: async (req) => {
        try {
            const body = await req.json?.() || {}
            const { token, password } = body

            if (!token || !password) {
                return Response.json(
                    { error: 'Token and password are required' },
                    { status: 400 }
                )
            }

            // Validate password strength
            if (password.length < 8) {
                return Response.json(
                    { error: 'Password must be at least 8 characters' },
                    { status: 400 }
                )
            }

            // Reset password using Payload's built-in method
            const result = await req.payload.resetPassword({
                collection: 'brand-users',
                data: { token, password },
                overrideAccess: true,
            })

            if (!result.user) {
                return Response.json(
                    { error: 'Invalid or expired reset token' },
                    { status: 400 }
                )
            }

            console.log(`[BrandAuth] Password reset completed for user: ${result.user.id}`)

            return Response.json({
                success: true,
                message: 'Password reset successfully. You can now log in with your new password.',
                token: result.token, // Auto-login token
            })
        } catch (error) {
            console.error('[BrandAuth] Reset password error:', error)
            return Response.json(
                { error: 'Failed to reset password' },
                { status: 500 }
            )
        }
    },
}

/**
 * Resend Verification Email
 * POST /api/brand-auth/resend-verification
 */
export const brandResendVerificationHandler: Endpoint = {
    path: '/brand-auth/resend-verification',
    method: 'post',
    handler: async (req) => {
        try {
            const body = await req.json?.() || {}
            const { email } = body

            if (!email) {
                return Response.json(
                    { error: 'Email is required' },
                    { status: 400 }
                )
            }

            // Find user by email
            const users = await req.payload.find({
                collection: 'brand-users',
                where: { email: { equals: email.toLowerCase() } },
                limit: 1,
            })

            if (users.docs.length === 0) {
                // Don't reveal if email exists
                return Response.json({
                    success: true,
                    message: 'If an unverified account exists with this email, a verification link has been sent.',
                })
            }

            const user = users.docs[0] as {
                id: number
                name: string
                isVerified: boolean
            }

            if (user.isVerified) {
                return Response.json({
                    success: true,
                    message: 'Account is already verified. You can log in.',
                    alreadyVerified: true,
                })
            }

            // Generate new verification token
            const verificationToken = generateToken()
            const hashedToken = hashToken(verificationToken)

            // Update verification notes with new token
            await req.payload.update({
                collection: 'brand-users',
                id: user.id,
                data: {
                    verificationNotes: `
                        Verification token hash: ${hashedToken}
                        Token expires: ${new Date(Date.now() + VERIFICATION_TOKEN_EXPIRY_MS).toISOString()}
                        Resent at: ${new Date().toISOString()}
                    `.trim(),
                },
            })

            // Send verification email
            const verificationUrl = `https://brands.theproductreport.org/verify?token=${verificationToken}&email=${encodeURIComponent(email)}`

            try {
                await req.payload.sendEmail({
                    to: email,
                    subject: 'Verify your Brand Portal account',
                    html: `
                        <h1>Verify Your Email</h1>
                        <p>Hi ${user.name},</p>
                        <p>Here's a new verification link for your Brand Portal account:</p>
                        <p><a href="${verificationUrl}" style="display: inline-block; padding: 12px 24px; background: #059669; color: white; text-decoration: none; border-radius: 6px;">Verify Email</a></p>
                        <p>This link expires in 24 hours.</p>
                        <p>Best,<br>The Product Report Team</p>
                    `,
                })
            } catch (emailError) {
                console.error('[BrandAuth] Failed to resend verification email:', emailError)
            }

            return Response.json({
                success: true,
                message: 'If an unverified account exists with this email, a verification link has been sent.',
            })
        } catch (error) {
            console.error('[BrandAuth] Resend verification error:', error)
            return Response.json(
                { error: 'Failed to resend verification' },
                { status: 500 }
            )
        }
    },
}

/**
 * Get Current User Endpoint (Me)
 * GET /api/brand-auth/me
 */
export const brandMeHandler: Endpoint = {
    path: '/brand-auth/me',
    method: 'get',
    handler: async (req) => {
        try {
            // Check if user is authenticated as brand user
            if (!req.user || req.user.collection !== 'brand-users') {
                return Response.json(
                    { error: 'Not authenticated' },
                    { status: 401 }
                )
            }

            const user = req.user as {
                id: number
                email: string
                name: string
                jobTitle?: string
                brand: any
                additionalBrands?: any[]
                role: string
                subscription: string
                features: any
                isVerified: boolean
                lastLoginAt?: string
            }

            // Get brand details
            let brandData = null
            if (user.brand) {
                const brand = typeof user.brand === 'object'
                    ? user.brand
                    : await req.payload.findByID({
                        collection: 'brands',
                        id: user.brand,
                    })
                brandData = brand ? {
                    id: brand.id,
                    name: brand.name,
                    slug: brand.slug,
                    trustScore: brand.trustScore,
                    trustGrade: brand.trustGrade,
                    productCount: brand.productCount,
                } : null
            }

            return Response.json({
                id: user.id,
                email: user.email,
                name: user.name,
                jobTitle: user.jobTitle,
                role: user.role,
                subscription: user.subscription,
                features: user.features,
                isVerified: user.isVerified,
                lastLoginAt: user.lastLoginAt,
                brand: brandData,
            })
        } catch (error) {
            console.error('[BrandAuth] Me error:', error)
            return Response.json(
                { error: 'Failed to get user data' },
                { status: 500 }
            )
        }
    },
}

// Export all handlers
export const brandAuthEndpoints = [
    brandLoginHandler,
    brandSignupHandler,
    brandVerifyEmailHandler,
    brandForgotPasswordHandler,
    brandResetPasswordHandler,
    brandResendVerificationHandler,
    brandMeHandler,
]
