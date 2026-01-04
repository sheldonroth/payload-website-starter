import type { PayloadHandler, PayloadRequest } from 'payload'
import { createAuditLog } from '../collections/AuditLog'

/**
 * Error Retry Endpoint
 *
 * POST /api/error/retry
 * Retries a failed operation logged in AuditLog
 *
 * Request body: { errorId: number }
 */
export const errorRetryHandler: PayloadHandler = async (req: PayloadRequest) => {
    // Require authentication
    if (!req.user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check admin role
    const role = (req.user as { role?: string }).role
    if (role !== 'admin' && role !== 'product_editor') {
        return Response.json({ error: 'Forbidden' }, { status: 403 })
    }

    try {
        // Parse request body
        const body = await req.json?.()
        const { errorId } = body || {}

        if (!errorId) {
            return Response.json({ error: 'errorId is required' }, { status: 400 })
        }

        // Fetch the error record
        const errorRecord = await req.payload.findByID({
            collection: 'audit-log',
            id: errorId,
        })

        if (!errorRecord) {
            return Response.json({ error: 'Error record not found' }, { status: 404 })
        }

        // Validate it's retryable
        if (!errorRecord.retryable) {
            return Response.json({ error: 'This error is not retryable' }, { status: 400 })
        }

        if (!errorRecord.retryEndpoint) {
            return Response.json({ error: 'No retry endpoint configured' }, { status: 400 })
        }

        // Already resolved?
        if (errorRecord.resolvedAt) {
            return Response.json({ error: 'This error has already been resolved' }, { status: 400 })
        }

        // Increment retry count
        const newRetryCount = ((errorRecord.retryCount as number) || 0) + 1
        await req.payload.update({
            collection: 'audit-log',
            id: errorId,
            data: {
                retryCount: newRetryCount,
            },
        })

        // Build the full URL for internal call
        const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
        const retryUrl = `${baseUrl}${errorRecord.retryEndpoint}`

        // Make the retry request
        const retryResponse = await fetch(retryUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Pass along API key for internal requests
                'x-api-key': process.env.PAYLOAD_API_SECRET || '',
            },
            body: JSON.stringify(errorRecord.retryPayload || {}),
        })

        const retryResult = await retryResponse.json().catch(() => ({}))

        if (retryResponse.ok) {
            // Mark as resolved
            await req.payload.update({
                collection: 'audit-log',
                id: errorId,
                data: {
                    resolvedAt: new Date().toISOString(),
                    success: true,
                },
            })

            // Log the successful retry
            await createAuditLog(req.payload, {
                action: 'manual_override',
                sourceType: 'manual',
                targetCollection: errorRecord.targetCollection as string,
                targetId: errorRecord.targetId as number,
                targetName: errorRecord.targetName as string,
                metadata: {
                    type: 'error_retry',
                    originalErrorId: errorId,
                    retryEndpoint: errorRecord.retryEndpoint,
                    retryAttempt: newRetryCount,
                    result: 'success',
                },
                performedBy: (req.user as { id?: number })?.id,
            })

            return Response.json({
                success: true,
                message: 'Retry successful',
                retryCount: newRetryCount,
                resolved: true,
            })
        } else {
            // Log the failed retry
            await createAuditLog(req.payload, {
                action: 'error',
                sourceType: 'system',
                targetCollection: errorRecord.targetCollection as string,
                targetId: errorRecord.targetId as number,
                targetName: errorRecord.targetName as string,
                metadata: {
                    type: 'retry_failed',
                    originalErrorId: errorId,
                    retryEndpoint: errorRecord.retryEndpoint,
                    retryAttempt: newRetryCount,
                    responseStatus: retryResponse.status,
                    responseBody: retryResult,
                },
                performedBy: (req.user as { id?: number })?.id,
                success: false,
                errorMessage: `Retry attempt ${newRetryCount} failed with status ${retryResponse.status}`,
            })

            return Response.json({
                success: false,
                message: `Retry failed with status ${retryResponse.status}`,
                retryCount: newRetryCount,
                error: retryResult,
            })
        }
    } catch (error) {
        console.error('[Error Retry] Failed:', error)
        return Response.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Retry failed',
            },
            { status: 500 }
        )
    }
}
