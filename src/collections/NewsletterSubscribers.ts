/**
 * Newsletter Subscribers Collection
 *
 * Stores waitlist and newsletter signups from the website.
 * Primary source of truth for email collection before Resend audience sync.
 */

import { CollectionConfig } from 'payload'

export const NewsletterSubscribers: CollectionConfig = {
  slug: 'newsletter-subscribers',
  labels: {
    singular: 'Newsletter Subscriber',
    plural: 'Newsletter Subscribers',
  },
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'source', 'status', 'subscribedAt'],
    group: 'Growth',
    description: 'Waitlist and newsletter signups',
    listSearchableFields: ['email'],
    pagination: {
      defaultLimit: 50,
      limits: [25, 50, 100, 250],
    },
  },
  access: {
    // Admins can read all subscribers
    read: ({ req: { user } }) => !!user,
    // Public API can create (website form submissions)
    create: () => true,
    // Only admins can update/delete
    update: ({ req: { user } }) => {
      if ((user as { role?: string })?.role === 'admin') return true
      return false
    },
    delete: ({ req: { user } }) => {
      if ((user as { role?: string })?.role === 'admin') return true
      return false
    },
  },
  fields: [
    {
      name: 'email',
      type: 'email',
      required: true,
      unique: true,
      index: true,
    },
    {
      type: 'row',
      fields: [
        {
          name: 'status',
          type: 'select',
          options: [
            { label: 'Active', value: 'active' },
            { label: 'Unsubscribed', value: 'unsubscribed' },
            { label: 'Bounced', value: 'bounced' },
          ],
          defaultValue: 'active',
          required: true,
          admin: {
            width: '50%',
          },
        },
        {
          name: 'source',
          type: 'select',
          options: [
            { label: 'Website Waitlist', value: 'website_waitlist' },
            { label: 'Website Footer', value: 'website_footer' },
            { label: 'Founding Member Page', value: 'founding_member' },
            { label: 'Manual Import', value: 'manual' },
          ],
          defaultValue: 'website_waitlist',
          admin: {
            width: '50%',
          },
        },
      ],
    },
    {
      name: 'subscribedAt',
      type: 'date',
      required: true,
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
    {
      name: 'unsubscribedAt',
      type: 'date',
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
        condition: (data) => data.status === 'unsubscribed',
      },
    },
    {
      name: 'resendContactId',
      type: 'text',
      admin: {
        description: 'Resend audience contact ID (if synced)',
        readOnly: true,
      },
    },
  ],
  timestamps: true,
}

export default NewsletterSubscribers
