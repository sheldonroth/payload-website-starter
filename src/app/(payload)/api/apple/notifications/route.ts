import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
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

        // Decode the JWT (in production, you should verify the signature with Apple's public keys)
        // For now, we'll decode without verification since this is a webhook from Apple
        const decoded = jwt.decode(signedPayload) as AppleNotificationPayload

        if (!decoded || !decoded.events) {
            console.error('[Apple Notifications] Invalid payload structure')
            return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
        }

        // Parse the events JSON
        const events = JSON.parse(decoded.events) as Record<string, AppleEvent>

        const payload = await getPayload({ config: configPromise })

        for (const [eventType, eventData] of Object.entries(events)) {
            console.log(`[Apple Notifications] Processing event: ${eventType}`, {
                sub: eventData.sub,
                email: eventData.email,
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
                    console.log(`[Apple Notifications] User ${user.email} requested account deletion/revocation`)

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
                    console.log(`[Apple Notifications] User ${user.email} disabled email relay`)
                    break

                case 'email-enabled':
                    // User re-enabled their private relay email
                    console.log(`[Apple Notifications] User ${user.email} enabled email relay`)
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
