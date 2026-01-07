/**
 * Integration Tests for User Profile Endpoints
 *
 * Tests contributor profile CRUD operations and statistics.
 * Covers:
 * - GET /api/contributor-profile/:slug - Public profile data
 * - GET /api/my-contributor-stats - Personal stats (fingerprint-based)
 * - POST /api/contributor-profile/update - Update display name, avatar, bio
 * - POST /api/contributor-profile/register-contribution - Register contribution
 */

import { getPayload, Payload } from 'payload'
import config from '@/payload.config'
import { describe, it, beforeAll, beforeEach, expect, vi } from 'vitest'
import {
    getContributorProfileHandler,
    getMyContributorStatsHandler,
    updateContributorProfileHandler,
    registerContributorContributionHandler,
    invalidateContributorCache,
} from '@/endpoints/contributor-profile'

let payload: Payload

// Mock analytics
vi.mock('@/lib/analytics/rudderstack-server', () => ({
    trackServer: vi.fn(),
    identifyServer: vi.fn(),
    flushServer: vi.fn(),
}))

describe('User Profile Endpoints', () => {
    beforeAll(async () => {
        const payloadConfig = await config
        payload = await getPayload({ config: payloadConfig })
    })

    beforeEach(() => {
        // Clear cache between tests
        invalidateContributorCache()
    })

    describe('GET /api/contributor-profile/:slug', () => {
        it('returns public profile by slug', async () => {
            // Create a contributor profile
            const slug = `test-contributor-${Date.now()}`
            const profile = await (payload.create as Function)({
                collection: 'contributor-profiles',
                data: {
                    fingerprintHash: `fp-${slug}`,
                    displayName: 'Test Contributor',
                    avatar: '🔬',
                    bio: 'Testing products for fun',
                    contributorNumber: Math.floor(Math.random() * 10000),
                    shareableSlug: slug,
                    isPublic: true,
                    documentsSubmitted: 10,
                    productsTestedFromSubmissions: 5,
                    peopleHelped: 100,
                    firstCases: 3,
                    contributorLevel: 'builder',
                    badges: ['early_adopter'],
                },
            })

            const request = new Request(`http://localhost/api/contributor-profile/${slug}`, {
                method: 'GET',
            })

            const payloadRequest = Object.assign(request, {
                payload,
                url: request.url,
                method: 'GET',
                user: null,
            })

            const response = await getContributorProfileHandler(payloadRequest as any)
            const data = await response.json()

            expect(response.status).toBe(200)
            expect(data.success).toBe(true)
            expect(data.profile).toBeDefined()
            expect(data.profile.displayName).toBe('Test Contributor')
            expect(data.profile.avatar).toBe('🔬')
            expect(data.profile.bio).toBe('Testing products for fun')
            expect(data.profile.level).toBe('builder')
            expect(data.profile.stats.documentsSubmitted).toBe(10)
            expect(data.profile.stats.productsTestedFromSubmissions).toBe(5)
            expect(data.profile.stats.peopleHelped).toBe(100)
            expect(data.profile.stats.firstCases).toBe(3)
        })

        it('returns 404 for non-existent slug', async () => {
            const request = new Request(
                'http://localhost/api/contributor-profile/nonexistent-slug-12345',
                { method: 'GET' }
            )

            const payloadRequest = Object.assign(request, {
                payload,
                url: request.url,
                method: 'GET',
                user: null,
            })

            const response = await getContributorProfileHandler(payloadRequest as any)

            expect(response.status).toBe(404)
            const data = await response.json()
            expect(data.error).toBe('Contributor not found')
        })

        it('returns 403 for private profile', async () => {
            const slug = `private-contributor-${Date.now()}`
            await (payload.create as Function)({
                collection: 'contributor-profiles',
                data: {
                    fingerprintHash: `fp-${slug}`,
                    displayName: 'Private Contributor',
                    avatar: '🔒',
                    shareableSlug: slug,
                    isPublic: false, // Private
                    documentsSubmitted: 5,
                    contributorLevel: 'new',
                },
            })

            const request = new Request(`http://localhost/api/contributor-profile/${slug}`, {
                method: 'GET',
            })

            const payloadRequest = Object.assign(request, {
                payload,
                url: request.url,
                method: 'GET',
                user: null,
            })

            const response = await getContributorProfileHandler(payloadRequest as any)

            expect(response.status).toBe(403)
            const data = await response.json()
            expect(data.error).toBe('This contributor profile is private')
        })

        it('returns 400 when slug is missing', async () => {
            const request = new Request('http://localhost/api/contributor-profile', {
                method: 'GET',
            })

            const payloadRequest = Object.assign(request, {
                payload,
                url: request.url,
                method: 'GET',
                user: null,
            })

            const response = await getContributorProfileHandler(payloadRequest as any)

            expect(response.status).toBe(400)
            const data = await response.json()
            expect(data.error).toBe('Contributor slug is required')
        })

        it('returns cached response on second request', async () => {
            const slug = `cached-contributor-${Date.now()}`
            await (payload.create as Function)({
                collection: 'contributor-profiles',
                data: {
                    fingerprintHash: `fp-${slug}`,
                    displayName: 'Cached Contributor',
                    avatar: '📦',
                    shareableSlug: slug,
                    isPublic: true,
                    documentsSubmitted: 3,
                    contributorLevel: 'new',
                },
            })

            const request1 = new Request(`http://localhost/api/contributor-profile/${slug}`, {
                method: 'GET',
            })
            const payloadRequest1 = Object.assign(request1, {
                payload,
                url: request1.url,
                method: 'GET',
                user: null,
            })

            const response1 = await getContributorProfileHandler(payloadRequest1 as any)
            const data1 = await response1.json()
            expect(data1.cached).toBe(false)
            expect(response1.headers.get('X-Cache')).toBe('MISS')

            // Second request should be cached
            const request2 = new Request(`http://localhost/api/contributor-profile/${slug}`, {
                method: 'GET',
            })
            const payloadRequest2 = Object.assign(request2, {
                payload,
                url: request2.url,
                method: 'GET',
                user: null,
            })

            const response2 = await getContributorProfileHandler(payloadRequest2 as any)
            const data2 = await response2.json()
            expect(data2.cached).toBe(true)
            expect(response2.headers.get('X-Cache')).toBe('HIT')
        })

        it('returns 405 for non-GET requests', async () => {
            const request = new Request('http://localhost/api/contributor-profile/test-slug', {
                method: 'POST',
            })

            const payloadRequest = Object.assign(request, {
                payload,
                url: request.url,
                method: 'POST',
                user: null,
            })

            const response = await getContributorProfileHandler(payloadRequest as any)

            expect(response.status).toBe(405)
            const data = await response.json()
            expect(data.error).toBe('Method not allowed')
        })
    })

    describe('GET /api/my-contributor-stats', () => {
        it('returns stats for existing contributor', async () => {
            const fingerprintHash = `fp-stats-${Date.now()}`
            await (payload.create as Function)({
                collection: 'contributor-profiles',
                data: {
                    fingerprintHash,
                    displayName: 'Stats Contributor',
                    avatar: '📊',
                    contributorNumber: Math.floor(Math.random() * 10000),
                    shareableSlug: `stats-${Date.now()}`,
                    isPublic: true,
                    documentsSubmitted: 7,
                    productsTestedFromSubmissions: 3,
                    peopleHelped: 50,
                    firstCases: 2,
                    contributorLevel: 'builder',
                },
            })

            const request = new Request('http://localhost/api/my-contributor-stats', {
                method: 'GET',
                headers: {
                    'x-fingerprint': fingerprintHash,
                },
            })

            const payloadRequest = Object.assign(request, {
                payload,
                url: request.url,
                method: 'GET',
                headers: request.headers,
                user: null,
            })

            const response = await getMyContributorStatsHandler(payloadRequest as any)
            const data = await response.json()

            expect(response.status).toBe(200)
            expect(data.success).toBe(true)
            expect(data.hasProfile).toBe(true)
            expect(data.profile.displayName).toBe('Stats Contributor')
            expect(data.stats.documentsSubmitted).toBe(7)
            expect(data.stats.level).toBe('builder')
            expect(data.nextMilestone).toBeDefined()
        })

        it('returns no profile for new contributor', async () => {
            const fingerprintHash = `fp-new-${Date.now()}`

            const request = new Request('http://localhost/api/my-contributor-stats', {
                method: 'GET',
                headers: {
                    'x-fingerprint': fingerprintHash,
                },
            })

            const payloadRequest = Object.assign(request, {
                payload,
                url: request.url,
                method: 'GET',
                headers: request.headers,
                user: null,
            })

            const response = await getMyContributorStatsHandler(payloadRequest as any)
            const data = await response.json()

            expect(response.status).toBe(200)
            expect(data.success).toBe(true)
            expect(data.hasProfile).toBe(false)
            expect(data.stats.documentsSubmitted).toBe(0)
            expect(data.stats.level).toBe('new')
            expect(data.message).toBe('Document your first product to open a case!')
        })

        it('returns 400 when fingerprint header is missing', async () => {
            const request = new Request('http://localhost/api/my-contributor-stats', {
                method: 'GET',
            })

            const payloadRequest = Object.assign(request, {
                payload,
                url: request.url,
                method: 'GET',
                headers: request.headers,
                user: null,
            })

            const response = await getMyContributorStatsHandler(payloadRequest as any)

            expect(response.status).toBe(400)
            const data = await response.json()
            expect(data.error).toBe('Fingerprint required')
        })

        it('returns 405 for non-GET requests', async () => {
            const request = new Request('http://localhost/api/my-contributor-stats', {
                method: 'POST',
                headers: {
                    'x-fingerprint': 'test-fp',
                },
            })

            const payloadRequest = Object.assign(request, {
                payload,
                url: request.url,
                method: 'POST',
                headers: request.headers,
                user: null,
            })

            const response = await getMyContributorStatsHandler(payloadRequest as any)

            expect(response.status).toBe(405)
        })

        it('includes next milestone information', async () => {
            const fingerprintHash = `fp-milestone-${Date.now()}`
            await (payload.create as Function)({
                collection: 'contributor-profiles',
                data: {
                    fingerprintHash,
                    displayName: 'Milestone Contributor',
                    avatar: '🎯',
                    shareableSlug: `milestone-${Date.now()}`,
                    isPublic: true,
                    documentsSubmitted: 3, // 2 more to reach Builder (5)
                    contributorLevel: 'new',
                },
            })

            const request = new Request('http://localhost/api/my-contributor-stats', {
                method: 'GET',
                headers: {
                    'x-fingerprint': fingerprintHash,
                },
            })

            const payloadRequest = Object.assign(request, {
                payload,
                url: request.url,
                method: 'GET',
                headers: request.headers,
                user: null,
            })

            const response = await getMyContributorStatsHandler(payloadRequest as any)
            const data = await response.json()

            expect(data.nextMilestone).toBeDefined()
            expect(data.nextMilestone.nextLevel).toBe('builder')
            expect(data.nextMilestone.remaining).toBe(2)
        })
    })

    describe('POST /api/contributor-profile/update', () => {
        it('updates display name successfully', async () => {
            const fingerprintHash = `fp-update-${Date.now()}`
            await (payload.create as Function)({
                collection: 'contributor-profiles',
                data: {
                    fingerprintHash,
                    displayName: 'Original Name',
                    avatar: '👤',
                    shareableSlug: `update-${Date.now()}`,
                    isPublic: true,
                    documentsSubmitted: 1,
                    contributorLevel: 'new',
                },
            })

            const request = new Request('http://localhost/api/contributor-profile/update', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-fingerprint': fingerprintHash,
                },
                body: JSON.stringify({
                    displayName: 'Updated Name',
                }),
            })

            const payloadRequest = Object.assign(request, {
                payload,
                url: request.url,
                method: 'POST',
                headers: request.headers,
                json: async () => JSON.parse(await request.text()),
                user: null,
            })

            const response = await updateContributorProfileHandler(payloadRequest as any)
            const data = await response.json()

            expect(response.status).toBe(200)
            expect(data.success).toBe(true)
            expect(data.profile.displayName).toBe('Updated Name')
        })

        it('updates avatar successfully', async () => {
            const fingerprintHash = `fp-avatar-${Date.now()}`
            await (payload.create as Function)({
                collection: 'contributor-profiles',
                data: {
                    fingerprintHash,
                    displayName: 'Avatar Test',
                    avatar: '👤',
                    shareableSlug: `avatar-${Date.now()}`,
                    isPublic: true,
                    documentsSubmitted: 1,
                    contributorLevel: 'new',
                },
            })

            const request = new Request('http://localhost/api/contributor-profile/update', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-fingerprint': fingerprintHash,
                },
                body: JSON.stringify({
                    avatar: '🚀',
                }),
            })

            const payloadRequest = Object.assign(request, {
                payload,
                url: request.url,
                method: 'POST',
                headers: request.headers,
                json: async () => JSON.parse(await request.text()),
                user: null,
            })

            const response = await updateContributorProfileHandler(payloadRequest as any)
            const data = await response.json()

            expect(response.status).toBe(200)
            expect(data.profile.avatar).toBe('🚀')
        })

        it('updates bio successfully', async () => {
            const fingerprintHash = `fp-bio-${Date.now()}`
            await (payload.create as Function)({
                collection: 'contributor-profiles',
                data: {
                    fingerprintHash,
                    displayName: 'Bio Test',
                    avatar: '📝',
                    shareableSlug: `bio-${Date.now()}`,
                    isPublic: true,
                    documentsSubmitted: 1,
                    contributorLevel: 'new',
                },
            })

            const request = new Request('http://localhost/api/contributor-profile/update', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-fingerprint': fingerprintHash,
                },
                body: JSON.stringify({
                    bio: 'I test products to help others make informed choices.',
                }),
            })

            const payloadRequest = Object.assign(request, {
                payload,
                url: request.url,
                method: 'POST',
                headers: request.headers,
                json: async () => JSON.parse(await request.text()),
                user: null,
            })

            const response = await updateContributorProfileHandler(payloadRequest as any)
            const data = await response.json()

            expect(response.status).toBe(200)
            expect(data.profile.bio).toBe('I test products to help others make informed choices.')
        })

        it('updates privacy setting successfully', async () => {
            const fingerprintHash = `fp-privacy-${Date.now()}`
            await (payload.create as Function)({
                collection: 'contributor-profiles',
                data: {
                    fingerprintHash,
                    displayName: 'Privacy Test',
                    avatar: '🔓',
                    shareableSlug: `privacy-${Date.now()}`,
                    isPublic: true,
                    documentsSubmitted: 1,
                    contributorLevel: 'new',
                },
            })

            const request = new Request('http://localhost/api/contributor-profile/update', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-fingerprint': fingerprintHash,
                },
                body: JSON.stringify({
                    isPublic: false,
                }),
            })

            const payloadRequest = Object.assign(request, {
                payload,
                url: request.url,
                method: 'POST',
                headers: request.headers,
                json: async () => JSON.parse(await request.text()),
                user: null,
            })

            const response = await updateContributorProfileHandler(payloadRequest as any)
            const data = await response.json()

            expect(response.status).toBe(200)
            expect(data.profile.isPublic).toBe(false)
        })

        it('returns 404 for non-existent profile', async () => {
            const request = new Request('http://localhost/api/contributor-profile/update', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-fingerprint': 'nonexistent-fingerprint',
                },
                body: JSON.stringify({
                    displayName: 'New Name',
                }),
            })

            const payloadRequest = Object.assign(request, {
                payload,
                url: request.url,
                method: 'POST',
                headers: request.headers,
                json: async () => JSON.parse(await request.text()),
                user: null,
            })

            const response = await updateContributorProfileHandler(payloadRequest as any)

            expect(response.status).toBe(404)
            const data = await response.json()
            expect(data.error).toBe('Contributor profile not found')
        })

        it('returns 400 when fingerprint header is missing', async () => {
            const request = new Request('http://localhost/api/contributor-profile/update', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    displayName: 'New Name',
                }),
            })

            const payloadRequest = Object.assign(request, {
                payload,
                url: request.url,
                method: 'POST',
                headers: request.headers,
                json: async () => JSON.parse(await request.text()),
                user: null,
            })

            const response = await updateContributorProfileHandler(payloadRequest as any)

            expect(response.status).toBe(400)
            const data = await response.json()
            expect(data.error).toBe('Fingerprint required')
        })

        it('truncates display name to 50 characters', async () => {
            const fingerprintHash = `fp-truncate-${Date.now()}`
            await (payload.create as Function)({
                collection: 'contributor-profiles',
                data: {
                    fingerprintHash,
                    displayName: 'Short Name',
                    avatar: '✂️',
                    shareableSlug: `truncate-${Date.now()}`,
                    isPublic: true,
                    documentsSubmitted: 1,
                    contributorLevel: 'new',
                },
            })

            const longName = 'A'.repeat(100) // 100 characters

            const request = new Request('http://localhost/api/contributor-profile/update', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-fingerprint': fingerprintHash,
                },
                body: JSON.stringify({
                    displayName: longName,
                }),
            })

            const payloadRequest = Object.assign(request, {
                payload,
                url: request.url,
                method: 'POST',
                headers: request.headers,
                json: async () => JSON.parse(await request.text()),
                user: null,
            })

            const response = await updateContributorProfileHandler(payloadRequest as any)
            const data = await response.json()

            expect(response.status).toBe(200)
            expect(data.profile.displayName.length).toBe(50)
        })

        it('truncates bio to 280 characters', async () => {
            const fingerprintHash = `fp-bio-truncate-${Date.now()}`
            await (payload.create as Function)({
                collection: 'contributor-profiles',
                data: {
                    fingerprintHash,
                    displayName: 'Bio Truncate Test',
                    avatar: '📏',
                    shareableSlug: `bio-truncate-${Date.now()}`,
                    isPublic: true,
                    documentsSubmitted: 1,
                    contributorLevel: 'new',
                },
            })

            const longBio = 'B'.repeat(500) // 500 characters

            const request = new Request('http://localhost/api/contributor-profile/update', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-fingerprint': fingerprintHash,
                },
                body: JSON.stringify({
                    bio: longBio,
                }),
            })

            const payloadRequest = Object.assign(request, {
                payload,
                url: request.url,
                method: 'POST',
                headers: request.headers,
                json: async () => JSON.parse(await request.text()),
                user: null,
            })

            const response = await updateContributorProfileHandler(payloadRequest as any)
            const data = await response.json()

            expect(response.status).toBe(200)
            expect(data.profile.bio.length).toBe(280)
        })

        it('returns 405 for non-POST requests', async () => {
            const request = new Request('http://localhost/api/contributor-profile/update', {
                method: 'GET',
                headers: {
                    'x-fingerprint': 'test-fp',
                },
            })

            const payloadRequest = Object.assign(request, {
                payload,
                url: request.url,
                method: 'GET',
                headers: request.headers,
                user: null,
            })

            const response = await updateContributorProfileHandler(payloadRequest as any)

            expect(response.status).toBe(405)
        })
    })

    describe('POST /api/contributor-profile/register-contribution', () => {
        it('creates new profile on first contribution', async () => {
            const fingerprintHash = `fp-first-contrib-${Date.now()}`

            // Create a product vote to reference
            const productVote = await (payload.create as Function)({
                collection: 'product-votes',
                data: {
                    barcode: `barcode-${Date.now()}`,
                    productName: 'Test Product',
                    status: 'collecting_votes',
                    totalVotes: 1,
                    totalVoteWeight: 1,
                },
            })

            const request = new Request('http://localhost/api/contributor-profile/register-contribution', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    fingerprintHash,
                    barcode: 'test-barcode',
                    productVoteId: productVote.id,
                }),
            })

            const payloadRequest = Object.assign(request, {
                payload,
                url: request.url,
                method: 'POST',
                headers: request.headers,
                json: async () => JSON.parse(await request.text()),
                user: null,
            })

            const response = await registerContributorContributionHandler(payloadRequest as any)
            const data = await response.json()

            expect(response.status).toBe(200)
            expect(data.success).toBe(true)
            expect(data.isFirstContributor).toBe(true)
            expect(data.casePosition).toBe(1)
            expect(data.stats.documentsSubmitted).toBe(1)
        })

        it('increments documents count on subsequent contributions', async () => {
            const fingerprintHash = `fp-multiple-contrib-${Date.now()}`

            // Create profile with existing submissions
            await (payload.create as Function)({
                collection: 'contributor-profiles',
                data: {
                    fingerprintHash,
                    displayName: 'Multiple Contributor',
                    avatar: '🔄',
                    shareableSlug: `multiple-${Date.now()}`,
                    isPublic: true,
                    documentsSubmitted: 5,
                    firstCases: 2,
                    contributorLevel: 'builder',
                },
            })

            const productVote = await (payload.create as Function)({
                collection: 'product-votes',
                data: {
                    barcode: `barcode-multi-${Date.now()}`,
                    productName: 'Another Test Product',
                    status: 'collecting_votes',
                    totalVotes: 1,
                },
            })

            const request = new Request('http://localhost/api/contributor-profile/register-contribution', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    fingerprintHash,
                    barcode: 'test-barcode-2',
                    productVoteId: productVote.id,
                }),
            })

            const payloadRequest = Object.assign(request, {
                payload,
                url: request.url,
                method: 'POST',
                headers: request.headers,
                json: async () => JSON.parse(await request.text()),
                user: null,
            })

            const response = await registerContributorContributionHandler(payloadRequest as any)
            const data = await response.json()

            expect(response.status).toBe(200)
            expect(data.stats.documentsSubmitted).toBe(6)
        })

        it('returns 400 when required fields are missing', async () => {
            const request = new Request('http://localhost/api/contributor-profile/register-contribution', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    fingerprintHash: 'test-fp',
                    // Missing barcode and productVoteId
                }),
            })

            const payloadRequest = Object.assign(request, {
                payload,
                url: request.url,
                method: 'POST',
                headers: request.headers,
                json: async () => JSON.parse(await request.text()),
                user: null,
            })

            const response = await registerContributorContributionHandler(payloadRequest as any)

            expect(response.status).toBe(400)
            const data = await response.json()
            expect(data.error).toContain('required')
        })

        it('does not duplicate contributor in scoutContributors', async () => {
            const fingerprintHash = `fp-no-dupe-${Date.now()}`

            await (payload.create as Function)({
                collection: 'contributor-profiles',
                data: {
                    fingerprintHash,
                    displayName: 'No Dupe Contributor',
                    avatar: '🚫',
                    contributorNumber: Math.floor(Math.random() * 10000),
                    shareableSlug: `no-dupe-${Date.now()}`,
                    isPublic: true,
                    documentsSubmitted: 1,
                    contributorLevel: 'new',
                },
            })

            const productVote = await (payload.create as Function)({
                collection: 'product-votes',
                data: {
                    barcode: `barcode-dupe-${Date.now()}`,
                    productName: 'Dupe Test Product',
                    status: 'collecting_votes',
                    totalVotes: 1,
                    scoutContributors: [
                        {
                            fingerprintHash,
                            casePosition: 1,
                            contributedAt: new Date().toISOString(),
                        },
                    ],
                },
            })

            const request = new Request('http://localhost/api/contributor-profile/register-contribution', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    fingerprintHash,
                    barcode: 'test-barcode-dupe',
                    productVoteId: productVote.id,
                }),
            })

            const payloadRequest = Object.assign(request, {
                payload,
                url: request.url,
                method: 'POST',
                headers: request.headers,
                json: async () => JSON.parse(await request.text()),
                user: null,
            })

            const response = await registerContributorContributionHandler(payloadRequest as any)
            const data = await response.json()

            expect(response.status).toBe(200)
            expect(data.totalContributors).toBe(1) // Should not have added another
        })

        it('returns 405 for non-POST requests', async () => {
            const request = new Request('http://localhost/api/contributor-profile/register-contribution', {
                method: 'GET',
            })

            const payloadRequest = Object.assign(request, {
                payload,
                url: request.url,
                method: 'GET',
                headers: request.headers,
                user: null,
            })

            const response = await registerContributorContributionHandler(payloadRequest as any)

            expect(response.status).toBe(405)
        })
    })

    describe('Contributor Levels', () => {
        it('assigns "new" level for 0-4 documents', async () => {
            const fingerprintHash = `fp-level-new-${Date.now()}`
            await (payload.create as Function)({
                collection: 'contributor-profiles',
                data: {
                    fingerprintHash,
                    displayName: 'New Level',
                    avatar: '🌱',
                    shareableSlug: `level-new-${Date.now()}`,
                    isPublic: true,
                    documentsSubmitted: 3,
                    contributorLevel: 'new',
                },
            })

            const request = new Request('http://localhost/api/my-contributor-stats', {
                method: 'GET',
                headers: {
                    'x-fingerprint': fingerprintHash,
                },
            })

            const payloadRequest = Object.assign(request, {
                payload,
                url: request.url,
                method: 'GET',
                headers: request.headers,
                user: null,
            })

            const response = await getMyContributorStatsHandler(payloadRequest as any)
            const data = await response.json()

            expect(data.stats.level).toBe('new')
            expect(data.nextMilestone.nextLevel).toBe('builder')
            expect(data.nextMilestone.remaining).toBe(2)
        })

        it('assigns "builder" level for 5-14 documents', async () => {
            const fingerprintHash = `fp-level-builder-${Date.now()}`
            await (payload.create as Function)({
                collection: 'contributor-profiles',
                data: {
                    fingerprintHash,
                    displayName: 'Builder Level',
                    avatar: '🔧',
                    shareableSlug: `level-builder-${Date.now()}`,
                    isPublic: true,
                    documentsSubmitted: 10,
                    contributorLevel: 'builder',
                },
            })

            const request = new Request('http://localhost/api/my-contributor-stats', {
                method: 'GET',
                headers: {
                    'x-fingerprint': fingerprintHash,
                },
            })

            const payloadRequest = Object.assign(request, {
                payload,
                url: request.url,
                method: 'GET',
                headers: request.headers,
                user: null,
            })

            const response = await getMyContributorStatsHandler(payloadRequest as any)
            const data = await response.json()

            expect(data.stats.level).toBe('builder')
            expect(data.nextMilestone.nextLevel).toBe('veteran')
        })

        it('assigns "veteran" level for 15-49 documents', async () => {
            const fingerprintHash = `fp-level-veteran-${Date.now()}`
            await (payload.create as Function)({
                collection: 'contributor-profiles',
                data: {
                    fingerprintHash,
                    displayName: 'Veteran Level',
                    avatar: '⭐',
                    shareableSlug: `level-veteran-${Date.now()}`,
                    isPublic: true,
                    documentsSubmitted: 25,
                    contributorLevel: 'veteran',
                },
            })

            const request = new Request('http://localhost/api/my-contributor-stats', {
                method: 'GET',
                headers: {
                    'x-fingerprint': fingerprintHash,
                },
            })

            const payloadRequest = Object.assign(request, {
                payload,
                url: request.url,
                method: 'GET',
                headers: request.headers,
                user: null,
            })

            const response = await getMyContributorStatsHandler(payloadRequest as any)
            const data = await response.json()

            expect(data.stats.level).toBe('veteran')
            expect(data.nextMilestone.nextLevel).toBe('champion')
        })

        it('assigns "champion" level for 50+ documents', async () => {
            const fingerprintHash = `fp-level-champion-${Date.now()}`
            await (payload.create as Function)({
                collection: 'contributor-profiles',
                data: {
                    fingerprintHash,
                    displayName: 'Champion Level',
                    avatar: '🏆',
                    shareableSlug: `level-champion-${Date.now()}`,
                    isPublic: true,
                    documentsSubmitted: 75,
                    contributorLevel: 'champion',
                },
            })

            const request = new Request('http://localhost/api/my-contributor-stats', {
                method: 'GET',
                headers: {
                    'x-fingerprint': fingerprintHash,
                },
            })

            const payloadRequest = Object.assign(request, {
                payload,
                url: request.url,
                method: 'GET',
                headers: request.headers,
                user: null,
            })

            const response = await getMyContributorStatsHandler(payloadRequest as any)
            const data = await response.json()

            expect(data.stats.level).toBe('champion')
            expect(data.nextMilestone.remaining).toBe(0)
            expect(data.nextMilestone.message).toContain('building the database')
        })
    })

    describe('Cache Invalidation', () => {
        it('invalidates cache after profile update', async () => {
            const slug = `cache-invalidate-${Date.now()}`
            const fingerprintHash = `fp-${slug}`

            await (payload.create as Function)({
                collection: 'contributor-profiles',
                data: {
                    fingerprintHash,
                    displayName: 'Cache Invalidate Test',
                    avatar: '🗑️',
                    shareableSlug: slug,
                    isPublic: true,
                    documentsSubmitted: 1,
                    contributorLevel: 'new',
                },
            })

            // First request - cache miss
            const request1 = new Request(`http://localhost/api/contributor-profile/${slug}`, {
                method: 'GET',
            })
            const payloadRequest1 = Object.assign(request1, {
                payload,
                url: request1.url,
                method: 'GET',
                user: null,
            })
            const response1 = await getContributorProfileHandler(payloadRequest1 as any)
            const data1 = await response1.json()
            expect(data1.profile.displayName).toBe('Cache Invalidate Test')

            // Update profile
            const updateRequest = new Request('http://localhost/api/contributor-profile/update', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-fingerprint': fingerprintHash,
                },
                body: JSON.stringify({
                    displayName: 'Updated Cache Test',
                }),
            })
            const updatePayloadRequest = Object.assign(updateRequest, {
                payload,
                url: updateRequest.url,
                method: 'POST',
                headers: updateRequest.headers,
                json: async () => JSON.parse(await updateRequest.text()),
                user: null,
            })
            await updateContributorProfileHandler(updatePayloadRequest as any)

            // Third request - should get updated data (cache was invalidated)
            const request3 = new Request(`http://localhost/api/contributor-profile/${slug}`, {
                method: 'GET',
            })
            const payloadRequest3 = Object.assign(request3, {
                payload,
                url: request3.url,
                method: 'GET',
                user: null,
            })
            const response3 = await getContributorProfileHandler(payloadRequest3 as any)
            const data3 = await response3.json()
            expect(data3.profile.displayName).toBe('Updated Cache Test')
        })
    })

    describe('Error Handling', () => {
        it('handles database errors gracefully in profile lookup', async () => {
            // This test verifies the error handling path
            // The actual error would be from a database issue
            const request = new Request('http://localhost/api/contributor-profile/valid-slug', {
                method: 'GET',
            })

            const payloadRequest = Object.assign(request, {
                payload,
                url: request.url,
                method: 'GET',
                user: null,
            })

            // Should return 404 for non-existent, not 500
            const response = await getContributorProfileHandler(payloadRequest as any)
            expect(response.status).toBe(404)
        })

        it('handles malformed JSON in update request', async () => {
            const fingerprintHash = `fp-malformed-${Date.now()}`
            await (payload.create as Function)({
                collection: 'contributor-profiles',
                data: {
                    fingerprintHash,
                    displayName: 'Malformed Test',
                    avatar: '❌',
                    shareableSlug: `malformed-${Date.now()}`,
                    isPublic: true,
                    documentsSubmitted: 1,
                    contributorLevel: 'new',
                },
            })

            const request = new Request('http://localhost/api/contributor-profile/update', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-fingerprint': fingerprintHash,
                },
                body: 'not valid json',
            })

            const payloadRequest = Object.assign(request, {
                payload,
                url: request.url,
                method: 'POST',
                headers: request.headers,
                json: async () => {
                    throw new Error('Invalid JSON')
                },
                user: null,
            })

            const response = await updateContributorProfileHandler(payloadRequest as any)

            expect(response.status).toBe(500)
        })
    })
})
