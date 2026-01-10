import type { Endpoint } from 'payload'
import jwt from 'jsonwebtoken'
import * as jose from 'jose'
import { checkRateLimitAsync, rateLimitResponse, getRateLimitKey, RateLimits } from '../utilities/rate-limiter'

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

// SECURITY: OAuth state parameter for CSRF protection
function generateOAuthState(): string {
    const array = new Uint8Array(32)
    crypto.getRandomValues(array)
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
}

function getStateCookieOptions(isProduction: boolean): string {
    return [
        'HttpOnly',
        isProduction ? 'Secure' : '',
        'SameSite=Lax',
        'Path=/',
        'Max-Age=600', // 10 minutes - enough for OAuth flow
    ].filter(Boolean).join('; ')
}

function getStateFromCookies(cookieHeader: string | null, cookieName: string): string | null {
    if (!cookieHeader) return null
    const cookies = cookieHeader.split(';').map(c => c.trim())
    for (const cookie of cookies) {
        const [name, value] = cookie.split('=')
        if (name === cookieName) return value
    }
    return null
}

// SECURITY: Verify Apple ID token signature using Apple's public keys
// This prevents accepting forged tokens
async function verifyAppleIdToken(idToken: string): Promise<{
    sub: string
    email?: string
    email_verified?: boolean
} | null> {
    try {
        // Fetch Apple's public keys (JWKS)
        const JWKS = jose.createRemoteJWKSet(
            new URL('https://appleid.apple.com/auth/keys')
        )

        // Verify the token signature and claims
        const { payload } = await jose.jwtVerify(idToken, JWKS, {
            issuer: 'https://appleid.apple.com',
            audience: process.env.APPLE_CLIENT_ID,
        })

        return {
            sub: payload.sub as string,
            email: payload.email as string | undefined,
            email_verified: payload.email_verified as boolean | undefined,
        }
    } catch (error) {
        console.error('[OAuth] Apple token verification failed:', error)
        return null
    }
}

