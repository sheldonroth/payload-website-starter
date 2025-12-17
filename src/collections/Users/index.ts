import type { CollectionConfig } from 'payload'

import { authenticated } from '../../access/authenticated'

export const Users: CollectionConfig = {
  slug: 'users',
  access: {
    admin: authenticated,
    // Allow anyone to create an account (signup)
    create: () => true,
    delete: authenticated,
    read: authenticated,
    update: authenticated,
  },
  admin: {
    defaultColumns: ['name', 'email', 'subscriptionStatus'],
    useAsTitle: 'name',
  },
  auth: true,
  fields: [
    {
      name: 'name',
      type: 'text',
    },
    // ============================================
    // Subscription Fields
    // ============================================
    {
      name: 'subscriptionStatus',
      type: 'select',
      defaultValue: 'free',
      options: [
        { label: 'Free', value: 'free' },
        { label: 'Trial', value: 'trial' },
        { label: 'Premium', value: 'premium' },
        { label: 'Cancelled', value: 'cancelled' },
      ],
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'trialStartDate',
      type: 'date',
      admin: {
        position: 'sidebar',
        description: 'When the 7-day trial started',
      },
    },
    {
      name: 'trialEndDate',
      type: 'date',
      admin: {
        position: 'sidebar',
        description: 'When the 7-day trial ends',
      },
    },
    {
      name: 'productViewsThisMonth',
      type: 'number',
      defaultValue: 0,
      admin: {
        position: 'sidebar',
        description: 'Products viewed this month (5 free limit)',
      },
    },
    {
      name: 'productViewsResetDate',
      type: 'date',
      admin: {
        position: 'sidebar',
        description: 'When product views counter resets',
      },
    },
    // ============================================
    // Stripe Integration
    // ============================================
    {
      name: 'stripeCustomerId',
      type: 'text',
      admin: {
        position: 'sidebar',
        readOnly: true,
      },
    },
    {
      name: 'stripeSubscriptionId',
      type: 'text',
      admin: {
        position: 'sidebar',
        readOnly: true,
      },
    },
    // ============================================
    // RevenueCat Integration (Mobile)
    // ============================================
    {
      name: 'revenuecatUserId',
      type: 'text',
      admin: {
        position: 'sidebar',
        readOnly: true,
      },
    },
    // ============================================
    // OAuth Provider IDs
    // ============================================
    {
      name: 'googleId',
      type: 'text',
      admin: {
        position: 'sidebar',
        readOnly: true,
        description: 'Google OAuth user ID',
      },
    },
    {
      name: 'appleId',
      type: 'text',
      admin: {
        position: 'sidebar',
        readOnly: true,
        description: 'Apple Sign-In user ID',
      },
    },
    // ============================================
    // Privacy & Consent (REQUIRED for compliance)
    // ============================================
    {
      name: 'privacyConsent',
      type: 'group',
      fields: [
        {
          name: 'dataProcessingConsent',
          type: 'checkbox',
          defaultValue: false,
          label: 'Data Processing Consent',
          admin: {
            description: 'User consented to data processing for service operation',
          },
        },
        {
          name: 'consentDate',
          type: 'date',
          admin: {
            readOnly: true,
            description: 'When consent was given',
          },
        },
        {
          name: 'marketingOptIn',
          type: 'checkbox',
          defaultValue: false,
          label: 'Marketing Emails Opt-In',
          admin: {
            description: 'User opted in to receive marketing emails',
          },
        },
      ],
    },
    // ============================================
    // Saved Items (synced across platforms)
    // ============================================
    {
      name: 'savedProductIds',
      type: 'json',
      defaultValue: [],
      admin: {
        description: 'Array of saved product IDs',
      },
    },
    {
      name: 'savedArticleIds',
      type: 'json',
      defaultValue: [],
      admin: {
        description: 'Array of saved article IDs',
      },
    },
  ],
  timestamps: true,
}
