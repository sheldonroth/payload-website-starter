import type { CollectionConfig } from 'payload'

import { authenticated } from '../../access/authenticated'
import { isSelfOrAdmin } from '../../access/isSelfOrAdmin'

export const Users: CollectionConfig = {
  slug: 'users',
  access: {
    admin: authenticated,
    // Allow anyone to create an account (signup)
    create: () => true,
    delete: isSelfOrAdmin,
    read: isSelfOrAdmin,
    update: isSelfOrAdmin,
  },
  admin: {
    defaultColumns: ['name', 'email', 'subscriptionStatus'],
    useAsTitle: 'name',
  },
  auth: {
    forgotPassword: {
      generateEmailHTML: (props) => {
        const token = props?.token || '';
        const resetURL = `https://www.theproductreport.org/reset-password?token=${token}`;

        return `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Reset Your Password</title>
            </head>
            <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc;">
              <table width="100%" cellpadding="0" cellspacing="0" style="padding: 40px 20px;">
                <tr>
                  <td align="center">
                    <table width="100%" style="max-width: 480px; background: white; border-radius: 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); overflow: hidden;">
                      <!-- Header -->
                      <tr>
                        <td style="background: linear-gradient(135deg, #065f46 0%, #047857 100%); padding: 32px; text-align: center;">
                          <div style="font-size: 24px; font-weight: 800; color: white; letter-spacing: -0.5px;">The Product Report</div>
                        </td>
                      </tr>
                      <!-- Body -->
                      <tr>
                        <td style="padding: 40px 32px;">
                          <h1 style="margin: 0 0 16px; font-size: 24px; font-weight: 700; color: #0f172a;">Reset Your Password</h1>
                          <p style="margin: 0 0 24px; font-size: 16px; line-height: 24px; color: #475569;">
                            We received a request to reset the password for your account. Click the button below to create a new password.
                          </p>
                          <a href="${resetURL}" style="display: inline-block; padding: 14px 32px; background: #059669; color: white; text-decoration: none; font-weight: 600; font-size: 16px; border-radius: 8px;">
                            Reset Password
                          </a>
                          <p style="margin: 24px 0 0; font-size: 14px; color: #94a3b8;">
                            This link will expire in 1 hour. If you didn't request this, you can safely ignore this email.
                          </p>
                        </td>
                      </tr>
                      <!-- Footer -->
                      <tr>
                        <td style="padding: 24px 32px; background: #f8fafc; border-top: 1px solid #e2e8f0;">
                          <p style="margin: 0; font-size: 12px; color: #94a3b8; text-align: center;">
                            © ${new Date().getFullYear()} The Product Report. All rights reserved.<br>
                            Independent product testing powered by members.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </body>
          </html>
        `;
      },
      generateEmailSubject: () => 'Reset Your Password - The Product Report',
    },
  },
  fields: [
    {
      name: 'name',
      type: 'text',
    },
    {
      name: 'role',
      type: 'select',
      defaultValue: 'user',
      options: [
        { label: 'Admin (Full Access)', value: 'admin' },
        { label: 'Product Editor (Add/Edit Only)', value: 'product_editor' },
        { label: 'User (Public)', value: 'user' },
      ],
      admin: {
        position: 'sidebar',
        description: 'User role determines CMS permissions. Product Editors can add/edit products and categories but cannot delete.',
      },
    },
    {
      name: 'isAdmin',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        position: 'sidebar',
        description: 'Legacy admin flag - use role field instead',
        condition: (data) => data?.role === 'admin', // Only show if admin role
      },
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
    // ============================================
    // Watchlist (category alerts)
    // ============================================
    {
      name: 'watchlistCategories',
      type: 'relationship',
      relationTo: 'categories',
      hasMany: true,
      label: 'Watchlist Categories',
      admin: {
        description: 'Categories this user is watching for updates',
      },
    },
    // ============================================
    // Free Unlock System (PLG)
    // ============================================
    {
      name: 'freeUnlockCredits',
      type: 'number',
      defaultValue: 1,
      admin: {
        position: 'sidebar',
        description: 'Number of free product unlocks remaining',
      },
    },
    {
      name: 'unlockedProducts',
      type: 'json',
      defaultValue: [],
      admin: {
        description: 'Array of permanently unlocked product IDs',
      },
    },
  ],
  timestamps: true,
}
