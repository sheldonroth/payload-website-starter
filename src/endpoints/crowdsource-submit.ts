import type { PayloadHandler, PayloadRequest } from 'payload'
import { createAuditLog } from '../collections/AuditLog'
import { parseAndLinkIngredients } from '../utilities/smart-automation'
import { extractProductFromImage } from '../utilities/image-extraction'

/**
 * Crowdsource Submission Endpoint
 * POST /api/crowdsource/submit
 *
 * Handles user-submitted product scans, tips, and reports.
 * Includes:
 * - Image processing with GPT-4 Vision
 * - Duplicate detection
 * - Spam prevention
 * - Points calculation
 */

interface SubmissionRequest {
    type: 'product_scan' | 'tip' | 'reaction_report' | 'correction' | 'product_request'
    email?: string
    name?: string
    productId?: number // For corrections/reports on existing products
    barcode?: string
    images?: Array<{ base64: string; type: string }>
    content?: string
    reactionDetails?: {
        symptoms?: string[]
        severity?: string
        suspectedIngredient?: string
    }
}

interface SubmissionResult {
    success: boolean
    submissionId?: number
    isDuplicate?: boolean
    extractedData?: {
        productName?: string
        brand?: string
        upc?: string
        ingredients?: string
    }
    pointsAwarded?: number
    message: string
    warnings?: string[]
}

// Rate limiting for submissions
const submissionRateLimits = new Map<string, { count: number; resetAt: number }>()

function checkSubmissionRateLimit(key: string): boolean {
    const now = Date.now()
    const limit = submissionRateLimits.get(key)

    if (!limit || limit.resetAt < now) {
        submissionRateLimits.set(key, { count: 1, resetAt: now + 3600000 }) // 1 hour
        return true
    }

    if (limit.count >= 10) { // Max 10 submissions per hour
        return false
    }

    limit.count++
    return true
}

// Check for duplicate products
async function checkForDuplicate(
    payload: any,
    data: { productName?: string; upc?: string }
): Promise<{ isDuplicate: boolean; existingId?: number }> {
    if (data.upc) {
        const byUpc = await payload.find({
            collection: 'products',
            where: { upc: { equals: data.upc } },
            limit: 1,
        })
        if (byUpc.totalDocs > 0) {
            return { isDuplicate: true, existingId: (byUpc.docs[0] as { id: number }).id }
        }
    }

    if (data.productName) {
        const byName = await payload.find({
            collection: 'products',
            where: { name: { contains: data.productName } },
            limit: 1,
        })
        if (byName.totalDocs > 0) {
            return { isDuplicate: true, existingId: (byName.docs[0] as { id: number }).id }
        }
    }

    return { isDuplicate: false }
}

// Calculate points for submission
function calculatePoints(type: string, hasImages: boolean, isNew: boolean): number {
    const basePoints: Record<string, number> = {
        product_scan: 10,
        tip: 25,
        reaction_report: 15,
        correction: 5,
        product_request: 3,
    }

    let points = basePoints[type] || 5

    if (hasImages) points += 5
    if (isNew) points += 10 // Bonus for new products

    return points
}

