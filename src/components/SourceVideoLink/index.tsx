'use client'

import React from 'react'
import { useFormFields } from '@payloadcms/ui'

interface VideoData {
    id: number
    title?: string
    youtubeVideoId?: string
    videoUrl?: string
}

/**
 * Smart Source Link Component
 *
 * Displays a clickable link to the product's source based on available data:
 * - YouTube link (from sourceVideo relationship with youtubeVideoId)
 * - TikTok link (from sourceUrl containing tiktok.com)
 * - Generic source link (from sourceUrl)
 * - Placeholder when no source is available
 */
const SourceVideoLink: React.FC<any> = () => {
    // Watch both sourceVideo and sourceUrl fields
    const sourceVideoField = useFormFields(([fields]) => fields.sourceVideo)
    const sourceUrlField = useFormFields(([fields]) => fields.sourceUrl)

    // Extract values
    const videoData = sourceVideoField?.value as VideoData | number | null
    const video = typeof videoData === 'object' ? videoData : null
    const sourceUrl = sourceUrlField?.value as string | null

    // Determine source type and build link info
    const getSourceInfo = () => {
        // Priority 1: YouTube video from sourceVideo relationship
        if (video?.youtubeVideoId) {
            return {
                type: 'youtube',
                url: `https://youtube.com/watch?v=${video.youtubeVideoId}`,
                label: video.title || 'Watch Source Video',
                icon: '▶',
                color: '#ef4444',
                bgColor: '#fef3c7',
                borderColor: '#fcd34d',
                hint: 'Opens YouTube',
            }
        }

        // Priority 2: Direct video URL from sourceVideo
        if (video?.videoUrl) {
            return {
                type: 'direct_video',
                url: video.videoUrl,
                label: video.title || 'Watch Video',
                icon: '🎬',
                color: '#10b981',
                bgColor: '#ecfdf5',
                borderColor: '#6ee7b7',
                hint: 'Direct video link',
            }
        }

        // Priority 3: Video in CMS without YouTube ID or videoUrl
        if (video) {
            return {
                type: 'cms_video',
                url: `/admin/collections/videos/${video.id}`,
                label: video.title || 'View Video in CMS',
                icon: '📹',
                color: '#6366f1',
                bgColor: '#f3f4f6',
                borderColor: '#e5e7eb',
                hint: 'Opens CMS',
            }
        }

        // Priority 4: TikTok URL
        if (sourceUrl && sourceUrl.toLowerCase().includes('tiktok')) {
            // Extract username if possible
            const usernameMatch = sourceUrl.match(/@([^/?]+)/)
            const username = usernameMatch ? `@${usernameMatch[1]}` : 'TikTok'
            return {
                type: 'tiktok',
                url: sourceUrl,
                label: `View on TikTok (${username})`,
                icon: '📱',
                color: '#000000',
                bgColor: '#f0fdfa',
                borderColor: '#5eead4',
                hint: 'Opens TikTok',
            }
        }

        // Priority 5: Instagram URL
        if (sourceUrl && sourceUrl.toLowerCase().includes('instagram')) {
            return {
                type: 'instagram',
                url: sourceUrl,
                label: 'View on Instagram',
                icon: '📷',
                color: '#e1306c',
                bgColor: '#fdf2f8',
                borderColor: '#f9a8d4',
                hint: 'Opens Instagram',
            }
        }

        // Priority 6: Amazon URL
        if (sourceUrl && sourceUrl.toLowerCase().includes('amazon')) {
            return {
                type: 'amazon',
                url: sourceUrl,
                label: 'View on Amazon',
                icon: '🛒',
                color: '#ff9900',
                bgColor: '#fffbeb',
                borderColor: '#fcd34d',
                hint: 'Opens Amazon',
            }
        }

        // Priority 7: Generic source URL
        if (sourceUrl) {
            // Try to extract domain for label
            let domain = 'Source'
            try {
                const urlObj = new URL(sourceUrl)
                domain = urlObj.hostname.replace('www.', '')
            } catch {
                // Invalid URL, use generic label
            }
            return {
                type: 'generic',
                url: sourceUrl,
                label: `View Source (${domain})`,
                icon: '🔗',
                color: '#6b7280',
                bgColor: '#f9fafb',
                borderColor: '#e5e7eb',
                hint: 'Opens external link',
            }
        }

        // No source available
        return null
    }

    const sourceInfo = getSourceInfo()

    // No source - show placeholder
    if (!sourceInfo) {
        return (
            <div style={{
                padding: '12px 16px',
                background: '#f9fafb',
                borderRadius: '8px',
                border: '1px dashed #d1d5db',
            }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: '#9ca3af',
                    fontSize: '13px',
                }}>
                    <span style={{ fontSize: '16px' }}>📭</span>
                    <span style={{ fontStyle: 'italic' }}>
                        No source linked. Add a Source URL or Source Video above.
                    </span>
                </div>
            </div>
        )
    }

    // Show source link
    return (
        <div style={{
            padding: '12px 16px',
            background: sourceInfo.bgColor,
            borderRadius: '8px',
            border: `1px solid ${sourceInfo.borderColor}`,
        }}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                flexWrap: 'wrap',
            }}>
                <span style={{
                    fontSize: '20px',
                    color: sourceInfo.color,
                }}>
                    {sourceInfo.icon}
                </span>
                <a
                    href={sourceInfo.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                        color: '#1d4ed8',
                        textDecoration: 'none',
                        fontWeight: 600,
                        fontSize: '14px',
                    }}
                    onMouseOver={(e) => e.currentTarget.style.textDecoration = 'underline'}
                    onMouseOut={(e) => e.currentTarget.style.textDecoration = 'none'}
                >
                    {sourceInfo.label}
                </a>
                <span style={{
                    color: '#6b7280',
                    fontSize: '12px',
                    background: 'rgba(0,0,0,0.05)',
                    padding: '2px 8px',
                    borderRadius: '4px',
                }}>
                    {sourceInfo.hint}
                </span>
            </div>
        </div>
    )
}

export default SourceVideoLink
