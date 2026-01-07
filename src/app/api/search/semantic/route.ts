import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { searchSimilarProducts, generateEmbedding, getEmbeddingStats } from '../../../../utilities/embeddings'

export const dynamic = 'force-dynamic'

// Rate limiting: Simple in-memory store (use Redis in production)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT = 30 // requests per minute
const RATE_LIMIT_WINDOW = 60 * 1000 // 1 minute

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const record = rateLimitStore.get(ip)

  if (!record || now > record.resetTime) {
    rateLimitStore.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW })
    return true
  }

  if (record.count >= RATE_LIMIT) {
    return false
  }

  record.count++
  return true
}

/**
 * POST /api/search/semantic
 *
 * Semantic search for products using pgvector embeddings.
 *
 * Request body:
 * {
 *   query: string,           // Search query
 *   limit?: number,          // Max results (default 20, max 50)
 *   minSimilarity?: number,  // Minimum similarity threshold (default 0.3)
 *   verdictFilter?: string,  // Filter by verdict: 'recommend' | 'caution' | 'avoid'
 *   excludeIds?: number[],   // Product IDs to exclude
 * }
 *
 * Response:
 * {
 *   results: [
 *     { id, name, brand, similarity, verdict, imageUrl, category }
 *   ],
 *   query: string,
 *   count: number,
 *   embeddingStats?: { totalProducts, withEmbeddings, percentComplete }
 * }
 */
export async function POST(request: Request) {
  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      'unknown'

    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 }
      )
    }

    // Parse request body
    const body = await request.json().catch(() => ({}))
    const {
      query,
      limit = 20,
      minSimilarity = 0.3,
      verdictFilter = null,
      excludeIds = [],
    } = body

    // Validate query
    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query string is required' },
        { status: 400 }
      )
    }

    if (query.length < 2) {
      return NextResponse.json(
        { error: 'Query must be at least 2 characters' },
        { status: 400 }
      )
    }

    if (query.length > 500) {
      return NextResponse.json(
        { error: 'Query must be less than 500 characters' },
        { status: 400 }
      )
    }

    // Validate limit
    const safeLimit = Math.min(Math.max(1, limit), 50)

    // Validate verdictFilter
    const validVerdicts = ['recommend', 'caution', 'avoid', null]
    if (verdictFilter && !validVerdicts.includes(verdictFilter)) {
      return NextResponse.json(
        { error: 'Invalid verdictFilter. Must be: recommend, caution, or avoid' },
        { status: 400 }
      )
    }

    // Get Payload instance
    const payload = await getPayload({ config })

    // Check if embeddings are available
    const stats = await getEmbeddingStats(payload)

    if (stats.withEmbeddings === 0) {
      // Fall back to basic text search if no embeddings exist
      return NextResponse.json({
        results: [],
        query,
        count: 0,
        message: 'Semantic search not yet available. Embeddings are being generated.',
        embeddingStats: stats,
      })
    }

    // Perform semantic search
    const results = await searchSimilarProducts(payload, query, {
      limit: safeLimit,
      minSimilarity,
      excludeIds,
      verdictFilter: verdictFilter as 'recommend' | 'caution' | 'avoid' | null,
    })

    return NextResponse.json({
      results,
      query,
      count: results.length,
      embeddingStats: stats.percentComplete < 100 ? stats : undefined,
    })
  } catch (error) {
    console.error('[Semantic Search] Error:', error)

    // Check if it's an OpenAI error
    if (error instanceof Error && error.message.includes('OPENAI_API_KEY')) {
      return NextResponse.json(
        { error: 'Semantic search is not configured' },
        { status: 503 }
      )
    }

    return NextResponse.json(
      { error: 'Search failed. Please try again.' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/search/semantic
 *
 * Alternative GET endpoint for simple queries.
 * Query params: ?q=search+query&limit=20
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')
  const limit = parseInt(searchParams.get('limit') || '20', 10)
  const verdictFilter = searchParams.get('verdict')

  if (!query) {
    return NextResponse.json(
      { error: 'Query parameter "q" is required' },
      { status: 400 }
    )
  }

  // Create a fake request for the POST handler
  const fakeRequest = {
    json: async () => ({
      query,
      limit,
      verdictFilter,
    }),
    headers: request.headers,
  } as Request

  return POST(fakeRequest)
}