export const crowdsourceSubmitHandler: PayloadHandler = async (req: PayloadRequest) => {
    // Get client IP for rate limiting
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0] ||
                     req.headers.get('x-real-ip') ||
                     'unknown'

    // Rate limiting
    if (!checkSubmissionRateLimit(clientIp)) {
        return Response.json({
            success: false,
            message: 'Rate limit exceeded. Please try again later.',
        }, { status: 429 })
    }

    try {
        const body = await req.json?.() as SubmissionRequest
        const { type, email, name, productId, barcode, images, content, reactionDetails } = body

        if (!type) {
            return Response.json({
                success: false,
                message: 'Submission type is required',
            }, { status: 400 })
        }

        const result: SubmissionResult = {
            success: false,
            message: '',
            warnings: [],
        }

        // Process images if provided
        let extractedData: {
            productName?: string
            brand?: string
            upc?: string
            ingredients?: string
        } | undefined

        let aiConfidence = 0

        if (images && images.length > 0) {
            // Try to extract from the first image
            const extracted = await extractProductFromImage(images[0].base64)
            if (extracted.confidence > 0.5) {
                extractedData = {
                    productName: extracted.productName,
                    brand: extracted.brand,
                    upc: extracted.upc || barcode,
                    ingredients: extracted.ingredients,
                }
                aiConfidence = Math.round(extracted.confidence * 100)
                result.extractedData = extractedData
            } else {
                // Report AI extraction failure to user
                if (extracted.error) {
                    result.warnings!.push(`Image processing: ${extracted.error}. Your submission was still saved for manual review.`)
                } else if (extracted.confidence > 0 && extracted.confidence <= 0.5) {
                    result.warnings!.push('Image quality was too low for automatic extraction. Your submission was saved for manual review.')
                } else {
                    result.warnings!.push('Could not extract product info from image. Your submission was saved for manual review.')
                }
            }
        }

        // Use barcode if provided and not extracted
        if (barcode && (!extractedData?.upc)) {
            extractedData = extractedData || {}
            extractedData.upc = barcode
        }

        // Check for duplicates (for product scans)
        if (type === 'product_scan' && extractedData) {
            const duplicate = await checkForDuplicate(req.payload, extractedData)
            if (duplicate.isDuplicate) {
                result.isDuplicate = true
                // Still create submission but mark as duplicate
            }
        }

        // Upload images to media collection
        const uploadedImageIds: number[] = []
        if (images && images.length > 0) {
            for (let i = 0; i < Math.min(images.length, 5); i++) {
                try {
                    // Convert base64 to buffer
                    const buffer = Buffer.from(images[i].base64, 'base64')

                    // Create media entry
                    const media = await req.payload.create({
                        collection: 'media',
                        data: {
                            alt: `User submission ${type} ${i + 1}`,
                        },
                        file: {
                            data: buffer,
                            mimetype: 'image/jpeg',
                            name: `submission-${Date.now()}-${i}.jpg`,
                            size: buffer.length,
                        },
                    }) as { id: number }

                    uploadedImageIds.push(media.id)
                } catch (uploadError) {
                    console.error('Failed to upload image:', uploadError)
                }
            }
        }

        // Create the submission record
        const submissionData: Record<string, unknown> = {
            type,
            submitterEmail: email,
            submitterName: name,
            submitterIp: clientIp,
            product: productId,
            barcode: extractedData?.upc || barcode,
            content,
            extractedData,
            aiConfidence,
            status: result.isDuplicate ? 'duplicate' : 'pending',
            images: uploadedImageIds.map((id, i) => ({
                image: id,
                imageType: images?.[i]?.type || 'other',
            })),
        }

        if (type === 'reaction_report' && reactionDetails) {
            submissionData.reactionDetails = reactionDetails
        }

        const submission = await (req.payload.create as Function)({
            collection: 'user-submissions',
            data: submissionData,
        }) as { id: number }

        result.success = true
        result.submissionId = submission.id
        result.pointsAwarded = calculatePoints(type, uploadedImageIds.length > 0, !result.isDuplicate)

        if (result.isDuplicate) {
            result.message = 'Thanks for your submission! This product already exists in our database, but we appreciate your contribution.'
        } else {
            result.message = 'Thank you for your submission! Our team will review it shortly.'
        }

        // Create audit log
        await createAuditLog(req.payload, {
            action: 'ai_draft_created',
            sourceType: 'manual',
            targetCollection: 'user-submissions',
            targetId: submission.id,
            metadata: {
                submissionType: type,
                hasImages: uploadedImageIds.length > 0,
                aiConfidence,
                isDuplicate: result.isDuplicate,
                extractedProductName: extractedData?.productName,
                aiWarnings: result.warnings,
            },
        })

        // Clean up response - remove empty warnings array
        if (result.warnings && result.warnings.length === 0) {
            delete result.warnings
        }

        return Response.json(result)
    } catch (error) {
        console.error('Crowdsource submission error:', error)
        return Response.json({
            success: false,
            message: 'Failed to process submission. Please try again.',
        }, { status: 500 })
    }
}

/**
 * Gamification leaderboard endpoint
 * GET /api/crowdsource/leaderboard
 */
export const crowdsourceLeaderboardHandler: PayloadHandler = async (req: PayloadRequest) => {
    try {
        // Get verified submissions grouped by email
        const submissions = await (req.payload.find as Function)({
            collection: 'user-submissions',
            where: {
                status: { equals: 'verified' },
                submitterEmail: { exists: true },
            },
            limit: 1000,
        })

        // Aggregate points by email
        const pointsByUser: Record<string, { name: string; points: number; submissions: number }> = {}

        for (const sub of submissions.docs) {
            const submission = sub as {
                submitterEmail?: string
                submitterName?: string
                pointsAwarded?: number
            }

            if (!submission.submitterEmail) continue

            if (!pointsByUser[submission.submitterEmail]) {
                pointsByUser[submission.submitterEmail] = {
                    name: submission.submitterName || submission.submitterEmail.split('@')[0],
                    points: 0,
                    submissions: 0,
                }
            }

            pointsByUser[submission.submitterEmail].points += submission.pointsAwarded || 0
            pointsByUser[submission.submitterEmail].submissions++
        }

        // Sort by points
        const leaderboard = Object.entries(pointsByUser)
            .map(([email, data]) => ({
                name: data.name,
                points: data.points,
                submissions: data.submissions,
                // Mask email for privacy
                email: email.replace(/(.{2})(.*)(@.*)/, '$1***$3'),
            }))
            .sort((a, b) => b.points - a.points)
            .slice(0, 50)

        return Response.json({
            success: true,
            leaderboard,
            totalContributors: Object.keys(pointsByUser).length,
            totalSubmissions: submissions.totalDocs,
        })
    } catch (error) {
        console.error('Leaderboard error:', error)
        return Response.json({ success: false, error: 'Failed to load leaderboard' }, { status: 500 })
    }
}