// Helper to create a session token for the user
async function createSessionToken(userId: string, email: string): Promise<string> {
    const payload = {
        id: userId,
        email: email,
        collection: 'users',
    }

    // SECURITY: Require PAYLOAD_SECRET - never use fallback
    const secret = process.env.PAYLOAD_SECRET
    if (!secret) {
        throw new Error('PAYLOAD_SECRET environment variable is required for JWT signing')
    }

    return jwt.sign(payload, secret, {
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

        // SECURITY: Generate state for CSRF protection
        const state = generateOAuthState()
        const isProduction = process.env.NODE_ENV === 'production'

        const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
        authUrl.searchParams.set('client_id', googleClientId)
        authUrl.searchParams.set('redirect_uri', redirectUri)
        authUrl.searchParams.set('response_type', 'code')
        authUrl.searchParams.set('scope', scope)
        authUrl.searchParams.set('access_type', 'offline')
        authUrl.searchParams.set('prompt', 'consent')
        authUrl.searchParams.set('state', state)

        // Store state in HttpOnly cookie for verification in callback
        return new Response(null, {
            status: 302,
            headers: {
                'Location': authUrl.toString(),
                'Set-Cookie': `oauth_state_google=${state}; ${getStateCookieOptions(isProduction)}`,
            },
        })
    },
}

// Google OAuth Callback
const googleOAuthCallback: Endpoint = {
    path: '/users/oauth/google/callback',
    method: 'get',
    handler: async (req) => {
        // SECURITY: Rate limit OAuth callbacks to prevent brute force attacks
        const rateLimitKey = getRateLimitKey(req as unknown as Request)
        const rateLimit = await checkRateLimitAsync(rateLimitKey, RateLimits.LOGIN)
        if (!rateLimit.allowed) {
            return Response.redirect(`${FRONTEND_URL}/login?error=rate_limited`)
        }

        const url = new URL(req.url || '', 'http://localhost')
        const code = url.searchParams.get('code')
        const error = url.searchParams.get('error')
        const stateFromUrl = url.searchParams.get('state')

        // SECURITY: Verify state parameter to prevent CSRF attacks
        const cookieHeader = req.headers.get('cookie')
        const stateFromCookie = getStateFromCookies(cookieHeader, 'oauth_state_google')

        if (!stateFromUrl || !stateFromCookie || stateFromUrl !== stateFromCookie) {
            console.error('[OAuth] State mismatch - possible CSRF attack')
            return Response.redirect(`${FRONTEND_URL}/login?error=invalid_state`)
        }

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

            // SECURITY: Set token in HttpOnly cookie instead of URL parameter
            // This prevents token exposure in browser history, server logs, and referer headers
            const redirectUrl = new URL(`${FRONTEND_URL}/auth/callback`)

            const isProduction = process.env.NODE_ENV === 'production'
            const tokenCookie = [
                `payload-token=${token}`,
                'HttpOnly',
                isProduction ? 'Secure' : '',
                'SameSite=Lax',
                'Path=/',
                'Max-Age=604800', // 7 days
            ].filter(Boolean).join('; ')

            // Clear the state cookie after successful validation
            const clearStateCookie = `oauth_state_google=; HttpOnly; ${isProduction ? 'Secure; ' : ''}SameSite=Lax; Path=/; Max-Age=0`

            return new Response(null, {
                status: 302,
                headers: [
                    ['Location', redirectUrl.toString()],
                    ['Set-Cookie', tokenCookie],
                    ['Set-Cookie', clearStateCookie],
                ],
            })
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

        // SECURITY: Generate state for CSRF protection
        const state = generateOAuthState()
        const isProduction = process.env.NODE_ENV === 'production'

        const authUrl = new URL('https://appleid.apple.com/auth/authorize')
        authUrl.searchParams.set('client_id', appleClientId)
        authUrl.searchParams.set('redirect_uri', redirectUri)
        authUrl.searchParams.set('response_type', 'code id_token')
        authUrl.searchParams.set('response_mode', 'form_post')
        authUrl.searchParams.set('scope', scope)
        authUrl.searchParams.set('state', state)

        // Store state in HttpOnly cookie for verification in callback
        return new Response(null, {
            status: 302,
            headers: {
                'Location': authUrl.toString(),
                'Set-Cookie': `oauth_state_apple=${state}; ${getStateCookieOptions(isProduction)}`,
            },
        })
    },
}

// Apple OAuth Callback (POST because Apple uses form_post)
const appleOAuthCallback: Endpoint = {
    path: '/users/oauth/apple/callback',
    method: 'post',
    handler: async (req) => {
        // SECURITY: Rate limit OAuth callbacks to prevent brute force attacks
        const rateLimitKey = getRateLimitKey(req as unknown as Request)
        const rateLimit = await checkRateLimitAsync(rateLimitKey, RateLimits.LOGIN)
        if (!rateLimit.allowed) {
            return Response.redirect(`${FRONTEND_URL}/login?error=rate_limited`)
        }

        try {
            const body = req.text ? await req.text() : ''
            const params = new URLSearchParams(body)

            const idToken = params.get('id_token')
            const code = params.get('code')
            const error = params.get('error')
            const userString = params.get('user') // Apple sends user info on first login
            const stateFromBody = params.get('state')

            // SECURITY: Verify state parameter to prevent CSRF attacks
            const cookieHeader = req.headers.get('cookie')
            const stateFromCookie = getStateFromCookies(cookieHeader, 'oauth_state_apple')

            if (!stateFromBody || !stateFromCookie || stateFromBody !== stateFromCookie) {
                console.error('[OAuth] Apple state mismatch - possible CSRF attack')
                return Response.redirect(`${FRONTEND_URL}/login?error=invalid_state`)
            }

            if (error) {
                return Response.redirect(`${FRONTEND_URL}/login?error=apple_auth_failed`)
            }

            if (!idToken) {
                return Response.redirect(`${FRONTEND_URL}/login?error=no_token`)
            }

            // SECURITY: Verify Apple ID token signature against Apple's public keys
            const verifiedPayload = await verifyAppleIdToken(idToken)
            if (!verifiedPayload) {
                console.error('[OAuth] Apple token verification failed - rejecting login')
                return Response.redirect(`${FRONTEND_URL}/login?error=token_verification_failed`)
            }

            const appleUserId = verifiedPayload.sub
            const email = verifiedPayload.email

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

            // SECURITY: Set token in HttpOnly cookie instead of URL parameter
            const redirectUrl = new URL(`${FRONTEND_URL}/auth/callback`)

            const isProduction = process.env.NODE_ENV === 'production'
            const tokenCookie = [
                `payload-token=${token}`,
                'HttpOnly',
                isProduction ? 'Secure' : '',
                'SameSite=Lax',
                'Path=/',
                'Max-Age=604800', // 7 days
            ].filter(Boolean).join('; ')

            // Clear the state cookie after successful validation
            const clearStateCookie = `oauth_state_apple=; HttpOnly; ${isProduction ? 'Secure; ' : ''}SameSite=Lax; Path=/; Max-Age=0`

            return new Response(null, {
                status: 302,
                headers: [
                    ['Location', redirectUrl.toString()],
                    ['Set-Cookie', tokenCookie],
                    ['Set-Cookie', clearStateCookie],
                ],
            })
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
