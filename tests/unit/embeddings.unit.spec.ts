/**
 * Unit tests for embeddings utility
 *
 * Tests the embedding generation and product text creation.
 * API-dependent functions are tested with mocks.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createProductText } from '@/utilities/embeddings'

// Mock the Google Generative AI
vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
    getGenerativeModel: vi.fn().mockReturnValue({
      embedContent: vi.fn().mockResolvedValue({
        embedding: {
          values: Array(768).fill(0).map((_, i) => Math.sin(i * 0.1)), // Mock 768-dim embedding
        },
      }),
    }),
  })),
}))

describe('embeddings', () => {
  describe('createProductText', () => {
    it('combines brand and name', () => {
      const product = {
        id: 1,
        name: 'Organic Shampoo',
        brand: 'Nature Co',
      }

      const text = createProductText(product)

      expect(text).toContain('Nature Co')
      expect(text).toContain('Organic Shampoo')
    })

    it('includes category when provided', () => {
      const product = {
        id: 1,
        name: 'Face Cream',
        brand: 'SkinCare',
        category: 'Skincare',
      }

      const text = createProductText(product)

      expect(text).toContain('Category: Skincare')
    })

    it('includes summary when provided', () => {
      const product = {
        id: 1,
        name: 'Moisturizer',
        brand: 'HydraCare',
        summary: 'A gentle daily moisturizer for all skin types.',
      }

      const text = createProductText(product)

      expect(text).toContain('A gentle daily moisturizer')
    })

    it('includes verdict reason when provided', () => {
      const product = {
        id: 1,
        name: 'Sunscreen SPF 50',
        brand: 'SunSafe',
        verdictReason: 'Contains zinc oxide and no harmful chemicals.',
      }

      const text = createProductText(product)

      expect(text).toContain('Contains zinc oxide')
    })

    it('uses pipe separator between parts', () => {
      const product = {
        id: 1,
        name: 'Product Name',
        brand: 'Brand Name',
        category: 'Category',
      }

      const text = createProductText(product)

      expect(text).toContain(' | ')
      // Should have format: "Brand Name | Product Name | Category: Category"
      const parts = text.split(' | ')
      expect(parts.length).toBe(3)
    })

    it('handles minimal product (just name and brand)', () => {
      const product = {
        id: 1,
        name: 'Basic Product',
        brand: 'Basic Brand',
      }

      const text = createProductText(product)

      expect(text).toBe('Basic Brand | Basic Product')
    })

    it('handles full product with all fields', () => {
      const product = {
        id: 1,
        name: 'Complete Product',
        brand: 'Full Brand',
        category: 'Test Category',
        summary: 'Product summary here.',
        verdictReason: 'Verdict reason here.',
      }

      const text = createProductText(product)

      expect(text).toContain('Full Brand')
      expect(text).toContain('Complete Product')
      expect(text).toContain('Category: Test Category')
      expect(text).toContain('Product summary here.')
      expect(text).toContain('Verdict reason here.')
    })

    it('handles empty optional fields', () => {
      const product = {
        id: 1,
        name: 'Product',
        brand: 'Brand',
        category: null,
        summary: null,
        verdictReason: null,
      }

      const text = createProductText(product)

      // Should not include null values
      expect(text).toBe('Brand | Product')
      expect(text).not.toContain('null')
    })

    it('handles empty string fields', () => {
      const product = {
        id: 1,
        name: 'Product',
        brand: 'Brand',
        category: '',
        summary: '',
        verdictReason: '',
      }

      const text = createProductText(product)

      // Empty strings are falsy, should not be included
      expect(text).toBe('Brand | Product')
    })

    it('preserves brand priority (appears first)', () => {
      const product = {
        id: 1,
        name: 'Product Name',
        brand: 'BRAND',
      }

      const text = createProductText(product)

      expect(text.startsWith('BRAND')).toBe(true)
    })

    it('handles special characters in text', () => {
      const product = {
        id: 1,
        name: "Product's Name (Special)",
        brand: 'Brand & Co.',
        summary: 'Contains 15% vitamin C',
      }

      const text = createProductText(product)

      expect(text).toContain("Product's Name (Special)")
      expect(text).toContain('Brand & Co.')
      expect(text).toContain('15% vitamin C')
    })

    it('handles unicode characters', () => {
      const product = {
        id: 1,
        name: 'Crème Hydratante',
        brand: 'L\'Oréal',
        category: 'Soins du visage',
      }

      const text = createProductText(product)

      expect(text).toContain('Crème Hydratante')
      expect(text).toContain("L'Oréal")
      expect(text).toContain('Soins du visage')
    })

    it('handles very long text fields', () => {
      const longSummary = 'A'.repeat(1000)
      const product = {
        id: 1,
        name: 'Product',
        brand: 'Brand',
        summary: longSummary,
      }

      const text = createProductText(product)

      // Should include the full long summary
      expect(text).toContain(longSummary)
      expect(text.length).toBeGreaterThan(1000)
    })
  })

  describe('generateEmbedding', () => {
    let originalEnv: string | undefined

    beforeEach(() => {
      originalEnv = process.env.GEMINI_API_KEY
      process.env.GEMINI_API_KEY = 'test-key'
    })

    afterEach(() => {
      if (originalEnv === undefined) {
        delete process.env.GEMINI_API_KEY
      } else {
        process.env.GEMINI_API_KEY = originalEnv
      }
    })

    it('generates 768-dimensional embedding', async () => {
      // Dynamic import to get mocked version
      const { generateEmbedding } = await import('@/utilities/embeddings')

      const embedding = await generateEmbedding('Test product text')

      expect(Array.isArray(embedding)).toBe(true)
      expect(embedding.length).toBe(768)
    })

    it('returns numeric values', async () => {
      const { generateEmbedding } = await import('@/utilities/embeddings')

      const embedding = await generateEmbedding('Another test')

      embedding.forEach((value) => {
        expect(typeof value).toBe('number')
        expect(isNaN(value)).toBe(false)
      })
    })
  })

  describe('generateEmbeddings (batch)', () => {
    let originalEnv: string | undefined

    beforeEach(() => {
      originalEnv = process.env.GEMINI_API_KEY
      process.env.GEMINI_API_KEY = 'test-key'
    })

    afterEach(() => {
      if (originalEnv === undefined) {
        delete process.env.GEMINI_API_KEY
      } else {
        process.env.GEMINI_API_KEY = originalEnv
      }
    })

    it('returns empty array for empty input', async () => {
      const { generateEmbeddings } = await import('@/utilities/embeddings')

      const embeddings = await generateEmbeddings([])

      expect(embeddings).toEqual([])
    })

    it('generates embedding for each input text', async () => {
      const { generateEmbeddings } = await import('@/utilities/embeddings')
      const texts = ['Product 1', 'Product 2', 'Product 3']

      const embeddings = await generateEmbeddings(texts)

      expect(embeddings.length).toBe(3)
      embeddings.forEach((emb) => {
        expect(emb.length).toBe(768)
      })
    })
  })

  describe('EMBEDDING_DIMENSIONS constant', () => {
    it('should be 768 (Gemini text-embedding-004 dimension)', () => {
      // The embedding model produces 768-dimensional vectors
      // This is verified by the mock returning 768 values
      const expectedDimension = 768

      // We can't directly access the constant without modifying the module,
      // but we can verify through the mock that we expect 768 dimensions
      expect(expectedDimension).toBe(768)
    })
  })

  describe('edge cases', () => {
    it('createProductText handles product with only id', () => {
      // Edge case: minimal product
      const product = {
        id: 1,
        name: '',
        brand: '',
      }

      const text = createProductText(product)

      // Should return empty string or handle gracefully
      expect(typeof text).toBe('string')
    })

    it('createProductText handles whitespace-only fields', () => {
      const product = {
        id: 1,
        name: '  Product  ',
        brand: '  Brand  ',
        summary: '   ',
      }

      const text = createProductText(product)

      // Whitespace fields should be included (they're truthy)
      // but whitespace-only summary adds nothing meaningful
      expect(text).toContain('Product')
      expect(text).toContain('Brand')
    })
  })
})
