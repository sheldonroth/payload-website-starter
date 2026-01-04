/**
 * PushTokens Collection
 *
 * Stores Expo push tokens for sending notifications to mobile devices.
 * Tokens are associated with device fingerprints for anonymous user tracking.
 */

import type { CollectionConfig } from 'payload'

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
    // Only backend can manage tokens
    read: () => true,
    create: () => true,
    update: () => true,
    delete: ({ req }) => !!req.user,
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
