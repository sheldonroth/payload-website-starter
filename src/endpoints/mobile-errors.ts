/**
 * Mobile Error Reporting Endpoint
 *
 * Captures app crashes, JS errors, and other issues from mobile clients.
 * Provides visibility into app stability without third-party crash services.
 *
 * POST /api/mobile/errors
 *
 * Body:
 * {
 *   fingerprint: string,
 *   error: {
 *     name: string,
 *     message: string,
 *     stack?: string,
 *   },
 *   context: {
 *     screen?: string,
 *     action?: string,
 *     appVersion: string,
 *     platform: string,
 *     osVersion?: string,
 *   }
 * }
 */

import type { PayloadHandler } from 'payload'

interface ErrorReport {
    fingerprint: string
    error: {
        name: string
        message: string
        stack?: string
        componentStack?: string
    }
    context: {
        screen?: string
        action?: string
        appVersion: string
        platform: 'ios' | 'android'
        osVersion?: string
        deviceModel?: string
        networkType?: string
    }
    breadcrumbs?: {
        type: string
        message: string
        timestamp: number
    }[]
    timestamp?: number
}

export const mobileErrorsHandler: PayloadHandler = async (req) => {
    if (req.method !== 'POST') {
        return Response.json({ error: 'Method not allowed' }, { status: 405 })
    }

    let body: ErrorReport
    try {
        body = await req.json?.()
    } catch {
        return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    if (!body.fingerprint || !body.error || !body.context) {
        return Response.json(
            { error: 'fingerprint, error, and context required' },
            { status: 400 }
        )
    }

    // Create error signature for deduplication
    const errorSignature = `${body.error.name}:${body.error.message}:${body.context.screen || 'unknown'}`

    // Log to audit log for visibility
    // Using 'error' action and 'barcode' sourceType (mobile source)
    try {
        await req.payload.create({
            collection: 'audit-log',
            data: {
                action: 'error',
                sourceType: 'barcode', // mobile source
                sourceId: body.fingerprint,
                success: false,
                errorMessage: `[Mobile] ${body.error.name}: ${body.error.message}`,
                metadata: {
                    errorType: 'mobile_crash',
                    errorSignature,
                    platform: body.context.platform,
                    appVersion: body.context.appVersion,
                    osVersion: body.context.osVersion,
                    screen: body.context.screen,
                    action: body.context.action,
                    deviceModel: body.context.deviceModel,
                    stackPreview: body.error.stack?.slice(0, 500),
                    breadcrumbCount: body.breadcrumbs?.length || 0,
                    timestamp: body.timestamp || Date.now(),
                },
            },
        })
    } catch (err) {
        console.error('[MobileErrors] Failed to log error:', err)
    }

    // Log for immediate visibility
    console.error('[MobileErrors]', {
        fingerprint: body.fingerprint.slice(0, 8) + '...',
        error: body.error.name,
        message: body.error.message.slice(0, 100),
        screen: body.context.screen,
        platform: body.context.platform,
        version: body.context.appVersion,
    })

    return Response.json({
        received: true,
        errorId: errorSignature,
        timestamp: Date.now(),
    })
}
