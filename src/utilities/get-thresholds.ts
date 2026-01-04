/**
 * Get Thresholds Utility
 *
 * Fetches configurable automation thresholds from SiteSettings.
 * Provides defaults if settings are not configured.
 */

export interface ThresholdConfig {
    freshnessThresholdDays: number
    fuzzyMatchThreshold: number
    autoAlternativesLimit: number
    aiCategoryConfidence: number
    enableFuzzyMatching: boolean
    enableAICategories: boolean
    enableAutoAlternatives: boolean
}

const DEFAULT_THRESHOLDS: ThresholdConfig = {
    freshnessThresholdDays: 180,
    fuzzyMatchThreshold: 2,
    autoAlternativesLimit: 3,
    aiCategoryConfidence: 70,
    enableFuzzyMatching: true,
    enableAICategories: true,
    enableAutoAlternatives: true,
}

// Cache thresholds to avoid repeated DB calls
let cachedThresholds: ThresholdConfig | null = null
let cacheExpiry = 0
const CACHE_TTL = 60000 // 1 minute cache

/**
 * Get automation thresholds from SiteSettings
 *
 * @example
 * const thresholds = await getThresholds(req.payload)
 * if (distance <= thresholds.fuzzyMatchThreshold) {
 *   // Match found
 * }
 */
export async function getThresholds(
    payload: { findGlobal: Function }
): Promise<ThresholdConfig> {
    const now = Date.now()

    // Return cached if valid
    if (cachedThresholds && cacheExpiry > now) {
        return cachedThresholds
    }

    try {
        const settings = await payload.findGlobal({
            slug: 'site-settings',
        })

        const automation = settings?.automationThresholds || {}

        cachedThresholds = {
            freshnessThresholdDays: automation.freshnessThresholdDays ?? DEFAULT_THRESHOLDS.freshnessThresholdDays,
            fuzzyMatchThreshold: automation.fuzzyMatchThreshold ?? DEFAULT_THRESHOLDS.fuzzyMatchThreshold,
            autoAlternativesLimit: automation.autoAlternativesLimit ?? DEFAULT_THRESHOLDS.autoAlternativesLimit,
            aiCategoryConfidence: automation.aiCategoryConfidence ?? DEFAULT_THRESHOLDS.aiCategoryConfidence,
            enableFuzzyMatching: automation.enableFuzzyMatching ?? DEFAULT_THRESHOLDS.enableFuzzyMatching,
            enableAICategories: automation.enableAICategories ?? DEFAULT_THRESHOLDS.enableAICategories,
            enableAutoAlternatives: automation.enableAutoAlternatives ?? DEFAULT_THRESHOLDS.enableAutoAlternatives,
        }

        cacheExpiry = now + CACHE_TTL
        return cachedThresholds
    } catch (error) {
        console.warn('Failed to fetch thresholds, using defaults:', error)
        return DEFAULT_THRESHOLDS
    }
}

/**
 * Clear the thresholds cache (useful after settings update)
 */
export function clearThresholdsCache(): void {
    cachedThresholds = null
    cacheExpiry = 0
}

/**
 * Get default thresholds without DB call
 */
export function getDefaultThresholds(): ThresholdConfig {
    return { ...DEFAULT_THRESHOLDS }
}
