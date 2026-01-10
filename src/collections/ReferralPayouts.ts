/**
 * Referral Payouts Collection
 * 
 * Tracks commission payouts to referrers.
 * Payouts are processed annually when referral anniversary dates pass.
 * 
 * Commission: $25/year per active referred subscriber
 * Minimum payout: $25 (1 active referral)
 * Payment methods: PayPal, Venmo, or subscription credit
 */

import type { CollectionConfig } from 'payload'
import { createAuditLogHook, createAuditDeleteHook } from '../hooks/auditLog'

export const ReferralPayouts: CollectionConfig = {
    slug: 'referral-payouts',
    admin: {
        useAsTitle: 'id',
        group: 'Growth',
        description: 'Track referral commission payouts',
        defaultColumns: ['referrerId', 'amount', 'status', 'paymentMethod', 'createdAt'],
    },
    access: {
        // Payouts are sensitive financial data - admin only
        read: ({ req: { user } }) => (user as { role?: string })?.role === 'admin',
        create: ({ req: { user } }) => (user as { role?: string })?.role === 'admin',
        update: ({ req: { user } }) => (user as { role?: string })?.role === 'admin',
        delete: ({ req: { user } }) => (user as { role?: string })?.role === 'admin',
    },
    hooks: {
        afterChange: [createAuditLogHook('referral-payouts')],
        afterDelete: [createAuditDeleteHook('referral-payouts')],
    },
    fields: [
        // Referrer Information
        {
            name: 'referrerId',
            type: 'text',
            required: true,
            admin: {
                description: 'Device fingerprint or user ID of the referrer',
            },
            index: true,
        },
        {
            name: 'referrerEmail',
            type: 'email',
            required: true,
            admin: {
                description: 'Email address for payout notification',
            },
        },

        // Payout Details
        {
            name: 'amount',
            type: 'number',
            required: true,
            min: 0,
            admin: {
                description: 'Payout amount in USD',
            },
        },
        {
            name: 'referralCount',
            type: 'number',
            required: true,
            admin: {
                description: 'Number of active referrals this payout covers',
            },
        },
        {
            name: 'period',
            type: 'text',
            required: true,
            admin: {
                description: 'Period this payout covers (e.g., "2026-01" or "2026")',
            },
        },

        // Status
        {
            name: 'status',
            type: 'select',
            required: true,
            defaultValue: 'pending',
            options: [
                { label: 'Pending', value: 'pending' },        // Awaiting processing
                { label: 'Processing', value: 'processing' }, // Being processed
                { label: 'Paid', value: 'paid' },              // Successfully paid
                { label: 'Failed', value: 'failed' },         // Payment failed
                { label: 'Cancelled', value: 'cancelled' },   // Cancelled (fraud, etc.)
            ],
            index: true,
        },

        // Payment Method
        {
            name: 'paymentMethod',
            type: 'select',
            required: true,
            options: [
                { label: 'PayPal', value: 'paypal' },
                { label: 'Venmo', value: 'venmo' },
                { label: 'Subscription Credit', value: 'credit' },
                { label: 'Check', value: 'check' },
            ],
        },
        {
            name: 'paymentDetails',
            type: 'text',
            admin: {
                description: 'PayPal email, Venmo handle, or other payment details',
            },
        },

        // Processing Info
        {
            name: 'processedAt',
            type: 'date',
            admin: {
                description: 'When the payout was processed',
                date: {
                    pickerAppearance: 'dayAndTime',
                },
            },
        },
        {
            name: 'transactionId',
            type: 'text',
            admin: {
                description: 'External transaction ID (PayPal, Venmo, etc.)',
            },
        },

        // Tax Compliance
        {
            name: 'w9Collected',
            type: 'checkbox',
            defaultValue: false,
            admin: {
                description: 'W-9 collected from this referrer (required for $600+/year)',
            },
        },
        {
            name: 'ytdTotal',
            type: 'number',
            defaultValue: 0,
            admin: {
                description: 'Year-to-date total paid to this referrer (for 1099 tracking)',
            },
        },

        // Breakdown (which referrals contributed)
        {
            name: 'referralBreakdown',
            type: 'array',
            admin: {
                description: 'Breakdown of referrals included in this payout',
            },
            fields: [
                {
                    name: 'referralId',
                    type: 'text',
                    required: true,
                },
                {
                    name: 'referredEmail',
                    type: 'email',
                },
                {
                    name: 'amount',
                    type: 'number',
                    required: true,
                },
                {
                    name: 'anniversaryDate',
                    type: 'date',
                },
            ],
        },

        // Notes
        {
            name: 'notes',
            type: 'textarea',
            admin: {
                description: 'Internal notes about this payout',
            },
        },
    ],
    timestamps: true,
}

export default ReferralPayouts
