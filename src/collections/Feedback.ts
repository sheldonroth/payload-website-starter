import type { CollectionConfig } from 'payload'

/**
 * Feedback Collection
 *
 * Stores user feedback submitted from the mobile app.
 * Accessible via POST /api/feedback endpoint.
 */
export const Feedback: CollectionConfig = {
  slug: 'feedback',
  labels: {
    singular: 'Feedback',
    plural: 'Feedback',
  },
  admin: {
    useAsTitle: 'message',
    defaultColumns: ['message', 'email', 'platform', 'status', 'createdAt'],
    group: 'User Data',
  },
  access: {
    // Only admins can read feedback
    read: ({ req: { user } }) => (user as { role?: string })?.role === 'admin',
    // Anyone can create (public API)
    create: () => true,
    // Only admins can update/delete
    update: ({ req: { user } }) => (user as { role?: string })?.role === 'admin',
    delete: ({ req: { user } }) => (user as { role?: string })?.role === 'admin',
  },
  fields: [
    {
      name: 'message',
      type: 'textarea',
      required: true,
      maxLength: 500,
    },
    {
      name: 'email',
      type: 'email',
      admin: {
        description: 'User email if authenticated',
      },
    },
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      admin: {
        description: 'Linked user account if authenticated',
      },
    },
    {
      name: 'platform',
      type: 'select',
      options: ['ios', 'android', 'web'],
      required: true,
      defaultValue: 'ios',
    },
    {
      name: 'source',
      type: 'text',
      defaultValue: 'mobile-app',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'New', value: 'new' },
        { label: 'Reviewed', value: 'reviewed' },
        { label: 'Actioned', value: 'actioned' },
        { label: 'Archived', value: 'archived' },
      ],
      defaultValue: 'new',
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'adminNotes',
      type: 'textarea',
      admin: {
        description: 'Internal notes about this feedback',
        position: 'sidebar',
      },
    },
    {
      name: 'metadata',
      type: 'json',
      admin: {
        description: 'Additional data (app version, subscription status, etc.)',
      },
    },
  ],
  timestamps: true,
}
