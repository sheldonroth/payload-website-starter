import type { PayloadHandler, PayloadRequest, Payload } from 'payload'
import { createAuditLog } from '../collections/AuditLog'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { unauthorizedError } from '../utilities/api-response'
import type { Brand, TrendingNew, Product } from '../payload-types'

// Interface for brand alias structure
interface BrandAlias {
    alias: string
    id?: string | null
}

// Interface for brand trending data update
interface BrandTrendingData {
    isTrending: boolean
    trendingScore: number
    trendingSentiment?: 'positive' | 'negative' | 'neutral' | 'mixed' | null
    trendingReason?: string | null
    recentNewsCount: number
    lastTrendingCheck: string
}

// Interface for product trending data update
interface ProductTrendingData {
    isTrending: boolean
    trendingScore: number
    trendingSentiment?: 'positive' | 'negative' | 'neutral' | 'mixed' | null
    trendingReason?: string | null
}

// Type for sentiment values
type SentimentValue = 'positive' | 'negative' | 'neutral'

/**
 * Trending Engine Endpoint
 * POST /api/trending/update
 *
 * Scans news sources for brand mentions and updates trending scores.
 * Can be triggered manually or via daily cron job.
 *
 * Data Sources:
 * - GDELT Project: Free, unlimited, global news database
 * - Google News RSS: Free backup source
 *
 * @openapi
 * /trending/update:
 *   post:
 *     summary: Update brand trending scores
 *     description: |
 *       Scans news sources (GDELT, Google News) for brand mentions and updates trending scores.
 *       Uses Gemini AI for sentiment analysis and consumer safety relevance scoring.
 *       Can process a single brand or full scan of all brands with products.
 *
 *       Requires authentication (admin user or cron secret).
 *     tags: [Trending, Admin, Cron]
 *     security:
 *       - bearerAuth: []
 *       - cronSecret: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               brandId:
 *                 type: integer
 *                 description: Specific brand ID to check (optional)
 *               fullScan:
 *                 type: boolean
 *                 default: false
 *                 description: Scan all brands vs only active ones
 *               daysBack:
 *                 type: integer
 *                 default: 7
 *                 description: How many days of news to analyze
 *     responses:
 *       200:
 *         description: Trending update completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 brandsScanned:
 *                   type: integer
 *                 brandsUpdated:
 *                   type: integer
 *                 newsArticlesFound:
 *                   type: integer
 *                 trendingBrands:
 *                   type: array
 *                   items:
 *                     type: string
 *                   description: Names of brands currently trending
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: string
 *       401:
 *         description: Unauthorized (missing or invalid auth)
 *       500:
 *         description: Engine failed
 */

interface NewsArticle {
    title: string
    source: string
    url: string
    publishedAt: Date
    sentiment?: number // -1 to 1
}

interface GeminiAnalysis {
    overallSentiment: 'positive' | 'negative' | 'neutral' | 'mixed'
    summary: string
    isConsumerSafety: boolean
    topics: string[]
    alertLevel: 'none' | 'info' | 'warning' | 'critical'
}

interface TrendingResult {
    success: boolean
    brandsScanned: number
    brandsUpdated: number
    newsArticlesFound: number
    trendingBrands: string[]
    errors: string[]
}

// Format date for GDELT API (YYYYMMDDHHMMSS)
function formatGDELTDate(date: Date): string {
    return date.toISOString()
        .replace(/[-:T]/g, '')
        .replace(/\.\d{3}Z/, '')
}

// Safely format date to ISO string, returns null for invalid dates
function safeISOString(date: Date): string | null {
    try {
        const timestamp = date.getTime()
        if (isNaN(timestamp)) return null
        return date.toISOString()
    } catch {
        return null
    }
}

// Parse GDELT article response
function parseGDELTArticle(article: any): NewsArticle {
    return {
        title: article.title || '',
        source: article.domain || article.source?.name || 'Unknown',
        url: article.url || '',
        publishedAt: article.seendate ? new Date(article.seendate) : new Date(),
        sentiment: article.tone ? article.tone / 10 : undefined, // GDELT tone is -10 to +10
    }
}

