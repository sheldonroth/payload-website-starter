import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import jwt from 'jsonwebtoken'

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://www.theproductreport.org'

// Helper to create a session token for the user
async function createSessionToken(userId: string, email: string): Promise<string> {
    if (!process.env.PAYLOAD_SECRET) {
        throw new Error('PAYLOAD_SECRET environment variable is not set')
    }

    const tokenPayload = {
        id: userId,
        email: email,
        collection: 'users',
    }

    return jwt.sign(tokenPayload, process.env.PAYLOAD_SECRET, {
        expiresIn: '7d',
    })
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.text()
        const params = new URLSearchParams(body)

        const idToken = params.get('id_token')
        const error = params.get('error')
        const userString = params.get('user') // Apple sends user info on first login

        if (error) {
            return NextResponse.redirect(`${FRONTEND_URL}/login?error=apple_auth_failed`)
        }

        if (!idToken) {
            return NextResponse.redirect(`${FRONTEND_URL}/login?error=no_token`)
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

        // Get Payload instance
        const payload = await getPayload({ config: configPromise })

        // Check if user exists with this Apple ID
        let user = await payload.find({
            collection: 'users',
            where: { appleId: { equals: appleUserId } },
            limit: 1,
        }).then(res => res.docs[0])

        // If not found by Apple ID, check by email
        if (!user && email) {
            user = await payload.find({
                collection: 'users',
                where: { email: { equals: email } },
                limit: 1,
            }).then(res => res.docs[0])

            // Link Apple ID to existing user
            if (user) {
                await payload.update({
                    collection: 'users',
                    id: user.id,
                    data: { appleId: appleUserId } as any,
                })
            }
        }

        // Create new user if doesn't exist
        if (!user) {
            user = await payload.create({
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

        return NextResponse.redirect(redirectUrl.toString())
    } catch (err) {
        console.error('Apple OAuth error:', err)
        return NextResponse.redirect(`${FRONTEND_URL}/login?error=oauth_failed`)
    }
}
