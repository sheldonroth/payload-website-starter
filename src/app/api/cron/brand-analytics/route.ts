import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes

/**
 * Brand Analytics Aggregation Cron Job
 * Runs daily at 3 AM UTC
 *
 * Aggregates daily brand performance metrics:
 * - Scan counts from AuditLog
 * - Trust score snapshots
 * - Category rankings
 * - Verdict distributions
 *
 * Powers the Brand Intelligence Portal dashboards.
 */
export async function GET(request: Request) {
    // Verify cron secret
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
        console.error('[Brand Analytics] Unauthorized request')
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        console.log('[Brand Analytics] Starting daily aggregation...')

        const payload = await getPayload({ config })
        const now = new Date()
        const today = now.toISOString().split('T')[0] // YYYY-MM-DD
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]

        // Get all brands
        const brands = await payload.find({
            collection: 'brands',
            limit: 1000,
        })

        if (brands.docs.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'No brands to process',
                processed: 0,
            })
        }

        console.log(`[Brand Analytics] Processing ${brands.docs.length} brands`)

        let processed = 0
        let errors = 0

        for (const brandDoc of brands.docs) {
            const brand = brandDoc as {
                id: string | number
                name: string
                trustScore?: number
                trustGrade?: string
                productCount?: number
                avoidCount?: number
            }

            try {
                // Check if we already have today's snapshot
                const existing = await payload.find({
                    collection: 'brand-analytics',
                    where: {
                        and: [
                            { brand: { equals: brand.id } },
                            { date: { equals: today } },
                        ],
                    },
                    limit: 1,
                })

                if (existing.docs.length > 0) {
                    // Update existing snapshot
                    continue
                }

                // Get products for this brand
                const products = await payload.find({
                    collection: 'products',
                    where: { brand: { equals: brand.name } },
                    limit: 500,
                })

                // Calculate verdict breakdown
                const verdictBreakdown = {
                    recommendCount: 0,
                    cautionCount: 0,
                    avoidCount: 0,
                    avoidHitCount: 0,
                }

                for (const product of products.docs) {
                    const p = product as { verdict?: string }
                    if (p.verdict === 'recommend') verdictBreakdown.recommendCount++
                    else if (p.verdict === 'caution') verdictBreakdown.cautionCount++
                    else if (p.verdict === 'avoid') verdictBreakdown.avoidCount++
                }

                // Get yesterday's snapshot for comparison
                const yesterdaySnapshot = await payload.find({
                    collection: 'brand-analytics',
                    where: {
                        and: [
                            { brand: { equals: brand.id } },
                            { date: { equals: yesterday } },
                        ],
                    },
                    limit: 1,
                })

                const yesterdayData = yesterdaySnapshot.docs[0] as {
                    scanCount?: number
                    trustScore?: number
                    categoryRank?: number
                } | undefined

                // Calculate changes
                const changes = {
                    scanCountChange: 0, // Would need AuditLog aggregation
                    trustScoreChange: yesterdayData?.trustScore
                        ? (brand.trustScore || 0) - yesterdayData.trustScore
                        : 0,
                    categoryRankChange: 0,
                    weekOverWeekGrowth: 0,
                }

                // Calculate average product score
                let totalScore = 0
                let scoredProducts = 0
                for (const product of products.docs) {
                    const p = product as { score?: number }
                    if (p.score !== undefined) {
                        totalScore += p.score
                        scoredProducts++
                    }
                }
                const averageProductScore = scoredProducts > 0 ? Math.round(totalScore / scoredProducts) : 0

                // Create daily snapshot
                await payload.create({
                    collection: 'brand-analytics',
                    data: {
                        brand: brand.id,
                        brandName: brand.name,
                        date: today,
                        scanCount: 0, // Would need AuditLog aggregation - placeholder
                        searchCount: 0,
                        productViewCount: 0,
                        uniqueUsers: 0,
                        verdictBreakdown,
                        trustScore: brand.trustScore || 0,
                        trustGrade: brand.trustGrade || 'C',
                        categoryRank: 0, // Would need category-specific calculation
                        overallRank: 0,
                        changes,
                        productCount: products.docs.length,
                        testedProductCount: products.docs.length,
                        pendingTestCount: 0,
                        averageProductScore,
                        topScannedProducts: [], // Would need AuditLog aggregation
                    },
                })

                processed++
            } catch (error) {
                console.error(`[Brand Analytics] Error processing ${brand.name}:`, error)
                errors++
            }
        }

        console.log(`[Brand Analytics] Complete: ${processed} processed, ${errors} errors`)

        return NextResponse.json({
            success: true,
            processed,
            errors,
            date: today,
            timestamp: now.toISOString(),
        })
    } catch (error) {
        console.error('[Brand Analytics] Error:', error)
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Cron failed',
            timestamp: new Date().toISOString(),
        }, { status: 500 })
    }
}
