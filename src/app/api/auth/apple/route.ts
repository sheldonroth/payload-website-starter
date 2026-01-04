import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import * as jose from 'jose'

export const dynamic = 'force-dynamic'

// Apple's public keys endpoint
const APPLE_KEYS_URL = 'https://appleid.apple.com/auth/keys'

// Your app's bundle ID (must match what's in App Store Connect)
const APPLE_BUNDLE_ID = 'com.productrank.app'

interface AppleTokenPayload {
  iss: string
  aud: string
  exp: number
  iat: number
  sub: string // Apple's unique user ID
  email?: string
  email_verified?: string | boolean
  is_private_email?: string | boolean
  auth_time: number
  nonce_supported: boolean
}

/**
 * Verify Apple identity token using Apple's public keys
 */
async function verifyAppleToken(identityToken: string): Promise<AppleTokenPayload | null> {
  try {
    // Fetch Apple's public keys
    const keysResponse = await fetch(APPLE_KEYS_URL)
    if (!keysResponse.ok) {
      console.error('[Apple Auth] Failed to fetch Apple keys')
      return null
    }

    const keys = await keysResponse.json()
    const JWKS = jose.createRemoteJWKSet(new URL(APPLE_KEYS_URL))

    // Verify the token
    const { payload } = await jose.jwtVerify(identityToken, JWKS, {
      issuer: 'https://appleid.apple.com',
      audience: APPLE_BUNDLE_ID,
    })

    return payload as unknown as AppleTokenPayload
  } catch (error) {
    console.error('[Apple Auth] Token verification failed:', error)
    return null
  }
}

/**
 * POST /api/auth/apple
 * Handle Apple Sign-In from mobile app
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { identityToken, authorizationCode, user } = body

    if (!identityToken) {
      return NextResponse.json(
        { error: 'identityToken is required' },
        { status: 400 }
      )
    }

    // Verify the Apple identity token
    const tokenPayload = await verifyAppleToken(identityToken)

    if (!tokenPayload) {
      return NextResponse.json(
        { error: 'Invalid or expired Apple token' },
        { status: 401 }
      )
    }

    const appleUserId = tokenPayload.sub
    // Apple only sends email on first sign-in, so we need to handle both cases
    const email = tokenPayload.email || user?.email
    const name = user?.name?.firstName
      ? `${user.name.firstName}${user.name.lastName ? ' ' + user.name.lastName : ''}`
      : undefined

    const payload = await getPayload({ config })

    // Try to find existing user by Apple ID
    let existingUser = await payload.find({
      collection: 'users',
      where: {
        appleId: { equals: appleUserId },
      },
      limit: 1,
    })

    let payloadUser: any

    if (existingUser.docs.length > 0) {
      // User exists, update if we have new info
      payloadUser = existingUser.docs[0]

      // Update name if we got it and user doesn't have one
      if (name && !payloadUser.name) {
        await payload.update({
          collection: 'users',
          id: payloadUser.id,
          data: { name },
        })
        payloadUser.name = name
      }
    } else {
      // Check if user exists with same email (linking accounts)
      if (email) {
        existingUser = await payload.find({
          collection: 'users',
          where: {
            email: { equals: email },
          },
          limit: 1,
        })

        if (existingUser.docs.length > 0) {
          // Link Apple ID to existing account
          payloadUser = existingUser.docs[0]
          await payload.update({
            collection: 'users',
            id: payloadUser.id,
            data: { appleId: appleUserId },
          })
        }
      }

      // Create new user if not found
      if (!payloadUser) {
        // Generate a unique email if Apple provided a private relay email or none
        const userEmail = email || `apple_${appleUserId}@privaterelay.appleid.com`

        // Generate a random password (user won't need it for OAuth)
        const randomPassword = crypto.randomUUID() + crypto.randomUUID()

        payloadUser = await payload.create({
          collection: 'users',
          data: {
            email: userEmail,
            password: randomPassword,
            name: name || 'Apple User',
            appleId: appleUserId,
            role: 'user',
            subscriptionStatus: 'free',
            memberState: 'virgin',
            freeUnlockCredits: 1,
            privacyConsent: {
              dataProcessingConsent: true,
              consentDate: new Date().toISOString(),
            },
          },
        })
      }
    }

    // Generate Payload JWT token for the user
    const token = await payload.auth({
      collection: 'users',
      token: true,
      // @ts-ignore - Payload internal method
      user: payloadUser,
    })

    // Create a login token manually
    const loginResult = await payload.login({
      collection: 'users',
      data: {
        email: payloadUser.email,
        // We use a workaround since we can't login with password
      },
      // Skip password check by using direct token generation
    }).catch(() => null)

    // Generate token directly using Payload's internal auth
    const { generatePayloadCookie } = await import('payload')

    // For OAuth, we need to generate a token without password
    // Use Payload's internal method to sign a JWT
    const jwt = await import('jsonwebtoken')
    const payloadSecret = process.env.PAYLOAD_SECRET

    if (!payloadSecret) {
      console.error('[Apple Auth] PAYLOAD_SECRET not configured')
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    const jwtToken = jwt.default.sign(
      {
        id: payloadUser.id,
        email: payloadUser.email,
        collection: 'users',
      },
      payloadSecret,
      {
        expiresIn: '7d',
      }
    )

    return NextResponse.json({
      success: true,
      token: jwtToken,
      user: {
        id: payloadUser.id,
        email: payloadUser.email,
        name: payloadUser.name,
        role: payloadUser.role,
        subscriptionStatus: payloadUser.subscriptionStatus,
      },
    })
  } catch (error) {
    console.error('[Apple Auth] Error:', error)
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    )
  }
}