// Parse RSS XML to extract articles
function parseRSSFeed(xml: string): NewsArticle[] {
    const articles: NewsArticle[] = []
    const items = xml.match(/<item>[\s\S]*?<\/item>/gi) || []

    for (const item of items.slice(0, 20)) {
        const titleMatch = item.match(/<title>(.*?)<\/title>/i)
        const linkMatch = item.match(/<link>(.*?)<\/link>/i)
        const dateMatch = item.match(/<pubDate>(.*?)<\/pubDate>/i)
        const sourceMatch = item.match(/<source[^>]*>(.*?)<\/source>/i)

        // Clean CDATA if present
        const title = titleMatch?.[1]?.replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1') || ''

        articles.push({
            title,
            source: sourceMatch?.[1] || 'Google News',
            url: linkMatch?.[1] || '',
            publishedAt: dateMatch?.[1] ? new Date(dateMatch[1]) : new Date(),
        })
    }

    return articles
}

// Fetch from GDELT Global Knowledge Graph
async function fetchGDELTNews(query: string, days: number = 7): Promise<NewsArticle[]> {
    try {
        const endDate = new Date()
        const startDate = new Date()
        startDate.setDate(startDate.getDate() - days)

        // Add English language filter and source country filter for better relevance
        const enhancedQuery = `${query} sourcelang:english`

        const url = `https://api.gdeltproject.org/api/v2/doc/doc?` +
            `query=${encodeURIComponent(enhancedQuery)}` +
            `&mode=artlist&maxrecords=50&format=json` +
            `&startdatetime=${formatGDELTDate(startDate)}` +
            `&enddatetime=${formatGDELTDate(endDate)}`

        const response = await fetch(url, {
            headers: { 'User-Agent': 'ProductReportCMS/1.0' },
        })

        if (!response.ok) {
            console.error('GDELT API error:', response.status)
            return []
        }

        const data = await response.json()
        return (data.articles || []).map(parseGDELTArticle)
    } catch (error) {
        console.error('Failed to fetch GDELT news:', error)
        return []
    }
}

