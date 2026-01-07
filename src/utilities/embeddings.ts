/**
 * Product Embedding Service
 *
 * Generates and manages embeddings for semantic search.
 * Uses Google Gemini text-embedding-004 (768 dimensions).
 *
 * Features:
 * - Generate embeddings from product text
 * - Batch processing for efficiency
 * - Database storage and retrieval
 * - Similarity search using pgvector
 */

import { GoogleGenerativeAI } from '@google/generative-ai'
import type { Payload } from 'payload'

// Initialize Gemini client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

const EMBEDDING_MODEL = 'text-embedding-004'
const EMBEDDING_DIMENSIONS = 768

interface ProductTextInput {
  id: number
  name: string
  brand: string
  summary?: string | null
  verdictReason?: string | null
  category?: string | null
}

interface EmbeddingResult {
  productId: number
  embedding: number[]
  model: string
  timestamp: Date
}

interface SimilarProduct {
  id: number
  name: string
  brand: string
  similarity: number
  verdict?: string
  imageUrl?: string | null
  category?: { name: string } | null
}

/**
 * Create searchable text from product fields
 * Combines name, brand, summary, and verdict reason for rich embeddings
 */
export function createProductText(product: ProductTextInput): string {
  const parts: string[] = []

  // Brand and name are most important
  if (product.brand) parts.push(product.brand)
  if (product.name) parts.push(product.name)

  // Category provides context
  if (product.category) parts.push(`Category: ${product.category}`)

  // Summary provides description
  if (product.summary) parts.push(product.summary)

  // Verdict reason explains why (good for semantic matching)
  if (product.verdictReason) parts.push(product.verdictReason)

  return parts.join(' | ')
}

/**
 * Generate embedding for a single text string
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY environment variable is not set')
  }

  const model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL })
  const result = await model.embedContent(text)

  return result.embedding.values
}

/**
 * Generate embeddings for multiple texts (batch processing)
 * Gemini processes one at a time, but we batch for efficiency
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY environment variable is not set')
  }

  if (texts.length === 0) return []

  const model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL })
  const allEmbeddings: number[][] = []

  // Process in parallel batches of 10 for rate limiting
  const batchSize = 10

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize)

    const results = await Promise.all(
      batch.map(async (text) => {
        const result = await model.embedContent(text)
        return result.embedding.values
      })
    )

    allEmbeddings.push(...results)

    // Small delay between batches to respect rate limits
    if (i + batchSize < texts.length) {
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
  }

  return allEmbeddings
}

/**
 * Generate and store embedding for a single product
 */
export async function embedProduct(
  payload: Payload,
  product: ProductTextInput
): Promise<EmbeddingResult> {
  const text = createProductText(product)
  const embedding = await generateEmbedding(text)
  const timestamp = new Date()

  // Store embedding in database using raw SQL (Payload doesn't support vector fields natively)
  const db = payload.db as { drizzle: { execute: (query: unknown) => Promise<unknown> } }

  // Format embedding as PostgreSQL vector literal
  const vectorString = `[${embedding.join(',')}]`

  await db.drizzle.execute(
    `UPDATE products
     SET embedding = '${vectorString}'::vector,
         embedding_model = '${EMBEDDING_MODEL}',
         embedding_updated_at = NOW()
     WHERE id = ${product.id}`
  )

  console.log(`[Embeddings] Generated embedding for product ${product.id}: ${product.name}`)

  return {
    productId: product.id,
    embedding,
    model: EMBEDDING_MODEL,
    timestamp,
  }
}

/**
 * Batch embed multiple products
 */
export async function embedProducts(
  payload: Payload,
  products: ProductTextInput[]
): Promise<EmbeddingResult[]> {
  if (products.length === 0) return []

  // Generate texts
  const texts = products.map(createProductText)

  // Generate embeddings in batch
  const embeddings = await generateEmbeddings(texts)

  // Store all embeddings
  const results: EmbeddingResult[] = []
  const timestamp = new Date()
  const db = payload.db as { drizzle: { execute: (query: unknown) => Promise<unknown> } }

  for (let i = 0; i < products.length; i++) {
    const product = products[i]
    const embedding = embeddings[i]

    // Format embedding as PostgreSQL vector literal
    const vectorString = `[${embedding.join(',')}]`

    await db.drizzle.execute(
      `UPDATE products
       SET embedding = '${vectorString}'::vector,
           embedding_model = '${EMBEDDING_MODEL}',
           embedding_updated_at = NOW()
       WHERE id = ${product.id}`
    )

    results.push({
      productId: product.id,
      embedding,
      model: EMBEDDING_MODEL,
      timestamp,
    })
  }

  console.log(`[Embeddings] Generated embeddings for ${products.length} products`)

  return results
}

