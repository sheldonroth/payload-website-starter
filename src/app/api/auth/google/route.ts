import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

export const dynamic = 'force-dynamic'

// Google's token info endpoint
const GOOGLE_TOKEN_INFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo'

interface GoogleUserInfo {
  sub: string // Google's unique user ID
  email: string
  email_verified: boolean
  name?: string
  given_name?: string
  family_name?: string
  picture?: string
}

/**
 * Verify Google access token and get user info
 */
async function verifyGoogleToken(accessToken: string): Promise<GoogleUserInfo | null> {
  try {
    const response = await fetch(GOOGLE_TOKEN_INFO_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      console.error('[Google Auth] Token verification failed:', response.status)
      return null
    }

    const userInfo = await response.json()
    return userInfo as GoogleUserInfo
  } catch (error) {
    console.error('[Google Auth] Token verification error:', error)
    return null
  }
}

/**
 * POST /api/auth/google
 * Handle Google Sign-In from mobile app
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { accessToken } = body

    if (!accessToken) {
      return NextResponse.json(
        { error: 'accessToken is required' },
        { status: 400 }
      )
    }

    // Verify the Google access token and get user info
    const googleUser = await verifyGoogleToken(accessToken)

    if (!googleUser) {
      return NextResponse.json(
        { error: 'Invalid or expired Google token' },
        { status: 401 }
      )
    }

    const googleUserId = googleUser.sub
    const email = googleUser.email
    const name = googleUser.name || googleUser.given_name || undefined

    if (!email) {
      return NextResponse.json(
        { error: 'Email not provided by Google' },
        { status: 400 }
      )
    }

    const payload = await getPayload({ config })

    // Try to find existing user by Google ID
    let existingUser = await payload.find({
      collection: 'users',
      where: {
        googleId: { equals: googleUserId },
      },
      limit: 1,
    })

    let payloadUser: any

    if (existingUser.docs.length > 0) {
      // User exists with Google ID
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
      existingUser = await payload.find({
        collection: 'users',
        where: {
          email: { equals: email },
        },
        limit: 1,
      })

      if (existingUser.docs.length > 0) {
        // Link Google ID to existing account
        payloadUser = existingUser.docs[0]
        await payload.update({
          collection: 'users',
          id: payloadUser.id,
          data: { googleId: googleUserId },
        })
      } else {
        // Create new user
        // Generate a random password (user won't need it for OAuth)
        const randomPassword = crypto.randomUUID() + crypto.randomUUID()

        payloadUser = await payload.create({
          collection: 'users',
          data: {
            email,
            password: randomPassword,
            name: name || 'Google User',
            googleId: googleUserId,
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

    // Generate JWT token for the user
    const jwt = await import('jsonwebtoken')
    const payloadSecret = process.env.PAYLOAD_SECRET

    if (!payloadSecret) {
      console.error('[Google Auth] PAYLOAD_SECRET not configured')
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
    console.error('[Google Auth] Error:', error)
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    )
  }
}
