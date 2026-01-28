import type { PayloadHandler, PayloadRequest } from 'payload'
import { createAuditLog } from '../collections/AuditLog'
import { getInternalBaseUrl } from '../utilities/internal-base-url'

/**
 * Unified Ingestion Gateway
 * POST /api/ingest
 *
 * The "One-Input" dream: paste any URL/code and auto-route to the right handler.
 * Supports:
 * - YouTube URLs → video analysis
 * - TikTok URLs → TikTok analysis
 * - Amazon/product URLs → product extraction
 * - UPC/barcode codes → product lookup
 */

interface IngestResult {
    inputType: 'youtube' | 'youtube_channel' | 'tiktok' | 'amazon' | 'product_page' | 'barcode' | 'unknown'
    success: boolean
    productsFound?: number
    draftsCreated?: number
    merged?: number
    skipped?: number
    message: string
    details?: unknown
}

// Check if YouTube URL is a channel URL (not a video)
function isYouTubeChannelUrl(url: string): boolean {
    const channelPatterns = [
        /youtube\.com\/@[\w.-]+/i,           // @username format
        /youtube\.com\/channel\/UC[\w-]+/i,  // /channel/UCxxxx format
        /youtube\.com\/c\/[\w.-]+/i,         // /c/channelname format
        /youtube\.com\/user\/[\w.-]+/i,      // /user/username format (legacy)
    ]
    return channelPatterns.some(pattern => pattern.test(url))
}

// Detect input type from string
function detectInputType(input: string): IngestResult['inputType'] {
    const trimmed = input.trim().toLowerCase()

    // YouTube - check for channel URLs first
    if (trimmed.includes('youtube.com') || trimmed.includes('youtu.be')) {
        // Check if it's a channel URL (not a video)
        if (isYouTubeChannelUrl(input)) {
            return 'youtube_channel'
        }
        return 'youtube'
    }

    // TikTok
    if (trimmed.includes('tiktok.com') || trimmed.includes('vm.tiktok.com')) {
        return 'tiktok'
    }

    // Amazon
    if (trimmed.includes('amazon.com') || trimmed.includes('amzn.to') || trimmed.includes('amzn.com')) {
        return 'amazon'
    }

    // Other product pages
    if (trimmed.includes('walmart.com') || trimmed.includes('target.com') || trimmed.includes('iherb.com')) {
        return 'product_page'
    }

    // UPC/Barcode (12-14 digits)
    if (/^\d{12,14}$/.test(trimmed)) {
        return 'barcode'
    }

    // Generic URL
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        return 'product_page'
    }

    return 'unknown'
}

// Extract YouTube video ID
function extractYouTubeVideoId(url: string): string | null {
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\s?]+)/,
        /youtube\.com\/shorts\/([^&\s?]+)/,
    ]

    for (const pattern of patterns) {
        const match = url.match(pattern)
        if (match) return match[1]
    }

    return null
}

// Extract YouTube channel identifier (handle or channel ID)
function extractYouTubeChannelId(url: string): { type: 'handle' | 'channelId' | 'customUrl' | 'user'; value: string } | null {
    // @username format - extract the handle
    const handleMatch = url.match(/youtube\.com\/@([\w.-]+)/i)
    if (handleMatch) {
        return { type: 'handle', value: handleMatch[1] }
    }

    // /channel/UCxxxx format - extract channel ID
    const channelMatch = url.match(/youtube\.com\/channel\/(UC[\w-]+)/i)
    if (channelMatch) {
        return { type: 'channelId', value: channelMatch[1] }
    }

    // /c/channelname format - extract custom URL
    const customMatch = url.match(/youtube\.com\/c\/([\w.-]+)/i)
    if (customMatch) {
        return { type: 'customUrl', value: customMatch[1] }
    }

    // /user/username format - extract username (legacy)
    const userMatch = url.match(/youtube\.com\/user\/([\w.-]+)/i)
    if (userMatch) {
        return { type: 'user', value: userMatch[1] }
    }

    return null
}

