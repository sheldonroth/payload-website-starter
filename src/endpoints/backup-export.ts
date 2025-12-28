import type { PayloadHandler, PayloadRequest } from 'payload'

/**
 * Export all CMS data as JSON backup
 * GET /api/backup/export - Returns JSON file with all collections
 */
export const backupExportHandler: PayloadHandler = async (req: PayloadRequest) => {
    // Only admins can export data
    if (!req.user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const payload = req.payload

        // Export all collections
        const [products, articles, videos, categories, users] = await Promise.all([
            payload.find({ collection: 'products', limit: 1000, depth: 0 }),
            payload.find({ collection: 'articles', limit: 1000, depth: 0 }),
            payload.find({ collection: 'videos', limit: 1000, depth: 0 }),
            payload.find({ collection: 'categories', limit: 1000, depth: 0 }),
            payload.find({ collection: 'users', limit: 1000, depth: 0 }),
        ])

        const backup = {
            exportedAt: new Date().toISOString(),
            version: '1.0',
            collections: {
                products: {
                    count: products.totalDocs,
                    docs: products.docs,
                },
                articles: {
                    count: articles.totalDocs,
                    docs: articles.docs,
                },
                videos: {
                    count: videos.totalDocs,
                    docs: videos.docs,
                },
                categories: {
                    count: categories.totalDocs,
                    docs: categories.docs,
                },
                users: {
                    count: users.totalDocs,
                    // Remove sensitive data from user export
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
                totalUsers: users.totalDocs,
            },
        }

        const filename = `backup_${new Date().toISOString().split('T')[0]}.json`

        return new Response(JSON.stringify(backup, null, 2), {
            headers: {
                'Content-Type': 'application/json',
                'Content-Disposition': `attachment; filename="${filename}"`,
            },
        })
    } catch (error) {
        console.error('Backup export error:', error)
        return Response.json(
            { error: error instanceof Error ? error.message : 'Export failed' },
            { status: 500 }
        )
    }
}
