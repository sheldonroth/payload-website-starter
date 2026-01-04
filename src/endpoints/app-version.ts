/**
 * App Version Check Endpoint
 * 
 * Returns whether a given app version is supported and if force update is needed.
 * 
 * GET /api/app-version?platform=ios&version=1.0.0
 */

import type { PayloadHandler, PayloadRequest } from 'payload'

// Minimum supported versions per platform
const MINIMUM_VERSIONS = {
    ios: '1.0.0',
    android: '1.0.0',
}

// If true, block users below minimum version from using the app
const FORCE_UPDATE_ENABLED = true

// Custom message for force update (optional)
const FORCE_UPDATE_MESSAGE = 'We\'ve made important improvements. Please update to continue.'

/**
 * Compare semantic versions
 * Returns: -1 if a < b, 0 if a === b, 1 if a > b
 */
function compareVersions(a: string, b: string): number {
    const partsA = a.split('.').map(Number)
    const partsB = b.split('.').map(Number)

    for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
        const numA = partsA[i] || 0
        const numB = partsB[i] || 0

        if (numA < numB) return -1
        if (numA > numB) return 1
    }

    return 0
}

export const appVersionHandler: PayloadHandler = async (req: PayloadRequest) => {
    try {
        const url = new URL(req.url || '', 'http://localhost')
        const platform = url.searchParams.get('platform') || 'ios'
        const version = url.searchParams.get('version') || '0.0.0'

        // Get minimum version for this platform
        const minimumVersion = MINIMUM_VERSIONS[platform as keyof typeof MINIMUM_VERSIONS] || '1.0.0'

        // Compare versions
        const comparison = compareVersions(version, minimumVersion)
        const isSupported = comparison >= 0

        // Determine if force update is needed
        const forceUpdate = FORCE_UPDATE_ENABLED && !isSupported

        const response = {
            isSupported,
            currentVersion: version,
            minimumVersion,
            forceUpdate,
            updateAvailable: !isSupported,
            message: forceUpdate ? FORCE_UPDATE_MESSAGE : undefined,
            platform,
        }

        // Log version checks for analytics
        console.log(`[AppVersion] Check: ${platform} v${version} - Supported: ${isSupported}`)

        return Response.json(response)
    } catch (error) {
        console.error('[AppVersion] Error:', error)
        return Response.json(
            { isSupported: true, forceUpdate: false, error: 'Check failed' },
            { status: 200 } // Return 200 to not block app on errors
        )
    }
}
