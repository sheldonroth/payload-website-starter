import type { PayloadHandler, PayloadRequest, Payload } from 'payload'

/**
 * Amazon Link Validation Endpoint
 * POST /api/amazon/validate
 *
 * Validates Amazon product links by checking if the page exists.
 * Supports both ASIN-based direct links and search-based links.
 *
 * Future: Will support Amazon PA-API when credentials are available.
 */

interface ValidationResult {
    productId: number
    productName: string
    asin: string | null
    linkType: 'direct' | 'search'
    status: 'valid' | 'invalid'
    error?: string
    url: string
}

interface ValidateResponse {
    success: boolean
    validated: number
    valid: number
    invalid: number
    results: ValidationResult[]
    papiAvailable: boolean
}

// Check if Amazon PA-API credentials are configured
function hasPapiCredentials(): boolean {
    return !!(
        process.env.AMAZON_ACCESS_KEY &&
        process.env.AMAZON_SECRET_KEY &&
        process.env.AMAZON_PARTNER_TAG
    )
}

// Validate ASIN format (10 alphanumeric characters)
function isValidAsinFormat(asin: string): boolean {
    return /^[A-Z0-9]{10}$/i.test(asin)
}

// Generate Amazon URL for a product
function getAmazonUrl(asin: string | null, brand: string, name: string, affiliateTag?: string): { url: string; type: 'direct' | 'search' } {
    if (asin && isValidAsinFormat(asin)) {
        const url = affiliateTag
            ? `https://www.amazon.com/dp/${asin.toUpperCase()}?tag=${affiliateTag}`
            : `https://www.amazon.com/dp/${asin.toUpperCase()}`
        return { url, type: 'direct' }
    }

    const searchTerms = `${brand} ${name}`.trim()
    const encodedSearch = encodeURIComponent(searchTerms)
    const url = affiliateTag
        ? `https://www.amazon.com/s?k=${encodedSearch}&tag=${affiliateTag}`
        : `https://www.amazon.com/s?k=${encodedSearch}`
    return { url, type: 'search' }
}

// Simple HTTP check to see if Amazon page exists
// Note: Amazon may rate-limit or block automated requests
async function checkAmazonLink(url: string): Promise<{ valid: boolean; error?: string }> {
    try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 10000) // 10s timeout

        const response = await fetch(url, {
            method: 'HEAD',
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; ProductReportBot/1.0)',
                'Accept': 'text/html',
            },
            redirect: 'follow',
            signal: controller.signal,
        })

        clearTimeout(timeoutId)

        // Amazon returns 200 for valid pages
        // 404 means product not found
        // 503 might mean rate limiting
        if (response.ok) {
            return { valid: true }
        }

        if (response.status === 404) {
            return { valid: false, error: 'Product not found on Amazon' }
        }

        if (response.status === 503) {
            return { valid: false, error: 'Amazon rate limit - try again later' }
        }

        return { valid: false, error: `HTTP ${response.status}` }
    } catch (error) {
        if (error instanceof Error) {
            if (error.name === 'AbortError') {
                return { valid: false, error: 'Request timeout' }
            }
            return { valid: false, error: error.message }
        }
        return { valid: false, error: 'Unknown error' }
    }
}

// Future: Use Amazon PA-API for validation (more reliable)
async function validateWithPapi(asin: string): Promise<{ valid: boolean; error?: string; productData?: any }> {
    // TODO: Implement when PA-API credentials are available
    // This would use the Amazon Product Advertising API to:
    // 1. Verify the ASIN exists
    // 2. Get product details (title, price, availability)
    // 3. Return richer data for the product
    return { valid: false, error: 'PA-API not configured' }
}

// Main validation logic
async function validateProduct(
    product: any,
    affiliateTag?: string,
    usePapi: boolean = false
): Promise<ValidationResult> {
    const asin = product.amazonAsin || null
    const brand = typeof product.brand === 'string' ? product.brand : ''
    const name = product.name || ''

    const { url, type } = getAmazonUrl(asin, brand, name, affiliateTag)

    // If PA-API is available and we have an ASIN, use it
    if (usePapi && asin && isValidAsinFormat(asin)) {
        const papiResult = await validateWithPapi(asin)
        return {
            productId: product.id,
            productName: `${brand} - ${name}`,
            asin,
            linkType: type,
            status: papiResult.valid ? 'valid' : 'invalid',
            error: papiResult.error,
            url,
        }
    }

    // Fallback to HTTP check
    const httpResult = await checkAmazonLink(url)
    return {
        productId: product.id,
        productName: `${brand} - ${name}`,
        asin,
        linkType: type,
        status: httpResult.valid ? 'valid' : 'invalid',
        error: httpResult.error,
        url,
    }
}

