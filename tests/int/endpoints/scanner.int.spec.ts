/**
 * Integration Tests for Scanner Endpoints
 *
 * Tests barcode scanning and product lookup functionality.
 * Covers:
 * - POST /api/scanner/lookup - Look up product by barcode
 * - POST /api/scanner/submit - Submit product photos for OCR processing
 * - Rate limiting for scanner endpoints
 */

import { getPayload, Payload } from 'payload'
import config from '@/payload.config'
import { describe, it, beforeAll, beforeEach, expect, vi } from 'vitest'
import { scannerLookupHandler, scannerSubmitHandler } from '@/endpoints/scanner'

let payload: Payload

// Mock external services
vi.mock('@/utilities/barcode-lookup', () => ({
    lookupBarcode: vi.fn().mockImplementation(async (barcode: string) => {
        // Return mock product for specific test barcodes
        if (barcode === '5000328657950') {
            return {
                found: true,
                product: {
                    barcode: '5000328657950',
                    name: 'Test Product',
                    brand: 'Test Brand',
                    description: 'A test product',
                    imageUrl: 'https://example.com/image.jpg',
                    ingredients: 'Water, Sugar, Salt',
                    categories: ['Food', 'Snacks'],
                    source: 'external',
                    confidence: 0.95,
                },
                localProductId: null,
            }
        }
        return {
            found: false,
            message: 'Product not found in any database',
            suggestion: 'Submit photos to help others',
        }
    }),
    saveProductFromLookup: vi.fn().mockImplementation(async () => ({ id: 1 })),
}))

vi.mock('@/collections/AuditLog', () => ({
    createAuditLog: vi.fn(),
}))

vi.mock('@google/generative-ai', () => ({
    GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
        getGenerativeModel: vi.fn().mockReturnValue({
            generateContent: vi.fn().mockResolvedValue({
                response: {
                    text: () => JSON.stringify({
                        rawText: 'Ingredients: Water, Sugar',
                        ingredients: ['Water', 'Sugar'],
                        confidence: 0.9,
                    }),
                },
            }),
        }),
    })),
}))

