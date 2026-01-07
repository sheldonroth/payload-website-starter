/**
 * Integration Tests for Product Vote Endpoints
 *
 * Tests the "Proof of Possession" voting system for untested products.
 * Covers:
 * - POST /api/product-vote - Cast a vote for a product
 * - GET /api/product-vote/status - Get vote status for a barcode
 * - GET /api/product-vote/leaderboard - Get top voted products
 * - POST /api/product-vote/contribute - Add photos for bounty bonus
 * - Vote weight calculations
 * - Duplicate vote prevention
 */

import { getPayload, Payload } from 'payload'
import config from '@/payload.config'
import { describe, it, beforeAll, beforeEach, expect, vi } from 'vitest'
import {
    productVoteHandler,
    productVoteStatusHandler,
    productVoteLeaderboardHandler,
    productVoteContributeHandler,
} from '@/endpoints/product-vote'

let payload: Payload

describe('Product Vote Endpoints', () => {
    beforeAll(async () => {
        const payloadConfig = await config
        payload = await getPayload({ config: payloadConfig })
    })

    describe('POST /api/product-vote', () => {
        it('creates a new vote record for unknown barcode', async () => {
            const barcode = `test-barcode-${Date.now()}`

            const request = new Request('http://localhost/api/product-vote', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    barcode,
                    voteType: 'scan',
                    fingerprint: 'test-fingerprint-1',
                }),
            })

            const payloadRequest = Object.assign(request, {
                payload,
                method: 'POST',
                json: async () => JSON.parse(await request.text()),
                user: null,
            })

            const response = await productVoteHandler(payloadRequest as any)
            const data = await response.json()

            expect(response.status).toBe(200)
            expect(data.success).toBe(true)
            expect(data.voteRegistered).toBe(true)
            expect(data.yourVoteRank).toBe(1)
            expect(data.fundingProgress).toBeGreaterThanOrEqual(0)
            expect(data.productInfo.barcode).toBe(barcode)
        })

        it('increments vote count for existing barcode', async () => {
            const barcode = `test-barcode-increment-${Date.now()}`

            // First vote
            const request1 = new Request('http://localhost/api/product-vote', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    barcode,
                    voteType: 'scan',
                    fingerprint: 'fingerprint-1',
                }),
            })
            const payloadRequest1 = Object.assign(request1, {
                payload,
                method: 'POST',
                json: async () => JSON.parse(await request1.text()),
                user: null,
            })
            await productVoteHandler(payloadRequest1 as any)

            // Second vote with different fingerprint
            const request2 = new Request('http://localhost/api/product-vote', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    barcode,
                    voteType: 'scan',
                    fingerprint: 'fingerprint-2',
                }),
            })
            const payloadRequest2 = Object.assign(request2, {
                payload,
                method: 'POST',
                json: async () => JSON.parse(await request2.text()),
                user: null,
            })
            const response2 = await productVoteHandler(payloadRequest2 as any)
            const data2 = await response2.json()

            expect(data2.success).toBe(true)
            expect(data2.totalVotes).toBe(2)
            expect(data2.yourVoteRank).toBe(2)
        })

        it('applies correct vote weights', async () => {
            // Test search weight (1x)
            const barcodeSearch = `test-barcode-search-${Date.now()}`
            const searchRequest = new Request('http://localhost/api/product-vote', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    barcode: barcodeSearch,
                    voteType: 'search',
                }),
            })
            const searchPayloadRequest = Object.assign(searchRequest, {
                payload,
                method: 'POST',
                json: async () => JSON.parse(await searchRequest.text()),
                user: null,
            })
            await productVoteHandler(searchPayloadRequest as any)

            // Test scan weight (5x)
            const barcodeScan = `test-barcode-scan-${Date.now()}`
            const scanRequest = new Request('http://localhost/api/product-vote', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    barcode: barcodeScan,
                    voteType: 'scan',
                }),
            })
            const scanPayloadRequest = Object.assign(scanRequest, {
                payload,
                method: 'POST',
                json: async () => JSON.parse(await scanRequest.text()),
                user: null,
            })
            await productVoteHandler(scanPayloadRequest as any)

            // Test member_scan weight (20x)
            const barcodeMember = `test-barcode-member-${Date.now()}`
            const memberRequest = new Request('http://localhost/api/product-vote', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    barcode: barcodeMember,
                    voteType: 'member_scan',
                }),
            })
            const memberPayloadRequest = Object.assign(memberRequest, {
                payload,
                method: 'POST',
                json: async () => JSON.parse(await memberRequest.text()),
                user: null,
            })
            const memberResponse = await productVoteHandler(memberPayloadRequest as any)
            const memberData = await memberResponse.json()

            expect(memberData.success).toBe(true)
            expect(memberData.message).toContain('20x')
        })

        it('returns 400 when barcode is missing', async () => {
            const request = new Request('http://localhost/api/product-vote', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    voteType: 'scan',
                }),
            })

            const payloadRequest = Object.assign(request, {
                payload,
                method: 'POST',
                json: async () => JSON.parse(await request.text()),
                user: null,
            })

            const response = await productVoteHandler(payloadRequest as any)

            expect(response.status).toBe(400)
            const data = await response.json()
            expect(data.error).toBe('Barcode is required')
        })

        it('returns 400 for invalid vote type', async () => {
            const request = new Request('http://localhost/api/product-vote', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    barcode: '5000328657950',
                    voteType: 'invalid_type',
                }),
            })

            const payloadRequest = Object.assign(request, {
                payload,
                method: 'POST',
                json: async () => JSON.parse(await request.text()),
                user: null,
            })

            const response = await productVoteHandler(payloadRequest as any)

            expect(response.status).toBe(400)
            const data = await response.json()
            expect(data.error).toBe('Invalid vote type')
        })

        it('returns 405 for non-POST requests', async () => {
            const request = new Request('http://localhost/api/product-vote', {
                method: 'GET',
            })

            const payloadRequest = Object.assign(request, {
                payload,
                method: 'GET',
                user: null,
            })

            const response = await productVoteHandler(payloadRequest as any)

            expect(response.status).toBe(405)
        })

        it('handles product info submission', async () => {
            const barcode = `test-barcode-info-${Date.now()}`

            const request = new Request('http://localhost/api/product-vote', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    barcode,
                    voteType: 'scan',
                    productInfo: {
                        name: 'Test Product Name',
                        brand: 'Test Brand',
                        imageUrl: 'https://example.com/image.jpg',
                    },
                }),
            })

            const payloadRequest = Object.assign(request, {
                payload,
                method: 'POST',
                json: async () => JSON.parse(await request.text()),
                user: null,
            })

            const response = await productVoteHandler(payloadRequest as any)
            const data = await response.json()

            expect(data.success).toBe(true)
            expect(data.productInfo.name).toBe('Test Product Name')
            expect(data.productInfo.brand).toBe('Test Brand')
        })

        it('prevents duplicate votes from same fingerprint', async () => {
            const barcode = `test-barcode-dupe-${Date.now()}`
            const fingerprint = 'same-fingerprint'

            // First vote
            const request1 = new Request('http://localhost/api/product-vote', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    barcode,
                    voteType: 'scan',
                    fingerprint,
                }),
            })
            const payloadRequest1 = Object.assign(request1, {
                payload,
                method: 'POST',
                json: async () => JSON.parse(await request1.text()),
                user: null,
            })
            await productVoteHandler(payloadRequest1 as any)

            // Second vote with same fingerprint
            const request2 = new Request('http://localhost/api/product-vote', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    barcode,
                    voteType: 'scan',
                    fingerprint,
                }),
            })
            const payloadRequest2 = Object.assign(request2, {
                payload,
                method: 'POST',
                json: async () => JSON.parse(await request2.text()),
                user: null,
            })
            const response2 = await productVoteHandler(payloadRequest2 as any)
            const data2 = await response2.json()

            // Unique voters should still be 1
            expect(data2.totalVotes).toBe(1)
        })
    })

    describe('GET /api/product-vote/status', () => {
        it('returns vote status for existing barcode', async () => {
            const barcode = `test-status-${Date.now()}`

            // Create a vote first
            const voteRequest = new Request('http://localhost/api/product-vote', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ barcode, voteType: 'scan' }),
            })
            const votePayloadRequest = Object.assign(voteRequest, {
                payload,
                method: 'POST',
                json: async () => JSON.parse(await voteRequest.text()),
                user: null,
            })
            await productVoteHandler(votePayloadRequest as any)

            // Check status
            const statusRequest = new Request(
                `http://localhost/api/product-vote/status?barcode=${barcode}`,
                { method: 'GET' }
            )
            const statusPayloadRequest = Object.assign(statusRequest, {
                payload,
                method: 'GET',
                url: statusRequest.url,
                user: null,
            })

            const response = await productVoteStatusHandler(statusPayloadRequest as any)
            const data = await response.json()

            expect(response.status).toBe(200)
            expect(data.exists).toBe(true)
            expect(data.barcode).toBe(barcode)
            expect(data.totalVotes).toBe(1)
        })

        it('returns not found for non-existent barcode', async () => {
            const statusRequest = new Request(
                `http://localhost/api/product-vote/status?barcode=nonexistent-${Date.now()}`,
                { method: 'GET' }
            )
            const statusPayloadRequest = Object.assign(statusRequest, {
                payload,
                method: 'GET',
                url: statusRequest.url,
                user: null,
            })

            const response = await productVoteStatusHandler(statusPayloadRequest as any)
            const data = await response.json()

            expect(response.status).toBe(200)
            expect(data.exists).toBe(false)
            expect(data.totalVotes).toBe(0)
        })

        it('returns 400 when barcode is missing', async () => {
            const statusRequest = new Request(
                'http://localhost/api/product-vote/status',
                { method: 'GET' }
            )
            const statusPayloadRequest = Object.assign(statusRequest, {
                payload,
                method: 'GET',
                url: statusRequest.url,
                user: null,
            })

            const response = await productVoteStatusHandler(statusPayloadRequest as any)

            expect(response.status).toBe(400)
        })

        it('returns 405 for non-GET requests', async () => {
            const statusRequest = new Request(
                'http://localhost/api/product-vote/status?barcode=test',
                { method: 'POST' }
            )
            const statusPayloadRequest = Object.assign(statusRequest, {
                payload,
                method: 'POST',
                url: statusRequest.url,
                user: null,
            })

            const response = await productVoteStatusHandler(statusPayloadRequest as any)

            expect(response.status).toBe(405)
        })
    })

    describe('GET /api/product-vote/leaderboard', () => {
        it('returns top voted products', async () => {
            // Create some votes
            const barcodes = [`lb-test-1-${Date.now()}`, `lb-test-2-${Date.now()}`]

            for (const barcode of barcodes) {
                const request = new Request('http://localhost/api/product-vote', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        barcode,
                        voteType: 'member_scan',
                        productInfo: { name: `Product ${barcode}` },
                    }),
                })
                const payloadRequest = Object.assign(request, {
                    payload,
                    method: 'POST',
                    json: async () => JSON.parse(await request.text()),
                    user: null,
                })
                await productVoteHandler(payloadRequest as any)
            }

            const leaderboardRequest = new Request(
                'http://localhost/api/product-vote/leaderboard?limit=10',
                { method: 'GET' }
            )
            const leaderboardPayloadRequest = Object.assign(leaderboardRequest, {
                payload,
                method: 'GET',
                url: leaderboardRequest.url,
                user: null,
            })

            const response = await productVoteLeaderboardHandler(leaderboardPayloadRequest as any)
            const data = await response.json()

            expect(response.status).toBe(200)
            expect(data.leaderboard).toBeDefined()
            expect(Array.isArray(data.leaderboard)).toBe(true)
            expect(data.total).toBeGreaterThanOrEqual(0)
        })

        it('respects limit parameter', async () => {
            const leaderboardRequest = new Request(
                'http://localhost/api/product-vote/leaderboard?limit=5',
                { method: 'GET' }
            )
            const leaderboardPayloadRequest = Object.assign(leaderboardRequest, {
                payload,
                method: 'GET',
                url: leaderboardRequest.url,
                user: null,
            })

            const response = await productVoteLeaderboardHandler(leaderboardPayloadRequest as any)
            const data = await response.json()

            expect(response.status).toBe(200)
            expect(data.leaderboard.length).toBeLessThanOrEqual(5)
        })

        it('caps limit at 50', async () => {
            const leaderboardRequest = new Request(
                'http://localhost/api/product-vote/leaderboard?limit=100',
                { method: 'GET' }
            )
            const leaderboardPayloadRequest = Object.assign(leaderboardRequest, {
                payload,
                method: 'GET',
                url: leaderboardRequest.url,
                user: null,
            })

            const response = await productVoteLeaderboardHandler(leaderboardPayloadRequest as any)
            const data = await response.json()

            expect(response.status).toBe(200)
            expect(data.leaderboard.length).toBeLessThanOrEqual(50)
        })
    })

    describe('POST /api/product-vote/contribute', () => {
        it('awards bounty for photo contribution from different user', async () => {
            const barcode = `contrib-test-${Date.now()}`
            const originalFingerprint = 'original-voter-fp'
            const contributorFingerprint = 'contributor-fp'

            // Create initial vote
            const voteRequest = new Request('http://localhost/api/product-vote', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    barcode,
                    voteType: 'scan',
                    fingerprint: originalFingerprint,
                }),
            })
            const votePayloadRequest = Object.assign(voteRequest, {
                payload,
                method: 'POST',
                json: async () => JSON.parse(await voteRequest.text()),
                user: null,
            })
            await productVoteHandler(votePayloadRequest as any)

            // Contribute photos from different user
            const contributeRequest = new Request('http://localhost/api/product-vote/contribute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    barcode,
                    fingerprintId: contributorFingerprint,
                    submissionId: 123,
                }),
            })
            const contributePayloadRequest = Object.assign(contributeRequest, {
                payload,
                method: 'POST',
                json: async () => JSON.parse(await contributeRequest.text()),
                user: null,
            })

            const response = await productVoteContributeHandler(contributePayloadRequest as any)
            const data = await response.json()

            expect(response.status).toBe(200)
            expect(data.success).toBe(true)
            expect(data.bountyAwarded).toBe(true)
            expect(data.bonusWeight).toBe(10)
        })

        it('does not award bounty to original voter', async () => {
            const barcode = `contrib-original-${Date.now()}`
            const fingerprint = 'same-voter-fp'

            // Create initial vote
            const voteRequest = new Request('http://localhost/api/product-vote', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    barcode,
                    voteType: 'scan',
                    fingerprint,
                }),
            })
            const votePayloadRequest = Object.assign(voteRequest, {
                payload,
                method: 'POST',
                json: async () => JSON.parse(await voteRequest.text()),
                user: null,
            })
            await productVoteHandler(votePayloadRequest as any)

            // Try to contribute with same fingerprint
            const contributeRequest = new Request('http://localhost/api/product-vote/contribute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    barcode,
                    fingerprintId: fingerprint,
                    submissionId: 123,
                }),
            })
            const contributePayloadRequest = Object.assign(contributeRequest, {
                payload,
                method: 'POST',
                json: async () => JSON.parse(await contributeRequest.text()),
                user: null,
            })

            const response = await productVoteContributeHandler(contributePayloadRequest as any)
            const data = await response.json()

            expect(response.status).toBe(200)
            expect(data.bountyAwarded).toBe(false)
            expect(data.bonusWeight).toBe(0)
        })

        it('returns 404 for non-existent barcode', async () => {
            const contributeRequest = new Request('http://localhost/api/product-vote/contribute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    barcode: `nonexistent-${Date.now()}`,
                    fingerprintId: 'some-fp',
                    submissionId: 123,
                }),
            })
            const contributePayloadRequest = Object.assign(contributeRequest, {
                payload,
                method: 'POST',
                json: async () => JSON.parse(await contributeRequest.text()),
                user: null,
            })

            const response = await productVoteContributeHandler(contributePayloadRequest as any)

            expect(response.status).toBe(404)
        })

        it('returns 400 when required fields are missing', async () => {
            const contributeRequest = new Request('http://localhost/api/product-vote/contribute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    barcode: '5000328657950',
                    // Missing fingerprintId and submissionId
                }),
            })
            const contributePayloadRequest = Object.assign(contributeRequest, {
                payload,
                method: 'POST',
                json: async () => JSON.parse(await contributeRequest.text()),
                user: null,
            })

            const response = await productVoteContributeHandler(contributePayloadRequest as any)

            expect(response.status).toBe(400)
        })

        it('prevents duplicate contributions', async () => {
            const barcode = `contrib-dupe-${Date.now()}`
            const fingerprint = 'contributor-dupe-fp'

            // Create initial vote
            const voteRequest = new Request('http://localhost/api/product-vote', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ barcode, voteType: 'scan' }),
            })
            const votePayloadRequest = Object.assign(voteRequest, {
                payload,
                method: 'POST',
                json: async () => JSON.parse(await voteRequest.text()),
                user: null,
            })
            await productVoteHandler(votePayloadRequest as any)

            // First contribution
            const contributeRequest1 = new Request('http://localhost/api/product-vote/contribute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    barcode,
                    fingerprintId: fingerprint,
                    submissionId: 123,
                }),
            })
            const contributePayloadRequest1 = Object.assign(contributeRequest1, {
                payload,
                method: 'POST',
                json: async () => JSON.parse(await contributeRequest1.text()),
                user: null,
            })
            await productVoteContributeHandler(contributePayloadRequest1 as any)

            // Second contribution with same fingerprint
            const contributeRequest2 = new Request('http://localhost/api/product-vote/contribute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    barcode,
                    fingerprintId: fingerprint,
                    submissionId: 456,
                }),
            })
            const contributePayloadRequest2 = Object.assign(contributeRequest2, {
                payload,
                method: 'POST',
                json: async () => JSON.parse(await contributeRequest2.text()),
                user: null,
            })

            const response = await productVoteContributeHandler(contributePayloadRequest2 as any)
            const data = await response.json()

            expect(data.success).toBe(false)
            expect(data.bountyAwarded).toBe(false)
            expect(data.message).toContain('already contributed')
        })
    })

    describe('Vote Weight Calculations', () => {
        it('search vote has weight of 1', async () => {
            const barcode = `weight-search-${Date.now()}`

            const request = new Request('http://localhost/api/product-vote', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    barcode,
                    voteType: 'search',
                }),
            })
            const payloadRequest = Object.assign(request, {
                payload,
                method: 'POST',
                json: async () => JSON.parse(await request.text()),
                user: null,
            })

            const response = await productVoteHandler(payloadRequest as any)
            const data = await response.json()

            expect(data.message).toContain('1x')
        })

        it('scan vote has weight of 5', async () => {
            const barcode = `weight-scan-${Date.now()}`

            const request = new Request('http://localhost/api/product-vote', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    barcode,
                    voteType: 'scan',
                }),
            })
            const payloadRequest = Object.assign(request, {
                payload,
                method: 'POST',
                json: async () => JSON.parse(await request.text()),
                user: null,
            })

            const response = await productVoteHandler(payloadRequest as any)
            const data = await response.json()

            expect(data.message).toContain('5x')
        })

        it('member_scan vote has weight of 20', async () => {
            const barcode = `weight-member-${Date.now()}`

            const request = new Request('http://localhost/api/product-vote', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    barcode,
                    voteType: 'member_scan',
                }),
            })
            const payloadRequest = Object.assign(request, {
                payload,
                method: 'POST',
                json: async () => JSON.parse(await request.text()),
                user: null,
            })

            const response = await productVoteHandler(payloadRequest as any)
            const data = await response.json()

            expect(data.message).toContain('20x')
        })
    })
})
