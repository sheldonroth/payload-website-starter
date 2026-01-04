import type { PayloadHandler, PayloadRequest } from 'payload'

// Maximum number of items a user can save
const MAX_SAVED_PRODUCTS = 500
const MAX_SAVED_ARTICLES = 500

/**
 * User Saved Products Endpoints
 *
 * GET /api/users/me/saved-products - Get saved product IDs
 * POST /api/users/me/saved-products - Add product to saved
 * DELETE /api/users/me/saved-products - Remove product from saved
 */
export const savedProductsGetHandler: PayloadHandler = async (req: PayloadRequest) => {
    if (!req.user) {
        return Response.json({ error: 'Login required' }, { status: 401 })
    }

    try {
        const user = await req.payload.findByID({
            collection: 'users',
            id: req.user.id,
        })

        const savedProductIds = ((user as any).savedProductIds || []) as number[]

        return Response.json({
            savedProductIds,
            count: savedProductIds.length,
        })
    } catch (error) {
        console.error('Get saved products error:', error)
        return Response.json({ error: 'Failed to fetch saved products' }, { status: 500 })
    }
}

export const savedProductsAddHandler: PayloadHandler = async (req: PayloadRequest) => {
    if (!req.user) {
        return Response.json({ error: 'Login required' }, { status: 401 })
    }

    try {
        const body = await req.json?.()
        const { productId } = body || {}

        if (!productId) {
            return Response.json({ error: 'productId is required' }, { status: 400 })
        }

        const numericId = typeof productId === 'string' ? parseInt(productId, 10) : productId
        if (isNaN(numericId)) {
            return Response.json({ error: 'Invalid productId' }, { status: 400 })
        }

        // Get current user
        const user = await req.payload.findByID({
            collection: 'users',
            id: req.user.id,
        })

        const currentSaved = ((user as any).savedProductIds || []) as number[]

        // Check size limit
        if (currentSaved.length >= MAX_SAVED_PRODUCTS) {
            return Response.json(
                { error: `Maximum ${MAX_SAVED_PRODUCTS} products can be saved` },
                { status: 400 }
            )
        }

        // Check if already saved
        if (currentSaved.includes(numericId)) {
            return Response.json({ error: 'Product already saved' }, { status: 409 })
        }

        // Verify product exists
        try {
            await req.payload.findByID({
                collection: 'products',
                id: numericId,
            })
        } catch {
            return Response.json({ error: 'Product not found' }, { status: 404 })
        }

        // Add to saved
        const updatedSaved = [...currentSaved, numericId]

        await req.payload.update({
            collection: 'users',
            id: req.user.id,
            data: {
                savedProductIds: updatedSaved,
            } as any,
        })

        return Response.json({
            success: true,
            savedProductIds: updatedSaved,
            added: numericId,
        }, { status: 201 })
    } catch (error) {
        console.error('Add saved product error:', error)
        return Response.json({ error: 'Failed to save product' }, { status: 500 })
    }
}

export const savedProductsRemoveHandler: PayloadHandler = async (req: PayloadRequest) => {
    if (!req.user) {
        return Response.json({ error: 'Login required' }, { status: 401 })
    }

    try {
        const body = await req.json?.()
        const { productId } = body || {}

        if (!productId) {
            return Response.json({ error: 'productId is required' }, { status: 400 })
        }

        const numericId = typeof productId === 'string' ? parseInt(productId, 10) : productId
        if (isNaN(numericId)) {
            return Response.json({ error: 'Invalid productId' }, { status: 400 })
        }

        // Get current user
        const user = await req.payload.findByID({
            collection: 'users',
            id: req.user.id,
        })

        const currentSaved = ((user as any).savedProductIds || []) as number[]

        // Check if saved
        if (!currentSaved.includes(numericId)) {
            return Response.json({ error: 'Product not in saved list' }, { status: 404 })
        }

        // Remove from saved
        const updatedSaved = currentSaved.filter(id => id !== numericId)

        await req.payload.update({
            collection: 'users',
            id: req.user.id,
            data: {
                savedProductIds: updatedSaved,
            } as any,
        })

        return Response.json({
            success: true,
            savedProductIds: updatedSaved,
            removed: numericId,
        })
    } catch (error) {
        console.error('Remove saved product error:', error)
        return Response.json({ error: 'Failed to remove product' }, { status: 500 })
    }
}

