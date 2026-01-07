/**
 * API Status Endpoint
 *
 * Returns the configuration status of all external API integrations.
 * GET /api/api-status
 */

import type { PayloadHandler } from 'payload'
import { successResponse, unauthorizedError, internalError } from '../utilities/api-response'

interface ServiceStatus {
    id: string
    status: 'healthy' | 'degraded' | 'down' | 'unknown'
    configured: boolean
    lastChecked?: string
    error?: string
}

// Service configuration checks
const SERVICE_CHECKS: Record<string, { envVars: string[]; optional?: string[] }> = {
    stripe: {
        envVars: ['STRIPE_SECRET_KEY'],
        optional: ['STRIPE_WEBHOOK_SECRET'],
    },
    resend: {
        envVars: ['RESEND_API_KEY'],
        optional: ['RESEND_WEBHOOK_SECRET'],
    },
    revenuecat: {
        envVars: ['REVENUECAT_API_KEY'],
        optional: ['REVENUECAT_WEBHOOK_SECRET'],
    },
    gemini: {
        envVars: ['GEMINI_API_KEY'],
    },
    openai: {
        envVars: ['OPENAI_API_KEY'],
    },
    statsig: {
        envVars: ['STATSIG_CONSOLE_API_KEY'],
    },
    mixpanel: {
        envVars: ['MIXPANEL_API_SECRET'],
    },
    rudderstack: {
        envVars: ['RUDDERSTACK_SERVER_WRITE_KEY'],
        optional: ['NEXT_PUBLIC_RUDDERSTACK_WRITE_KEY'],
    },
    sentry: {
        envVars: ['SENTRY_API_TOKEN'],
        optional: ['SENTRY_WEBHOOK_SECRET'],
    },
    photoroom: {
        envVars: ['PHOTOROOM_API_KEY'],
    },
    apify: {
        envVars: ['APIFY_API_KEY'],
    },
    fingerprint: {
        envVars: ['NEXT_PUBLIC_FINGERPRINT_API_KEY'],
    },
    'google-search': {
        envVars: ['GOOGLE_SEARCH_API_KEY', 'GOOGLE_CSE_ID'],
    },
    'google-oauth': {
        envVars: ['GOOGLE_CLIENT_SECRET'],
    },
    'apple-oauth': {
        envVars: ['APPLE_CLIENT_ID'],
        optional: ['APPLE_TEAM_ID'],
    },
}

function checkServiceConfiguration(serviceId: string): ServiceStatus {
    const check = SERVICE_CHECKS[serviceId]
    if (!check) {
        return {
            id: serviceId,
            status: 'unknown',
            configured: false,
            error: 'Unknown service',
        }
    }

    const missingRequired = check.envVars.filter((v) => !process.env[v])
    const configured = missingRequired.length === 0

    // Check optional vars
    const missingOptional = check.optional?.filter((v) => !process.env[v]) || []
    const hasSomeOptional = check.optional
        ? check.optional.some((v) => process.env[v])
        : true

    let status: ServiceStatus['status'] = 'unknown'
    if (configured) {
        status = hasSomeOptional || !check.optional ? 'healthy' : 'degraded'
    } else {
        status = 'down'
    }

    return {
        id: serviceId,
        status,
        configured,
        lastChecked: new Date().toISOString(),
        error: missingRequired.length > 0
            ? `Missing: ${missingRequired.join(', ')}`
            : undefined,
    }
}

export const apiStatusHandler: PayloadHandler = async (req) => {
    try {
        // Check if user is admin
        if (!req.user) {
            return unauthorizedError()
        }

        // Check all services
        const services: Record<string, ServiceStatus> = {}
        for (const serviceId of Object.keys(SERVICE_CHECKS)) {
            services[serviceId] = checkServiceConfiguration(serviceId)
        }

        // Calculate summary
        const configured = Object.values(services).filter((s) => s.configured).length
        const total = Object.keys(services).length

        return successResponse({
            services,
            summary: {
                configured,
                total,
                percentage: Math.round((configured / total) * 100),
            },
            timestamp: new Date().toISOString(),
        })
    } catch (error) {
        console.error('[APIStatus] Error:', error)
        return internalError('Failed to check API status')
    }
}

export const apiStatusEndpoint = {
    path: '/api-status',
    method: 'get' as const,
    handler: apiStatusHandler,
}
