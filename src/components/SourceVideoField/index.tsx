'use client'

import React from 'react'
import { useField, useFormFields, RelationshipField } from '@payloadcms/ui'

interface SourceVideoFieldProps {
    path: string
    field: {
        name: string
        label?: string
        relationTo: string
        admin?: {
            description?: string
        }
    }
}

interface VideoData {
    id: number
    title?: string
    youtubeVideoId?: string
}

const SourceVideoField: React.FC<SourceVideoFieldProps> = ({ path, field }) => {
    const { value, setValue } = useField<number | VideoData | null>({ path })

    // The relationship field stores the full object when populated
    const video = typeof value === 'object' && value ? value : null

    const youtubeUrl = video?.youtubeVideoId
        ? `https://youtube.com/watch?v=${video.youtubeVideoId}`
        : null

    return (
        <div style={{ marginBottom: '24px' }}>
            {/* Render the default relationship field */}
            <RelationshipField
                field={field as any}
                path={path}
            />

            {/* YouTube Link Display */}
            {video && (
                <div style={{
                    marginTop: '8px',
                    padding: '12px',
                    background: youtubeUrl ? '#fef3c7' : '#f3f4f6',
                    borderRadius: '6px',
                    border: `1px solid ${youtubeUrl ? '#fcd34d' : '#e5e7eb'}`,
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: '#ef4444', fontSize: '18px' }}>&#x25B6;</span>
                        {youtubeUrl ? (
                            <>
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
                            </>
                        ) : (
                            <>
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
                            </>
                        )}
                    </div>
                </div>
            )}

            {!video && (
                <div style={{
                    marginTop: '8px',
                    padding: '10px 12px',
                    background: '#f9fafb',
                    borderRadius: '6px',
                    border: '1px solid #e5e7eb',
                }}>
                    <span style={{ color: '#9ca3af', fontSize: '13px', fontStyle: 'italic' }}>
                        Select a source video to see YouTube link
                    </span>
                </div>
            )}
        </div>
    )
}

export default SourceVideoField
