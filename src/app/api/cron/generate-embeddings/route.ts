import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import {
  findProductsWithoutEmbeddings,
  embedProducts,
  getEmbeddingStats,
} from '../../../../utilities/embeddings'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // Vercel function timeout

/**
 * GET /api/cron/generate-embeddings
 *
 * Cron job to generate embeddings for products that don't have them.
 * Processes products in batches to stay within API limits and timeouts.
 *
 * Set up in Vercel Cron or call manually:
 * - vercel.json: { "crons": [{ "path": "/api/cron/generate-embeddings", "schedule": "0 * * * *" }] }
 * - This runs every hour
 *
 * Authorization:
 * - Requires CRON_SECRET header matching CRON_SECRET env var
 * - Or x-api-key header matching PAYLOAD_API_SECRET env var
 */
export async function GET(request: Request) {
  try {
    // Verify authorization
    const cronSecret = request.headers.get('authorization')?.replace('Bearer ', '')
    const apiKey = request.headers.get('x-api-key')

    const validCronSecret = cronSecret === process.env.CRON_SECRET
    const validApiKey = apiKey === process.env.PAYLOAD_API_SECRET

    if (!validCronSecret && !validApiKey) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY not configured' },
        { status: 503 }
      )
    }

    const payload = await getPayload({ config })

    // Get current stats
    const statsBefore = await getEmbeddingStats(payload)

    // Find products without embeddings
    const batchSize = 50 // Process 50 at a time to stay within limits
    const products = await findProductsWithoutEmbeddings(payload, batchSize)

    if (products.length === 0) {
      return NextResponse.json({
        message: 'All products have embeddings',
        stats: statsBefore,
      })
    }

    console.log(`[Embeddings Cron] Processing ${products.length} products...`)

    // Generate embeddings
    const results = await embedProducts(payload, products)

    // Get updated stats
    const statsAfter = await getEmbeddingStats(payload)

    return NextResponse.json({
      message: `Generated embeddings for ${results.length} products`,
      processed: results.length,
      statsBefore,
      statsAfter,
      remaining: statsAfter.withoutEmbeddings,
    })
  } catch (error) {
    console.error('[Embeddings Cron] Error:', error)

    return NextResponse.json(
      {
        error: 'Embedding generation failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/cron/generate-embeddings
 *
 * Trigger embedding generation for specific products or all missing.
 *
 * Request body:
 * {
 *   productIds?: number[],  // Specific products to embed (optional)
 *   batchSize?: number,     // Override batch size (default 50)
 *   dryRun?: boolean,       // Just return what would be processed
 * }
 */
export async function POST(request: Request) {
  try {
    // Verify authorization
    const apiKey = request.headers.get('x-api-key')
    if (apiKey !== process.env.PAYLOAD_API_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY not configured' },
        { status: 503 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const { productIds, batchSize = 50, dryRun = false } = body

    const payload = await getPayload({ config })

    // If specific product IDs provided, fetch and embed those
    if (productIds && Array.isArray(productIds) && productIds.length > 0) {
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
         WHERE p.id IN (${productIds.join(',')})
           AND p.status = 'published'
           AND p.name IS NOT NULL
           AND p.brand IS NOT NULL`
      )

      const products = (result.rows as unknown[]).map((row: unknown) => {
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

      if (dryRun) {
        return NextResponse.json({
          message: 'Dry run - would process these products',
          products: products.map((p) => ({ id: p.id, name: p.name, brand: p.brand })),
          count: products.length,
        })
      }

      const results = await embedProducts(payload, products)

      return NextResponse.json({
        message: `Generated embeddings for ${results.length} specific products`,
        processed: results.length,
        productIds: results.map((r) => r.productId),
      })
    }

    // Otherwise, process batch of products without embeddings
    const products = await findProductsWithoutEmbeddings(payload, batchSize)

    if (dryRun) {
      return NextResponse.json({
        message: 'Dry run - would process these products',
        products: products.map((p) => ({ id: p.id, name: p.name, brand: p.brand })),
        count: products.length,
      })
    }

    if (products.length === 0) {
      const stats = await getEmbeddingStats(payload)
      return NextResponse.json({
        message: 'All products have embeddings',
        stats,
      })
    }

    const results = await embedProducts(payload, products)
    const stats = await getEmbeddingStats(payload)

    return NextResponse.json({
      message: `Generated embeddings for ${results.length} products`,
      processed: results.length,
      stats,
    })
  } catch (error) {
    console.error('[Embeddings Manual] Error:', error)

    return NextResponse.json(
      {
        error: 'Embedding generation failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
