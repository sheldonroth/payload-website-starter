import type { GlobalConfig } from 'payload'

export const YouTubeSettings: GlobalConfig = {
    slug: 'youtube-settings',
    access: {
        read: () => true,
    },
    admin: {
        group: 'Settings',
    },
    fields: [
        {
            name: 'channelId',
            type: 'text',
            label: 'YouTube Channel ID',
            admin: {
                description: 'Your YouTube channel ID (found at youtube.com/account_advanced)',
            },
        },
        {
            name: 'apiKey',
            type: 'text',
            label: 'YouTube Data API Key',
            admin: {
                description: 'Get from Google Cloud Console with YouTube Data API v3 enabled',
            },
        },
        {
            name: 'autoSyncEnabled',
            type: 'checkbox',
            label: 'Enable Auto-Sync',
            defaultValue: false,
            admin: {
                description: 'Automatically sync videos daily',
            },
        },
        {
            name: 'maxVideosToSync',
            type: 'number',
            label: 'Max Videos to Sync',
            defaultValue: 50,
            admin: {
                description: 'Maximum number of videos to import per sync',
            },
        },
        {
            name: 'shortsOnly',
            type: 'checkbox',
            label: 'Shorts Only',
            defaultValue: true,
            admin: {
                description: 'Only import YouTube Shorts (videos under 60 seconds)',
            },
        },
        {
            name: 'lastSyncAt',
            type: 'date',
            label: 'Last Sync',
            admin: {
                readOnly: true,
                description: 'When videos were last synced from YouTube',
            },
        },
        {
            name: 'lastSyncStatus',
            type: 'text',
            label: 'Last Sync Status',
            admin: {
                readOnly: true,
            },
        },
    ],
}
