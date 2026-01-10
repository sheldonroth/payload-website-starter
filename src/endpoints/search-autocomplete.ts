import type { PayloadRequest } from 'payload'
import { successResponse, internalError } from '../utilities/api-response'

/**
 * @openapi
 * /api/search/autocomplete:
 *   get:
 *     summary: Search autocomplete suggestions
 *     description: Returns product name suggestions as user types
 *     tags:
 *       - Search
 *     parameters:
 *       - name: q
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 2
 *         description: Search query (minimum 2 characters)
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           default: 5
 *           maximum: 10
 *         description: Maximum number of suggestions
 *     responses:
 *       200:
 *         description: Autocomplete suggestions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 suggestions:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: number
 *                       name:
 *                         type: string
 *                       brand:
 *                         type: string
 *                       category:
 *                         type: string
 */
export const searchAutocompleteHandler = async (req: PayloadRequest): Promise<Response> => {
    if (req.method !== 'GET') {
        return Response.json({ error: 'Method not allowed' }, { status: 405 })
    }

    try {
        const url = new URL(req.url || '', 'http://localhost')
        const query = url.searchParams.get('q')?.trim() || ''
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '5', 10), 10)

        if (query.length < 2) {
            return successResponse({
                suggestions: [],
                message: 'Query too short (minimum 2 characters)',
            })
        }

        // Sanitize query: remove special characters that could cause issues
        // Allow only alphanumeric, spaces, hyphens, and common punctuation
        const sanitizedQuery = query
            .replace(/[^\w\s\-'.,&]/g, '')
            .substring(0, 100) // Limit length to prevent abuse

        if (sanitizedQuery.length < 2) {
            return successResponse({
                suggestions: [],
                message: 'Query contains invalid characters',
            })
        }

        // Search products by name with prefix matching
        const results = await req.payload.find({
            collection: 'products',
            where: {
                and: [
                    {
                        name: {
                            like: `%${sanitizedQuery}%`,
                        },
                    },
                    {
                        _status: {
                            equals: 'published',
                        },
                    },
                ],
            },
            limit,
            sort: '-overallScore', // Prioritize higher-scored products
            depth: 1, // Include related docs for category/brand names
        })

        // Map results to suggestions with explicit type handling
        const suggestions = results.docs.map((doc: any) => ({
            id: doc.id,
            name: doc.name || 'Unknown',
            brand: typeof doc.brand === 'object' ? doc.brand?.name : (doc.brand || 'Unknown'),
            category: typeof doc.category === 'object' ? doc.category?.name : (doc.category || 'Unknown'),
        }))

        return successResponse({
            suggestions,
            total: results.totalDocs,
            query,
        })
    } catch (error) {
        console.error('[SearchAutocomplete] Error:', error)
        return internalError('Failed to fetch suggestions')
    }
}
