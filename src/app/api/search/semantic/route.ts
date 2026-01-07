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
 * @swagger
 * /api/search/semantic:
 *   post:
 *     summary: Semantic product search
 *     description: |
 *       Search for products using AI-powered semantic similarity.
 *       Uses pgvector embeddings with Gemini text-embedding-004 model.
 *       Returns products ordered by cosine similarity to the query.
 *     tags: [Mobile, Scanner]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [query]
 *             properties:
 *               query:
 *                 type: string
 *                 description: Natural language search query (2-500 characters)
 *                 example: "organic moisturizer for sensitive skin"
 *               limit:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 50
 *                 default: 20
 *                 description: Maximum number of results to return
 *               minSimilarity:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 1
 *                 default: 0.3
 *                 description: Minimum cosine similarity threshold
 *               verdictFilter:
 *                 type: string
 *                 enum: [recommend, caution, avoid]
 *                 description: Filter results by product verdict
 *               excludeIds:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: Product IDs to exclude from results
 *     responses:
 *       200:
 *         description: Search results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 results:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       name:
 *                         type: string
 *                       brand:
 *                         type: string
 *                       similarity:
 *                         type: number
 *                         description: Cosine similarity score (0-1)
 *                       verdict:
 *                         type: string
 *                         enum: [recommend, caution, avoid]
 *                       imageUrl:
 *                         type: string
 *                         nullable: true
 *                       category:
 *                         type: string
 *                         nullable: true
 *                 query:
 *                   type: string
 *                 count:
 *                   type: integer
 *                 embeddingStats:
 *                   type: object
 *                   description: Only included when embeddings are not 100% complete
 *                   properties:
 *                     totalProducts:
 *                       type: integer
 *                     withEmbeddings:
 *                       type: integer
 *                     percentComplete:
 *                       type: number
 *       400:
 *         description: Invalid request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       429:
 *         $ref: '#/components/responses/RateLimited'
 *       503:
 *         description: Service unavailable (embeddings not configured)
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

    // Check if it's a Gemini API error
    if (error instanceof Error && error.message.includes('GEMINI_API_KEY')) {
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
 * @swagger
 * /api/search/semantic:
 *   get:
 *     summary: Semantic product search (GET)
 *     description: Alternative GET endpoint for simple semantic search queries.
 *     tags: [Mobile, Scanner]
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Search query (2-500 characters)
 *         example: "organic sunscreen"
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 20
 *         description: Maximum number of results
 *       - in: query
 *         name: verdict
 *         schema:
 *           type: string
 *           enum: [recommend, caution, avoid]
 *         description: Filter by product verdict
 *     responses:
 *       200:
 *         description: Search results (same as POST response)
 *       400:
 *         description: Missing or invalid query parameter
 *       429:
 *         $ref: '#/components/responses/RateLimited'
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
