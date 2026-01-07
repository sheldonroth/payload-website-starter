/**
 * Mobile Configuration Endpoint
 *
 * Provides dynamic configuration and feature flags for mobile apps.
 * Allows updating app behavior without app store updates.
 *
 * GET /api/mobile/config
 * Query params:
 *   - platform: 'ios' | 'android'
 *   - version: App version string (e.g., '1.2.3')
 *   - fingerprint: Device fingerprint (optional, for A/B targeting)
 *
 * Returns:
 * - features: Feature flag object
 * - config: Dynamic configuration values
 * - experiments: Active A/B tests for this device
 * - announcements: System announcements/banners
 */

import type { PayloadHandler } from 'payload'

interface MobileConfig {
    features: {
        scannerEnabled: boolean
        aiVerdictEnabled: boolean
        pushNotificationsEnabled: boolean
        crowdsourceEnabled: boolean
        referralProgramEnabled: boolean
        shelfScanEnabled: boolean
        priceAlertsEnabled: boolean
        socialSharingEnabled: boolean
    }
    config: {
        scanCooldownMs: number
        maxDailyScans: number
        freeUnlocksPerDevice: number
        minVersionRequired: string
        supportEmail: string
        privacyPolicyUrl: string
        termsUrl: string
    }
    experiments: {
        id: string
        variant: string
    }[]
    announcements: {
        id: string
        type: 'info' | 'warning' | 'promo'
        title: string
        message: string
        dismissible: boolean
        actionUrl?: string
        actionText?: string
        expiresAt?: string
    }[]
    rateLimit: {
        scansPerMinute: number
        photosPerMinute: number
        searchesPerMinute: number
    }
}

// Static config - in production, this would come from database or Statsig
const BASE_CONFIG: MobileConfig = {
    features: {
        scannerEnabled: true,
        aiVerdictEnabled: true,
        pushNotificationsEnabled: true,
        crowdsourceEnabled: true,
        referralProgramEnabled: true,
        shelfScanEnabled: true,
        priceAlertsEnabled: false, // Coming soon
        socialSharingEnabled: true,
    },
    config: {
        scanCooldownMs: 500, // 500ms between scans
        maxDailyScans: 100,
        freeUnlocksPerDevice: 1,
        minVersionRequired: '1.0.0',
        supportEmail: 'support@theproductreport.org',
        privacyPolicyUrl: 'https://theproductreport.org/privacy',
        termsUrl: 'https://theproductreport.org/terms',
    },
    experiments: [],
    announcements: [],
    rateLimit: {
        scansPerMinute: 30,
        photosPerMinute: 10,
        searchesPerMinute: 60,
    },
}

export const mobileConfigHandler: PayloadHandler = async (req) => {
    const url = new URL(req.url || '', 'http://localhost')
    const platform = url.searchParams.get('platform') || 'unknown'
    const version = url.searchParams.get('version') || '0.0.0'
    const fingerprint = url.searchParams.get('fingerprint')

    // Clone base config
    const config: MobileConfig = JSON.parse(JSON.stringify(BASE_CONFIG))

    // Platform-specific adjustments
    if (platform === 'android') {
        // Android-specific config adjustments if needed
    }

    // Version-specific adjustments
    const [major] = version.split('.').map(Number)
    if (major < 1) {
        // Disable newer features for old app versions
        config.features.shelfScanEnabled = false
    }

    // Fingerprint-based experiment assignment
    if (fingerprint) {
        try {
            // Look up device fingerprint for A/B test cohort
            const device = await req.payload.find({
                collection: 'device-fingerprints',
                where: {
                    fingerprintHash: { equals: fingerprint },
                },
                limit: 1,
            })

            if (device.docs[0]) {
                const cohort = (device.docs[0] as { abTestCohort?: string }).abTestCohort
                if (cohort) {
                    config.experiments.push({
                        id: 'adaptive_paywall',
                        variant: cohort,
                    })
                }
            }
        } catch {
            // Ignore errors, continue with default config
        }
    }

    // Add any active announcements
    // In production, fetch from database
    // config.announcements.push({
    //   id: 'new-feature-1',
    //   type: 'info',
    //   title: 'New Feature!',
    //   message: 'Try our new shelf scanning feature.',
    //   dismissible: true,
    // })

    return Response.json(config, {
        headers: {
            'Cache-Control': 'public, max-age=300', // 5 minute cache
            'X-API-Version': '1.0.0',
        },
    })
}
