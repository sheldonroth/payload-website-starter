/**
 * Referrals Collection
 * 
 * Tracks referral relationships between users/devices.
 * Powers the $25/year recurring commission program.
 * 
 * Commission is paid annually on the subscription anniversary
 * for each referred subscriber who remains active.
 */

import type { CollectionConfig } from 'payload'

export const Referrals: CollectionConfig = {
    slug: 'referrals',
    admin: {
        useAsTitle: 'referralCode',
        group: 'Growth',
        description: 'Track referral relationships and commission eligibility',
        defaultColumns: ['referralCode', 'referredEmail', 'status', 'firstSubscriptionDate', 'totalCommissionPaid'],
    },
    access: {
        read: () => true,
        create: () => true,
        update: ({ req: { user } }) => Boolean(user),
        delete: ({ req: { user } }) => Boolean(user),
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
            name: 'referralCode',
            type: 'text',
            required: true,
            admin: {
                description: 'The 6-character referral code used',
            },
            index: true,
        },
        {
            name: 'referrerEmail',
            type: 'email',
            admin: {
                description: 'Email for payout notifications (collected when balance reaches $25)',
            },
        },

        // Referred User Information
        {
            name: 'referredDeviceId',
            type: 'text',
            required: true,
            admin: {
                description: 'Device fingerprint of the referred user',
            },
            index: true,
        },
        {
            name: 'referredUserId',
            type: 'text',
            admin: {
                description: 'User ID if the referred user has an account',
            },
        },
        {
            name: 'referredEmail',
            type: 'email',
            admin: {
                description: 'Email of the referred subscriber',
            },
        },

        // Subscription Status
        {
            name: 'status',
            type: 'select',
            required: true,
            defaultValue: 'pending',
            options: [
                { label: 'Pending', value: 'pending' },        // Referred but not yet subscribed
                { label: 'Active', value: 'active' },          // Subscribed and eligible for commission
                { label: 'Churned', value: 'churned' },        // Cancelled subscription
                { label: 'Fraud', value: 'fraud' },            // Flagged as fraudulent
            ],
            admin: {
                description: 'Current status of this referral',
            },
            index: true,
        },

        // Commission Tracking
        {
            name: 'firstSubscriptionDate',
            type: 'date',
            admin: {
                description: 'When the referred user first subscribed',
                date: {
                    pickerAppearance: 'dayAndTime',
                },
            },
        },
        {
            name: 'lastRenewalDate',
            type: 'date',
            admin: {
                description: 'Most recent subscription renewal date',
                date: {
                    pickerAppearance: 'dayAndTime',
                },
            },
        },
        {
            name: 'nextCommissionDate',
            type: 'date',
            admin: {
                description: 'Next date commission should be accrued (subscription anniversary)',
                date: {
                    pickerAppearance: 'dayOnly',
                },
            },
        },
        {
            name: 'totalCommissionPaid',
            type: 'number',
            defaultValue: 0,
            admin: {
                description: 'Total commission paid to referrer for this referral ($)',
            },
        },
        {
            name: 'yearsActive',
            type: 'number',
            defaultValue: 0,
            admin: {
                description: 'Number of years this referral has remained active',
            },
        },

        // RevenueCat Integration
        {
            name: 'revenuecatSubscriberId',
            type: 'text',
            admin: {
                description: 'RevenueCat subscriber ID for webhook matching',
            },
            index: true,
        },

        // Metadata
        {
            name: 'source',
            type: 'select',
            defaultValue: 'mobile',
            options: [
                { label: 'Mobile App', value: 'mobile' },
                { label: 'Website', value: 'web' },
                { label: 'Direct Link', value: 'link' },
            ],
        },
        {
            name: 'notes',
            type: 'textarea',
            admin: {
                description: 'Internal notes about this referral',
            },
        },
    ],
    timestamps: true,
    indexes: [
        {
            fields: ['referrerId', 'status'],
        },
        {
            fields: ['referredDeviceId'],
            unique: true,
        },
    ],
}

export default Referrals
