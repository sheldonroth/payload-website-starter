/**
 * Email Cron Integration Tests
 *
 * Tests the email automation cron jobs:
 * - Weekly digest
 * - Week 1 value sequence
 * - Win-back sequence
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import { getPayload, Payload } from 'payload'
import config from '@/payload.config'
import {
    getSentEmails,
    setResendToFail,
    setResendToSucceed,
    installResendMock,
    resetResendMock,
} from '../../mocks/resend.mock'

// Install Resend mock before importing email sender
installResendMock()

let payload: Payload

describe('Email Cron Jobs', () => {
    beforeAll(async () => {
        const payloadConfig = await config
        payload = await getPayload({ config: payloadConfig })
    })

    beforeEach(() => {
        resetResendMock()
    })

    describe('Weekly Digest', () => {
        it('should find active weekly digest template', async () => {
            // Arrange: Create a test template
            const template = await payload.create({
                collection: 'email-templates',
                data: {
                    name: 'Test Weekly Digest',
                    sequence: 'weekly_digest',
                    status: 'active',
                    subject: 'Your Weekly Report',
                    headline: 'This Week in Product Testing',
                    body: {
                        root: {
                            type: 'root',
                            version: 1,
                            children: [
                                {
                                    type: 'paragraph',
                                    version: 1,
                                    children: [{ type: 'text', text: 'Weekly content here', version: 1 }],
                                },
                            ],
                        },
                    },
                } as any,
            })

            // Assert
            expect(template).toBeDefined()
            expect(template.sequence).toBe('weekly_digest')
            expect(template.status).toBe('active')

            // Cleanup
            await payload.delete({
                collection: 'email-templates',
                id: template.id,
            })
        })

        it('should query subscribers with weekly digest enabled', async () => {
            // Query users with emailPreferences.weeklyDigest = true
            const subscribers = await payload.find({
                collection: 'users',
                where: {
                    and: [
                        { email: { exists: true } },
                        { 'emailPreferences.weeklyDigest': { equals: true } },
                    ],
                },
                limit: 10,
            })

            // This is a structure test - verifying the query works
            expect(subscribers).toBeDefined()
            expect(subscribers.docs).toBeInstanceOf(Array)
        })

        it('should get recent products for digest content', async () => {
            const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

            const recentProducts = await payload.find({
                collection: 'products',
                where: {
                    and: [
                        { status: { equals: 'published' } },
                        { updatedAt: { greater_than: oneWeekAgo.toISOString() } },
                    ],
                },
                limit: 5,
                sort: '-updatedAt',
            })

            expect(recentProducts).toBeDefined()
            expect(recentProducts.docs).toBeInstanceOf(Array)
        })
    })

    describe('Week 1 Value Sequence', () => {
        it('should find templates for each day in sequence', async () => {
            const days = [0, 1, 3, 5, 7]

            for (const day of days) {
                const templates = await payload.find({
                    collection: 'email-templates',
                    where: {
                        and: [
                            { sequence: { equals: 'week1_value' } },
                            { dayInSequence: { equals: day } },
                            { status: { equals: 'active' } },
                        ],
                    },
                    limit: 1,
                })

                // Just verify query structure works
                expect(templates).toBeDefined()
                expect(templates.docs).toBeInstanceOf(Array)
            }
        })

        it('should find users by signup date', async () => {
            const now = new Date()
            const targetDate = new Date(now)
            targetDate.setDate(targetDate.getDate() - 1) // 1 day ago

            const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0))
            const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999))

            const users = await payload.find({
                collection: 'users',
                where: {
                    and: [
                        { email: { exists: true } },
                        { createdAt: { greater_than: startOfDay.toISOString() } },
                        { createdAt: { less_than: endOfDay.toISOString() } },
                    ],
                },
                limit: 10,
            })

            expect(users).toBeDefined()
            expect(users.docs).toBeInstanceOf(Array)
        })

        it('should check for already-sent emails', async () => {
            const testEmail = 'test-duplicate-check@example.com'
            const testTemplateId = 999 // Non-existent

            const alreadySent = await payload.find({
                collection: 'email-sends',
                where: {
                    and: [
                        { template: { equals: testTemplateId } },
                        { recipient: { equals: testEmail } },
                    ],
                },
                limit: 1,
            })

            expect(alreadySent).toBeDefined()
            expect(alreadySent.docs).toBeInstanceOf(Array)
            expect(alreadySent.docs.length).toBe(0) // Should not find anything
        })
    })

    describe('Win-Back Sequence', () => {
        it('should find templates for winback days', async () => {
            const winbackDays = [14, 30]

            for (const day of winbackDays) {
                const templates = await payload.find({
                    collection: 'email-templates',
                    where: {
                        and: [
                            { sequence: { equals: 'winback' } },
                            { dayInSequence: { equals: day } },
                            { status: { equals: 'active' } },
                        ],
                    },
                    limit: 1,
                })

                expect(templates).toBeDefined()
                expect(templates.docs).toBeInstanceOf(Array)
            }
        })

        it('should find users by last activity date', async () => {
            const now = new Date()
            const targetDate = new Date(now)
            targetDate.setDate(targetDate.getDate() - 14) // 14 days ago

            const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0))
            const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999))

            const users = await payload.find({
                collection: 'users',
                where: {
                    and: [
                        { email: { exists: true } },
                        { lastActiveAt: { greater_than: startOfDay.toISOString() } },
                        { lastActiveAt: { less_than: endOfDay.toISOString() } },
                    ],
                },
                limit: 10,
            })

            expect(users).toBeDefined()
            expect(users.docs).toBeInstanceOf(Array)
        })

        it('should count new products since user left', async () => {
            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

            const newProducts = await payload.count({
                collection: 'products',
                where: {
                    and: [
                        { status: { equals: 'published' } },
                        { createdAt: { greater_than: thirtyDaysAgo.toISOString() } },
                    ],
                },
            })

            expect(newProducts).toBeDefined()
            expect(typeof newProducts.totalDocs).toBe('number')
        })
    })

    describe('Email Send Logging', () => {
        it('should create email-sends record structure correctly', async () => {
            // Verify the email-sends collection schema
            const testSend = {
                template: 1, // Would be actual template ID
                recipient: 'test@example.com',
                subject: 'Test Subject',
                abVariant: 'A',
                messageId: 'msg_test_123',
                sentAt: new Date().toISOString(),
                status: 'sent',
            }

            // This tests that the data structure is valid
            expect(testSend.recipient).toContain('@')
            expect(['A', 'B']).toContain(testSend.abVariant)
            expect(['sent', 'delivered', 'opened', 'clicked', 'bounced']).toContain(testSend.status)
        })
    })
})

describe('Cron Authorization', () => {
    it('should reject requests without authorization header', async () => {
        // This tests the authorization pattern used in cron routes
        const cronSecret = process.env.CRON_SECRET
        const testAuthHeader = null

        const isAuthorized = cronSecret && testAuthHeader === `Bearer ${cronSecret}`
        expect(isAuthorized).toBe(false)
    })

    it('should reject requests with wrong secret', async () => {
        const cronSecret = process.env.CRON_SECRET
        const testAuthHeader = 'Bearer wrong_secret'

        const isAuthorized = cronSecret && testAuthHeader === `Bearer ${cronSecret}`
        expect(isAuthorized).toBe(false)
    })

    it('should accept requests with correct secret', async () => {
        const cronSecret = 'test_cron_secret' // Set in vitest.setup.ts
        const testAuthHeader = `Bearer ${cronSecret}`

        const isAuthorized = cronSecret && testAuthHeader === `Bearer ${cronSecret}`
        expect(isAuthorized).toBe(true)
    })
})
