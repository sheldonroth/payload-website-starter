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

interface YouTubePlaylistResponse {
    items: Array<{
        snippet: {
            title: string
            description: string
            thumbnails: {
                high?: { url: string }
                maxres?: { url: string }
            }
            resourceId: {
                videoId: string
            }
            publishedAt: string
        }
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
 * Convert a channel ID to its Shorts playlist ID
 * Pattern: Replace "UC" prefix with "UUSH"
 * Example: UCb9Bv8QPZ6HScpEvrBUIA2Q -> UUSHb9Bv8QPZ6HScpEvrBUIA2Q
 */
function getShortsPlaylistId(channelId: string): string | null {
    if (channelId.startsWith('UC')) {
        return 'UUSH' + channelId.substring(2)
    }
    return null
}

export const youtubeSyncHandler: PayloadHandler = async (req: PayloadRequest) => {
    try {
        const { payload } = req

        // Get YouTube settings
        const settings = await payload.findGlobal({
            slug: 'youtube-settings',
        })

        const { channelId, apiKey, maxVideosToSync = 50 } = settings as {
            channelId?: string
            apiKey?: string
            maxVideosToSync?: number
        }

        if (!channelId || !apiKey) {
            return Response.json(
                { error: 'YouTube channel ID and API key are required. Configure in CMS Settings.' },
                { status: 400 }
            )
        }

        // Get the Shorts playlist ID from the channel ID
        const shortsPlaylistId = getShortsPlaylistId(channelId)

        if (!shortsPlaylistId) {
            return Response.json(
                { error: 'Invalid channel ID format. Must start with "UC".' },
                { status: 400 }
            )
        }

        console.log(`[YouTube Sync] Fetching Shorts from playlist: ${shortsPlaylistId}`)

        // Fetch videos from the Shorts playlist (UUSH...)
        const playlistUrl = new URL('https://www.googleapis.com/youtube/v3/playlistItems')
        playlistUrl.searchParams.set('key', apiKey)
        playlistUrl.searchParams.set('playlistId', shortsPlaylistId)
        playlistUrl.searchParams.set('part', 'snippet')
        playlistUrl.searchParams.set('maxResults', String(Math.min(maxVideosToSync, 50)))

        const playlistResponse = await fetch(playlistUrl.toString())

        if (!playlistResponse.ok) {
            const error = await playlistResponse.json()
            console.error('[YouTube Sync] Playlist API error:', error)

            // If Shorts playlist doesn't exist, fall back to search
            if (error.error?.code === 404) {
                await payload.updateGlobal({
                    slug: 'youtube-settings',
                    data: {
                        lastSyncAt: new Date().toISOString(),
                        lastSyncStatus: 'No Shorts playlist found for this channel',
                    },
                })
                return Response.json({
                    error: 'No Shorts playlist found. This channel may not have any Shorts.',
                    imported: 0
                }, { status: 404 })
            }

            await payload.updateGlobal({
                slug: 'youtube-settings',
                data: {
                    lastSyncAt: new Date().toISOString(),
                    lastSyncStatus: `Error: ${error.error?.message || 'API request failed'}`,
                },
            })
            return Response.json({ error: error.error?.message || 'YouTube API error' }, { status: 500 })
        }

        const playlistData: YouTubePlaylistResponse = await playlistResponse.json()

        if (!playlistData.items || playlistData.items.length === 0) {
            await payload.updateGlobal({
                slug: 'youtube-settings',
                data: {
                    lastSyncAt: new Date().toISOString(),
                    lastSyncStatus: 'No Shorts found in channel',
                },
            })
            return Response.json({ message: 'No Shorts found', imported: 0 })
        }

        console.log(`[YouTube Sync] Found ${playlistData.items.length} Shorts`)

        const videoIds = playlistData.items.map(item => item.snippet.resourceId.videoId).join(',')

        // Get video details (including duration)
        const detailsUrl = new URL('https://www.googleapis.com/youtube/v3/videos')
        detailsUrl.searchParams.set('key', apiKey)
        detailsUrl.searchParams.set('id', videoIds)
        detailsUrl.searchParams.set('part', 'snippet,contentDetails')

        const detailsResponse = await fetch(detailsUrl.toString())
        const detailsData: YouTubeVideoDetailsResponse = await detailsResponse.json()

        let imported = 0
        let updated = 0

        for (const video of detailsData.items) {
            const duration = video.contentDetails ? parseDuration(video.contentDetails.duration) : 0

            // Check if video already exists
            const existing = await payload.find({
                collection: 'videos',
                where: {
                    youtubeVideoId: { equals: video.id },
                },
                limit: 1,
            })

            if (existing.docs.length > 0) {
                // Update existing video - mark as Short
                await payload.update({
                    collection: 'videos',
                    id: existing.docs[0].id,
                    data: {
                        title: video.snippet.title,
                        description: video.snippet.description,
                        thumbnailUrl: video.snippet.thumbnails.maxres?.url || video.snippet.thumbnails.high?.url,
                        duration,
                        videoType: 'short', // From Shorts playlist = definitely a Short
                        youtubeImportedAt: new Date().toISOString(),
                    },
                })
                updated++
            } else {
                // Create new video
                await payload.create({
                    collection: 'videos',
                    data: {
                        title: video.snippet.title,
                        youtubeVideoId: video.id,
                        description: video.snippet.description,
                        thumbnailUrl: video.snippet.thumbnails.maxres?.url || video.snippet.thumbnails.high?.url,
                        duration,
                        videoType: 'short', // From Shorts playlist = definitely a Short
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
                lastSyncStatus: `Success: ${imported} Shorts imported, ${updated} updated`,
            },
        })

        return Response.json({
            success: true,
            imported,
            updated,
            message: `Synced ${imported} new Shorts, updated ${updated} existing`,
        })
    } catch (error) {
        console.error('YouTube sync error:', error)
        return Response.json(
            { error: error instanceof Error ? error.message : 'Sync failed' },
            { status: 500 }
        )
    }
}
