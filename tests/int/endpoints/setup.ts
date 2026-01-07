/**
 * Test Setup for Integration Endpoint Tests
 *
 * Provides common utilities and setup for endpoint integration tests.
 * - Creates mock request objects compatible with Payload handlers
 * - Provides helper functions for authentication
 * - Exports test utilities
 */

import { Payload } from 'payload'
import { vi, expect } from 'vitest'

/**
 * Create a mock Payload request object for testing handlers
 */
export function createMockRequest(
    url: string,
    options: {
        method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
        body?: object | string
        headers?: Record<string, string>
        user?: object | null
    } = {}
): Request & { payload?: Payload; json?: () => Promise<any>; user?: any } {
    const { method = 'GET', body, headers = {}, user = null } = options

    const requestInit: RequestInit = {
        method,
        headers: {
            'Content-Type': 'application/json',
            ...headers,
        },
    }

    if (body) {
        requestInit.body = typeof body === 'string' ? body : JSON.stringify(body)
    }

    const request = new Request(url, requestInit)

    // Add json method for POST/PUT/PATCH requests
    const extendedRequest = Object.assign(request, {
        json: body
            ? async () => (typeof body === 'string' ? JSON.parse(body) : body)
            : async () => null,
        user,
        method,
        url,
    })

    return extendedRequest as any
}

/**
 * Attach Payload instance to a request
 */
export function attachPayload(request: Request, payload: Payload): Request & { payload: Payload } {
    return Object.assign(request, { payload })
}

/**
 * Create an authenticated request with a mock user
 */
export function createAuthenticatedRequest(
    url: string,
    payload: Payload,
    user: {
        id: number | string
        email: string
        role?: string
        collection?: string
    },
    options: Parameters<typeof createMockRequest>[1] = {}
) {
    const request = createMockRequest(url, {
        ...options,
        user: {
            ...user,
            collection: user.collection || 'users',
        },
    })

    return attachPayload(request, payload)
}

/**
 * Create a test brand user for authentication tests
 */
export async function createTestBrandUser(
    payload: Payload,
    overrides: Partial<{
        email: string
        password: string
        name: string
        role: 'analyst' | 'owner' | 'admin' | 'viewer'
        subscription: 'free' | 'starter' | 'pro' | 'enterprise'
        isVerified: boolean
    }> = {}
) {
    const defaults = {
        email: `test-brand-${Date.now()}@example.com`,
        password: 'TestPassword123!',
        name: 'Test Brand User',
        role: 'analyst' as const,
        subscription: 'free' as const,
        isVerified: true,
    }

    const data = { ...defaults, ...overrides }

    try {
        const user = await payload.create({
            collection: 'brand-users',
            data,
        })
        return { user, password: data.password }
    } catch (e) {
        console.warn('Failed to create test brand user:', e)
        return null
    }
}

/**
 * Create a test regular user
 */
export async function createTestUser(
    payload: Payload,
    overrides: Partial<{
        email: string
        password: string
        role: 'user' | 'admin' | 'product_editor'
        subscriptionStatus: 'free' | 'subscribed' | 'trial'
    }> = {}
) {
    const defaults = {
        email: `test-user-${Date.now()}@example.com`,
        password: 'TestPassword123!',
        role: 'user' as const,
        subscriptionStatus: 'free' as const,
    }

    const data = { ...defaults, ...overrides }

    try {
        const user = await payload.create({
            collection: 'users',
            data,
        })
        return { user, password: data.password }
    } catch (e) {
        console.warn('Failed to create test user:', e)
        return null
    }
}

/**
 * Create a test product vote record
 */
export async function createTestProductVote(
    payload: Payload,
    barcode: string,
    options: Partial<{
        totalVotes: number
        totalVoteWeight: number
        voters: string[]
    }> = {}
) {
    try {
        return await (payload.create as Function)({
            collection: 'product-votes',
            data: {
                barcode,
                totalVotes: options.totalVotes || 1,
                totalVoteWeight: options.totalVoteWeight || 5,
                voters: options.voters || ['test-voter-1'],
                status: 'voting',
                createdAt: new Date().toISOString(),
            },
        })
    } catch (e) {
        console.warn('Failed to create test product vote:', e)
        return null
    }
}

/**
 * Clean up test data
 */
export async function cleanupTestData(
    payload: Payload,
    collections: string[],
    where: Record<string, any> = {}
) {
    for (const collection of collections) {
        try {
            const docs = await payload.find({
                collection: collection as 'users',
                where: {
                    ...where,
                    // Only delete test data (email contains 'test-')
                    or: [
                        { email: { contains: 'test-' } },
                        { barcode: { contains: 'test-' } },
                    ],
                },
                limit: 100,
            })

            for (const doc of docs.docs) {
                await payload.delete({
                    collection: collection as 'users',
                    id: doc.id,
                })
            }
        } catch (e) {
            // Collection might not exist
        }
    }
}

/**
 * Wait for a specified duration (useful for rate limit tests)
 */
export function wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Generate a unique test identifier
 */
export function uniqueId(prefix = 'test'): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

/**
 * Assert response is a validation error (400)
 */
export async function expectValidationError(response: Response, messageContains?: string) {
    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBeDefined()
    expect(data.code).toBe('VALIDATION_ERROR')
    if (messageContains) {
        expect(data.error.toLowerCase()).toContain(messageContains.toLowerCase())
    }
}

/**
 * Assert response is unauthorized (401)
 */
export async function expectUnauthorized(response: Response) {
    expect(response.status).toBe(401)
    const data = await response.json()
    expect(data.error).toBeDefined()
}

/**
 * Assert response is forbidden (403)
 */
export async function expectForbidden(response: Response) {
    expect(response.status).toBe(403)
    const data = await response.json()
    expect(data.error).toBeDefined()
}

/**
 * Assert response is not found (404)
 */
export async function expectNotFound(response: Response) {
    expect(response.status).toBe(404)
    const data = await response.json()
    expect(data.error).toBeDefined()
}

/**
 * Assert response is rate limited (429)
 */
export async function expectRateLimited(response: Response) {
    expect(response.status).toBe(429)
    const data = await response.json()
    expect(data.error).toContain('Rate limit')
    expect(response.headers.get('Retry-After')).toBeDefined()
}

/**
 * Assert response is successful with data
 */
export async function expectSuccess<T>(response: Response): Promise<T> {
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.success).toBe(true)
    return data as T
}

export default {
    createMockRequest,
    attachPayload,
    createAuthenticatedRequest,
    createTestBrandUser,
    createTestUser,
    createTestProductVote,
    cleanupTestData,
    wait,
    uniqueId,
    expectValidationError,
    expectUnauthorized,
    expectForbidden,
    expectNotFound,
    expectRateLimited,
    expectSuccess,
}