describe('Scanner Endpoints', () => {
    beforeAll(async () => {
        const payloadConfig = await config
        payload = await getPayload({ config: payloadConfig })
    })

    describe('POST /api/scanner/lookup', () => {
        it('returns product for valid barcode', async () => {
            const request = new Request('http://localhost/api/scanner/lookup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    barcode: '5000328657950',
                    fingerprintHash: 'test-fp-123',
                }),
            })

            const payloadRequest = Object.assign(request, {
                payload,
                json: async () => JSON.parse(await request.text()),
                user: null,
            })

            const response = await scannerLookupHandler(payloadRequest as any)
            const data = await response.json()

            expect(response.status).toBe(200)
            expect(data.found).toBe(true)
            expect(data.product).toBeDefined()
            expect(data.product.barcode).toBe('5000328657950')
            expect(data.product.name).toBe('Test Product')
            expect(data.product.brand).toBe('Test Brand')
        })

        it('returns 404-like response for unknown barcode', async () => {
            const request = new Request('http://localhost/api/scanner/lookup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    barcode: '0000000000000',
                }),
            })

            const payloadRequest = Object.assign(request, {
                payload,
                json: async () => JSON.parse(await request.text()),
                user: null,
            })

            const response = await scannerLookupHandler(payloadRequest as any)
            const data = await response.json()

            expect(response.status).toBe(200)
            expect(data.found).toBe(false)
            expect(data.message).toBeDefined()
            expect(data.voteStats).toBeDefined()
        })

        it('returns 400 when barcode is missing', async () => {
            const request = new Request('http://localhost/api/scanner/lookup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
            })

            const payloadRequest = Object.assign(request, {
                payload,
                json: async () => JSON.parse(await request.text()),
                user: null,
            })

            const response = await scannerLookupHandler(payloadRequest as any)

            expect(response.status).toBe(400)
            const data = await response.json()
            expect(data.error).toBe('barcode is required')
        })

        it('returns 400 for invalid barcode format - too short', async () => {
            const request = new Request('http://localhost/api/scanner/lookup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    barcode: '123', // Too short
                }),
            })

            const payloadRequest = Object.assign(request, {
                payload,
                json: async () => JSON.parse(await request.text()),
                user: null,
            })

            const response = await scannerLookupHandler(payloadRequest as any)

            expect(response.status).toBe(400)
            const data = await response.json()
            expect(data.error).toContain('Invalid barcode format')
        })

        it('returns 400 for invalid barcode format - too long', async () => {
            const request = new Request('http://localhost/api/scanner/lookup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    barcode: '123456789012345678', // Too long
                }),
            })

            const payloadRequest = Object.assign(request, {
                payload,
                json: async () => JSON.parse(await request.text()),
                user: null,
            })

            const response = await scannerLookupHandler(payloadRequest as any)

            expect(response.status).toBe(400)
            const data = await response.json()
            expect(data.error).toContain('Invalid barcode format')
        })

        it('cleans barcode of non-numeric characters', async () => {
            const request = new Request('http://localhost/api/scanner/lookup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    barcode: '5000-3286-57950', // With dashes
                }),
            })

            const payloadRequest = Object.assign(request, {
                payload,
                json: async () => JSON.parse(await request.text()),
                user: null,
            })

            const response = await scannerLookupHandler(payloadRequest as any)
            const data = await response.json()

            expect(response.status).toBe(200)
            expect(data.found).toBe(true)
        })

        it('handles saveIfFound option', async () => {
            const request = new Request('http://localhost/api/scanner/lookup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    barcode: '5000328657950',
                    saveIfFound: true,
                }),
            })

            const payloadRequest = Object.assign(request, {
                payload,
                json: async () => JSON.parse(await request.text()),
                user: null,
            })

            const response = await scannerLookupHandler(payloadRequest as any)
            const data = await response.json()

            expect(response.status).toBe(200)
            expect(data.found).toBe(true)
            expect(data.product.id).toBeDefined()
        })

        it('returns vote stats for not found products', async () => {
            const request = new Request('http://localhost/api/scanner/lookup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    barcode: '9999999999999',
                }),
            })

            const payloadRequest = Object.assign(request, {
                payload,
                json: async () => JSON.parse(await request.text()),
                user: null,
            })

            const response = await scannerLookupHandler(payloadRequest as any)
            const data = await response.json()

            expect(response.status).toBe(200)
            expect(data.found).toBe(false)
            expect(data.voteStats).toBeDefined()
            expect(data.voteStats.totalVotes).toBeDefined()
            expect(data.voteStats.fundingProgress).toBeDefined()
            expect(data.voteStats.fundingThreshold).toBeDefined()
        })
    })

    describe('POST /api/scanner/submit', () => {
        it('returns 400 when barcode is missing', async () => {
            const request = new Request('http://localhost/api/scanner/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    frontImageId: 1,
                }),
            })

            const payloadRequest = Object.assign(request, {
                payload,
                json: async () => JSON.parse(await request.text()),
                formData: null,
                user: null,
                headers: request.headers,
            })

            const response = await scannerSubmitHandler(payloadRequest as any)

            expect(response.status).toBe(400)
            const data = await response.json()
            expect(data.error).toBe('barcode is required')
        })

        it('returns 400 when no images provided', async () => {
            const request = new Request('http://localhost/api/scanner/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    barcode: '5000328657950',
                }),
            })

            const payloadRequest = Object.assign(request, {
                payload,
                json: async () => JSON.parse(await request.text()),
                formData: null,
                user: null,
                headers: request.headers,
            })

            const response = await scannerSubmitHandler(payloadRequest as any)

            expect(response.status).toBe(400)
            const data = await response.json()
            expect(data.error).toContain('At least one image is required')
        })

        it('accepts JSON with media IDs', async () => {
            // First create a media item for testing
            const mediaDoc = await payload.create({
                collection: 'media',
                data: {
                    alt: 'Test image',
                    filename: 'test-image.jpg',
                },
                file: {
                    data: Buffer.from('fake-image-data'),
                    mimetype: 'image/jpeg',
                    name: 'test-image.jpg',
                    size: 100,
                },
            })

            const request = new Request('http://localhost/api/scanner/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    barcode: '5000328657950',
                    frontImageId: mediaDoc.id,
                    fingerprintHash: 'test-fp-submit',
                }),
            })

            const payloadRequest = Object.assign(request, {
                payload,
                json: async () => JSON.parse(await request.text()),
                formData: null,
                user: null,
                headers: request.headers,
            })

            const response = await scannerSubmitHandler(payloadRequest as any)
            const data = await response.json()

            expect(response.status).toBe(200)
            expect(data.success).toBe(true)
            expect(data.submissionId).toBeDefined()
            expect(data.imagesUploaded).toBe(1)
        })

        it('handles both front and back images', async () => {
            // Create two media items
            const frontMedia = await payload.create({
                collection: 'media',
                data: {
                    alt: 'Front image',
                    filename: 'front-image.jpg',
                },
                file: {
                    data: Buffer.from('fake-front-image'),
                    mimetype: 'image/jpeg',
                    name: 'front-image.jpg',
                    size: 100,
                },
            })

            const backMedia = await payload.create({
                collection: 'media',
                data: {
                    alt: 'Back image',
                    filename: 'back-image.jpg',
                },
                file: {
                    data: Buffer.from('fake-back-image'),
                    mimetype: 'image/jpeg',
                    name: 'back-image.jpg',
                    size: 100,
                },
            })

            const request = new Request('http://localhost/api/scanner/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    barcode: '5000328657950',
                    frontImageId: frontMedia.id,
                    backImageId: backMedia.id,
                }),
            })

            const payloadRequest = Object.assign(request, {
                payload,
                json: async () => JSON.parse(await request.text()),
                formData: null,
                user: null,
                headers: request.headers,
            })

            const response = await scannerSubmitHandler(payloadRequest as any)
            const data = await response.json()

            expect(response.status).toBe(200)
            expect(data.success).toBe(true)
            expect(data.imagesUploaded).toBe(2)
        })

        it('includes content field when provided', async () => {
            const mediaDoc = await payload.create({
                collection: 'media',
                data: {
                    alt: 'Test image',
                    filename: 'test-content.jpg',
                },
                file: {
                    data: Buffer.from('fake-image-data'),
                    mimetype: 'image/jpeg',
                    name: 'test-content.jpg',
                    size: 100,
                },
            })

            const request = new Request('http://localhost/api/scanner/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    barcode: '5000328657950',
                    frontImageId: mediaDoc.id,
                    content: 'This is a gluten-free product',
                }),
            })

            const payloadRequest = Object.assign(request, {
                payload,
                json: async () => JSON.parse(await request.text()),
                formData: null,
                user: null,
                headers: request.headers,
            })

            const response = await scannerSubmitHandler(payloadRequest as any)
            const data = await response.json()

            expect(response.status).toBe(200)
            expect(data.success).toBe(true)
        })
    })

    describe('Barcode Format Validation', () => {
        it('accepts valid UPC-A barcode (12 digits)', async () => {
            const request = new Request('http://localhost/api/scanner/lookup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    barcode: '012345678905', // 12 digits
                }),
            })

            const payloadRequest = Object.assign(request, {
                payload,
                json: async () => JSON.parse(await request.text()),
                user: null,
            })

            const response = await scannerLookupHandler(payloadRequest as any)

            expect(response.status).toBe(200)
        })

        it('accepts valid EAN-13 barcode (13 digits)', async () => {
            const request = new Request('http://localhost/api/scanner/lookup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    barcode: '5000328657950', // 13 digits
                }),
            })

            const payloadRequest = Object.assign(request, {
                payload,
                json: async () => JSON.parse(await request.text()),
                user: null,
            })

            const response = await scannerLookupHandler(payloadRequest as any)

            expect(response.status).toBe(200)
        })

        it('accepts valid EAN-8 barcode (8 digits)', async () => {
            const request = new Request('http://localhost/api/scanner/lookup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    barcode: '12345678', // 8 digits
                }),
            })

            const payloadRequest = Object.assign(request, {
                payload,
                json: async () => JSON.parse(await request.text()),
                user: null,
            })

            const response = await scannerLookupHandler(payloadRequest as any)

            expect(response.status).toBe(200)
        })

        it('accepts valid GTIN-14 barcode (14 digits)', async () => {
            const request = new Request('http://localhost/api/scanner/lookup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    barcode: '01234567890123', // 14 digits
                }),
            })

            const payloadRequest = Object.assign(request, {
                payload,
                json: async () => JSON.parse(await request.text()),
                user: null,
            })

            const response = await scannerLookupHandler(payloadRequest as any)

            expect(response.status).toBe(200)
        })
    })

    describe('Rate Limiting', () => {
        it('should allow requests within rate limit', async () => {
            // First request should succeed
            const request = new Request('http://localhost/api/scanner/lookup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-forwarded-for': '192.168.1.100',
                },
                body: JSON.stringify({
                    barcode: '5000328657950',
                }),
            })

            const payloadRequest = Object.assign(request, {
                payload,
                json: async () => JSON.parse(await request.text()),
                user: null,
            })

            const response = await scannerLookupHandler(payloadRequest as any)

            expect(response.status).toBe(200)
        })
    })

    describe('Error Handling', () => {
        it('handles malformed JSON gracefully', async () => {
            const request = new Request('http://localhost/api/scanner/lookup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: 'not valid json',
            })

            const payloadRequest = Object.assign(request, {
                payload,
                json: async () => {
                    throw new Error('Invalid JSON')
                },
                user: null,
            })

            const response = await scannerLookupHandler(payloadRequest as any)

            expect(response.status).toBe(500)
        })

        it('handles empty request body', async () => {
            const request = new Request('http://localhost/api/scanner/lookup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: '',
            })

            const payloadRequest = Object.assign(request, {
                payload,
                json: async () => null,
                user: null,
            })

            const response = await scannerLookupHandler(payloadRequest as any)

            expect(response.status).toBe(400)
        })
    })
})
