/**
 * Mobile Health Check Endpoint
 *
 * Provides a lightweight status check for mobile apps to verify
 * API connectivity and get server status information.
 *
 * GET /api/mobile/health
 *
 * Returns:
 * - status: 'ok' | 'degraded' | 'maintenance'
 * - timestamp: ISO string
 * - version: API version
 * - features: Available features status
 *
 * @openapi
 * /mobile/health:
 *   get:
 *     summary: Mobile app health check
 *     description: |
 *       Lightweight status check for mobile apps to verify API connectivity.
 *       Returns server status, API version, and feature availability flags.
 *       No authentication required.
 *     tags: [Mobile, Health]
 *     responses:
 *       200:
 *         description: Server is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [ok, degraded, maintenance]
 *                   example: ok
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: "2024-01-15T10:30:00.000Z"
 *                 version:
 *                   type: string
 *                   example: "1.0.0"
 *                 serverTime:
 *                   type: number
 *                   description: Unix timestamp in milliseconds
 *                   example: 1705315800000
 *                 features:
 *                   type: object
 *                   properties:
 *                     scanner:
 *                       type: boolean
 *                       description: Barcode scanning feature availability
 *                     pushNotifications:
 *                       type: boolean
 *                       description: Push notification service status
 *                     aiAnalysis:
 *                       type: boolean
 *                       description: AI-powered analysis availability
 *                     userAccounts:
 *                       type: boolean
 *                       description: User account features status
 *                 message:
 *                   type: string
 *                   description: Optional status message (present during degraded/maintenance)
 *       503:
 *         description: Server is in maintenance mode
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: maintenance
 *                 message:
 *                   type: string
 *                   example: "The service is currently undergoing maintenance."
 */

import type { PayloadHandler } from 'payload'

interface HealthResponse {
    status: 'ok' | 'degraded' | 'maintenance'
    timestamp: string
    version: string
    serverTime: number
    features: {
        scanner: boolean
        pushNotifications: boolean
        aiAnalysis: boolean
        userAccounts: boolean
    }
    message?: string
}

// Feature availability flags (can be toggled during incidents)
const FEATURE_FLAGS = {
    scanner: true,
    pushNotifications: true,
    aiAnalysis: true,
    userAccounts: true,
}

// Maintenance mode (toggle for planned downtime)
const MAINTENANCE_MODE = false
const MAINTENANCE_MESSAGE = ''

export const mobileHealthHandler: PayloadHandler = async () => {
    const now = new Date()

    // Determine overall status
    let status: HealthResponse['status'] = 'ok'
    let message: string | undefined

    if (MAINTENANCE_MODE) {
        status = 'maintenance'
        message = MAINTENANCE_MESSAGE || 'The service is currently undergoing maintenance.'
    } else if (!FEATURE_FLAGS.scanner || !FEATURE_FLAGS.aiAnalysis) {
        // Degraded if key features are down
        status = 'degraded'
        message = 'Some features are temporarily unavailable.'
    }

    const response: HealthResponse = {
        status,
        timestamp: now.toISOString(),
        version: '1.0.0',
        serverTime: now.getTime(),
        features: {
            scanner: FEATURE_FLAGS.scanner,
            pushNotifications: FEATURE_FLAGS.pushNotifications,
            aiAnalysis: FEATURE_FLAGS.aiAnalysis,
            userAccounts: FEATURE_FLAGS.userAccounts,
        },
    }

    if (message) {
        response.message = message
    }

    return Response.json(response, {
        status: status === 'maintenance' ? 503 : 200,
        headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'X-API-Version': '1.0.0',
        },
    })
}
