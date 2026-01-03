import { PayloadHandler } from 'payload'

/**
 * Admin Backfill Display Titles
 * POST /api/admin/backfill-titles
 *
 * Populates the displayTitle field for all products that don't have it set.
 * Run this once after adding the displayTitle field.
 */
export const adminBackfillTitlesHandler: PayloadHandler = async (req) => {
  // Admin only
  const user = req.user as { role?: string } | undefined
  if (!user || user.role !== 'admin') {
    return Response.json({ error: 'Admin access required' }, { status: 403 })
  }

  try {
    // Find all products
    const products = await req.payload.find({
      collection: 'products',
      limit: 1000,
      depth: 0,
    })

    let updated = 0
    let skipped = 0

    for (const product of products.docs) {
      const brand = (product as any).brand || ''
      const name = (product as any).name || ''
      const currentDisplayTitle = (product as any).displayTitle

      // Generate correct display title
      const correctDisplayTitle = brand && name
        ? `${brand} - ${name}`
        : name || brand || 'Unnamed Product'

      // Skip if already correct
      if (currentDisplayTitle === correctDisplayTitle) {
        skipped++
        continue
      }

      // Update the product
      await req.payload.update({
        collection: 'products',
        id: product.id,
        data: {
          displayTitle: correctDisplayTitle,
        } as any,
      })

      updated++
    }

    console.log(`[Backfill Titles] Updated ${updated} products, skipped ${skipped}`)

    return Response.json({
      success: true,
      updated,
      skipped,
      total: products.docs.length,
    })

  } catch (error) {
    console.error('[Backfill Titles] Error:', error)
    return Response.json(
      { error: 'Failed to backfill titles' },
      { status: 500 }
    )
  }
}
