/**
 * Email Sends Collection
 *
 * Tracks all sent emails for analytics and A/B test results.
 * Enhanced with filtering, sorting, and performance metrics.
 */

import { CollectionConfig } from 'payload'

export const EmailSends: CollectionConfig = {
  slug: 'email-sends',
  labels: {
    singular: 'Email Send',
    plural: 'Email Sends',
  },
  admin: {
    useAsTitle: 'subject',
    defaultColumns: ['recipient', 'subject', 'status', 'abVariant', 'sentAt', 'openedAt'],
    group: 'Growth',
    description: 'Complete log of all sent emails with open/click tracking and A/B test results',
    listSearchableFields: ['recipient', 'subject', 'messageId'],
    pagination: {
      defaultLimit: 50,
      limits: [25, 50, 100, 250],
    },
  },
  access: {
    read: ({ req: { user } }) => !!user,
    create: () => true, // System creates these
    update: () => true, // Webhooks update these
    delete: ({ req: { user } }) => !!user,
  },
  fields: [
    // Core email data
    {
      type: 'row',
      fields: [
        {
          name: 'template',
          type: 'relationship',
          relationTo: 'email-templates' as any,
          required: true,
          admin: {
            width: '50%',
          },
        },
        {
          name: 'recipient',
          type: 'email',
          required: true,
          index: true,
          admin: {
            width: '50%',
          },
        },
      ],
    },
    {
      name: 'subject',
      type: 'text',
      required: true,
      admin: {
        description: 'The actual subject line sent (after A/B variant selection)',
      },
    },

    // Status and tracking
    {
      type: 'row',
      fields: [
        {
          name: 'status',
          type: 'select',
          options: [
            { label: '📤 Sent', value: 'sent' },
            { label: '📬 Delivered', value: 'delivered' },
            { label: '👁️ Opened', value: 'opened' },
            { label: '👆 Clicked', value: 'clicked' },
            { label: '🔄 Bounced', value: 'bounced' },
            { label: '⚠️ Complained', value: 'complained' },
          ],
          defaultValue: 'sent',
          admin: {
            width: '33%',
          },
        },
        {
          name: 'abVariant',
          type: 'select',
          options: [
            { label: 'A (Control)', value: 'A' },
            { label: 'B (Variant)', value: 'B' },
          ],
          defaultValue: 'A',
          admin: {
            width: '33%',
            description: 'Which subject line variant was sent',
          },
        },
        {
          name: 'messageId',
          type: 'text',
          index: true,
          admin: {
            width: '33%',
            description: 'Resend message ID for tracking',
            readOnly: true,
          },
        },
      ],
    },

    // Timestamps
    {
      type: 'row',
      fields: [
        {
          name: 'sentAt',
          type: 'date',
          required: true,
          admin: {
            width: '33%',
            date: {
              pickerAppearance: 'dayAndTime',
            },
          },
        },
        {
          name: 'openedAt',
          type: 'date',
          admin: {
            width: '33%',
            date: {
              pickerAppearance: 'dayAndTime',
            },
          },
        },
        {
          name: 'clickedAt',
          type: 'date',
          admin: {
            width: '33%',
            date: {
              pickerAppearance: 'dayAndTime',
            },
          },
        },
      ],
    },

    // Click data
    {
      name: 'clickedUrl',
      type: 'text',
      admin: {
        description: 'The URL that was clicked (if any)',
        condition: (data) => !!data.clickedAt,
      },
    },

    // User agent for analytics
    {
      name: 'userAgent',
      type: 'text',
      admin: {
        description: 'Email client user agent',
        condition: (data) => !!data.openedAt,
        readOnly: true,
      },
    },

    // Derived metrics (for quick filtering)
    {
      name: 'timeToOpen',
      type: 'number',
      admin: {
        description: 'Seconds from send to open',
        readOnly: true,
        condition: (data) => !!data.openedAt,
      },
    },
  ],
  hooks: {
    beforeChange: [
      async ({ data, operation }) => {
        // Calculate time to open
        if (data.openedAt && data.sentAt && !data.timeToOpen) {
          const sentTime = new Date(data.sentAt).getTime()
          const openTime = new Date(data.openedAt).getTime()
          data.timeToOpen = Math.round((openTime - sentTime) / 1000)
        }
        return data
      },
    ],
  },
  timestamps: true,
}

export default EmailSends