// Fetch from Google News RSS
async function fetchGoogleNewsRSS(query: string): Promise<NewsArticle[]> {
    try {
        const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`

        const response = await fetch(url, {
            headers: { 'User-Agent': 'ProductReportCMS/1.0' },
        })

        if (!response.ok) {
            console.error('Google News RSS error:', response.status)
            return []
        }

        const xml = await response.text()
        return parseRSSFeed(xml)
    } catch (error) {
        console.error('Failed to fetch Google News RSS:', error)
        return []
    }
}

// Deduplicate articles by URL
function deduplicateByUrl(articles: NewsArticle[]): NewsArticle[] {
    const seen = new Set<string>()
    return articles.filter(article => {
        const key = article.url || article.title
        if (seen.has(key)) return false
        seen.add(key)
        return true
    })
}

// Analyze articles with Gemini AI
async function analyzeWithGemini(
    brandName: string,
    articles: NewsArticle[]
): Promise<GeminiAnalysis> {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
        console.warn('GEMINI_API_KEY not set, using default analysis')
        return {
            overallSentiment: 'neutral',
            summary: `${brandName} appears in ${articles.length} news articles.`,
            isConsumerSafety: false,
            topics: [],
            alertLevel: 'none',
        }
    }

    try {
        const genAI = new GoogleGenerativeAI(apiKey)
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

        const articleList = articles.slice(0, 10).map((a, i) =>
            `${i + 1}. "${a.title}" - ${a.source}`
        ).join('\n')

        const prompt = `You are analyzing news articles for a consumer product safety platform.

Brand: ${brandName}

Recent News Articles:
${articleList}

Analyze these articles and respond with JSON only:
{
  "overallSentiment": "positive" | "negative" | "neutral" | "mixed",
  "summary": "2-3 sentence summary of why this brand is in the news",
  "isConsumerSafety": true/false,
  "topics": ["topic1", "topic2"],
  "alertLevel": "none" | "info" | "warning" | "critical"
}

Consider:
- Recalls = critical, negative
- Lawsuits = warning, negative
- Positive reviews = info, positive
- General business news = none, neutral
- Ingredient concerns = warning, negative`

        const result = await model.generateContent(prompt)
        const responseText = result.response.text()

        // Extract JSON from response
        const jsonMatch = responseText.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0])
        }
    } catch (error) {
        console.error('Gemini analysis error:', error)
    }

    // Default fallback
    return {
        overallSentiment: 'neutral',
        summary: `${brandName} appears in ${articles.length} news articles.`,
        isConsumerSafety: false,
        topics: [],
        alertLevel: 'none',
    }
}

// Calculate trending score (0-100)
function calculateTrendingScore(
    articleCount: number,
    analysis: GeminiAnalysis
): number {
    // Base score from article count (logarithmic, max 40 points)
    const countScore = Math.min(40, Math.log10(articleCount + 1) * 25)

    // Recency bonus (all articles are within lookback period, max 20 points)
    const recencyScore = 20

    // Sentiment intensity (extreme sentiment = more newsworthy, max 20 points)
    const sentimentScore = analysis.overallSentiment === 'mixed' ? 15
        : analysis.overallSentiment !== 'neutral' ? 20 : 5

    // Consumer safety bonus (max 20 points)
    const safetyScore = analysis.isConsumerSafety ? 20 : 0

    return Math.min(100, Math.round(countScore + recencyScore + sentimentScore + safetyScore))
}

// Propagate trending status to products
async function propagateTrendingToProducts(
    payload: Payload,
    brandId: number,
    trending: { isTrending: boolean; score: number; analysis: GeminiAnalysis }
): Promise<number> {
    try {
        // Find all products with this brand name
        const brand = await payload.findByID({
            collection: 'brands',
            id: brandId,
        }) as Brand | null

        if (!brand) return 0

        const products = await payload.find({
            collection: 'products',
            where: {
                brand: { equals: brand.name },
            },
            limit: 100,
        })

        let updated = 0
        const trendingData: ProductTrendingData = {
            isTrending: trending.isTrending,
            trendingScore: trending.score,
            trendingSentiment: trending.analysis.overallSentiment,
            trendingReason: trending.analysis.summary,
        }

        for (const product of products.docs) {
            await payload.update({
                collection: 'products',
                id: product.id,
                data: {
                    trending: trendingData,
                },
            })
            updated++
        }

        return updated
    } catch (error) {
        console.error('Failed to propagate trending to products:', error)
        return 0
    }
}

// Main handler
export const trendingEngineHandler: PayloadHandler = async (req: PayloadRequest) => {
    // Verify authentication
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    const isAuthenticated = req.user ||
        (cronSecret && authHeader === `Bearer ${cronSecret}`)

    if (!isAuthenticated) {
        return unauthorizedError()
    }

    const result: TrendingResult = {
        success: true,
        brandsScanned: 0,
        brandsUpdated: 0,
        newsArticlesFound: 0,
        trendingBrands: [],
        errors: [],
    }

    try {
        const body = await req.json?.()
        const {
            brandId = null,          // Specific brand to check
            fullScan = false,        // Scan all brands vs just active ones
            daysBack = 7,            // How far back to look
        } = body || {}

        // Step 1: Get brands to scan
        let brands: Brand[]
        if (brandId) {
            const brand = await req.payload.findByID({
                collection: 'brands',
                id: brandId,
            }) as Brand | null
            brands = brand ? [brand] : []
        } else {
            const brandsResult = await req.payload.find({
                collection: 'brands',
                where: fullScan ? {} : { productCount: { greater_than: 0 } },
                limit: 200,
            })
            brands = brandsResult.docs as Brand[]
        }

        result.brandsScanned = brands.length
        console.log(`[Trending Engine] Scanning ${brands.length} brands`)

        // Step 2: For each brand, fetch and analyze news
        for (const brand of brands) {
            try {
                // Build search terms (brand name + aliases)
                const searchTerms: string[] = [brand.name]
                if (brand.aliases) {
                    const aliases = brand.aliases as BrandAlias[]
                    searchTerms.push(...aliases.map((a) => a.alias))
                }

                // Fetch from both sources
                const articles: NewsArticle[] = []
                for (const term of searchTerms.slice(0, 3)) {
                    // Health/safety focused query
                    const query = `"${term}" (recall OR safety OR FDA OR ingredient OR review OR contamination)`

                    const [gdeltResults, googleResults] = await Promise.all([
                        fetchGDELTNews(query, daysBack),
                        fetchGoogleNewsRSS(term),
                    ])

                    articles.push(...gdeltResults, ...googleResults)
                }

                // Deduplicate
                const uniqueArticles = deduplicateByUrl(articles)
                result.newsArticlesFound += uniqueArticles.length

                if (uniqueArticles.length === 0) {
                    // No news = not trending
                    const noTrendingData: BrandTrendingData = {
                        isTrending: false,
                        trendingScore: 0,
                        trendingSentiment: null,
                        trendingReason: null,
                        recentNewsCount: 0,
                        lastTrendingCheck: new Date().toISOString(),
                    }
                    await req.payload.update({
                        collection: 'brands',
                        id: brand.id,
                        data: {
                            trending: noTrendingData,
                        },
                    })
                    continue
                }

                // Step 3: Analyze with Gemini
                const analysis = await analyzeWithGemini(brand.name, uniqueArticles)

                // Step 4: Calculate trending score
                const score = calculateTrendingScore(uniqueArticles.length, analysis)
                const isTrending = score >= 30

                // Step 5: Update brand
                const brandTrendingData: BrandTrendingData = {
                    isTrending,
                    trendingScore: score,
                    trendingSentiment: analysis.overallSentiment,
                    trendingReason: analysis.summary,
                    recentNewsCount: uniqueArticles.length,
                    lastTrendingCheck: new Date().toISOString(),
                }
                await req.payload.update({
                    collection: 'brands',
                    id: brand.id,
                    data: {
                        trending: brandTrendingData,
                    },
                })

                // Step 6: Store top news snippets (limit to 5 per brand)
                // First, delete old news for this brand
                const existingNews = await req.payload.find({
                    collection: 'trending-news',
                    where: { brand: { equals: brand.id } },
                    limit: 100,
                })
                for (const news of existingNews.docs) {
                    await req.payload.delete({
                        collection: 'trending-news',
                        id: news.id,
                    })
                }

                // Add new snippets
                for (const article of uniqueArticles.slice(0, 5)) {
                    const publishedAt = safeISOString(article.publishedAt)
                    const sentiment: SentimentValue = article.sentiment !== undefined
                        ? (article.sentiment > 0.1 ? 'positive' : article.sentiment < -0.1 ? 'negative' : 'neutral')
                        : 'neutral'
                    await req.payload.create({
                        collection: 'trending-news',
                        data: {
                            brand: brand.id,
                            title: article.title,
                            source: article.source,
                            url: article.url,
                            publishedAt: publishedAt || new Date().toISOString(),
                            sentiment,
                            matchedTerms: brand.name,
                        },
                    })
                }

                // Step 7: Propagate to products
                await propagateTrendingToProducts(req.payload, brand.id, {
                    isTrending,
                    score,
                    analysis,
                })

                result.brandsUpdated++
                if (isTrending) {
                    result.trendingBrands.push(brand.name)
                }

                console.log(`[Trending Engine] ${brand.name}: ${uniqueArticles.length} articles, score=${score}, trending=${isTrending}`)

            } catch (brandError) {
                const errorMsg = `Failed to process ${brand.name}: ${brandError instanceof Error ? brandError.message : 'Unknown error'}`
                result.errors.push(errorMsg)
                console.error(`[Trending Engine] ${errorMsg}`)
            }
        }

        // Step 8: Create audit log
        await createAuditLog(req.payload, {
            action: 'freshness_check',
            sourceType: 'system',
            metadata: {
                type: 'trending_engine',
                brandsScanned: result.brandsScanned,
                brandsUpdated: result.brandsUpdated,
                newsArticlesFound: result.newsArticlesFound,
                trendingBrands: result.trendingBrands,
            },
        })

        console.log(`[Trending Engine] Complete. ${result.brandsUpdated}/${result.brandsScanned} brands updated, ${result.trendingBrands.length} trending`)

        return Response.json(result)

    } catch (error) {
        console.error('[Trending Engine] Fatal error:', error)
        return Response.json({
            ...result,
            success: false,
            errors: [...result.errors, error instanceof Error ? error.message : 'Engine failed'],
        }, { status: 500 })
    }
}

// Export for cron job usage
export async function runTrendingEngine(
    payload: Payload,
    options: { fullScan?: boolean; daysBack?: number } = {}
): Promise<TrendingResult> {
    const { fullScan = false, daysBack = 7 } = options

    const result: TrendingResult = {
        success: true,
        brandsScanned: 0,
        brandsUpdated: 0,
        newsArticlesFound: 0,
        trendingBrands: [],
        errors: [],
    }

    try {
        const brandsResult = await payload.find({
            collection: 'brands',
            where: fullScan ? {} : { productCount: { greater_than: 0 } },
            limit: 200,
        })

        result.brandsScanned = brandsResult.docs.length

        for (const brand of brandsResult.docs as Brand[]) {
            try {
                const searchTerms: string[] = [brand.name]
                if (brand.aliases) {
                    const aliases = brand.aliases as BrandAlias[]
                    searchTerms.push(...aliases.map((a) => a.alias))
                }

                const articles: NewsArticle[] = []
                for (const term of searchTerms.slice(0, 3)) {
                    const query = `"${term}" (recall OR safety OR FDA OR ingredient OR review)`
                    const [gdelt, google] = await Promise.all([
                        fetchGDELTNews(query, daysBack),
                        fetchGoogleNewsRSS(term),
                    ])
                    articles.push(...gdelt, ...google)
                }

                const unique = deduplicateByUrl(articles)
                result.newsArticlesFound += unique.length

                if (unique.length === 0) {
                    const noTrendingData: BrandTrendingData = {
                        isTrending: false,
                        trendingScore: 0,
                        trendingSentiment: null,
                        trendingReason: null,
                        recentNewsCount: 0,
                        lastTrendingCheck: new Date().toISOString(),
                    }
                    await payload.update({
                        collection: 'brands',
                        id: brand.id,
                        data: {
                            trending: noTrendingData,
                        },
                    })
                    continue
                }

                const analysis = await analyzeWithGemini(brand.name, unique)
                const score = calculateTrendingScore(unique.length, analysis)
                const isTrending = score >= 30

                const brandTrendingData: BrandTrendingData = {
                    isTrending,
                    trendingScore: score,
                    trendingSentiment: analysis.overallSentiment,
                    trendingReason: analysis.summary,
                    recentNewsCount: unique.length,
                    lastTrendingCheck: new Date().toISOString(),
                }
                await payload.update({
                    collection: 'brands',
                    id: brand.id,
                    data: {
                        trending: brandTrendingData,
                    },
                })

                // Store top news snippets (limit to 5 per brand)
                // First, delete old news for this brand
                const existingNews = await payload.find({
                    collection: 'trending-news',
                    where: { brand: { equals: brand.id } },
                    limit: 100,
                })
                for (const news of existingNews.docs) {
                    await payload.delete({
                        collection: 'trending-news',
                        id: news.id,
                    })
                }

                // Add new snippets
                for (const article of unique.slice(0, 5)) {
                    const publishedAt = safeISOString(article.publishedAt)
                    const sentiment: SentimentValue = article.sentiment !== undefined
                        ? (article.sentiment > 0.1 ? 'positive' : article.sentiment < -0.1 ? 'negative' : 'neutral')
                        : 'neutral'
                    await payload.create({
                        collection: 'trending-news',
                        data: {
                            brand: brand.id,
                            title: article.title,
                            source: article.source,
                            url: article.url,
                            publishedAt: publishedAt || new Date().toISOString(),
                            sentiment,
                            matchedTerms: brand.name,
                        },
                    })
                }

                await propagateTrendingToProducts(payload, brand.id, { isTrending, score, analysis })

                result.brandsUpdated++
                if (isTrending) result.trendingBrands.push(brand.name)

            } catch (error) {
                result.errors.push(`${brand.name}: ${error instanceof Error ? error.message : 'Unknown'}`)
            }
        }

        await createAuditLog(payload, {
            action: 'freshness_check',
            sourceType: 'system',
            metadata: { type: 'trending_engine_cron', ...result },
        })

        return result
    } catch (error) {
        return {
            ...result,
            success: false,
            errors: [error instanceof Error ? error.message : 'Cron failed'],
        }
    }
}
