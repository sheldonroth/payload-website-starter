import type { PayloadHandler } from 'payload'
import type { PayloadRequest } from 'payload'

interface YouTubeVideo {
    id: string
    snippet: {
        title: string
        description: string
        channelId: string
        thumbnails: {
            high?: { url: string }
            maxres?: { url: string }
        }
        publishedAt: string
    }
    contentDetails?: {
        duration: string
    }
}

interface YouTubeSearchResponse {
    items: Array<{
        id: { videoId: string }
        snippet: YouTubeVideo['snippet']
    }>
    nextPageToken?: string
}

interface YouTubeVideoDetailsResponse {
    items: YouTubeVideo[]
}

// Parse ISO 8601 duration to seconds
function parseDuration(duration: string): number {
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
    if (!match) return 0
    const hours = parseInt(match[1] || '0', 10)
    const minutes = parseInt(match[2] || '0', 10)
    const seconds = parseInt(match[3] || '0', 10)
    return hours * 3600 + minutes * 60 + seconds
}

/**
 * Check if a YouTube video is a Short by testing the /shorts/ URL
 * Returns true if the video is a Short, false otherwise
 */
async function isYouTubeShort(videoId: string): Promise<boolean> {
    try {
        // Make a HEAD request to the shorts URL
        const response = await fetch(`https://www.youtube.com/shorts/${videoId}`, {
            method: 'HEAD',
            redirect: 'manual', // Don't follow redirects
        })
        // If 200, it's a Short. If 303 redirect, it's not.
        return response.status === 200
    } catch {
        // On error, fall back to false (not a short)
        return false
    }
}

export const youtubeSyncHandler: PayloadHandler = async (req: PayloadRequest) => {
    try {
        const { payload } = req

        // Get YouTube settings
        const settings = await payload.findGlobal({
            slug: 'youtube-settings',
        })

        const { channelId, apiKey, maxVideosToSync = 50, shortsOnly = true } = settings as {
            channelId?: string
            apiKey?: string
            maxVideosToSync?: number
            shortsOnly?: boolean
        }

        if (!channelId || !apiKey) {
            return Response.json(
                { error: 'YouTube channel ID and API key are required. Configure in CMS Settings.' },
                { status: 400 }
            )
        }

        // Fetch videos from YouTube channel
        const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search')
        searchUrl.searchParams.set('key', apiKey)
        searchUrl.searchParams.set('channelId', channelId)
        searchUrl.searchParams.set('part', 'snippet')
        searchUrl.searchParams.set('order', 'date')
        searchUrl.searchParams.set('maxResults', String(Math.min(maxVideosToSync, 50)))
        searchUrl.searchParams.set('type', 'video')

        const searchResponse = await fetch(searchUrl.toString())

        if (!searchResponse.ok) {
            const error = await searchResponse.json()
            await payload.updateGlobal({
                slug: 'youtube-settings',
                data: {
                    lastSyncAt: new Date().toISOString(),
                    lastSyncStatus: `Error: ${error.error?.message || 'API request failed'}`,
                },
            })
            return Response.json({ error: error.error?.message || 'YouTube API error' }, { status: 500 })
        }

        const searchData: YouTubeSearchResponse = await searchResponse.json()
        const videoIds = searchData.items.map(item => item.id.videoId).join(',')

        if (!videoIds) {
            await payload.updateGlobal({
                slug: 'youtube-settings',
                data: {
                    lastSyncAt: new Date().toISOString(),
                    lastSyncStatus: 'No videos found',
                },
            })
            return Response.json({ message: 'No videos found', imported: 0 })
        }

        // Get video details (including duration)
        const detailsUrl = new URL('https://www.googleapis.com/youtube/v3/videos')
        detailsUrl.searchParams.set('key', apiKey)
        detailsUrl.searchParams.set('id', videoIds)
        detailsUrl.searchParams.set('part', 'snippet,contentDetails')

        const detailsResponse = await fetch(detailsUrl.toString())
        const detailsData: YouTubeVideoDetailsResponse = await detailsResponse.json()

        let imported = 0
        let skipped = 0

        for (const video of detailsData.items) {
            const duration = video.contentDetails ? parseDuration(video.contentDetails.duration) : 0

            // Skip if shortsOnly and video is longer than 3 minutes (180 seconds)
            if (shortsOnly && duration > 180) {
                skipped++
                continue
            }

            // Check if video already exists
            const existing = await payload.find({
                collection: 'videos',
                where: {
                    youtubeVideoId: { equals: video.id },
                },
                limit: 1,
            })

            if (existing.docs.length > 0) {
                // Update existing video
                // Detect if it's a YouTube Short using the /shorts/ URL check
                const isShort = await isYouTubeShort(video.id)
                const videoType = isShort ? 'short' : 'longform'

                await payload.update({
                    collection: 'videos',
                    id: existing.docs[0].id,
                    data: {
                        title: video.snippet.title,
                        description: video.snippet.description,
                        thumbnailUrl: video.snippet.thumbnails.maxres?.url || video.snippet.thumbnails.high?.url,
                        duration,
                        videoType, // Auto-detected from YouTube
                        youtubeImportedAt: new Date().toISOString(),
                    },
                })
            } else {
                // Create new video
                // Detect if it's a YouTube Short using the /shorts/ URL check
                const isShort = await isYouTubeShort(video.id)
                const videoType = isShort ? 'short' : 'longform'

                await payload.create({
                    collection: 'videos',
                    data: {
                        title: video.snippet.title,
                        youtubeVideoId: video.id,
                        description: video.snippet.description,
                        thumbnailUrl: video.snippet.thumbnails.maxres?.url || video.snippet.thumbnails.high?.url,
                        duration,
                        videoType, // Auto-detected from YouTube
                        status: 'published',
                        isAutoImported: true,
                        youtubeImportedAt: new Date().toISOString(),
                    },
                })
                imported++
            }
        }

        // Update sync status
        await payload.updateGlobal({
            slug: 'youtube-settings',
            data: {
                lastSyncAt: new Date().toISOString(),
                lastSyncStatus: `Success: ${imported} imported, ${skipped} skipped (too long)`,
            },
        })

        return Response.json({
            success: true,
            imported,
            skipped,
            message: `Synced ${imported} new videos, skipped ${skipped}`,
        })
    } catch (error) {
        console.error('YouTube sync error:', error)
        return Response.json(
            { error: error instanceof Error ? error.message : 'Sync failed' },
            { status: 500 }
        )
    }
}