/**
 * User Saved Articles Endpoints
 *
 * GET /api/users/me/saved-articles - Get saved article IDs
 * POST /api/users/me/saved-articles - Add article to saved
 * DELETE /api/users/me/saved-articles - Remove article from saved
 */
export const savedArticlesGetHandler: PayloadHandler = async (req: PayloadRequest) => {
    if (!req.user) {
        return Response.json({ error: 'Login required' }, { status: 401 })
    }

    try {
        const user = await req.payload.findByID({
            collection: 'users',
            id: req.user.id,
        })

        const savedArticleIds = ((user as any).savedArticleIds || []) as number[]

        return Response.json({
            savedArticleIds,
            count: savedArticleIds.length,
        })
    } catch (error) {
        console.error('Get saved articles error:', error)
        return Response.json({ error: 'Failed to fetch saved articles' }, { status: 500 })
    }
}

export const savedArticlesAddHandler: PayloadHandler = async (req: PayloadRequest) => {
    if (!req.user) {
        return Response.json({ error: 'Login required' }, { status: 401 })
    }

    try {
        const body = await req.json?.()
        const { articleId } = body || {}

        if (!articleId) {
            return Response.json({ error: 'articleId is required' }, { status: 400 })
        }

        const numericId = typeof articleId === 'string' ? parseInt(articleId, 10) : articleId
        if (isNaN(numericId)) {
            return Response.json({ error: 'Invalid articleId' }, { status: 400 })
        }

        // Get current user
        const user = await req.payload.findByID({
            collection: 'users',
            id: req.user.id,
        })

        const currentSaved = ((user as any).savedArticleIds || []) as number[]

        // Check size limit
        if (currentSaved.length >= MAX_SAVED_ARTICLES) {
            return Response.json(
                { error: `Maximum ${MAX_SAVED_ARTICLES} articles can be saved` },
                { status: 400 }
            )
        }

        // Check if already saved
        if (currentSaved.includes(numericId)) {
            return Response.json({ error: 'Article already saved' }, { status: 409 })
        }

        // Verify article exists
        try {
            await req.payload.findByID({
                collection: 'articles',
                id: numericId,
            })
        } catch {
            return Response.json({ error: 'Article not found' }, { status: 404 })
        }

        // Add to saved
        const updatedSaved = [...currentSaved, numericId]

        await req.payload.update({
            collection: 'users',
            id: req.user.id,
            data: {
                savedArticleIds: updatedSaved,
            } as any,
        })

        return Response.json({
            success: true,
            savedArticleIds: updatedSaved,
            added: numericId,
        }, { status: 201 })
    } catch (error) {
        console.error('Add saved article error:', error)
        return Response.json({ error: 'Failed to save article' }, { status: 500 })
    }
}

export const savedArticlesRemoveHandler: PayloadHandler = async (req: PayloadRequest) => {
    if (!req.user) {
        return Response.json({ error: 'Login required' }, { status: 401 })
    }

    try {
        const body = await req.json?.()
        const { articleId } = body || {}

        if (!articleId) {
            return Response.json({ error: 'articleId is required' }, { status: 400 })
        }

        const numericId = typeof articleId === 'string' ? parseInt(articleId, 10) : articleId
        if (isNaN(numericId)) {
            return Response.json({ error: 'Invalid articleId' }, { status: 400 })
        }

        // Get current user
        const user = await req.payload.findByID({
            collection: 'users',
            id: req.user.id,
        })

        const currentSaved = ((user as any).savedArticleIds || []) as number[]

        // Check if saved
        if (!currentSaved.includes(numericId)) {
            return Response.json({ error: 'Article not in saved list' }, { status: 404 })
        }

        // Remove from saved
        const updatedSaved = currentSaved.filter(id => id !== numericId)

        await req.payload.update({
            collection: 'users',
            id: req.user.id,
            data: {
                savedArticleIds: updatedSaved,
            } as any,
        })

        return Response.json({
            success: true,
            savedArticleIds: updatedSaved,
            removed: numericId,
        })
    } catch (error) {
        console.error('Remove saved article error:', error)
        return Response.json({ error: 'Failed to remove article' }, { status: 500 })
    }
}