/**
 * Semantic search: Find similar products using vector similarity
 */
export async function searchSimilarProducts(
  payload: Payload,
  query: string,
  options: {
    limit?: number
    minSimilarity?: number
    excludeIds?: number[]
    verdictFilter?: 'recommend' | 'caution' | 'avoid' | null
  } = {}
): Promise<SimilarProduct[]> {
  const { limit = 20, minSimilarity = 0.3, excludeIds = [], verdictFilter = null } = options

  // Generate embedding for the search query
  const queryEmbedding = await generateEmbedding(query)
  const vectorString = `[${queryEmbedding.join(',')}]`

  // Build WHERE clause
  const whereClauses: string[] = [
    "p.status = 'published'",
    'p.embedding IS NOT NULL',
  ]

  if (excludeIds.length > 0) {
    whereClauses.push(`p.id NOT IN (${excludeIds.join(',')})`)
  }

  if (verdictFilter) {
    whereClauses.push(`p.verdict = '${verdictFilter}'`)
  }

  const whereClause = whereClauses.join(' AND ')

  // Execute similarity search using pgvector
  // Using cosine similarity (1 - cosine distance)
  const db = payload.db as {
    drizzle: {
      execute: (query: unknown) => Promise<{ rows: unknown[] }>
    }
  }

  const result = await db.drizzle.execute(
    `SELECT
       p.id,
       p.name,
       p.brand,
       p.verdict,
       p.image_url as "imageUrl",
       c.name as "categoryName",
       1 - (p.embedding <=> '${vectorString}'::vector) as similarity
     FROM products p
     LEFT JOIN categories c ON p.category_id = c.id
     WHERE ${whereClause}
       AND 1 - (p.embedding <=> '${vectorString}'::vector) > ${minSimilarity}
     ORDER BY p.embedding <=> '${vectorString}'::vector
     LIMIT ${limit}`
  )

  return (result.rows as unknown[]).map((row: unknown) => {
    const r = row as {
      id: number
      name: string
      brand: string
      similarity: number
      verdict?: string
      imageUrl?: string | null
      categoryName?: string | null
    }
    return {
      id: r.id,
      name: r.name,
      brand: r.brand,
      similarity: r.similarity,
      verdict: r.verdict,
      imageUrl: r.imageUrl,
      category: r.categoryName ? { name: r.categoryName } : null,
    }
  })
}

/**
 * Find products without embeddings (for batch processing)
 */
export async function findProductsWithoutEmbeddings(
  payload: Payload,
  limit: number = 100
): Promise<ProductTextInput[]> {
  const db = payload.db as {
    drizzle: {
      execute: (query: unknown) => Promise<{ rows: unknown[] }>
    }
  }

  const result = await db.drizzle.execute(
    `SELECT
       p.id,
       p.name,
       p.brand,
       p.summary,
       p.verdict_reason as "verdictReason",
       c.name as "category"
     FROM products p
     LEFT JOIN categories c ON p.category_id = c.id
     WHERE p.status = 'published'
       AND p.embedding IS NULL
       AND p.name IS NOT NULL
       AND p.brand IS NOT NULL
     LIMIT ${limit}`
  )

  return (result.rows as unknown[]).map((row: unknown) => {
    const r = row as {
      id: number
      name: string
      brand: string
      summary?: string | null
      verdictReason?: string | null
      category?: string | null
    }
    return {
      id: r.id,
      name: r.name,
      brand: r.brand,
      summary: r.summary,
      verdictReason: r.verdictReason,
      category: r.category,
    }
  })
}

/**
 * Get embedding statistics
 */
export async function getEmbeddingStats(payload: Payload): Promise<{
  totalProducts: number
  withEmbeddings: number
  withoutEmbeddings: number
  percentComplete: number
}> {
  const db = payload.db as {
    drizzle: {
      execute: (query: unknown) => Promise<{ rows: { count: string }[] }>
    }
  }

  const totalResult = await db.drizzle.execute(
    `SELECT COUNT(*) as count FROM products WHERE status = 'published'`
  )
  const totalProducts = parseInt(totalResult.rows[0].count, 10)

  const withEmbeddingsResult = await db.drizzle.execute(
    `SELECT COUNT(*) as count FROM products WHERE status = 'published' AND embedding IS NOT NULL`
  )
  const withEmbeddings = parseInt(withEmbeddingsResult.rows[0].count, 10)

  const withoutEmbeddings = totalProducts - withEmbeddings
  const percentComplete = totalProducts > 0 ? (withEmbeddings / totalProducts) * 100 : 0

  return {
    totalProducts,
    withEmbeddings,
    withoutEmbeddings,
    percentComplete: Math.round(percentComplete * 10) / 10,
  }
}
