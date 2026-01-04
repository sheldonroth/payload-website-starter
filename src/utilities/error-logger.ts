import { createAuditLog } from '../collections/AuditLog'

/**
 * Error Logger Utility
 *
 * Centralized error logging for all automation hooks.
 * Writes errors to AuditLog for admin visibility and debugging.
 */

export type ErrorCategory =
    | 'ingredient_parse_error'
    | 'category_hydration_error'
    | 'verdict_calculation_error'
    | 'conflict_detection_error'
    | 'enrichment_error'
    | 'image_processing_error'
    | 'fuzzy_match_error'
    | 'ai_classification_error'
    | 'safe_alternatives_error'
    | 'ocr_extraction_error'
    | 'threshold_fetch_error'

interface LogErrorOptions {
    category: ErrorCategory
    message: string
    targetCollection?: 'products' | 'ingredients' | 'categories' | 'videos' | 'articles'
    targetId?: number
    targetName?: string
    metadata?: Record<string, unknown>
    error?: Error | unknown
    // Retry capability
    retryable?: boolean
    retryEndpoint?: string
    retryPayload?: Record<string, unknown>
}

/**
 * Mapping of error categories to their default retry endpoints
 */
const RETRY_ENDPOINTS: Partial<Record<ErrorCategory, string>> = {
    image_processing_error: '/api/background/remove',
    enrichment_error: '/api/category/enrich',
    ai_classification_error: '/api/ingest',
    ocr_extraction_error: '/api/products/extract-from-image',
}

/**
 * Log an automation error to AuditLog
 *
 * @example
 * await logError(req.payload, {
 *   category: 'ingredient_parse_error',
 *   message: 'Failed to parse ingredient list',
 *   targetCollection: 'products',
 *   targetId: 123,
 *   targetName: 'Product Name',
 *   error: err
 * })
 */
export async function logError(
    payload: { create: Function },
    options: LogErrorOptions
): Promise<void> {
    const {
        category,
        message,
        targetCollection,
        targetId,
        targetName,
        metadata,
        error,
        retryable,
        retryEndpoint,
        retryPayload,
    } = options

    // Extract error details if provided
    const errorDetails: Record<string, unknown> = {}
    if (error) {
        if (error instanceof Error) {
            errorDetails.errorName = error.name
            errorDetails.errorMessage = error.message
            errorDetails.errorStack = error.stack?.split('\n').slice(0, 5).join('\n')
        } else {
            errorDetails.errorRaw = String(error)
        }
    }

    // Determine retry capability
    const isRetryable = retryable ?? RETRY_ENDPOINTS[category] !== undefined
    const endpoint = retryEndpoint ?? RETRY_ENDPOINTS[category]

    // Build retry payload if retryable and not provided
    const computedRetryPayload =
        retryPayload ?? (isRetryable && targetId ? { productId: targetId } : undefined)

    await createAuditLog(payload, {
        action: 'error',
        sourceType: 'system',
        targetCollection,
        targetId,
        targetName,
        success: false,
        errorMessage: message,
        metadata: {
            category,
            ...errorDetails,
            ...metadata,
            timestamp: new Date().toISOString(),
        },
        // Retry fields
        retryable: isRetryable,
        retryEndpoint: endpoint,
        retryPayload: computedRetryPayload,
    })

    // Also log to console for immediate visibility
    console.error(`[${category}] ${message}`, {
        targetCollection,
        targetId,
        targetName,
        retryable: isRetryable,
        error: error instanceof Error ? error.message : error,
    })
}

/**
 * Log a warning (non-fatal) to AuditLog
 * Uses the error action type but with success=true
 */
export async function logWarning(
    payload: { create: Function },
    options: Omit<LogErrorOptions, 'error'> & { warning?: string }
): Promise<void> {
    const { category, message, targetCollection, targetId, targetName, metadata, warning } = options

    await createAuditLog(payload, {
        action: 'error', // Use same action type for filtering
        sourceType: 'system',
        targetCollection,
        targetId,
        targetName,
        success: true, // Warning, not failure
        metadata: {
            category,
            isWarning: true,
            warningMessage: warning || message,
            ...metadata,
            timestamp: new Date().toISOString(),
        },
    })

    console.warn(`[${category}] ${message}`, {
        targetCollection,
        targetId,
        targetName,
    })
}
