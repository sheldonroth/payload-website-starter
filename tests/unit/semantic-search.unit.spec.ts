/**
 * Unit tests for Semantic Search API
 *
 * Tests the /api/search/semantic endpoint functionality including:
 * - POST and GET request handling
 * - Input validation
 * - Rate limiting
 * - Response format
 *
 * Note: These are unit tests with mocked dependencies.
 * For true integration tests, run against a test database.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock all external dependencies before importing the route
const mockGetPayload = vi.fn()
const mockGenerateEmbedding = vi.fn()
const mockSearchSimilarProducts = vi.fn()
const mockGetEmbeddingStats = vi.fn()

vi.mock('payload', () => ({
  getPayload: () => mockGetPayload(),
}))

vi.mock('@payload-config', () => ({
  default: Promise.resolve({}),
}))

vi.mock('@/utilities/embeddings', () => ({
  generateEmbedding: (...args: unknown[]) => mockGenerateEmbedding(...args),
  searchSimilarProducts: (...args: unknown[]) => mockSearchSimilarProducts(...args),
  getEmbeddingStats: (...args: unknown[]) => mockGetEmbeddingStats(...args),
}))

// Import after mocks
import { POST, GET } from '@/app/api/search/semantic/route'

describe('Semantic Search API', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default mock implementations
    mockGetPayload.mockResolvedValue({
      find: vi.fn().mockResolvedValue({ docs: [] }),
      db: { pool: { query: vi.fn() } },
    })

    mockGetEmbeddingStats.mockResolvedValue({
      totalProducts: 100,
      withEmbeddings: 80,
      percentComplete: 80,
    })

    mockGenerateEmbedding.mockResolvedValue(Array(768).fill(0))

    mockSearchSimilarProducts.mockResolvedValue([
      {
        id: 1,
        name: 'Test Product',
        brand: 'Test Brand',
        similarity: 0.95,
        verdict: 'recommend',
        imageUrl: 'https://example.com/image.jpg',
        category: 'Test Category',
      },
    ])
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('POST /api/search/semantic', () => {
    const createRequest = (body: object, ip = '127.0.0.1') => {
      return {
        json: async () => body,
        headers: new Headers({
          'x-forwarded-for': ip,
          'content-type': 'application/json',
        }),
      } as unknown as Request
    }

    it('returns results for valid query', async () => {
      const request = createRequest({ query: 'organic shampoo' })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.query).toBe('organic shampoo')
      expect(data.results).toBeDefined()
      expect(Array.isArray(data.results)).toBe(true)
      expect(data.count).toBeGreaterThanOrEqual(0)
    })

    it('returns 400 for missing query', async () => {
      const request = createRequest({})
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Query string is required')
    })

    it('returns 400 for query too short', async () => {
      const request = createRequest({ query: 'a' })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('at least 2 characters')
    })

    it('returns 400 for query too long', async () => {
      const longQuery = 'a'.repeat(501)
      const request = createRequest({ query: longQuery })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('less than 500 characters')
    })

    it('returns 400 for invalid verdict filter', async () => {
      const request = createRequest({
        query: 'test',
        verdictFilter: 'invalid',
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Invalid verdictFilter')
    })

    it('accepts valid verdict filter: recommend', async () => {
      const request = createRequest({
        query: 'test product',
        verdictFilter: 'recommend',
      })
      const response = await POST(request)

      expect(response.status).toBe(200)
    })

    it('accepts valid verdict filter: caution', async () => {
      const request = createRequest({
        query: 'test product',
        verdictFilter: 'caution',
      })
      const response = await POST(request)

      expect(response.status).toBe(200)
    })

    it('accepts valid verdict filter: avoid', async () => {
      const request = createRequest({
        query: 'test product',
        verdictFilter: 'avoid',
      })
      const response = await POST(request)

      expect(response.status).toBe(200)
    })

    it('clamps limit to max 50', async () => {
      const request = createRequest({ query: 'test product', limit: 100 })
      const response = await POST(request)

      expect(response.status).toBe(200)
      expect(mockSearchSimilarProducts).toHaveBeenCalledWith(
        expect.anything(),
        'test product',
        expect.objectContaining({ limit: 50 })
      )
    })

    it('clamps limit to min 1', async () => {
      const request = createRequest({ query: 'test product', limit: 0 })
      const response = await POST(request)

      expect(response.status).toBe(200)
      expect(mockSearchSimilarProducts).toHaveBeenCalledWith(
        expect.anything(),
        'test product',
        expect.objectContaining({ limit: 1 })
      )
    })

    it('handles rate limiting', async () => {
      const uniqueIp = `rate-limit-test-${Date.now()}-${Math.random()}`

      // Make 30 requests (at limit)
      for (let i = 0; i < 30; i++) {
        const request = createRequest({ query: 'test' }, uniqueIp)
        const response = await POST(request)
        expect(response.status).toBe(200)
      }

      // 31st request should be rate limited
      const request = createRequest({ query: 'test' }, uniqueIp)
      const response = await POST(request)

      expect(response.status).toBe(429)
      const data = await response.json()
      expect(data.error).toContain('Rate limit exceeded')
    })

    it('includes embedding stats when not 100% complete', async () => {
      mockGetEmbeddingStats.mockResolvedValue({
        totalProducts: 100,
        withEmbeddings: 80,
        percentComplete: 80,
      })

      const request = createRequest({ query: 'test' })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.embeddingStats).toBeDefined()
      expect(data.embeddingStats.percentComplete).toBe(80)
    })

    it('omits embedding stats when 100% complete', async () => {
      mockGetEmbeddingStats.mockResolvedValue({
        totalProducts: 100,
        withEmbeddings: 100,
        percentComplete: 100,
      })

      const request = createRequest({ query: 'test' })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.embeddingStats).toBeUndefined()
    })

    it('returns empty results when no embeddings exist', async () => {
      mockGetEmbeddingStats.mockResolvedValue({
        totalProducts: 100,
        withEmbeddings: 0,
        percentComplete: 0,
      })

      const request = createRequest({ query: 'test' })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.results).toEqual([])
      expect(data.message).toContain('Embeddings are being generated')
    })

    it('handles invalid JSON body gracefully', async () => {
      const request = {
        json: async () => {
          throw new Error('Invalid JSON')
        },
        headers: new Headers({
          'x-forwarded-for': '127.0.0.1',
        }),
      } as unknown as Request

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Query string is required')
    })

    it('returns 503 when Gemini API is not configured', async () => {
      mockGetEmbeddingStats.mockRejectedValue(new Error('GEMINI_API_KEY not set'))

      const request = createRequest({ query: 'test' })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(503)
      expect(data.error).toContain('not configured')
    })

    it('returns 500 for unexpected errors', async () => {
      mockGetEmbeddingStats.mockRejectedValue(new Error('Database connection failed'))

      const request = createRequest({ query: 'test' })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toContain('Search failed')
    })
  })

  describe('GET /api/search/semantic', () => {
    it('returns results for valid query parameter', async () => {
      const url = new URL('http://localhost/api/search/semantic?q=organic+shampoo')
      const request = {
        url: url.toString(),
        headers: new Headers({
          'x-forwarded-for': '127.0.0.1',
        }),
      } as unknown as Request

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.query).toBe('organic shampoo')
    })

    it('returns 400 for missing q parameter', async () => {
      const url = new URL('http://localhost/api/search/semantic')
      const request = {
        url: url.toString(),
        headers: new Headers({
          'x-forwarded-for': '127.0.0.1',
        }),
      } as unknown as Request

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Query parameter "q" is required')
    })

    it('accepts limit query param', async () => {
      const url = new URL('http://localhost/api/search/semantic?q=test&limit=10')
      const request = {
        url: url.toString(),
        headers: new Headers({
          'x-forwarded-for': '127.0.0.1',
        }),
      } as unknown as Request

      const response = await GET(request)

      expect(response.status).toBe(200)
    })

    it('accepts verdict query param', async () => {
      const url = new URL('http://localhost/api/search/semantic?q=test&verdict=recommend')
      const request = {
        url: url.toString(),
        headers: new Headers({
          'x-forwarded-for': '127.0.0.1',
        }),
      } as unknown as Request

      const response = await GET(request)

      expect(response.status).toBe(200)
    })
  })

  describe('Response format', () => {
    it('returns correctly structured search results', async () => {
      const request = {
        json: async () => ({ query: 'test' }),
        headers: new Headers({
          'x-forwarded-for': '127.0.0.1',
        }),
      } as unknown as Request

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)

      // Check response structure
      expect(data).toHaveProperty('results')
      expect(data).toHaveProperty('query')
      expect(data).toHaveProperty('count')

      // Check result item structure
      if (data.results.length > 0) {
        const result = data.results[0]
        expect(result).toHaveProperty('id')
        expect(result).toHaveProperty('name')
        expect(result).toHaveProperty('brand')
        expect(result).toHaveProperty('similarity')
        expect(result).toHaveProperty('verdict')
      }
    })
  })

  describe('Edge cases', () => {
    it('handles empty excludeIds array', async () => {
      const request = {
        json: async () => ({ query: 'test', excludeIds: [] }),
        headers: new Headers({
          'x-forwarded-for': '127.0.0.1',
        }),
      } as unknown as Request

      const response = await POST(request)

      expect(response.status).toBe(200)
    })

    it('handles special characters in query', async () => {
      const request = {
        json: async () => ({ query: 'test & product "special" <chars>' }),
        headers: new Headers({
          'x-forwarded-for': '127.0.0.1',
        }),
      } as unknown as Request

      const response = await POST(request)

      expect(response.status).toBe(200)
    })

    it('handles unicode in query', async () => {
      const request = {
        json: async () => ({ query: 'crème hydratante pour visage' }),
        headers: new Headers({
          'x-forwarded-for': '127.0.0.1',
        }),
      } as unknown as Request

      const response = await POST(request)

      expect(response.status).toBe(200)
    })

    it('handles minimum similarity threshold', async () => {
      const request = {
        json: async () => ({ query: 'test', minSimilarity: 0.9 }),
        headers: new Headers({
          'x-forwarded-for': '127.0.0.1',
        }),
      } as unknown as Request

      const response = await POST(request)

      expect(response.status).toBe(200)
      expect(mockSearchSimilarProducts).toHaveBeenCalledWith(
        expect.anything(),
        'test',
        expect.objectContaining({ minSimilarity: 0.9 })
      )
    })

    it('handles excludeIds parameter', async () => {
      const request = {
        json: async () => ({ query: 'test', excludeIds: [1, 2, 3] }),
        headers: new Headers({
          'x-forwarded-for': '127.0.0.1',
        }),
      } as unknown as Request

      const response = await POST(request)

      expect(response.status).toBe(200)
      expect(mockSearchSimilarProducts).toHaveBeenCalledWith(
        expect.anything(),
        'test',
        expect.objectContaining({ excludeIds: [1, 2, 3] })
      )
    })
  })
})
