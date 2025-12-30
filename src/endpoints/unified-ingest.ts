import type { PayloadHandler, PayloadRequest } from 'payload'
import { createAuditLog } from '../collections/AuditLog'

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
    inputType: 'youtube' | 'tiktok' | 'amazon' | 'product_page' | 'barcode' | 'unknown'
    success: boolean
    productsFound?: number
    draftsCreated?: number
    merged?: number
    skipped?: number
    message: string
    details?: unknown
}

// Detect input type from string
function detectInputType(input: string): IngestResult['inputType'] {
    const trimmed = input.trim().toLowerCase()

    // YouTube
    if (trimmed.includes('youtube.com') || trimmed.includes('youtu.be')) {
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
            sourceType: inputType === 'youtube' ? 'youtube' :
                inputType === 'tiktok' ? 'tiktok' :
                    inputType === 'barcode' ? 'barcode' : 'web_url',
            sourceUrl: input,
            performedBy: (req.user as { id?: number })?.id,
            metadata: { inputType, autoCreate },
        })

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
                const videoResponse = await fetch(`${req.headers.get('origin') || 'http://localhost:3000'}/api/video/analyze`, {
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

            case 'tiktok': {
                // Call TikTok analyze endpoint internally
                const tiktokResponse = await fetch(`${req.headers.get('origin') || 'http://localhost:3000'}/api/tiktok/analyze`, {
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
                const magicResponse = await fetch(`${req.headers.get('origin') || 'http://localhost:3000'}/api/magic-url`, {
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
                            verdict: 'pending',
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
