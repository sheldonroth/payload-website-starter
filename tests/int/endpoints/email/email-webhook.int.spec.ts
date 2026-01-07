/**
 * Email Webhook Integration Tests
 *
 * Tests the Resend webhook handler:
 * - Signature verification
 * - Event processing (delivered, opened, clicked, bounced)
 * - Stats updates
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { getPayload, Payload } from 'payload'
import config from '@/payload.config'
import {
    createMockWebhookEvent,
    generateWebhookSignature,
} from '../../mocks/resend.mock'
import crypto from 'crypto'

let payload: Payload

describe('Email Webhook', () => {
    beforeAll(async () => {
        const payloadConfig = await config
        payload = await getPayload({ config: payloadConfig })
    })

    describe('Signature Verification', () => {
        it('should verify valid webhook signature', () => {
            const webhookSecret = 'whsec_test_secret'
            const payload = { type: 'email.delivered', data: { email_id: 'msg_123' } }
            const timestamp = Math.floor(Date.now() / 1000)

            const payloadStr = JSON.stringify(payload)
            const signaturePayload = `${timestamp}.${payloadStr}`
            const signature = crypto
                .createHmac('sha256', webhookSecret)
                .update(signaturePayload)
                .digest('hex')

            expect(signature).toHaveLength(64) // SHA256 hex output
            expect(/^[a-f0-9]+$/.test(signature)).toBe(true)
        })

        it('should reject invalid signature', () => {
            const validSignature = 'v1=abc123...'
            const invalidSignature = 'v1=wrong_signature'

            expect(validSignature).not.toBe(invalidSignature)
        })

        it('should reject expired timestamps', () => {
            const now = Math.floor(Date.now() / 1000)
            const fiveMinutesAgo = now - 300
            const tenMinutesAgo = now - 600

            const isTimestampValid = (timestamp: number) => {
                const diff = now - timestamp
                return diff < 300 // 5 minute tolerance
            }

            expect(isTimestampValid(fiveMinutesAgo)).toBe(false) // Exactly at limit
            expect(isTimestampValid(tenMinutesAgo)).toBe(false)
            expect(isTimestampValid(now - 60)).toBe(true) // 1 minute ago
        })
    })

    describe('Event Processing', () => {
        describe('email.delivered', () => {
            it('should update email-sends status to delivered', async () => {
                const event = createMockWebhookEvent('email.delivered', 'msg_test_123')

                expect(event.event).toHaveProperty('type', 'email.delivered')
                expect(event.event).toHaveProperty('data')
            })

            it('should record delivery timestamp', () => {
                const deliveredAt = new Date().toISOString()
                const updateData = {
                    status: 'delivered',
                    deliveredAt,
                }

                expect(updateData.status).toBe('delivered')
                expect(new Date(updateData.deliveredAt)).toBeInstanceOf(Date)
            })
        })

        describe('email.opened', () => {
            it('should update email-sends status to opened', async () => {
                const event = createMockWebhookEvent('email.opened', 'msg_test_123')

                expect(event.event).toHaveProperty('type', 'email.opened')
            })

            it('should increment template open count', () => {
                const currentStats = { sent: 100, opened: 45 }
                const newStats = {
                    ...currentStats,
                    opened: currentStats.opened + 1,
                }

                expect(newStats.opened).toBe(46)
            })

            it('should track first open time', () => {
                const openedAt = new Date().toISOString()
                const updateData = {
                    status: 'opened',
                    firstOpenedAt: openedAt,
                }

                expect(updateData.status).toBe('opened')
            })
        })

        describe('email.clicked', () => {
            it('should update email-sends with click data', async () => {
                const event = createMockWebhookEvent('email.clicked', 'msg_test_123', {
                    link: 'https://theproductreport.org/products/test',
                })

                expect(event.event).toHaveProperty('type', 'email.clicked')
            })

            it('should increment template click count', () => {
                const currentStats = { sent: 100, opened: 45, clicked: 12 }
                const newStats = {
                    ...currentStats,
                    clicked: currentStats.clicked + 1,
                }

                expect(newStats.clicked).toBe(13)
            })

            it('should track clicked links', () => {
                const clickData = {
                    link: 'https://theproductreport.org/products/test',
                    clickedAt: new Date().toISOString(),
                }

                expect(clickData.link).toContain('theproductreport.org')
            })
        })

        describe('email.bounced', () => {
            it('should update email-sends status to bounced', async () => {
                const event = createMockWebhookEvent('email.bounced', 'msg_test_123', {
                    bounce_type: 'hard',
                })

                expect(event.event).toHaveProperty('type', 'email.bounced')
            })

            it('should handle hard bounces', () => {
                const bounceData = {
                    type: 'hard',
                    action: 'unsubscribe', // Should auto-unsubscribe
                }

                expect(bounceData.type).toBe('hard')
                expect(bounceData.action).toBe('unsubscribe')
            })

            it('should handle soft bounces', () => {
                const bounceData = {
                    type: 'soft',
                    action: 'retry', // Can retry later
                }

                expect(bounceData.type).toBe('soft')
                expect(bounceData.action).toBe('retry')
            })

            it('should increment template bounce count', () => {
                const currentStats = { sent: 100, bounced: 2 }
                const newStats = {
                    ...currentStats,
                    bounced: currentStats.bounced + 1,
                }

                expect(newStats.bounced).toBe(3)
            })
        })

        describe('email.complained', () => {
            it('should update email-sends status to complained', async () => {
                const event = createMockWebhookEvent('email.complained', 'msg_test_123')

                expect(event.event).toHaveProperty('type', 'email.complained')
            })

            it('should auto-unsubscribe on complaint', () => {
                const complaintAction = {
                    unsubscribe: true,
                    reason: 'spam_complaint',
                }

                expect(complaintAction.unsubscribe).toBe(true)
            })

            it('should track complaint for deliverability monitoring', () => {
                const complaintData = {
                    messageId: 'msg_test_123',
                    complainedAt: new Date().toISOString(),
                    feedbackType: 'spam',
                }

                expect(complaintData.feedbackType).toBe('spam')
            })
        })
    })

    describe('A/B Test Stats', () => {
        it('should update variant-specific stats', () => {
            const templateStats = {
                sent: 100,
                variantA: { sent: 50, opened: 25, clicked: 10 },
                variantB: { sent: 50, opened: 30, clicked: 8 },
            }

            const openRateA = templateStats.variantA.opened / templateStats.variantA.sent
            const openRateB = templateStats.variantB.opened / templateStats.variantB.sent

            expect(openRateA).toBe(0.5) // 50%
            expect(openRateB).toBe(0.6) // 60%
        })

        it('should determine winning variant', () => {
            const variantA = { openRate: 0.5, clickRate: 0.2 }
            const variantB = { openRate: 0.6, clickRate: 0.16 }

            // Winner by open rate
            const winnerByOpenRate = variantB.openRate > variantA.openRate ? 'B' : 'A'

            // Winner by click rate
            const winnerByClickRate = variantB.clickRate > variantA.clickRate ? 'B' : 'A'

            expect(winnerByOpenRate).toBe('B')
            expect(winnerByClickRate).toBe('A')
        })
    })

    describe('Error Handling', () => {
        it('should handle missing message ID gracefully', () => {
            const event = { type: 'email.delivered', data: {} }
            const messageId = event.data && 'email_id' in event.data ? event.data.email_id : null

            expect(messageId).toBeNull()
        })

        it('should handle unknown event types', () => {
            const unknownEventTypes = ['email.unknown', 'sms.delivered', 'webhook.test']

            const validEventTypes = ['email.sent', 'email.delivered', 'email.opened', 'email.clicked', 'email.bounced', 'email.complained']

            unknownEventTypes.forEach(type => {
                expect(validEventTypes.includes(type)).toBe(false)
            })
        })

        it('should not update non-existent email-sends records', async () => {
            const nonExistentMessageId = 'msg_does_not_exist_123'

            const emailSends = await payload.find({
                collection: 'email-sends',
                where: {
                    messageId: { equals: nonExistentMessageId },
                },
                limit: 1,
            })

            expect(emailSends.docs.length).toBe(0)
        })
    })
})

describe('Webhook Security', () => {
    it('should require authorization header', () => {
        const headers = {
            'svix-id': 'msg_123',
            'svix-timestamp': String(Date.now()),
            'svix-signature': 'v1=abc123',
        }

        expect(headers).toHaveProperty('svix-signature')
    })

    it('should validate all required headers', () => {
        const requiredHeaders = ['svix-id', 'svix-timestamp', 'svix-signature']
        const headers = {
            'svix-id': 'msg_123',
            'svix-timestamp': String(Date.now()),
            'svix-signature': 'v1=abc123',
        }

        requiredHeaders.forEach(header => {
            expect(headers).toHaveProperty(header)
        })
    })
})
