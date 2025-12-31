import type { PayloadHandler, PayloadRequest } from 'payload'

interface WatchlistItem {
    ingredientId: string
    ingredientName: string
    reason?: string
    dateAdded: string
}

/**
 * User Ingredient Watchlist Endpoints
 *
 * GET /api/users/me/watchlist - Get user's ingredient watchlist
 * POST /api/users/me/watchlist - Add ingredient to watchlist
 * DELETE /api/users/me/watchlist - Remove ingredient from watchlist
 */
export const userWatchlistGetHandler: PayloadHandler = async (req: PayloadRequest) => {
    if (!req.user) {
        return Response.json(
            { error: 'Login required' },
            { status: 401 }
        )
    }

    try {
        const user = await req.payload.findByID({
            collection: 'users',
            id: req.user.id,
        })

        const watchlist = ((user as any).ingredientWatchlist || []) as WatchlistItem[]

        return Response.json({
            watchlist,
            count: watchlist.length,
        })
    } catch (error) {
        console.error('Get watchlist error:', error)
        return Response.json(
            { error: 'Failed to fetch watchlist' },
            { status: 500 }
        )
    }
}

export const userWatchlistAddHandler: PayloadHandler = async (req: PayloadRequest) => {
    if (!req.user) {
        return Response.json(
            { error: 'Login required' },
            { status: 401 }
        )
    }

    try {
        const body = await req.json?.()
        const { ingredientId, ingredientName, reason } = body || {}

        if (!ingredientId || !ingredientName) {
            return Response.json(
                { error: 'ingredientId and ingredientName are required' },
                { status: 400 }
            )
        }

        // Get current user
        const user = await req.payload.findByID({
            collection: 'users',
            id: req.user.id,
        })

        const currentWatchlist = ((user as any).ingredientWatchlist || []) as WatchlistItem[]

        // Check if already in watchlist
        if (currentWatchlist.some(item => item.ingredientId === ingredientId)) {
            return Response.json(
                { error: 'Ingredient already in watchlist' },
                { status: 409 }
            )
        }

        // Verify ingredient exists
        try {
            await req.payload.findByID({
                collection: 'ingredients',
                id: ingredientId,
            })
        } catch {
            return Response.json(
                { error: 'Ingredient not found' },
                { status: 404 }
            )
        }

        // Add to watchlist
        const newItem: WatchlistItem = {
            ingredientId,
            ingredientName,
            reason: reason || undefined,
            dateAdded: new Date().toISOString(),
        }

        const updatedWatchlist = [...currentWatchlist, newItem]

        await req.payload.update({
            collection: 'users',
            id: req.user.id,
            data: {
                ingredientWatchlist: updatedWatchlist,
            } as any,
        })

        return Response.json({
            success: true,
            watchlist: updatedWatchlist,
            added: newItem,
        }, { status: 201 })
    } catch (error) {
        console.error('Add to watchlist error:', error)
        return Response.json(
            { error: 'Failed to add to watchlist' },
            { status: 500 }
        )
    }
}

export const userWatchlistRemoveHandler: PayloadHandler = async (req: PayloadRequest) => {
    if (!req.user) {
        return Response.json(
            { error: 'Login required' },
            { status: 401 }
        )
    }

    try {
        const body = await req.json?.()
        const { ingredientId } = body || {}

        if (!ingredientId) {
            return Response.json(
                { error: 'ingredientId is required' },
                { status: 400 }
            )
        }

        // Get current user
        const user = await req.payload.findByID({
            collection: 'users',
            id: req.user.id,
        })

        const currentWatchlist = ((user as any).ingredientWatchlist || []) as WatchlistItem[]

        // Check if in watchlist
        const itemIndex = currentWatchlist.findIndex(item => item.ingredientId === ingredientId)
        if (itemIndex === -1) {
            return Response.json(
                { error: 'Ingredient not in watchlist' },
                { status: 404 }
            )
        }

        // Remove from watchlist
        const removedItem = currentWatchlist[itemIndex]
        const updatedWatchlist = currentWatchlist.filter(item => item.ingredientId !== ingredientId)

        await req.payload.update({
            collection: 'users',
            id: req.user.id,
            data: {
                ingredientWatchlist: updatedWatchlist,
            } as any,
        })

        return Response.json({
            success: true,
            watchlist: updatedWatchlist,
            removed: removedItem,
        })
    } catch (error) {
        console.error('Remove from watchlist error:', error)
        return Response.json(
            { error: 'Failed to remove from watchlist' },
            { status: 500 }
        )
    }
}

/**
 * Check if a product contains any ingredients from user's watchlist
 * Returns matching ingredients for alerting
 */
export const checkWatchlistConflictsHandler: PayloadHandler = async (req: PayloadRequest) => {
    if (!req.user) {
        return Response.json(
            { error: 'Login required' },
            { status: 401 }
        )
    }

    try {
        const body = await req.json?.()
        const { productId } = body || {}

        if (!productId) {
            return Response.json(
                { error: 'productId is required' },
                { status: 400 }
            )
        }

        // Get user's watchlist
        const user = await req.payload.findByID({
            collection: 'users',
            id: req.user.id,
        })

        const watchlist = ((user as any).ingredientWatchlist || []) as WatchlistItem[]

        if (watchlist.length === 0) {
            return Response.json({
                hasConflicts: false,
                conflicts: [],
            })
        }

        // Get product
        const product = await req.payload.findByID({
            collection: 'products',
            id: productId,
            depth: 1, // Include ingredient details
        })

        if (!product) {
            return Response.json(
                { error: 'Product not found' },
                { status: 404 }
            )
        }

        // Get product's ingredient IDs
        const productIngredients = ((product as any).parsedIngredients || []) as Array<{
            ingredient?: { id?: string; name?: string } | string
        }>

        const productIngredientIds = productIngredients
            .map(pi => {
                if (typeof pi.ingredient === 'string') return pi.ingredient
                return pi.ingredient?.id
            })
            .filter(Boolean) as string[]

        // Find conflicts
        const conflicts = watchlist.filter(item =>
            productIngredientIds.includes(item.ingredientId)
        )

        return Response.json({
            hasConflicts: conflicts.length > 0,
            conflicts,
            totalWatchlistItems: watchlist.length,
            productIngredientCount: productIngredientIds.length,
        })
    } catch (error) {
        console.error('Check watchlist conflicts error:', error)
        return Response.json(
            { error: 'Failed to check conflicts' },
            { status: 500 }
        )
    }
}
