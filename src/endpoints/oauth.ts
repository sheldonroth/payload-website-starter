import type { Endpoint } from 'payload'
import jwt from 'jsonwebtoken'

/**
 * OAuth Endpoints for Apple and Google Sign-In
 * 
 * These endpoints handle the OAuth flow for the website and mobile app.
 * 
 * Required environment variables:
 * - GOOGLE_CLIENT_ID
 * - GOOGLE_CLIENT_SECRET
 * - APPLE_CLIENT_ID
 * - APPLE_TEAM_ID
 * - APPLE_KEY_ID
 * - APPLE_PRIVATE_KEY (base64 encoded)
 * - FRONTEND_URL (e.g., https://www.theproductreport.org)
 */

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://www.theproductreport.org'

// Helper to create a session token for the user
async function createSessionToken(userId: string, email: string): Promise<string> {
    const payload = {
        id: userId,
        email: email,
        collection: 'users',
    }

    return jwt.sign(payload, process.env.PAYLOAD_SECRET || 'your-secret-key', {
        expiresIn: '7d',
    })
}

// Google OAuth - Redirect to Google
const googleOAuthStart: Endpoint = {
    path: '/users/oauth/google',
    method: 'get',
    handler: async (req) => {
        const googleClientId = process.env.GOOGLE_CLIENT_ID

        if (!googleClientId) {
            return Response.json(
                { error: 'Google OAuth not configured. Please set GOOGLE_CLIENT_ID environment variable.' },
                { status: 500 }
            )
        }

        const redirectUri = `${process.env.PAYLOAD_PUBLIC_SERVER_URL || 'http://localhost:3000'}/api/users/oauth/google/callback`
        const scope = 'openid email profile'

        const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
        authUrl.searchParams.set('client_id', googleClientId)
        authUrl.searchParams.set('redirect_uri', redirectUri)
        authUrl.searchParams.set('response_type', 'code')
        authUrl.searchParams.set('scope', scope)
        authUrl.searchParams.set('access_type', 'offline')
        authUrl.searchParams.set('prompt', 'consent')

        return Response.redirect(authUrl.toString())
    },
}

// Google OAuth Callback
const googleOAuthCallback: Endpoint = {
    path: '/users/oauth/google/callback',
    method: 'get',
    handler: async (req) => {
        const url = new URL(req.url || '', 'http://localhost')
        const code = url.searchParams.get('code')
        const error = url.searchParams.get('error')

        if (error) {
            return Response.redirect(`${FRONTEND_URL}/login?error=google_auth_failed`)
        }

        if (!code) {
            return Response.redirect(`${FRONTEND_URL}/login?error=no_code`)
        }

        try {
            const googleClientId = process.env.GOOGLE_CLIENT_ID
            const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET
            const redirectUri = `${process.env.PAYLOAD_PUBLIC_SERVER_URL || 'http://localhost:3000'}/api/users/oauth/google/callback`

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
                return Response.redirect(`${FRONTEND_URL}/login?error=token_exchange_failed`)
            }

            // Get user info from Google
            const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                headers: { Authorization: `Bearer ${tokens.access_token}` },
            })

            const googleUser = await userInfoResponse.json()

            // Find or create user in Payload
            const payload = req.payload

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

            return Response.redirect(redirectUrl.toString())
        } catch (err) {
            console.error('Google OAuth error:', err)
            return Response.redirect(`${FRONTEND_URL}/login?error=oauth_failed`)
        }
    },
}

// Apple OAuth - Redirect to Apple
const appleOAuthStart: Endpoint = {
    path: '/users/oauth/apple',
    method: 'get',
    handler: async (req) => {
        const appleClientId = process.env.APPLE_CLIENT_ID

        if (!appleClientId) {
            return Response.json(
                { error: 'Apple Sign-In not configured. Please set APPLE_CLIENT_ID environment variable.' },
                { status: 500 }
            )
        }

        const redirectUri = `${process.env.PAYLOAD_PUBLIC_SERVER_URL || 'http://localhost:3000'}/api/users/oauth/apple/callback`
        const scope = 'name email'

        const authUrl = new URL('https://appleid.apple.com/auth/authorize')
        authUrl.searchParams.set('client_id', appleClientId)
        authUrl.searchParams.set('redirect_uri', redirectUri)
        authUrl.searchParams.set('response_type', 'code id_token')
        authUrl.searchParams.set('response_mode', 'form_post')
        authUrl.searchParams.set('scope', scope)

        return Response.redirect(authUrl.toString())
    },
}

// Apple OAuth Callback (POST because Apple uses form_post)
const appleOAuthCallback: Endpoint = {
    path: '/users/oauth/apple/callback',
    method: 'post',
    handler: async (req) => {
        try {
            const body = req.text ? await req.text() : ''
            const params = new URLSearchParams(body)

            const idToken = params.get('id_token')
            const code = params.get('code')
            const error = params.get('error')
            const userString = params.get('user') // Apple sends user info on first login

            if (error) {
                return Response.redirect(`${FRONTEND_URL}/login?error=apple_auth_failed`)
            }

            if (!idToken) {
                return Response.redirect(`${FRONTEND_URL}/login?error=no_token`)
            }

            // Decode the ID token (in production, you should verify the signature)
            const parts = idToken.split('.')
            const tokenPayload = JSON.parse(Buffer.from(parts[1], 'base64').toString())

            const appleUserId = tokenPayload.sub
            const email = tokenPayload.email

            // Parse user info if provided (only on first login)
            let userName = null
            if (userString) {
                try {
                    const userData = JSON.parse(userString)
                    userName = userData.name ? `${userData.name.firstName || ''} ${userData.name.lastName || ''}`.trim() : null
                } catch (e) {
                    // Ignore parse errors
                }
            }

            // Find or create user in Payload
            const payloadInstance = req.payload

            // Check if user exists with this Apple ID
            let user = await payloadInstance.find({
                collection: 'users',
                where: { appleId: { equals: appleUserId } },
                limit: 1,
            }).then(res => res.docs[0])

            // If not found by Apple ID, check by email
            if (!user && email) {
                user = await payloadInstance.find({
                    collection: 'users',
                    where: { email: { equals: email } },
                    limit: 1,
                }).then(res => res.docs[0])

                // Link Apple ID to existing user
                if (user) {
                    await payloadInstance.update({
                        collection: 'users',
                        id: user.id,
                        data: { appleId: appleUserId } as any,
                    })
                }
            }

            // Create new user if doesn't exist
            if (!user) {
                user = await payloadInstance.create({
                    collection: 'users',
                    data: {
                        email: email || `apple_${appleUserId}@privaterelay.appleid.com`,
                        name: userName || email?.split('@')[0] || 'Apple User',
                        appleId: appleUserId,
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

            return Response.redirect(redirectUrl.toString())
        } catch (err) {
            console.error('Apple OAuth error:', err)
            return Response.redirect(`${FRONTEND_URL}/login?error=oauth_failed`)
        }
    },
}

export const oauthEndpoints: Endpoint[] = [
    googleOAuthStart,
    googleOAuthCallback,
    appleOAuthStart,
    appleOAuthCallback,
]
