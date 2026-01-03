import { PayloadHandler } from 'payload'

/**
 * User Data Export Endpoint (GDPR Article 20 / CCPA Compliance)
 *
 * GET /api/user/export-data
 *
 * Allows authenticated users to download all their personal data.
 * Returns a JSON file with all user-related data across collections.
 *
 * Data included:
 * - User profile information
 * - Device fingerprints (privacy relevant)
 * - Product unlocks history
 * - Saved products and articles
 * - Watchlist categories
 * - Ingredient watchlist
 * - Consent records
 */
export const userDataExportHandler: PayloadHandler = async (req) => {
  try {
    // Require authentication
    const user = req.user as { id: number; email: string; name?: string } | undefined

    if (!user) {
      return Response.json(
        { error: 'Authentication required. Please log in to export your data.' },
        { status: 401 }
      )
    }

    const userId = user.id

    // Fetch all user data
    const [
      userProfile,
      deviceFingerprints,
      productUnlocks,
    ] = await Promise.all([
      // Full user profile
      req.payload.findByID({
        collection: 'users',
        id: userId,
        depth: 2, // Include related data
      }),

      // Device fingerprints (privacy-relevant)
      req.payload.find({
        collection: 'device-fingerprints' as 'users',
        where: { user: { equals: userId } },
        limit: 100,
      }),

      // Product unlock history
      req.payload.find({
        collection: 'product-unlocks' as 'users',
        where: { user: { equals: userId } },
        limit: 1000,
        depth: 1, // Include product names
      }),
    ])

    // Build export data structure
    const exportData = {
      exportDate: new Date().toISOString(),
      exportVersion: '1.0',
      dataController: 'The Product Report',
      dataControllerContact: 'privacy@theproductreport.org',

      // User Profile
      profile: {
        id: userProfile.id,
        email: (userProfile as any).email,
        name: (userProfile as any).name,
        role: (userProfile as any).role,
        createdAt: (userProfile as any).createdAt,
        updatedAt: (userProfile as any).updatedAt,
      },

      // Subscription Status
      subscription: {
        status: (userProfile as any).subscriptionStatus,
        memberState: (userProfile as any).memberState,
        trialStartDate: (userProfile as any).trialStartDate,
        trialEndDate: (userProfile as any).trialEndDate,
        stripeCustomerId: (userProfile as any).stripeCustomerId ? '[REDACTED]' : null,
        stripeSubscriptionId: (userProfile as any).stripeSubscriptionId ? '[REDACTED]' : null,
      },

      // OAuth Connections (IDs only, not tokens)
      oauthConnections: {
        google: (userProfile as any).googleId ? 'Connected' : 'Not connected',
        apple: (userProfile as any).appleId ? 'Connected' : 'Not connected',
      },

      // Privacy & Consent Records
      privacyConsent: (userProfile as any).privacyConsent || {},

      // Saved Content
      savedContent: {
        savedProductIds: (userProfile as any).savedProductIds || [],
        savedArticleIds: (userProfile as any).savedArticleIds || [],
        watchlistCategories: (userProfile as any).watchlistCategories || [],
        ingredientWatchlist: (userProfile as any).ingredientWatchlist || [],
      },

      // Email Preferences
      emailPreferences: {
        weeklyDigestEnabled: (userProfile as any).weeklyDigestEnabled,
        marketingOptIn: (userProfile as any).privacyConsent?.marketingOptIn,
      },

      // Product Unlocks (engagement data)
      productUnlocks: {
        totalUnlocks: (userProfile as any).totalUnlocks || 0,
        freeUnlockCredits: (userProfile as any).freeUnlockCredits,
        unlockedProducts: (userProfile as any).unlockedProducts || [],
        unlockHistory: productUnlocks.docs.map((unlock: any) => ({
          productId: typeof unlock.product === 'object' ? unlock.product?.id : unlock.product,
          productName: typeof unlock.product === 'object' ? unlock.product?.name : 'Unknown',
          unlockType: unlock.unlockType,
          unlockedAt: unlock.unlockedAt,
        })),
      },

      // Device Information (for transparency)
      devices: deviceFingerprints.docs.map((fp: any) => ({
        id: fp.id,
        deviceType: fp.deviceType,
        browser: fp.browser,
        os: fp.os,
        firstSeenAt: fp.firstSeenAt,
        lastSeenAt: fp.lastSeenAt,
        // Note: fingerprintHash is a privacy identifier, not exposed
      })),

      // Data Retention Notice
      dataRetentionPolicy: {
        accountData: 'Deleted immediately upon account deletion request',
        deviceFingerprints: 'Deleted upon account deletion',
        productUnlocks: 'Anonymized upon account deletion (user reference removed)',
        auditLogs: 'Retained for 2 years for legal compliance',
      },

      // Rights Information
      yourRights: {
        rightToAccess: 'You have received this data export',
        rightToRectification: 'Update your profile at /account/settings',
        rightToErasure: 'Delete your account at /account/delete',
        rightToDataPortability: 'This export is in machine-readable JSON format',
        rightToObject: 'Manage email preferences at /account/settings',
        rightToWithdrawConsent: 'Update privacy settings at /account/privacy',
      },
    }

    // Return as downloadable JSON
    const filename = `theproductreport-data-export-${new Date().toISOString().split('T')[0]}.json`

    return new Response(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('[User Data Export] Error:', error)
    return Response.json(
      { error: 'Failed to export user data. Please try again or contact support.' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/user/delete-account
 *
 * Self-service account deletion endpoint.
 * This is handled by Payload's built-in delete with our hooks,
 * but this endpoint provides a cleaner interface for mobile/web apps.
 */
export const userDeleteAccountHandler: PayloadHandler = async (req) => {
  try {
    const user = req.user as { id: number; email: string } | undefined

    if (!user) {
      return Response.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Parse confirmation
    const body = await req.json?.() || {}
    const { confirmEmail } = body

    if (confirmEmail !== user.email) {
      return Response.json(
        { error: 'Email confirmation does not match. Please enter your email to confirm deletion.' },
        { status: 400 }
      )
    }

    // Delete user (this triggers our beforeDelete and afterDelete hooks)
    await req.payload.delete({
      collection: 'users',
      id: user.id,
    })

    return Response.json({
      success: true,
      message: 'Your account has been deleted. All personal data has been removed or anonymized.',
    })
  } catch (error) {
    console.error('[User Delete Account] Error:', error)
    return Response.json(
      { error: 'Failed to delete account. Please contact support.' },
      { status: 500 }
    )
  }
}
