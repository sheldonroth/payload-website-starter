import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { headers, cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

// Maximum number of items a user can save
const MAX_SAVED_ARTICLES = 500

// Helper to ensure savedArticleIds is always an array
function getSavedArray(savedArticleIds: unknown): number[] {
    if (Array.isArray(savedArticleIds)) {
        return savedArticleIds
    }
    return []
}

/**
 * GET /api/users/me/saved-articles
 * Get user's saved article IDs
 */
export async function GET() {
    try {
        const payload = await getPayload({ config })
        const headersList = await headers()
        const cookieStore = await cookies()

        const token = cookieStore.get('payload-token')?.value ||
            headersList.get('authorization')?.replace('Bearer ', '')

        if (!token) {
            return NextResponse.json({ error: 'Login required' }, { status: 401 })
        }

        const { user } = await payload.auth({ headers: headersList })

        if (!user) {
            return NextResponse.json({ error: 'Login required' }, { status: 401 })
        }

        const savedArticleIds = getSavedArray((user as any).savedArticleIds)

        return NextResponse.json({
            savedArticleIds,
            count: savedArticleIds.length,
        })
    } catch (error) {
        console.error('Get saved articles error:', error)
        return NextResponse.json({ error: 'Failed to fetch saved articles' }, { status: 500 })
    }
}

/**
 * POST /api/users/me/saved-articles
 * Add article to saved
 */
export async function POST(request: Request) {
    try {
        const payload = await getPayload({ config })
        const headersList = await headers()
        const cookieStore = await cookies()

        const token = cookieStore.get('payload-token')?.value ||
            headersList.get('authorization')?.replace('Bearer ', '')

        if (!token) {
            return NextResponse.json({ error: 'Login required' }, { status: 401 })
        }

        const { user } = await payload.auth({ headers: headersList })

        if (!user) {
            return NextResponse.json({ error: 'Login required' }, { status: 401 })
        }

        const body = await request.json()
        const { articleId } = body || {}

        if (!articleId) {
            return NextResponse.json({ error: 'articleId is required' }, { status: 400 })
        }

        const numericId = typeof articleId === 'string' ? parseInt(articleId, 10) : articleId
        if (isNaN(numericId)) {
            return NextResponse.json({ error: 'Invalid articleId' }, { status: 400 })
        }

        const currentSaved = getSavedArray((user as any).savedArticleIds)

        // Check size limit
        if (currentSaved.length >= MAX_SAVED_ARTICLES) {
            return NextResponse.json(
                { error: `Maximum ${MAX_SAVED_ARTICLES} articles can be saved` },
                { status: 400 }
            )
        }

        // Check if already saved
        if (currentSaved.includes(numericId)) {
            return NextResponse.json({ error: 'Article already saved' }, { status: 409 })
        }

        // Verify article exists
        try {
            await payload.findByID({ collection: 'articles', id: numericId })
        } catch {
            return NextResponse.json({ error: 'Article not found' }, { status: 404 })
        }

        // Add to saved
        const updatedSaved = [...currentSaved, numericId]

        await payload.update({
            collection: 'users',
            id: user.id,
            data: { savedArticleIds: updatedSaved } as any,
        })

        return NextResponse.json({
            success: true,
            savedArticleIds: updatedSaved,
            added: numericId,
        }, { status: 201 })
    } catch (error) {
        console.error('Add saved article error:', error)
        return NextResponse.json({ error: 'Failed to save article' }, { status: 500 })
    }
}

/**
 * DELETE /api/users/me/saved-articles
 * Remove article from saved
 */
export async function DELETE(request: Request) {
    try {
        const payload = await getPayload({ config })
        const headersList = await headers()
        const cookieStore = await cookies()

        const token = cookieStore.get('payload-token')?.value ||
            headersList.get('authorization')?.replace('Bearer ', '')

        if (!token) {
            return NextResponse.json({ error: 'Login required' }, { status: 401 })
        }

        const { user } = await payload.auth({ headers: headersList })

        if (!user) {
            return NextResponse.json({ error: 'Login required' }, { status: 401 })
        }

        const body = await request.json()
        const { articleId } = body || {}

        if (!articleId) {
            return NextResponse.json({ error: 'articleId is required' }, { status: 400 })
        }

        const numericId = typeof articleId === 'string' ? parseInt(articleId, 10) : articleId
        if (isNaN(numericId)) {
            return NextResponse.json({ error: 'Invalid articleId' }, { status: 400 })
        }

        const currentSaved = getSavedArray((user as any).savedArticleIds)

        // Check if saved
        if (!currentSaved.includes(numericId)) {
            return NextResponse.json({ error: 'Article not in saved list' }, { status: 404 })
        }

        // Remove from saved
        const updatedSaved = currentSaved.filter(id => id !== numericId)

        await payload.update({
            collection: 'users',
            id: user.id,
            data: { savedArticleIds: updatedSaved } as any,
        })

        return NextResponse.json({
            success: true,
            savedArticleIds: updatedSaved,
            removed: numericId,
        })
    } catch (error) {
        console.error('Remove saved article error:', error)
        return NextResponse.json({ error: 'Failed to remove article' }, { status: 500 })
    }
}
