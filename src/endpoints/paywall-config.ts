import type { PayloadHandler, PayloadRequest } from 'payload'

interface PaywallVariant {
    id: number
    variantId: string
    name: string
    headline: string
    subheadline?: string
    ctaText: string
    ctaSubtext?: string
    valueProps?: Array<{
        text: string
        icon?: string
        emoji?: string
        lottieKey?: string
    }>
    trialEmphasis: 'prominent' | 'subtle' | 'in_cta' | 'hidden'
    showSocialProof: boolean
    socialProofText?: string
    socialProofRating?: string
    backgroundColor?: string
    accentColor?: string
    heroImage?: { url: string } | number
    isActive: boolean
    weight: number
    analyticsTag?: string
}

interface PaywallSettings {
    mode: 'statsig' | 'cms_ab_test' | 'fixed'
    fixedVariant?: PaywallVariant | number
    statsigExperimentName?: string
    statsigParameterName?: string
    fallbackVariant?: PaywallVariant | number
    showPaywall: boolean
    forcePaywallForAll: boolean
    delayBeforeShow: number
    minSessionsBeforePaywall: number
    defaultTrialDays: number
    showPricing: boolean
    priceDisplayFormat: 'monthly' | 'weekly' | 'annual_monthly' | 'annual_total'
}

/**
 * Select a variant based on weighted random selection
 */
function selectWeightedVariant(variants: PaywallVariant[]): PaywallVariant | null {
    if (variants.length === 0) return null
    if (variants.length === 1) return variants[0]

    const totalWeight = variants.reduce((sum, v) => sum + (v.weight || 1), 0)
    let random = Math.random() * totalWeight

    for (const variant of variants) {
        random -= variant.weight || 1
        if (random <= 0) {
            return variant
        }
    }

    return variants[0]
}

/**
 * Transform variant for API response (clean up internal fields)
 */
function transformVariant(variant: PaywallVariant): Omit<PaywallVariant, 'isActive' | 'weight'> & { heroImageUrl?: string } {
    const { isActive, weight, heroImage, ...rest } = variant
    return {
        ...rest,
        heroImageUrl: typeof heroImage === 'object' && heroImage?.url ? heroImage.url : undefined,
    }
}

/**
 * GET /api/paywall/config
 *
 * Returns paywall configuration and selected variant based on mode:
 * - fixed: Returns the configured fixed variant
 * - cms_ab_test: Returns a weighted-random variant from active variants
 * - statsig: Returns experiment name for client-side bucketing
 */
export const paywallConfigHandler: PayloadHandler = async (req: PayloadRequest) => {
    try {
        // Fetch settings
        const settings = await req.payload.findGlobal({
            slug: 'paywall-settings' as any,
            depth: 2, // Populate variant relationships
        }) as unknown as PaywallSettings

        if (!settings) {
            return Response.json({
                success: false,
                error: 'Paywall settings not configured',
            }, { status: 500 })
        }

        // If paywall is disabled, return minimal response
        if (!settings.showPaywall) {
            return Response.json({
                success: true,
                showPaywall: false,
            })
        }

        const baseResponse = {
            success: true,
            showPaywall: settings.showPaywall,
            forcePaywallForAll: settings.forcePaywallForAll,
            delayBeforeShow: settings.delayBeforeShow || 0,
            minSessionsBeforePaywall: settings.minSessionsBeforePaywall || 0,
            defaultTrialDays: settings.defaultTrialDays || 7,
            showPricing: settings.showPricing,
            priceDisplayFormat: settings.priceDisplayFormat,
            mode: settings.mode,
        }

        // Handle Statsig mode
        if (settings.mode === 'statsig') {
            // Fetch all active variants for client reference
            const { docs: variants } = await req.payload.find({
                collection: 'paywall-variants' as any,
                where: { isActive: { equals: true } },
                depth: 1,
                limit: 100,
            })

            return Response.json({
                ...baseResponse,
                statsigExperimentName: settings.statsigExperimentName,
                statsigParameterName: settings.statsigParameterName || 'variantId',
                variants: (variants as unknown as PaywallVariant[]).map(transformVariant),
                fallbackVariant: settings.fallbackVariant
                    ? transformVariant(settings.fallbackVariant as PaywallVariant)
                    : null,
            })
        }

        // Handle Fixed mode
        if (settings.mode === 'fixed') {
            const variant = settings.fixedVariant as PaywallVariant | undefined

            if (!variant || typeof variant === 'number') {
                // Fallback to fetching if not populated
                if (settings.fallbackVariant && typeof settings.fallbackVariant !== 'number') {
                    return Response.json({
                        ...baseResponse,
                        variant: transformVariant(settings.fallbackVariant as PaywallVariant),
                    })
                }
                return Response.json({
                    ...baseResponse,
                    error: 'No variant configured',
                }, { status: 500 })
            }

            return Response.json({
                ...baseResponse,
                variant: transformVariant(variant),
            })
        }

        // Handle CMS A/B Test mode
        if (settings.mode === 'cms_ab_test') {
            // Fetch all active variants
            const { docs: variants } = await req.payload.find({
                collection: 'paywall-variants' as any,
                where: { isActive: { equals: true } },
                depth: 1,
                limit: 100,
            })

            if (variants.length === 0) {
                // Use fallback
                if (settings.fallbackVariant && typeof settings.fallbackVariant !== 'number') {
                    return Response.json({
                        ...baseResponse,
                        variant: transformVariant(settings.fallbackVariant as PaywallVariant),
                    })
                }
                return Response.json({
                    ...baseResponse,
                    error: 'No active variants',
                }, { status: 500 })
            }

            // Select weighted random variant
            const selectedVariant = selectWeightedVariant(variants as unknown as PaywallVariant[])

            return Response.json({
                ...baseResponse,
                variant: selectedVariant ? transformVariant(selectedVariant) : null,
            })
        }

        return Response.json({
            ...baseResponse,
            error: 'Unknown mode',
        }, { status: 400 })
    } catch (error) {
        console.error('[Paywall Config] Error:', error)
        return Response.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        }, { status: 500 })
    }
}

/**
 * GET /api/paywall/variants
 *
 * Returns all active paywall variants (useful for debugging/admin)
 */
export const paywallVariantsHandler: PayloadHandler = async (req: PayloadRequest) => {
    try {
        const { docs: variants, totalDocs } = await req.payload.find({
            collection: 'paywall-variants' as any,
            where: { isActive: { equals: true } },
            depth: 1,
            limit: 100,
        })

        return Response.json({
            success: true,
            variants: (variants as unknown as PaywallVariant[]).map(transformVariant),
            totalVariants: totalDocs,
        })
    } catch (error) {
        console.error('[Paywall Variants] Error:', error)
        return Response.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        }, { status: 500 })
    }
}
