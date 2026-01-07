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
    defaultColumns: ['message', 'user', 'feedbackType', 'platform', 'status', 'createdAt'],
    group: 'User Data',
    description: 'User feedback from mobile app and web. User attribution is automatic for logged-in users.',
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
      name: 'feedbackType',
      type: 'select',
      options: [
        { label: 'General', value: 'general' },
        { label: 'Bug Report', value: 'bug_report' },
        { label: 'Feature Request', value: 'feature_request' },
        { label: 'Complaint', value: 'complaint' },
        { label: 'Praise', value: 'praise' },
        { label: 'Product Question', value: 'product_question' },
      ],
      defaultValue: 'general',
      admin: {
        description: 'Category of feedback',
      },
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
      name: 'product',
      type: 'relationship',
      relationTo: 'products',
      admin: {
        description: 'Related product (if feedback is about a specific product)',
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
      name: 'appVersion',
      type: 'text',
      admin: {
        description: 'App version at time of submission',
      },
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
      name: 'adminResponse',
      type: 'textarea',
      admin: {
        description: 'Response to send back to user (if applicable)',
        position: 'sidebar',
      },
    },
    {
      name: 'metadata',
      type: 'json',
      admin: {
        description: 'Additional data (subscription status, device info, etc.)',
      },
    },
  ],
  timestamps: true,
}
