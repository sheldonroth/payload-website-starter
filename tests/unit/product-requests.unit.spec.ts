/**
 * Unit tests for product-requests endpoints
 *
 * Tests the product request queue functionality including:
 * - Listing product requests with pagination and filtering
 * - Creating new product requests (with auth)
 * - Voting/unvoting on requests (with auth)
 * - Rate limiting
 * - Duplicate detection
 */

import { describe, it, expect, beforeEach, vi, Mock } from 'vitest'
import {
  productRequestsListHandler,
  productRequestsCreateHandler,
  productRequestVoteHandler,
} from '@/endpoints/product-requests'
import type { PayloadRequest } from 'payload'

// Mock rate limiter
vi.mock('@/utilities/rate-limiter', () => ({
  checkRateLimit: vi.fn().mockReturnValue({ allowed: true, remaining: 19, resetAt: Date.now() + 60000 }),
  rateLimitResponse: vi.fn().mockReturnValue(
    Response.json({ error: 'Rate limit exceeded' }, { status: 429 })
  ),
  getRateLimitKey: vi.fn().mockReturnValue('test-key'),
  RateLimits: {
    CONTENT_GENERATION: { maxRequests: 20, windowMs: 60000 },
  },
}))

// Import after mocking
import { checkRateLimit, rateLimitResponse } from '@/utilities/rate-limiter'

// Helper to create mock request
function createMockRequest(
  overrides: Partial<{
    url: string
    method: string
    user: { id: number; email: string; name?: string } | null
    body: Record<string, unknown>
    payload: unknown
  }> = {}
): PayloadRequest {
  const mockPayload = {
    find: vi.fn(),
    findByID: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    ...(overrides.payload || {}),
  }

  return {
    url: overrides.url || 'http://localhost/api/product-requests',
    method: overrides.method || 'GET',
    user: overrides.user ?? null,
    payload: mockPayload,
    json: vi.fn().mockResolvedValue(overrides.body || {}),
  } as unknown as PayloadRequest
}

