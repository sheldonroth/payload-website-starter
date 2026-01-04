import type { CollectionAfterChangeHook } from 'payload'
import { renderWelcomeEmail, emailSubjects } from '../../../email'

/**
 * Send welcome email to newly created users
 * Triggered on user creation (signup, OAuth, etc.)
 */
export const sendWelcomeEmail: CollectionAfterChangeHook = async ({
  doc,
  operation,
  req,
}) => {
  // Only send on create, not update
  if (operation !== 'create') {
    return doc
  }

  // Skip if no email (shouldn't happen, but defensive)
  if (!doc.email) {
    return doc
  }

  try {
    const userName = doc.name || doc.email.split('@')[0]
    const html = await renderWelcomeEmail(userName)

    await req.payload.sendEmail({
      to: doc.email,
      subject: emailSubjects.welcome,
      html,
    })

    req.payload.logger.info(`[Welcome Email] Sent to ${doc.email}`)
  } catch (error) {
    // Don't fail user creation if email fails
    req.payload.logger.error(
      `[Welcome Email] Failed for ${doc.email}: ${error instanceof Error ? error.message : String(error)}`,
    )
  }

  return doc
}