// Check for existing product with fuzzy matching
async function findExistingProduct(
    payload: { find: Function },
    name: string,
    brand?: string
): Promise<{ id: number; status: string } | null> {
    // Try exact match first
    const exactMatch = await payload.find({
        collection: 'products',
        where: {
            and: [
                { name: { equals: name } },
                ...(brand ? [{ brand: { equals: brand } }] : []),
            ],
        },
        limit: 1,
    })

    if (exactMatch.docs.length > 0) {
        const doc = exactMatch.docs[0] as { id: number; status: string }
        return { id: doc.id, status: doc.status }
    }

    // Try case-insensitive contains
    const fuzzyMatch = await payload.find({
        collection: 'products',
        where: {
            and: [
                { name: { contains: name.split(' ')[0] } }, // First word
                ...(brand ? [{ brand: { contains: brand } }] : []),
            ],
        },
        limit: 5,
    })

    // Check if any are close enough (simple fuzzy)
    for (const doc of fuzzyMatch.docs) {
        const d = doc as { id: number; name: string; brand?: string; status: string }
        const nameMatch = d.name.toLowerCase().includes(name.toLowerCase()) ||
            name.toLowerCase().includes(d.name.toLowerCase())
        if (nameMatch) {
            return { id: d.id, status: d.status }
        }
    }

    return null
}

