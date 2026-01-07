/**
 * Email Templates Collection
 *
 * Manage all email templates for automated sequences.
 * Enhanced with preview capability, A/B testing, and performance stats.
 *
 * Template Types:
 * - Week 1 Value Discovery: Onboarding sequence
 * - Weekly Digest: Weekly product updates
 * - Win-Back: Re-engagement for churned users
 * - FOMO Triggers: Event-based notifications
 * - Badge Unlock: Achievement celebrations
 * - Product Update: Changes to saved products
 */

import { CollectionConfig } from 'payload'

export const EmailTemplates: CollectionConfig = {
  slug: 'email-templates',
  labels: {
    singular: 'Email Template',
    plural: 'Email Templates',
  },
  admin: {
    useAsTitle: 'subject',
    defaultColumns: ['subject', 'sequence', 'status', 'stats.openRate', 'stats.sent', 'updatedAt'],
    group: 'Growth',
    description: 'Email templates with A/B testing, personalization, and performance tracking',
    listSearchableFields: ['subject', 'sequence', 'headline'],
    pagination: {
      defaultLimit: 25,
    },
  },
  access: {
    read: () => true,
    create: ({ req: { user } }) => !!user,
    update: ({ req: { user } }) => !!user,
    delete: ({ req: { user } }) => !!user,
  },
  fields: [
    // Status & Sequence (Sidebar)
    {
      name: 'status',
      type: 'select',
      defaultValue: 'draft',
      options: [
        { label: '📝 Draft', value: 'draft' },
        { label: '✅ Active', value: 'active' },
        { label: '⏸️ Paused', value: 'paused' },
        { label: '📊 A/B Testing', value: 'ab_testing' },
      ],
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'sequence',
      type: 'select',
      required: true,
      options: [
        { label: '📅 Week 1: Value Discovery', value: 'week1_value' },
        { label: '📬 Weekly Digest', value: 'weekly_digest' },
        { label: '💔 Win-Back', value: 'winback' },
        { label: '🔔 FOMO Trigger', value: 'fomo_trigger' },
        { label: '🎁 Year in Clean', value: 'year_in_clean' },
        { label: '🏅 Badge Unlock', value: 'badge_unlock' },
        { label: '📰 Product Update', value: 'product_update' },
        { label: '🎉 Welcome', value: 'welcome' },
        { label: '⚡ Transactional', value: 'transactional' },
      ],
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'dayInSequence',
      type: 'number',
      admin: {
        position: 'sidebar',
        description: 'For sequences: which day (0, 1, 3, 5, 7, etc.)',
        condition: (data) => ['week1_value', 'winback'].includes(data?.sequence),
      },
    },
    {
      name: 'triggerEvent',
      type: 'select',
      options: [
        { label: 'Product Re-tested', value: 'product_retested' },
        { label: 'Brand Makes News', value: 'brand_news' },
        { label: 'New Category Tests', value: 'new_category_tests' },
        { label: 'Badge Unlocked', value: 'badge_unlocked' },
        { label: 'Year in Clean Ready', value: 'year_in_clean_ready' },
        { label: 'Saved Product Updated', value: 'saved_product_updated' },
      ],
      admin: {
        position: 'sidebar',
        description: 'What event triggers this email',
        condition: (data) => data?.sequence === 'fomo_trigger',
      },
    },

    // Subject Lines (A/B Testing)
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Content',
          fields: [
            {
              name: 'subject',
              type: 'text',
              required: true,
              admin: {
                description: 'Email subject line (supports {{variables}} like {{userName}})',
              },
            },
            {
              name: 'subjectVariantB',
              type: 'text',
              admin: {
                description: 'A/B test: alternate subject line (50% of recipients)',
                condition: (data) => data?.status === 'ab_testing',
              },
            },
            {
              name: 'preheader',
              type: 'text',
              admin: {
                description: 'Preview text shown in inbox (40-130 characters recommended)',
              },
            },
            {
              name: 'headline',
              type: 'text',
              admin: {
                description: 'Main headline in email body',
              },
            },
            {
              name: 'body',
              type: 'richText',
              required: true,
              admin: {
                description: 'Email body content - use React Email components for rendering',
              },
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'ctaText',
                  type: 'text',
                  admin: {
                    width: '50%',
                    description: 'Call-to-action button text',
                  },
                },
                {
                  name: 'ctaUrl',
                  type: 'text',
                  admin: {
                    width: '50%',
                    description: 'CTA button destination URL',
                  },
                },
              ],
            },
          ],
        },
        {
          label: 'Personalization',
          description: 'Configure dynamic content',
          fields: [
            {
              name: 'availableVariables',
              type: 'array',
              admin: {
                description: 'Variables you can use in templates: {{variable_name}}',
                initCollapsed: false,
              },
              fields: [
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'variable',
                      type: 'text',
                      admin: { width: '40%' },
                    },
                    {
                      name: 'description',
                      type: 'text',
                      admin: { width: '60%' },
                    },
                  ],
                },
              ],
              defaultValue: [
                { variable: 'userName', description: 'User first name' },
                { variable: 'productName', description: 'Product name' },
                { variable: 'brandName', description: 'Brand name' },
                { variable: 'categoryName', description: 'Category name' },
              ],
            },
            {
              name: 'dynamicContent',
              type: 'group',
              fields: [
                {
                  name: 'includeProductCards',
                  type: 'checkbox',
                  defaultValue: false,
                  label: 'Include Product Cards',
                  admin: {
                    description: 'Auto-insert product cards based on user preferences',
                  },
                },
                {
                  name: 'productCardCount',
                  type: 'number',
                  defaultValue: 3,
                  admin: {
                    condition: (data) => data?.dynamicContent?.includeProductCards,
                  },
                },
                {
                  name: 'includeStats',
                  type: 'checkbox',
                  defaultValue: false,
                  label: 'Include Stats Block',
                  admin: {
                    description: 'Show personalized stats (scans, saves, badges)',
                  },
                },
              ],
            },
          ],
        },
        {
          label: 'Stats',
          description: 'Performance metrics',
          fields: [
            {
              name: 'stats',
              type: 'group',
              admin: {
                readOnly: true,
              },
              fields: [
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'sent',
                      type: 'number',
                      defaultValue: 0,
                      admin: { width: '25%' },
                    },
                    {
                      name: 'opened',
                      type: 'number',
                      defaultValue: 0,
                      admin: { width: '25%' },
                    },
                    {
                      name: 'clicked',
                      type: 'number',
                      defaultValue: 0,
                      admin: { width: '25%' },
                    },
                    {
                      name: 'unsubscribed',
                      type: 'number',
                      defaultValue: 0,
                      admin: { width: '25%' },
                    },
                  ],
                },
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'openRate',
                      type: 'text',
                      admin: {
                        width: '33%',
                        description: 'Percentage of opens',
                      },
                    },
                    {
                      name: 'clickRate',
                      type: 'text',
                      admin: {
                        width: '33%',
                        description: 'Percentage of clicks',
                      },
                    },
                    {
                      name: 'unsubscribeRate',
                      type: 'text',
                      admin: {
                        width: '33%',
                        description: 'Percentage of unsubscribes',
                      },
                    },
                  ],
                },
                {
                  name: 'abTestWinner',
                  type: 'select',
                  options: [
                    { label: 'Not Determined', value: 'pending' },
                    { label: 'Variant A Wins', value: 'A' },
                    { label: 'Variant B Wins', value: 'B' },
                    { label: 'No Significant Difference', value: 'tie' },
                  ],
                  admin: {
                    condition: (data) => data?.subjectVariantB,
                    description: 'A/B test result (auto-calculated after 100+ sends)',
                  },
                },
              ],
            },
          ],
        },
      ],
    },

    // Notes
    {
      name: 'internalNotes',
      type: 'textarea',
      admin: {
        description: 'Internal notes about this template (not sent to users)',
      },
    },
  ],
  hooks: {
    afterChange: [
      async ({ doc, previousDoc, operation }) => {
        // Recalculate rates when stats change
        if (doc.stats && doc.stats.sent > 0) {
          const openRate = ((doc.stats.opened || 0) / doc.stats.sent * 100).toFixed(1) + '%'
          const clickRate = ((doc.stats.clicked || 0) / doc.stats.sent * 100).toFixed(1) + '%'
          const unsubscribeRate = ((doc.stats.unsubscribed || 0) / doc.stats.sent * 100).toFixed(2) + '%'

          // Only update if rates changed
          if (doc.stats.openRate !== openRate || doc.stats.clickRate !== clickRate) {
            doc.stats.openRate = openRate
            doc.stats.clickRate = clickRate
            doc.stats.unsubscribeRate = unsubscribeRate
          }
        }
        return doc
      },
    ],
  },
  timestamps: true,
}

export default EmailTemplates
