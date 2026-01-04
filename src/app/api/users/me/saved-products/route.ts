import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { headers, cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

// Maximum number of items a user can save
const MAX_SAVED_PRODUCTS = 500

/**
 * GET /api/users/me/saved-products
 * Get user's saved product IDs
 */
export async function GET() {
    try {
        const payload = await getPayload({ config })
        const headersList = await headers()
        const cookieStore = await cookies()

        // Get auth from cookies or headers
        const token = cookieStore.get('payload-token')?.value ||
            headersList.get('authorization')?.replace('Bearer ', '')

        if (!token) {
            return NextResponse.json({ error: 'Login required' }, { status: 401 })
        }

        // Verify token and get user
        const { user } = await payload.auth({ headers: headersList })

        if (!user) {
            return NextResponse.json({ error: 'Login required' }, { status: 401 })
        }

        const savedProductIds = ((user as any).savedProductIds || []) as number[]

        return NextResponse.json({
            savedProductIds,
            count: savedProductIds.length,
        })
    } catch (error) {
        console.error('Get saved products error:', error)
        return NextResponse.json({ error: 'Failed to fetch saved products' }, { status: 500 })
    }
}

/**
 * POST /api/users/me/saved-products
 * Add product to saved
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
        const { productId } = body || {}

        if (!productId) {
            return NextResponse.json({ error: 'productId is required' }, { status: 400 })
        }

        const numericId = typeof productId === 'string' ? parseInt(productId, 10) : productId
        if (isNaN(numericId)) {
            return NextResponse.json({ error: 'Invalid productId' }, { status: 400 })
        }

        const currentSaved = ((user as any).savedProductIds || []) as number[]

        // Check size limit
        if (currentSaved.length >= MAX_SAVED_PRODUCTS) {
            return NextResponse.json(
                { error: `Maximum ${MAX_SAVED_PRODUCTS} products can be saved` },
                { status: 400 }
            )
        }

        // Check if already saved
        if (currentSaved.includes(numericId)) {
            return NextResponse.json({ error: 'Product already saved' }, { status: 409 })
        }

        // Verify product exists
        try {
            await payload.findByID({ collection: 'products', id: numericId })
        } catch {
            return NextResponse.json({ error: 'Product not found' }, { status: 404 })
        }

        // Add to saved
        const updatedSaved = [...currentSaved, numericId]

        await payload.update({
            collection: 'users',
            id: user.id,
            data: { savedProductIds: updatedSaved } as any,
        })

        return NextResponse.json({
            success: true,
            savedProductIds: updatedSaved,
            added: numericId,
        }, { status: 201 })
    } catch (error) {
        console.error('Add saved product error:', error)
        return NextResponse.json({ error: 'Failed to save product' }, { status: 500 })
    }
}

/**
 * DELETE /api/users/me/saved-products
 * Remove product from saved
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
        const { productId } = body || {}

        if (!productId) {
            return NextResponse.json({ error: 'productId is required' }, { status: 400 })
        }

        const numericId = typeof productId === 'string' ? parseInt(productId, 10) : productId
        if (isNaN(numericId)) {
            return NextResponse.json({ error: 'Invalid productId' }, { status: 400 })
        }

        const currentSaved = ((user as any).savedProductIds || []) as number[]

        // Check if saved
        if (!currentSaved.includes(numericId)) {
            return NextResponse.json({ error: 'Product not in saved list' }, { status: 404 })
        }

        // Remove from saved
        const updatedSaved = currentSaved.filter(id => id !== numericId)

        await payload.update({
            collection: 'users',
            id: user.id,
            data: { savedProductIds: updatedSaved } as any,
        })

        return NextResponse.json({
            success: true,
            savedProductIds: updatedSaved,
            removed: numericId,
        })
    } catch (error) {
        console.error('Remove saved product error:', error)
        return NextResponse.json({ error: 'Failed to remove product' }, { status: 500 })
    }
}
