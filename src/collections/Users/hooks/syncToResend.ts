import type { CollectionAfterChangeHook } from 'payload'

const RESEND_API_KEY = process.env.RESEND_API_KEY || ''

interface ResendContactCreate {
  email: string
  first_name?: string
  last_name?: string
  unsubscribed?: boolean
}

/**
 * Sync user marketing opt-in status to Resend Contacts
 * Uses the new Resend API (no audience ID required)
 * - Adds contact when marketingOptIn becomes true
 * - Updates contact to unsubscribed when marketingOptIn becomes false
 */
export const syncToResendAudience: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  operation,
  req,
}) => {
  // Skip if no API key configured
  if (!RESEND_API_KEY) {
    return doc
  }

  const currentOptIn = doc.privacyConsent?.marketingOptIn
  const previousOptIn = previousDoc?.privacyConsent?.marketingOptIn

  // Only sync when marketingOptIn changes or on create with optIn
  const shouldSync =
    (operation === 'create' && currentOptIn) ||
    (operation === 'update' && currentOptIn !== previousOptIn)

  if (!shouldSync) {
    return doc
  }

  // Parse name into first/last
  const nameParts = doc.name?.split(' ') || []
  const firstName = nameParts[0] || undefined
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : undefined

  try {
    if (currentOptIn) {
      // Add to contacts (new API - no audience ID needed)
      const response = await fetch('https://api.resend.com/contacts', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: doc.email,
          first_name: firstName,
          last_name: lastName,
          unsubscribed: false,
        } as ResendContactCreate),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Resend API error: ${response.status} - ${errorText}`)
      }

      req.payload.logger.info(`[Resend] Added ${doc.email} to contacts`)
    } else {
      // Update contact to unsubscribed (by email)
      const response = await fetch('https://api.resend.com/contacts', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: doc.email,
          unsubscribed: true,
        }),
      })

      // 404 is okay - contact may not exist
      if (!response.ok && response.status !== 404) {
        const errorText = await response.text()
        throw new Error(`Resend API error: ${response.status} - ${errorText}`)
      }

      req.payload.logger.info(`[Resend] Unsubscribed ${doc.email} from marketing`)
    }
  } catch (error) {
    // Don't fail the user operation if Resend sync fails
    req.payload.logger.error(
      `[Resend] Failed to sync ${doc.email}: ${error instanceof Error ? error.message : String(error)}`,
    )
  }

  return doc
}