// Handler
export const amazonValidateHandler: PayloadHandler = async (req: PayloadRequest) => {
    // Auth check
    if (!req.user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json?.() || {}
    const {
        productId,           // Single product ID
        productIds,          // Array of product IDs
        validateAll = false, // Validate all products with ASINs
        limit = 50,          // Max products to validate at once
    } = body

    const results: ValidationResult[] = []
    let validCount = 0
    let invalidCount = 0

    try {
        // Get affiliate tag from settings
        let affiliateTag: string | undefined
        try {
            const settings = await req.payload.findGlobal({
                slug: 'site-settings',
            }) as any
            affiliateTag = settings?.affiliateSettings?.amazonAffiliateTag
        } catch {
            // Settings not available, continue without tag
        }

        const usePapi = hasPapiCredentials()

        // Determine which products to validate
        let products: any[] = []

        if (productId) {
            const product = await req.payload.findByID({
                collection: 'products',
                id: productId,
            })
            if (product) products = [product]
        } else if (productIds?.length) {
            const found = await req.payload.find({
                collection: 'products',
                where: { id: { in: productIds } },
                limit: Math.min(productIds.length, limit),
            })
            products = found.docs
        } else if (validateAll) {
            // Only validate products that have ASINs and haven't been checked recently
            const found = await req.payload.find({
                collection: 'products',
                where: {
                    amazonAsin: { exists: true },
                },
                limit,
            })
            products = found.docs
        }

        if (products.length === 0) {
            return Response.json({
                success: true,
                validated: 0,
                valid: 0,
                invalid: 0,
                results: [],
                papiAvailable: usePapi,
                message: 'No products to validate',
            })
        }

        // Validate each product with a small delay to avoid rate limiting
        for (const product of products) {
            const result = await validateProduct(product, affiliateTag, usePapi)
            results.push(result)

            if (result.status === 'valid') {
                validCount++
            } else {
                invalidCount++
            }

            // Update the product with validation status
            await req.payload.update({
                collection: 'products',
                id: product.id,
                data: {
                    amazonLinkStatus: result.status,
                    amazonLinkLastChecked: new Date().toISOString(),
                    amazonLinkError: result.error || null,
                } as any,
            })

            // Small delay between requests to avoid rate limiting
            if (products.length > 1) {
                await new Promise(resolve => setTimeout(resolve, 500))
            }
        }

        const response: ValidateResponse = {
            success: true,
            validated: results.length,
            valid: validCount,
            invalid: invalidCount,
            results,
            papiAvailable: usePapi,
        }

        return Response.json(response)

    } catch (error) {
        console.error('[Amazon Validate] Error:', error)
        return Response.json({
            success: false,
            error: error instanceof Error ? error.message : 'Validation failed',
            validated: results.length,
            valid: validCount,
            invalid: invalidCount,
            results,
            papiAvailable: hasPapiCredentials(),
        }, { status: 500 })
    }
}

// Batch validation function for cron/bulk operations
export async function validateAmazonLinks(
    payload: Payload,
    options: { limit?: number; onlyUnchecked?: boolean } = {}
): Promise<ValidateResponse> {
    const { limit = 50, onlyUnchecked = true } = options

    const where: any = {
        amazonAsin: { exists: true },
    }

    if (onlyUnchecked) {
        where.amazonLinkStatus = { equals: 'unchecked' }
    }

    const products = await payload.find({
        collection: 'products',
        where,
        limit,
    })

    let affiliateTag: string | undefined
    try {
        const settings = await payload.findGlobal({
            slug: 'site-settings',
        }) as any
        affiliateTag = settings?.affiliateSettings?.amazonAffiliateTag
    } catch {
        // Continue without tag
    }

    const results: ValidationResult[] = []
    let validCount = 0
    let invalidCount = 0
    const usePapi = hasPapiCredentials()

    for (const product of products.docs) {
        const result = await validateProduct(product, affiliateTag, usePapi)
        results.push(result)

        if (result.status === 'valid') {
            validCount++
        } else {
            invalidCount++
        }

        await payload.update({
            collection: 'products',
            id: product.id,
            data: {
                amazonLinkStatus: result.status,
                amazonLinkLastChecked: new Date().toISOString(),
                amazonLinkError: result.error || null,
            } as any,
        })

        // Small delay
        await new Promise(resolve => setTimeout(resolve, 500))
    }

    return {
        success: true,
        validated: results.length,
        valid: validCount,
        invalid: invalidCount,
        results,
        papiAvailable: usePapi,
    }
}
