import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import jwt from 'jsonwebtoken'

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://www.theproductreport.org'

// Helper to create a session token for the user  
async function createSessionToken(userId: string, email: string): Promise<string> {
    const tokenPayload = {
        id: userId,
        email: email,
        collection: 'users',
    }

    return jwt.sign(tokenPayload, process.env.PAYLOAD_SECRET || 'your-secret-key', {
        expiresIn: '7d',
    })
}

export async function GET(request: NextRequest) {
    const url = new URL(request.url)
    const code = url.searchParams.get('code')
    const error = url.searchParams.get('error')

    if (error) {
        return NextResponse.redirect(`${FRONTEND_URL}/login?error=google_auth_failed`)
    }

    if (!code) {
        return NextResponse.redirect(`${FRONTEND_URL}/login?error=no_code`)
    }

    try {
        const googleClientId = process.env.GOOGLE_CLIENT_ID
        const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET
        const serverUrl = process.env.PAYLOAD_PUBLIC_SERVER_URL || process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'
        const redirectUri = `${serverUrl}/api/users/oauth/google/callback`

        // Exchange code for tokens
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code,
                client_id: googleClientId!,
                client_secret: googleClientSecret!,
                redirect_uri: redirectUri,
                grant_type: 'authorization_code',
            }),
        })

        const tokens = await tokenResponse.json()

        if (!tokens.access_token) {
            console.error('Token exchange failed:', tokens)
            return NextResponse.redirect(`${FRONTEND_URL}/login?error=token_exchange_failed`)
        }

        // Get user info from Google
        const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${tokens.access_token}` },
        })

        const googleUser = await userInfoResponse.json()

        // Get Payload instance
        const payload = await getPayload({ config: configPromise })

        // Check if user exists with this Google ID
        let user = await payload.find({
            collection: 'users',
            where: { googleId: { equals: googleUser.id } },
            limit: 1,
        }).then(res => res.docs[0])

        // If not found by Google ID, check by email
        if (!user && googleUser.email) {
            user = await payload.find({
                collection: 'users',
                where: { email: { equals: googleUser.email } },
                limit: 1,
            }).then(res => res.docs[0])

            // Link Google ID to existing user
            if (user) {
                await payload.update({
                    collection: 'users',
                    id: user.id,
                    data: { googleId: googleUser.id } as any,
                })
            }
        }

        // Create new user if doesn't exist
        if (!user) {
            user = await payload.create({
                collection: 'users',
                data: {
                    email: googleUser.email,
                    name: googleUser.name || googleUser.email.split('@')[0],
                    googleId: googleUser.id,
                    password: crypto.randomUUID(), // Random password for OAuth users
                    privacyConsent: {
                        dataProcessingConsent: true,
                        consentDate: new Date().toISOString(),
                    },
                } as any,
            })
        }

        // Create session token
        const token = await createSessionToken(String(user.id), user.email)

        // Redirect to frontend with token
        const redirectUrl = new URL(`${FRONTEND_URL}/auth/callback`)
        redirectUrl.searchParams.set('token', token)

        return NextResponse.redirect(redirectUrl.toString())
    } catch (err) {
        console.error('Google OAuth error:', err)
        return NextResponse.redirect(`${FRONTEND_URL}/login?error=oauth_failed`)
    }
}
