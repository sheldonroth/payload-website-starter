/**
 * Referrals Collection
 *
 * Tracks referral relationships between users/devices.
 * Powers the $25/year recurring commission program.
 *
 * Commission is paid annually on the subscription anniversary
 * for each referred subscriber who remains active.
 *
 * Security: Prevents self-referral, duplicate referrals, and rate limits creation.
 */

import type { CollectionConfig } from 'payload'
import { createAuditLogHook, createAuditDeleteHook } from '../hooks/auditLog'

// Anti-fraud: Maximum referrals that can be created in a short time window
const MAX_REFERRALS_PER_HOUR = 10

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
    hooks: {
        beforeChange: [
            async ({ data, operation, req }) => {
                if (operation !== 'create') return data

                // Validate required fields
                if (!data?.referrerId || !data?.referredDeviceId || !data?.referralCode) {
                    throw new Error('Missing required fields: referrerId, referredDeviceId, and referralCode are required')
                }

                // FRAUD PREVENTION: Block self-referral
                if (data.referrerId === data.referredDeviceId) {
                    console.warn(`[Referral] Self-referral attempt blocked: ${data.referrerId}`)
                    throw new Error('Self-referral is not allowed')
                }

                // FRAUD PREVENTION: Check if device was already referred
                const existingReferral = await req.payload.find({
                    collection: 'referrals',
                    where: { referredDeviceId: { equals: data.referredDeviceId } },
                    limit: 1,
                })

                if (existingReferral.docs.length > 0) {
                    throw new Error('This device has already been referred')
                }

                // FRAUD PREVENTION: Validate referral code exists
                const referrer = await req.payload.find({
                    collection: 'device-fingerprints',
                    where: {
                        or: [
                            { referralCode: { equals: data.referralCode.toUpperCase() } },
                            { fingerprintHash: { equals: data.referrerId } },
                        ],
                    },
                    limit: 1,
                })

                if (referrer.docs.length === 0) {
                    throw new Error('Invalid referral code')
                }

                // RATE LIMITING: Check recent referrals from this referrer
                const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
                const recentReferrals = await req.payload.find({
                    collection: 'referrals',
                    where: {
                        and: [
                            { referrerId: { equals: data.referrerId } },
                            { createdAt: { greater_than: oneHourAgo } },
                        ],
                    },
                    limit: MAX_REFERRALS_PER_HOUR + 1,
                })

                if (recentReferrals.docs.length >= MAX_REFERRALS_PER_HOUR) {
                    console.warn(`[Referral] Rate limit exceeded for referrer: ${data.referrerId}`)
                    throw new Error('Too many referrals in a short time. Please try again later.')
                }

                // Normalize referral code to uppercase
                data.referralCode = data.referralCode.toUpperCase()

                return data
            },
        ],
        afterChange: [createAuditLogHook('referrals')],
        afterDelete: [createAuditDeleteHook('referrals')],
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
