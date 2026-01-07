/**
 * Resend API Mock for Integration Tests
 *
 * Mocks the Resend email service to:
 * - Capture sent emails for assertions
 * - Simulate success/failure responses
 * - Verify webhook signature handling
 */

import { vi } from 'vitest'

export interface MockEmailSend {
    to: string
    subject: string
    html: string
    from: string
    headers?: Record<string, string>
    messageId: string
    sentAt: Date
}

export interface ResendMockState {
    sentEmails: MockEmailSend[]
    shouldFail: boolean
    failureMessage?: string
    webhookSecret: string
}

const state: ResendMockState = {
    sentEmails: [],
    shouldFail: false,
    failureMessage: undefined,
    webhookSecret: 'whsec_test_secret',
}

/**
 * Mock Resend client
 */
export const mockResend = {
    emails: {
        send: vi.fn(async (options: {
            from: string
            to: string
            subject: string
            html: string
            headers?: Record<string, string>
        }) => {
            if (state.shouldFail) {
                return {
                    data: null,
                    error: { message: state.failureMessage || 'Resend API error' },
                }
            }

            const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

            state.sentEmails.push({
                ...options,
                messageId,
                sentAt: new Date(),
            })

            return {
                data: { id: messageId },
                error: null,
            }
        }),
    },
}

/**
 * Reset mock state between tests
 */
export function resetResendMock(): void {
    state.sentEmails = []
    state.shouldFail = false
    state.failureMessage = undefined
    mockResend.emails.send.mockClear()
}

/**
 * Configure mock to fail on next send
 */
export function setResendToFail(message = 'Resend API error'): void {
    state.shouldFail = true
    state.failureMessage = message
}

/**
 * Configure mock to succeed
 */
export function setResendToSucceed(): void {
    state.shouldFail = false
    state.failureMessage = undefined
}

/**
 * Get all sent emails
 */
export function getSentEmails(): MockEmailSend[] {
    return [...state.sentEmails]
}

/**
 * Get the most recent sent email
 */
export function getLastSentEmail(): MockEmailSend | undefined {
    return state.sentEmails[state.sentEmails.length - 1]
}

/**
 * Get emails sent to a specific address
 */
export function getEmailsSentTo(email: string): MockEmailSend[] {
    return state.sentEmails.filter(e => e.to === email)
}

/**
 * Generate a valid webhook signature for testing
 */
export function generateWebhookSignature(
    payload: object,
    timestamp = Date.now()
): { signature: string; timestamp: string } {
    const crypto = require('crypto')
    const timestampStr = String(Math.floor(timestamp / 1000))
    const payloadStr = JSON.stringify(payload)

    const signaturePayload = `${timestampStr}.${payloadStr}`
    const signature = crypto
        .createHmac('sha256', state.webhookSecret)
        .update(signaturePayload)
        .digest('hex')

    return {
        signature: `v1=${signature}`,
        timestamp: timestampStr,
    }
}

/**
 * Create a mock webhook event for testing
 */
export function createMockWebhookEvent(
    type: 'email.sent' | 'email.delivered' | 'email.opened' | 'email.clicked' | 'email.bounced' | 'email.complained',
    messageId: string,
    additionalData: Record<string, any> = {}
): { event: object; headers: Record<string, string> } {
    const event = {
        type,
        created_at: new Date().toISOString(),
        data: {
            email_id: messageId,
            ...additionalData,
        },
    }

    const { signature, timestamp } = generateWebhookSignature(event)

    return {
        event,
        headers: {
            'svix-id': `msg_${Date.now()}`,
            'svix-timestamp': timestamp,
            'svix-signature': signature,
        },
    }
}

/**
 * Install the Resend mock globally
 */
export function installResendMock(): void {
    vi.mock('resend', () => ({
        Resend: vi.fn(() => mockResend),
    }))
}

export default {
    mockResend,
    resetResendMock,
    setResendToFail,
    setResendToSucceed,
    getSentEmails,
    getLastSentEmail,
    getEmailsSentTo,
    generateWebhookSignature,
    createMockWebhookEvent,
    installResendMock,
}