export const unifiedIngestHandler: PayloadHandler = async (req: PayloadRequest) => {
    if (!req.user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // SECURITY: Verify admin or editor role - ingestion creates products
    const userRole = (req.user as { role?: string }).role
    const isAdminFlag = (req.user as { isAdmin?: boolean }).isAdmin
    if (userRole !== 'admin' && userRole !== 'product_editor' && !isAdminFlag) {
        return Response.json({ error: 'Forbidden: Admin or Editor access required' }, { status: 403 })
    }

    try {
        const body = await req.json?.()
        const { input, autoCreate = true } = body || {}

        if (!input) {
            return Response.json({ error: 'input is required' }, { status: 400 })
        }

        const payload = req.payload
        const inputType = detectInputType(input)

        // Create audit log for ingestion attempt
        await createAuditLog(payload, {
            action: 'ai_product_created',
            sourceType: inputType === 'youtube' || inputType === 'youtube_channel' ? 'youtube' :
                inputType === 'tiktok' ? 'tiktok' :
                    inputType === 'barcode' ? 'barcode' : 'web_url',
            sourceUrl: input,
            performedBy: (req.user as { id?: number })?.id,
            metadata: { inputType, autoCreate },
        })

        const internalBaseUrl = getInternalBaseUrl(req)

        // Route to appropriate handler based on input type
        switch (inputType) {
            case 'youtube': {
                const videoId = extractYouTubeVideoId(input)
                if (!videoId) {
                    return Response.json({
                        inputType,
                        success: false,
                        message: 'Could not extract YouTube video ID',
                    })
                }

                // Call video analyze endpoint internally
                const videoResponse = await fetch(`${internalBaseUrl}/api/video/analyze`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Cookie': req.headers.get('cookie') || '',
                    },
                    body: JSON.stringify({ videoUrl: input }),
                })

                const videoResult = await videoResponse.json()

                return Response.json({
                    inputType,
                    success: videoResult.success ?? false,
                    productsFound: videoResult.productsFound || 0,
                    draftsCreated: videoResult.draftsCreated?.length || 0,
                    skipped: videoResult.skippedDuplicates?.length || 0,
                    message: videoResult.success
                        ? `Extracted ${videoResult.productsFound} products from YouTube video`
                        : videoResult.error || 'Video analysis failed',
                    details: videoResult,
                })
            }

            case 'youtube_channel': {
                const channelInfo = extractYouTubeChannelId(input)
                if (!channelInfo) {
                    return Response.json({
                        inputType,
                        success: false,
                        message: 'Could not extract YouTube channel identifier',
                    })
                }

                // For channel URLs, we need a channel ID (starts with UC)
                // Handle @username and other formats require resolution via YouTube API
                if (channelInfo.type !== 'channelId') {
                    // For non-channelId formats, guide user to Channel Analyzer
                    return Response.json({
                        inputType,
                        success: false,
                        message: `Detected YouTube channel: @${channelInfo.value}. To analyze a channel, use the "Channel Analyzer" tool in Advanced Ingestion section. You can find the channel ID on YouTube by going to the channel page → About → Share → Copy channel ID.`,
                        details: {
                            detectedType: channelInfo.type,
                            detectedValue: channelInfo.value,
                            hint: 'Channel IDs start with "UC" (e.g., UC-lHJZR3Gqxm24_Vd_AJ5Yw)',
                        }
                    })
                }

                // We have a valid channel ID (UC...), call the channel analyze endpoint
                const channelResponse = await fetch(`${internalBaseUrl}/api/channel/analyze`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Cookie': req.headers.get('cookie') || '',
                    },
                    body: JSON.stringify({
                        customChannelId: channelInfo.value,
                        maxVideos: 10
                    }),
                })

                const channelResult = await channelResponse.json()

                return Response.json({
                    inputType,
                    success: channelResult.success ?? false,
                    productsFound: channelResult.productsFound || 0,
                    draftsCreated: channelResult.draftsCreated || 0,
                    skipped: channelResult.skippedDuplicates?.length || 0,
                    message: channelResult.success
                        ? `Analyzed ${channelResult.videosProcessed || 0} videos from YouTube channel`
                        : channelResult.error || 'Channel analysis failed',
                    details: channelResult,
                })
            }

            case 'tiktok': {
                // Call TikTok analyze endpoint internally
                const tiktokResponse = await fetch(`${internalBaseUrl}/api/tiktok/analyze`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Cookie': req.headers.get('cookie') || '',
                    },
                    body: JSON.stringify({ videoUrl: input }),
                })

                const tiktokResult = await tiktokResponse.json()

                return Response.json({
                    inputType,
                    success: tiktokResult.success ?? false,
                    productsFound: tiktokResult.productsFound || 0,
                    draftsCreated: tiktokResult.draftsCreated || 0,
                    skipped: tiktokResult.skippedDuplicates?.length || 0,
                    message: tiktokResult.success
                        ? `Extracted ${tiktokResult.productsFound} products from TikTok`
                        : tiktokResult.error || 'TikTok analysis failed',
                    details: tiktokResult,
                })
            }

            case 'amazon':
            case 'product_page': {
                // Call magic-url endpoint internally
                const magicResponse = await fetch(`${internalBaseUrl}/api/magic-url`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Cookie': req.headers.get('cookie') || '',
                    },
                    body: JSON.stringify({ url: input, autoCreate }),
                })

                const magicResult = await magicResponse.json()

                // Check if product already exists (cross-platform dedup)
                if (magicResult.extractedData) {
                    const existing = await findExistingProduct(
                        payload,
                        magicResult.extractedData.name,
                        magicResult.extractedData.brand
                    )

                    if (existing && existing.status !== 'ai_draft') {
                        return Response.json({
                            inputType,
                            success: true,
                            productsFound: 1,
                            draftsCreated: 0,
                            merged: 1,
                            message: `Product "${magicResult.extractedData.name}" already exists (${existing.status})`,
                            details: {
                                existingProductId: existing.id,
                                extractedData: magicResult.extractedData,
                            },
                        })
                    }
                }

                return Response.json({
                    inputType,
                    success: magicResult.action === 'created' || magicResult.action === 'preview',
                    productsFound: magicResult.extractedData ? 1 : 0,
                    draftsCreated: magicResult.action === 'created' ? 1 : 0,
                    message: magicResult.message || 'Product page processed',
                    details: magicResult,
                })
            }

            case 'barcode': {
                // Look up product by UPC
                const existingByUpc = await payload.find({
                    collection: 'products',
                    where: { upc: { equals: input } },
                    limit: 1,
                })

                if (existingByUpc.docs.length > 0) {
                    const existing = existingByUpc.docs[0] as { id: number; name: string; status: string }
                    return Response.json({
                        inputType,
                        success: true,
                        productsFound: 1,
                        draftsCreated: 0,
                        message: `Found existing product: ${existing.name}`,
                        details: { productId: existing.id, status: existing.status },
                    })
                }

                // TODO: Add UPC database lookup (Open Food Facts, UPC Database API, etc.)
                // For now, create a placeholder product with the UPC
                if (autoCreate) {
                    const newProduct = await payload.create({
                        collection: 'products',
                        data: {
                            name: `Product (UPC: ${input})`,
                            brand: 'Unknown',
                            upc: input,
                            status: 'ai_draft',
                            verdict: 'recommend', // Default to recommend, will be reviewed
                            verdictReason: 'Created from barcode scan - needs enrichment',
                        },
                    })

                    return Response.json({
                        inputType,
                        success: true,
                        productsFound: 0,
                        draftsCreated: 1,
                        message: `Created placeholder for UPC ${input} - enrich with product details`,
                        details: { productId: newProduct.id },
                    })
                }

                return Response.json({
                    inputType,
                    success: false,
                    message: `No product found for UPC ${input}`,
                })
            }

            default:
                return Response.json({
                    inputType,
                    success: false,
                    message: `Unknown input type. Supported: YouTube URLs, TikTok URLs, Amazon URLs, product page URLs, or UPC barcodes.`,
                })
        }
    } catch (error) {
        console.error('Unified ingest error:', error)
        return Response.json(
            { error: error instanceof Error ? error.message : 'Ingestion failed' },
            { status: 500 }
        )
    }
}