describe('product-requests endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset rate limiter to allow requests
    ;(checkRateLimit as Mock).mockReturnValue({ allowed: true, remaining: 19, resetAt: Date.now() + 60000 })
  })

  describe('productRequestsListHandler', () => {
    it('returns empty list when no requests exist', async () => {
      const mockPayload = {
        find: vi.fn().mockResolvedValue({
          docs: [],
          totalDocs: 0,
          totalPages: 0,
          page: 1,
          hasNextPage: false,
          hasPrevPage: false,
        }),
      }

      const req = createMockRequest({ payload: mockPayload })
      const response = await productRequestsListHandler(req)
      const data = await response.json()

      expect(data.requests).toEqual([])
      expect(data.totalDocs).toBe(0)
    })

    it('returns product requests sorted by votes by default', async () => {
      const mockDocs = [
        {
          id: '1',
          productRequestDetails: { requestedProductName: 'Product A', requestedBrand: 'Brand A' },
          voteCount: 10,
          status: 'pending',
          submitterName: 'User 1',
          createdAt: new Date().toISOString(),
          voters: [],
        },
        {
          id: '2',
          productRequestDetails: { requestedProductName: 'Product B', requestedBrand: 'Brand B' },
          voteCount: 5,
          status: 'pending',
          submitterName: 'User 2',
          createdAt: new Date().toISOString(),
          voters: [],
        },
      ]

      const mockPayload = {
        find: vi.fn().mockResolvedValue({
          docs: mockDocs,
          totalDocs: 2,
          totalPages: 1,
          page: 1,
          hasNextPage: false,
          hasPrevPage: false,
        }),
      }

      const req = createMockRequest({ payload: mockPayload })
      const response = await productRequestsListHandler(req)
      const data = await response.json()

      expect(data.requests).toHaveLength(2)
      expect(data.requests[0].productName).toBe('Product A')
      expect(data.requests[0].voteCount).toBe(10)
      expect(mockPayload.find).toHaveBeenCalledWith(
        expect.objectContaining({
          sort: '-voteCount',
        })
      )
    })

    it('filters by status when provided', async () => {
      const mockPayload = {
        find: vi.fn().mockResolvedValue({
          docs: [],
          totalDocs: 0,
          totalPages: 0,
          page: 1,
          hasNextPage: false,
          hasPrevPage: false,
        }),
      }

      const req = createMockRequest({
        url: 'http://localhost/api/product-requests?status=verified',
        payload: mockPayload,
      })
      await productRequestsListHandler(req)

      expect(mockPayload.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            and: expect.arrayContaining([
              { status: { equals: 'verified' } },
            ]),
          }),
        })
      )
    })

    it('sorts by newest when requested', async () => {
      const mockPayload = {
        find: vi.fn().mockResolvedValue({
          docs: [],
          totalDocs: 0,
          totalPages: 0,
          page: 1,
          hasNextPage: false,
          hasPrevPage: false,
        }),
      }

      const req = createMockRequest({
        url: 'http://localhost/api/product-requests?sort=newest',
        payload: mockPayload,
      })
      await productRequestsListHandler(req)

      expect(mockPayload.find).toHaveBeenCalledWith(
        expect.objectContaining({
          sort: '-createdAt',
        })
      )
    })

    it('paginates results correctly', async () => {
      const mockPayload = {
        find: vi.fn().mockResolvedValue({
          docs: [],
          totalDocs: 100,
          totalPages: 5,
          page: 2,
          hasNextPage: true,
          hasPrevPage: true,
        }),
      }

      const req = createMockRequest({
        url: 'http://localhost/api/product-requests?page=2&limit=20',
        payload: mockPayload,
      })
      const response = await productRequestsListHandler(req)
      const data = await response.json()

      expect(data.page).toBe(2)
      expect(data.totalPages).toBe(5)
      expect(data.hasNextPage).toBe(true)
      expect(data.hasPrevPage).toBe(true)
    })

    it('limits page size to 50 max', async () => {
      const mockPayload = {
        find: vi.fn().mockResolvedValue({
          docs: [],
          totalDocs: 0,
          totalPages: 0,
          page: 1,
          hasNextPage: false,
          hasPrevPage: false,
        }),
      }

      const req = createMockRequest({
        url: 'http://localhost/api/product-requests?limit=100',
        payload: mockPayload,
      })
      await productRequestsListHandler(req)

      expect(mockPayload.find).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 50, // Capped at 50
        })
      )
    })

    it('indicates if authenticated user has voted', async () => {
      const userId = 123
      const mockDocs = [
        {
          id: '1',
          productRequestDetails: { requestedProductName: 'Product A' },
          voteCount: 5,
          status: 'pending',
          voters: ['123', '456'],
          createdAt: new Date().toISOString(),
        },
        {
          id: '2',
          productRequestDetails: { requestedProductName: 'Product B' },
          voteCount: 3,
          status: 'pending',
          voters: ['456'],
          createdAt: new Date().toISOString(),
        },
      ]

      const mockPayload = {
        find: vi.fn().mockResolvedValue({
          docs: mockDocs,
          totalDocs: 2,
          totalPages: 1,
          page: 1,
          hasNextPage: false,
          hasPrevPage: false,
        }),
      }

      const req = createMockRequest({
        payload: mockPayload,
        user: { id: userId, email: 'test@example.com' },
      })
      const response = await productRequestsListHandler(req)
      const data = await response.json()

      expect(data.requests[0].hasVoted).toBe(true) // User voted
      expect(data.requests[1].hasVoted).toBe(false) // User didn't vote
    })
  })

  describe('productRequestsCreateHandler', () => {
    it('requires authentication', async () => {
      const req = createMockRequest({ user: null })
      const response = await productRequestsCreateHandler(req)

      expect(response.status).toBe(401)
      const data = await response.json()
      expect(data.error).toContain('Login required')
    })

    it('requires product name', async () => {
      const mockPayload = {
        find: vi.fn(),
        create: vi.fn(),
      }

      const req = createMockRequest({
        user: { id: 1, email: 'test@example.com' },
        body: { brand: 'Some Brand' }, // No productName
        payload: mockPayload,
      })

      const response = await productRequestsCreateHandler(req)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toContain('Product name is required')
    })

    it('detects duplicate requests', async () => {
      const mockPayload = {
        find: vi.fn().mockResolvedValue({
          docs: [{ id: 'existing-1', voteCount: 10 }],
        }),
        create: vi.fn(),
      }

      const req = createMockRequest({
        user: { id: 1, email: 'test@example.com' },
        body: { productName: 'Existing Product', brand: 'Brand' },
        payload: mockPayload,
      })

      const response = await productRequestsCreateHandler(req)

      expect(response.status).toBe(409)
      const data = await response.json()
      expect(data.error).toContain('already exists')
      expect(data.existingRequest.id).toBe('existing-1')
    })

    it('creates new product request with initial vote', async () => {
      const userId = 1
      const mockPayload = {
        find: vi.fn().mockResolvedValue({ docs: [] }),
        create: vi.fn().mockResolvedValue({
          id: 'new-request-1',
          productRequestDetails: { requestedProductName: 'New Product' },
          voteCount: 1,
        }),
      }

      const req = createMockRequest({
        user: { id: userId, email: 'test@example.com', name: 'Test User' },
        body: {
          productName: 'New Product',
          brand: 'New Brand',
          productUrl: 'https://example.com/product',
          reason: 'I want to know if it is safe',
        },
        payload: mockPayload,
      })

      const response = await productRequestsCreateHandler(req)

      expect(response.status).toBe(201)
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.request.voteCount).toBe(1)

      expect(mockPayload.create).toHaveBeenCalledWith(
        expect.objectContaining({
          collection: 'user-submissions',
          data: expect.objectContaining({
            type: 'product_request',
            voteCount: 1,
            voters: [String(userId)],
            productRequestDetails: expect.objectContaining({
              requestedProductName: 'New Product',
              requestedBrand: 'New Brand',
            }),
          }),
        })
      )
    })

    it('respects rate limiting', async () => {
      ;(checkRateLimit as Mock).mockReturnValue({ allowed: false, remaining: 0, resetAt: Date.now() + 30000 })

      const req = createMockRequest({
        user: { id: 1, email: 'test@example.com' },
        body: { productName: 'Test Product' },
      })

      await productRequestsCreateHandler(req)

      expect(rateLimitResponse).toHaveBeenCalled()
    })
  })

  describe('productRequestVoteHandler', () => {
    it('requires authentication', async () => {
      const req = createMockRequest({ user: null })
      const response = await productRequestVoteHandler(req)

      expect(response.status).toBe(401)
      const data = await response.json()
      expect(data.error).toContain('Login required')
    })

    it('requires requestId', async () => {
      const mockPayload = {
        findByID: vi.fn(),
        update: vi.fn(),
      }

      const req = createMockRequest({
        user: { id: 1, email: 'test@example.com' },
        body: { action: 'add' }, // No requestId
        payload: mockPayload,
      })

      const response = await productRequestVoteHandler(req)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toContain('requestId is required')
    })

    it('returns 404 for non-existent request', async () => {
      const mockPayload = {
        findByID: vi.fn().mockResolvedValue(null),
        update: vi.fn(),
      }

      const req = createMockRequest({
        user: { id: 1, email: 'test@example.com' },
        body: { requestId: 'non-existent', action: 'add' },
        payload: mockPayload,
      })

      const response = await productRequestVoteHandler(req)

      expect(response.status).toBe(404)
    })

    it('rejects voting on non-product-request submissions', async () => {
      const mockPayload = {
        findByID: vi.fn().mockResolvedValue({
          id: '1',
          type: 'feedback', // Not a product_request
          voters: [],
        }),
        update: vi.fn(),
      }

      const req = createMockRequest({
        user: { id: 1, email: 'test@example.com' },
        body: { requestId: '1', action: 'add' },
        payload: mockPayload,
      })

      const response = await productRequestVoteHandler(req)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toContain('Invalid request type')
    })

    it('adds vote successfully', async () => {
      const userId = 1
      const mockPayload = {
        findByID: vi.fn().mockResolvedValue({
          id: 'request-1',
          type: 'product_request',
          voteCount: 5,
          voters: ['2', '3'],
        }),
        update: vi.fn().mockResolvedValue({}),
      }

      const req = createMockRequest({
        user: { id: userId, email: 'test@example.com' },
        body: { requestId: 'request-1', action: 'add' },
        payload: mockPayload,
      })

      const response = await productRequestVoteHandler(req)
      const data = await response.json()

      expect(data.success).toBe(true)
      expect(data.voteCount).toBe(6)
      expect(data.hasVoted).toBe(true)

      expect(mockPayload.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            voters: ['2', '3', '1'],
            voteCount: 6,
          }),
        })
      )
    })

    it('prevents duplicate voting', async () => {
      const userId = 1
      const mockPayload = {
        findByID: vi.fn().mockResolvedValue({
          id: 'request-1',
          type: 'product_request',
          voteCount: 5,
          voters: ['1', '2', '3'], // User already voted
        }),
        update: vi.fn(),
      }

      const req = createMockRequest({
        user: { id: userId, email: 'test@example.com' },
        body: { requestId: 'request-1', action: 'add' },
        payload: mockPayload,
      })

      const response = await productRequestVoteHandler(req)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toContain('already voted')
      expect(mockPayload.update).not.toHaveBeenCalled()
    })

    it('removes vote successfully', async () => {
      const userId = 1
      const mockPayload = {
        findByID: vi.fn().mockResolvedValue({
          id: 'request-1',
          type: 'product_request',
          voteCount: 5,
          voters: ['1', '2', '3'],
        }),
        update: vi.fn().mockResolvedValue({}),
      }

      const req = createMockRequest({
        user: { id: userId, email: 'test@example.com' },
        body: { requestId: 'request-1', action: 'remove' },
        payload: mockPayload,
      })

      const response = await productRequestVoteHandler(req)
      const data = await response.json()

      expect(data.success).toBe(true)
      expect(data.voteCount).toBe(4)
      expect(data.hasVoted).toBe(false)

      expect(mockPayload.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            voters: ['2', '3'], // User removed
            voteCount: 4,
          }),
        })
      )
    })

    it('prevents removing vote when user has not voted', async () => {
      const userId = 1
      const mockPayload = {
        findByID: vi.fn().mockResolvedValue({
          id: 'request-1',
          type: 'product_request',
          voteCount: 5,
          voters: ['2', '3'], // User not in list
        }),
        update: vi.fn(),
      }

      const req = createMockRequest({
        user: { id: userId, email: 'test@example.com' },
        body: { requestId: 'request-1', action: 'remove' },
        payload: mockPayload,
      })

      const response = await productRequestVoteHandler(req)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toContain('have not voted')
      expect(mockPayload.update).not.toHaveBeenCalled()
    })

    it('does not allow negative vote count', async () => {
      const userId = 1
      const mockPayload = {
        findByID: vi.fn().mockResolvedValue({
          id: 'request-1',
          type: 'product_request',
          voteCount: 0, // Edge case: already at 0
          voters: ['1'], // But user is somehow in the list
        }),
        update: vi.fn().mockResolvedValue({}),
      }

      const req = createMockRequest({
        user: { id: userId, email: 'test@example.com' },
        body: { requestId: 'request-1', action: 'remove' },
        payload: mockPayload,
      })

      const response = await productRequestVoteHandler(req)
      const data = await response.json()

      expect(data.voteCount).toBe(0) // Should not go negative
    })

    it('respects rate limiting on votes', async () => {
      ;(checkRateLimit as Mock).mockReturnValue({ allowed: false, remaining: 0, resetAt: Date.now() + 30000 })

      const req = createMockRequest({
        user: { id: 1, email: 'test@example.com' },
        body: { requestId: 'request-1', action: 'add' },
      })

      await productRequestVoteHandler(req)

      expect(rateLimitResponse).toHaveBeenCalled()
    })
  })
})
