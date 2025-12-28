import type { PayloadHandler, PayloadRequest } from 'payload'
import { google } from 'googleapis'

/**
 * Automated backup to Google Drive
 * POST /api/backup/drive - Called by Vercel cron daily
 */
export const backupDriveHandler: PayloadHandler = async (req: PayloadRequest) => {
    // Allow authenticated users OR cron job with secret
    const authHeader = req.headers.get('authorization')
    const isCronJob = authHeader === `Bearer ${process.env.CRON_SECRET}`

    if (!req.user && !isCronJob) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID

    if (!serviceAccountKey || !folderId) {
        return Response.json({
            error: 'Google Drive not configured (missing GOOGLE_SERVICE_ACCOUNT_KEY or GOOGLE_DRIVE_FOLDER_ID)'
        }, { status: 500 })
    }

    try {
        const payload = req.payload

        // Export all collections (same as manual backup)
        const [products, articles, videos, categories, users, media, polls] = await Promise.all([
            payload.find({ collection: 'products', limit: 10000, depth: 0 }),
            payload.find({ collection: 'articles', limit: 10000, depth: 0 }),
            payload.find({ collection: 'videos', limit: 10000, depth: 0 }),
            payload.find({ collection: 'categories', limit: 10000, depth: 0 }),
            payload.find({ collection: 'users', limit: 10000, depth: 0 }),
            payload.find({ collection: 'media', limit: 10000, depth: 0 }),
            payload.find({ collection: 'investigation-polls', limit: 10000, depth: 0 }),
        ])

        const backup = {
            exportedAt: new Date().toISOString(),
            version: '1.0',
            collections: {
                products: { count: products.totalDocs, docs: products.docs },
                articles: { count: articles.totalDocs, docs: articles.docs },
                videos: { count: videos.totalDocs, docs: videos.docs },
                categories: { count: categories.totalDocs, docs: categories.docs },
                media: { count: media.totalDocs, docs: media.docs },
                polls: { count: polls.totalDocs, docs: polls.docs },
                users: {
                    count: users.totalDocs,
                    docs: users.docs.map((u: Record<string, unknown>) => ({
                        id: u.id,
                        email: u.email,
                        name: u.name,
                        createdAt: u.createdAt,
                    })),
                },
            },
            summary: {
                totalProducts: products.totalDocs,
                totalArticles: articles.totalDocs,
                totalVideos: videos.totalDocs,
                totalCategories: categories.totalDocs,
                totalMedia: media.totalDocs,
                totalPolls: polls.totalDocs,
                totalUsers: users.totalDocs,
            },
        }

        // Authenticate with Google Drive
        const credentials = JSON.parse(serviceAccountKey)
        const auth = new google.auth.GoogleAuth({
            credentials,
            scopes: ['https://www.googleapis.com/auth/drive.file'],
        })

        const drive = google.drive({ version: 'v3', auth })

        // Create filename with date
        const dateStr = new Date().toISOString().split('T')[0]
        const filename = `tpr_backup_${dateStr}.json`

        // Upload to Drive
        const fileMetadata = {
            name: filename,
            parents: [folderId],
        }

        const media_content = {
            mimeType: 'application/json',
            body: JSON.stringify(backup, null, 2),
        }

        const file = await drive.files.create({
            requestBody: fileMetadata,
            media: media_content,
            fields: 'id, name, webViewLink',
        })

        console.log(`Backup uploaded to Google Drive: ${file.data.name} (${file.data.id})`)

        // Clean up old backups (keep last 30)
        const existingFiles = await drive.files.list({
            q: `'${folderId}' in parents and name contains 'tpr_backup_' and trashed = false`,
            orderBy: 'createdTime desc',
            fields: 'files(id, name, createdTime)',
        })

        const files = existingFiles.data.files || []
        if (files.length > 30) {
            const filesToDelete = files.slice(30)
            for (const oldFile of filesToDelete) {
                if (oldFile.id) {
                    await drive.files.delete({ fileId: oldFile.id })
                    console.log(`Deleted old backup: ${oldFile.name}`)
                }
            }
        }

        return Response.json({
            success: true,
            filename: file.data.name,
            fileId: file.data.id,
            webViewLink: file.data.webViewLink,
            summary: backup.summary,
            backupsKept: Math.min(files.length + 1, 30),
        })
    } catch (error) {
        console.error('Google Drive backup error:', error)
        return Response.json(
            { error: error instanceof Error ? error.message : 'Backup failed' },
            { status: 500 }
        )
    }
}
