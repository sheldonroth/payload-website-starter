import { NextRequest, NextResponse } from 'next/server'
import jwt, { JwtHeader, SigningKeyCallback } from 'jsonwebtoken'
import jwksClient from 'jwks-rsa'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

/**
 * Apple Server-to-Server Notifications Endpoint
 *
 * Apple sends JWT-encoded notifications when:
 * - User deletes their Apple Account (account-delete)
 * - User stops using Sign in with Apple with your app (consent-revoked)
 * - User disables their email relay (email-disabled)
 * - User re-enables their email relay (email-enabled)
 *
 * Configure this URL in Apple Developer:
 * https://your-payload-url.com/api/apple/notifications
 */

interface AppleNotificationPayload {
    iss: string
    aud: string
    iat: number
    jti: string
    events: string // JSON string containing the event data
}

interface AppleEvent {
    type: 'email-disabled' | 'email-enabled' | 'consent-revoked' | 'account-delete'
    sub: string // Apple user ID
    email?: string
    is_private_email?: string
    event_time: number
}

// Apple's public keys for JWT verification
const APPLE_TOKEN_ISSUER = 'https://appleid.apple.com'
const APPLE_JWKS_URI = 'https://appleid.apple.com/auth/keys'

// JWKS client for fetching Apple's public keys
const client = jwksClient({
    jwksUri: APPLE_JWKS_URI,
    cache: true,
    cacheMaxEntries: 5,
    cacheMaxAge: 600000, // 10 minutes
})

// Get signing key from Apple's JWKS
function getAppleSigningKey(header: JwtHeader, callback: SigningKeyCallback) {
    if (!header.kid) {
        callback(new Error('No key ID in JWT header'))
        return
    }
    client.getSigningKey(header.kid, (err: Error | null, key: { getPublicKey: () => string } | undefined) => {
        if (err) {
            callback(err)
            return
        }
        const signingKey = key?.getPublicKey()
        callback(null, signingKey)
    })
}

// Verify JWT with Apple's public keys
async function verifyAppleJWT(token: string): Promise<AppleNotificationPayload> {
    return new Promise((resolve, reject) => {
        jwt.verify(
            token,
            getAppleSigningKey,
            {
                algorithms: ['RS256'],
                issuer: APPLE_TOKEN_ISSUER,
                audience: process.env.APPLE_CLIENT_ID || process.env.NEXT_PUBLIC_APPLE_CLIENT_ID,
            },
            (err, decoded) => {
                if (err) {
                    reject(err)
                } else {
                    resolve(decoded as AppleNotificationPayload)
                }
            }
        )
    })
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.text()

        // Apple sends the JWT in the 'payload' field of form data
        const formData = new URLSearchParams(body)
        const signedPayload = formData.get('payload')

        if (!signedPayload) {
            console.error('[Apple Notifications] No payload received')
            return NextResponse.json({ error: 'No payload' }, { status: 400 })
        }

        // Verify the JWT signature with Apple's public keys
        let decoded: AppleNotificationPayload
        try {
            decoded = await verifyAppleJWT(signedPayload)
        } catch (verifyError) {
            console.error('[Apple Notifications] JWT verification failed:', verifyError)
            return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
        }

        if (!decoded || !decoded.events) {
            console.error('[Apple Notifications] Invalid payload structure')
            return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
        }

        // Parse the events JSON safely
        let events: Record<string, AppleEvent>
        try {
            events = JSON.parse(decoded.events) as Record<string, AppleEvent>
        } catch (parseError) {
            console.error('[Apple Notifications] Failed to parse events JSON')
            return NextResponse.json({ error: 'Invalid events data' }, { status: 400 })
        }

        const payload = await getPayload({ config: configPromise })

        for (const [eventType, eventData] of Object.entries(events)) {
            console.log(`[Apple Notifications] Processing event: ${eventType}`, {
                sub: eventData.sub?.slice(0, 8) + '***',
                // Email masked for privacy
            })

            // Find user by Apple ID (stored in 'sub' field during OAuth)
            const existingUsers = await payload.find({
                collection: 'users',
                where: {
                    appleId: { equals: eventData.sub },
                },
                limit: 1,
            })

            const user = existingUsers.docs[0]

            if (!user) {
                console.log(`[Apple Notifications] No user found for Apple ID: ${eventData.sub}`)
                continue
            }

            switch (eventType) {
                case 'consent-revoked':
                case 'account-delete':
                    // User revoked consent or deleted Apple account
                    // You should mark the account for deletion or deactivate it
                    console.log(`[Apple Notifications] User ${user.id} requested account deletion/revocation`)

                    await payload.update({
                        collection: 'users',
                        id: user.id,
                        data: {
                            // Mark account for review/deletion
                            // You may want to add a 'deletionRequested' field to your users collection
                            appleConsentRevoked: true,
                            appleConsentRevokedAt: new Date().toISOString(),
                        } as any,
                    })
                    break

                case 'email-disabled':
                    // User disabled their private relay email
                    console.log(`[Apple Notifications] User ${user.id} disabled email relay`)
                    break

                case 'email-enabled':
                    // User re-enabled their private relay email
                    console.log(`[Apple Notifications] User ${user.id} enabled email relay`)
                    break

                default:
                    console.log(`[Apple Notifications] Unknown event type: ${eventType}`)
            }
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('[Apple Notifications] Error processing notification:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}

// Apple may send a GET request to verify the endpoint exists
export async function GET() {
    return NextResponse.json({ status: 'Apple notifications endpoint active' })
}
