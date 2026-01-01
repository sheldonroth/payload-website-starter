'use client'

import React from 'react'
import { useField, useFormFields } from '@payloadcms/ui'

interface SourceVideoLinkProps {
    path: string
    field: {
        name: string
        label?: string
    }
}

interface VideoData {
    id: number
    title?: string
    youtubeVideoId?: string
}

const SourceVideoLink: React.FC<SourceVideoLinkProps> = ({ path }) => {
    // Get the sourceVideo field value from form context
    const sourceVideoField = useFormFields(([fields]) => fields.sourceVideo)

    // Handle both populated object and ID-only cases
    const videoData = sourceVideoField?.value as VideoData | number | null
    const video = typeof videoData === 'object' ? videoData : null

    if (!video) {
        return (
            <div style={{
                padding: '10px 12px',
                background: '#f9fafb',
                borderRadius: '6px',
                marginBottom: '16px',
                border: '1px solid #e5e7eb',
            }}>
                <span style={{ color: '#9ca3af', fontSize: '13px', fontStyle: 'italic' }}>
                    Select a source video above to see YouTube link
                </span>
            </div>
        )
    }

    if (!video.youtubeVideoId) {
        return (
            <div style={{
                padding: '12px',
                background: '#f3f4f6',
                borderRadius: '6px',
                marginBottom: '16px',
                border: '1px solid #e5e7eb',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '16px' }}>&#x1F4F9;</span>
                    <a
                        href={`/admin/collections/videos/${video.id}`}
                        style={{
                            color: '#6366f1',
                            textDecoration: 'none',
                            fontWeight: 500,
                        }}
                    >
                        {video.title || 'View Video in CMS'}
                    </a>
                    <span style={{ color: '#9ca3af', fontSize: '12px' }}>
                        (no YouTube ID)
                    </span>
                </div>
            </div>
        )
    }

    const youtubeUrl = `https://youtube.com/watch?v=${video.youtubeVideoId}`

    return (
        <div style={{
            padding: '12px',
            background: '#fef3c7',
            borderRadius: '6px',
            marginBottom: '16px',
            border: '1px solid #fcd34d',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: '#ef4444', fontSize: '18px' }}>&#x25B6;</span>
                <a
                    href={youtubeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                        color: '#1d4ed8',
                        textDecoration: 'none',
                        fontWeight: 500,
                        fontSize: '14px',
                    }}
                >
                    {video.title || 'Watch Source Video'}
                </a>
                <span style={{ color: '#92400e', fontSize: '12px' }}>
                    (opens YouTube)
                </span>
            </div>
        </div>
    )
}

export default SourceVideoLink
