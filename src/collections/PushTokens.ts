/**
 * PushTokens Collection
 *
 * Stores Expo push tokens for sending notifications to mobile devices.
 * Tokens are associated with device fingerprints for anonymous user tracking.
 *
 * Security: Validates token format and limits tokens per fingerprint.
 */

import type { CollectionConfig } from 'payload'

// Maximum tokens per fingerprint (prevents spam)
const MAX_TOKENS_PER_FINGERPRINT = 5

export const PushTokens: CollectionConfig = {
  slug: 'push-tokens',
  labels: {
    singular: 'Push Token',
    plural: 'Push Tokens',
  },
  admin: {
    group: 'Mobile',
    useAsTitle: 'token',
    description: 'Expo push notification tokens for mobile devices',
    defaultColumns: ['token', 'platform', 'fingerprintHash', 'createdAt'],
  },
  access: {
    // Security: Restrict access to prevent token hijacking
    // Read: Only admins or authenticated API calls with API key
    read: ({ req }) => {
      // Admin users can read all
      if ((req.user as { role?: string })?.role === 'admin') return true
      // API calls with secret key (for backend services)
      const apiKey = req.headers.get('x-api-key')
      const expectedKey = process.env.PAYLOAD_API_SECRET
      if (apiKey && expectedKey && apiKey === expectedKey) return true
      return false
    },
    // Create: Only via API key (mobile app backend)
    create: ({ req }) => {
      const apiKey = req.headers.get('x-api-key')
      const expectedKey = process.env.PAYLOAD_API_SECRET
      if (apiKey && expectedKey && apiKey === expectedKey) return true
      // Admin can also create for testing
      if ((req.user as { role?: string })?.role === 'admin') return true
      return false
    },
    // Update: Only via API key or admin
    update: ({ req }) => {
      const apiKey = req.headers.get('x-api-key')
      const expectedKey = process.env.PAYLOAD_API_SECRET
      if (apiKey && expectedKey && apiKey === expectedKey) return true
      if ((req.user as { role?: string })?.role === 'admin') return true
      return false
    },
    delete: ({ req }) => (req.user as { role?: string })?.role === 'admin',
  },
  hooks: {
    beforeChange: [
      async ({ data, operation, req }) => {
        // Validate token format
        if (data?.token && !data.token.startsWith('ExponentPushToken[')) {
          throw new Error('Invalid push token format. Must be an Expo push token.')
        }

        // On create, validate fingerprint and check limits
        if (operation === 'create') {
          if (!data?.fingerprintHash) {
            throw new Error('fingerprintHash is required for push token registration')
          }

          // Check token count per fingerprint to prevent spam
          const existingTokens = await req.payload.find({
            collection: 'push-tokens',
            where: { fingerprintHash: { equals: data.fingerprintHash } },
            limit: MAX_TOKENS_PER_FINGERPRINT + 1,
          })

          if (existingTokens.docs.length >= MAX_TOKENS_PER_FINGERPRINT) {
            // Delete oldest token to make room for new one
            const oldestToken = existingTokens.docs[existingTokens.docs.length - 1]
            await req.payload.delete({
              collection: 'push-tokens',
              id: oldestToken.id,
            })
          }
        }

        return data
      },
    ],
  },
  fields: [
    {
      name: 'token',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        description: 'Expo push token (ExponentPushToken[...])',
      },
    },
    {
      name: 'fingerprintHash',
      type: 'text',
      index: true,
      admin: {
        description: 'Device fingerprint hash for anonymous user tracking',
      },
    },
    {
      name: 'platform',
      type: 'select',
      options: [
        { label: 'iOS', value: 'ios' },
        { label: 'Android', value: 'android' },
      ],
      defaultValue: 'ios',
    },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Whether this token is still valid for sending notifications',
      },
    },
    {
      name: 'lastUsed',
      type: 'date',
      admin: {
        description: 'Last time a notification was sent to this token',
      },
    },
    {
      name: 'lastActiveAt',
      type: 'date',
      index: true,
      admin: {
        description: 'Last time the user opened the app (for win-back targeting)',
      },
    },
    {
      name: 'lastWinbackNotification',
      type: 'date',
      index: true,
      admin: {
        description: 'Last time a win-back notification was sent (for cooldown)',
      },
    },
    {
      name: 'failureCount',
      type: 'number',
      defaultValue: 0,
      admin: {
        description: 'Number of consecutive failed notification attempts',
      },
    },
    // Product notification subscriptions
    {
      name: 'productSubscriptions',
      type: 'array',
      admin: {
        description: 'Products this device wants to be notified about when testing completes',
      },
      fields: [
        {
          name: 'barcode',
          type: 'text',
          required: true,
        },
        {
          name: 'subscribedAt',
          type: 'date',
          defaultValue: () => new Date().toISOString(),
        },
        {
          name: 'notified',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description: 'Whether the user has been notified about this product',
          },
        },
      ],
    },
  ],
  timestamps: true,
}
