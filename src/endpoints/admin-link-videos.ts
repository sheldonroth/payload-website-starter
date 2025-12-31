import type { PayloadHandler } from 'payload'

/**
 * Admin endpoint to retroactively link products to their source videos
 * Matches products to videos based on video title in the product summary
 */
const adminLinkVideos: PayloadHandler = async (req) => {
    if (req.method !== 'POST') {
        return Response.json({ error: 'Method not allowed' }, { status: 405 })
    }

    // Require admin authentication
    if (!req.user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const payload = req.payload

        // Get all products without source video
        const productsQuery = await payload.find({
            collection: 'products',
            where: {
                sourceVideo: { exists: false },
            },
            limit: 500,
            depth: 0,
        })

        // Filter out TikTok products (they use sourceUrl instead of sourceVideo)
        const productsToLink = {
            ...productsQuery,
            docs: productsQuery.docs.filter((p: any) => {
                const summary = p.summary as string
                return !summary?.includes('Source: TikTok')
            }),
        }

        // Get all videos for matching
        const allVideos = await payload.find({
            collection: 'videos',
            limit: 500,
            depth: 0,
        })

        const results = {
            productsChecked: productsToLink.docs.length,
            linked: 0,
            notFound: 0,
            errors: [] as string[],
            linkedProducts: [] as { productId: number; productName: string; videoId: number; videoTitle: string }[],
        }

        for (const product of productsToLink.docs) {
            try {
                const summary = (product as any).summary as string
                if (!summary) continue

                // Extract video title from summary
                // Pattern: "Source: {title}" or "Source: {title} by {channel}"
                const sourceMatch = summary.match(/Source:\s*(.+?)(?:\s+by\s+|$)/i)
                if (!sourceMatch) continue

                let videoTitle = sourceMatch[1].trim()
                // Clean up HTML entities
                videoTitle = videoTitle.replace(/&#39;/g, "'").replace(/&amp;/g, '&')

                // Find matching video
                const matchingVideo = allVideos.docs.find((video: any) => {
                    const vTitle = (video.title as string).toLowerCase()
                    const searchTitle = videoTitle.toLowerCase()
                    // Exact match or partial match
                    return vTitle === searchTitle ||
                           vTitle.includes(searchTitle) ||
                           searchTitle.includes(vTitle)
                })

                if (matchingVideo) {
                    await payload.update({
                        collection: 'products',
                        id: product.id,
                        data: {
                            sourceVideo: matchingVideo.id,
                        },
                    })
                    results.linked++
                    results.linkedProducts.push({
                        productId: product.id as number,
                        productName: (product as any).name,
                        videoId: matchingVideo.id as number,
                        videoTitle: (matchingVideo as any).title,
                    })
                } else {
                    results.notFound++
                    results.errors.push(`No video match for: "${videoTitle}" (product: ${(product as any).name})`)
                }
            } catch (err) {
                results.errors.push(`Error processing product ${product.id}: ${err}`)
            }
        }

        return Response.json({
            success: true,
            message: `Linked ${results.linked} products to videos`,
            ...results,
        })
    } catch (error) {
        console.error('Admin link videos error:', error)
        return Response.json(
            { error: error instanceof Error ? error.message : 'Failed to link videos' },
            { status: 500 }
        )
    }
}

export default adminLinkVideos
export const adminLinkVideosHandler = adminLinkVideos
