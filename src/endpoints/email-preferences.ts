/**
 * Email Preferences Endpoint
 *
 * Allows users to manage their email preferences.
 * Supports:
 * - GET: Retrieve current preferences (requires auth OR unsubscribe token)
 * - PATCH: Update preferences (requires auth OR unsubscribe token)
 * - POST with action=unsubscribe-all: One-click unsubscribe from all emails
 *
 * Usage:
 * - Authenticated: GET /api/email-preferences
 * - Unsubscribe link: GET /api/email-preferences?token=abc123
 * - Update: PATCH /api/email-preferences with { weeklyDigest: false, ... }
 */

import type { PayloadHandler } from 'payload'
import crypto from 'crypto'

// Email preference types
interface EmailPreferences {
  weeklyDigest: boolean
  productAlerts: boolean
  badgeUnlocks: boolean
  streakReminders: boolean
  regulatoryUpdates: boolean
  communityHighlights: boolean
}

const DEFAULT_PREFERENCES: EmailPreferences = {
  weeklyDigest: true,
  productAlerts: true,
  badgeUnlocks: true,
  streakReminders: true,
  regulatoryUpdates: false,
  communityHighlights: false,
}

/**
 * Generate a unique unsubscribe token for a user
 */
export function generateUnsubscribeToken(userId: string | number, email: string): string {
  const secret = process.env.PAYLOAD_SECRET || 'fallback-secret'
  const data = `${userId}-${email}-unsubscribe`
  return crypto.createHmac('sha256', secret).update(data).digest('hex').substring(0, 32)
}

/**
 * Verify an unsubscribe token
 */
async function findUserByUnsubscribeToken(
  payload: any,
  token: string
): Promise<any | null> {
  // Find user with matching token
  const users = await payload.find({
    collection: 'users',
    where: { emailUnsubscribeToken: { equals: token } },
    limit: 1,
  })

  return users.docs[0] || null
}

/**
 * Main handler for email preferences
 */
export const emailPreferencesHandler: PayloadHandler = async (req) => {
  const { payload, user } = req

  try {
    // Parse URL for token parameter
    const url = new URL(req.url || '', `http://${req.headers.get('host') || 'localhost'}`)
    const token = url.searchParams.get('token')

    let targetUser: any = null

    // Determine which user we're operating on
    if (token) {
      // Token-based access (for unsubscribe links)
      targetUser = await findUserByUnsubscribeToken(payload, token)
      if (!targetUser) {
        return Response.json(
          { error: 'Invalid or expired unsubscribe token' },
          { status: 401 }
        )
      }
    } else if (user) {
      // Authenticated access
      targetUser = user
    } else {
      return Response.json(
        { error: 'Authentication required. Provide auth token or unsubscribe token.' },
        { status: 401 }
      )
    }

    // Handle different HTTP methods
    const method = req.method?.toUpperCase()

    if (method === 'GET') {
      // Return current preferences
      const preferences = targetUser.emailPreferences || DEFAULT_PREFERENCES
      return Response.json({
        email: maskEmail(targetUser.email),
        preferences,
        marketingOptIn: targetUser.privacyConsent?.marketingOptIn || false,
      })
    }

    if (method === 'PATCH' || method === 'POST') {
      const body = await req.json?.() || {}

      // Handle one-click unsubscribe all
      if (body.action === 'unsubscribe-all') {
        await payload.update({
          collection: 'users',
          id: targetUser.id,
          data: {
            emailPreferences: {
              weeklyDigest: false,
              productAlerts: false,
              badgeUnlocks: false,
              streakReminders: false,
              regulatoryUpdates: false,
              communityHighlights: false,
            },
            privacyConsent: {
              ...targetUser.privacyConsent,
              marketingOptIn: false,
            },
          } as any, // Type will match after payload-types regeneration
        })

        return Response.json({
          success: true,
          message: 'You have been unsubscribed from all emails',
        })
      }

      // Update specific preferences
      const updatedPreferences: Partial<EmailPreferences> = {}
      const validKeys = Object.keys(DEFAULT_PREFERENCES)

      for (const key of validKeys) {
        if (typeof body[key] === 'boolean') {
          updatedPreferences[key as keyof EmailPreferences] = body[key]
        }
      }

      // Merge with existing preferences
      const currentPreferences = targetUser.emailPreferences || DEFAULT_PREFERENCES
      const newPreferences = { ...currentPreferences, ...updatedPreferences }

      await payload.update({
        collection: 'users',
        id: targetUser.id,
        data: {
          emailPreferences: newPreferences,
          // Also update marketing opt-in based on any email being enabled
          privacyConsent: {
            ...targetUser.privacyConsent,
            marketingOptIn: Object.values(newPreferences).some(v => v),
          },
        } as any, // Type will match after payload-types regeneration
      })

      return Response.json({
        success: true,
        preferences: newPreferences,
      })
    }

    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  } catch (error) {
    console.error('[Email Preferences] Error:', error)
    return Response.json(
      { error: 'Failed to process request' },
      { status: 500 }
    )
  }
}

/**
 * Mask email for privacy (show first 2 chars and domain)
 */
function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!domain) return '***@***'
  const maskedLocal = local.substring(0, 2) + '***'
  return `${maskedLocal}@${domain}`
}

/**
 * Endpoint configuration for Payload
 */
export const emailPreferencesEndpoint = {
  path: '/email-preferences',
  method: 'get' as const,
  handler: emailPreferencesHandler,
}

export const emailPreferencesUpdateEndpoint = {
  path: '/email-preferences',
  method: 'patch' as const,
  handler: emailPreferencesHandler,
}

export const emailPreferencesUnsubscribeEndpoint = {
  path: '/email-preferences',
  method: 'post' as const,
  handler: emailPreferencesHandler,
}
