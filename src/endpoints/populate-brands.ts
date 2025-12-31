import type { PayloadHandler, PayloadRequest } from 'payload'

/**
 * Populate Brands from Existing Products
 * POST /api/admin/populate-brands
 */
export const populateBrandsHandler: PayloadHandler = async (req: PayloadRequest) => {
    if (!req.user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const isAdmin = (req.user as any).role === 'admin' || (req.user as any).isAdmin
    if (!isAdmin) {
        return Response.json({ error: 'Admin access required' }, { status: 403 })
    }

    try {
        const payload = req.payload
        const products = await payload.find({
            collection: 'products',
            limit: 1000,
            depth: 0,
        })

        const brandNames = new Map<string, { count: number; productIds: number[] }>()

        for (const product of products.docs) {
            const p = product as { id: number; brand?: string }
            const brandName = p.brand?.trim()

            if (!brandName || brandName === 'N/A' || brandName === 'Unspecified' || brandName === 'Various') {
                continue
            }

            if (!brandNames.has(brandName)) {
                brandNames.set(brandName, { count: 0, productIds: [] })
            }

            const entry = brandNames.get(brandName)!
            entry.count++
            entry.productIds.push(p.id)
        }

        const results = { created: 0, existing: 0, updated: 0, errors: [] as string[] }

        for (const [brandName, data] of brandNames) {
            try {
                const existing = await payload.find({
                    collection: 'brands',
                    where: { name: { equals: brandName } },
                    limit: 1,
                })

                if (existing.docs.length > 0) {
                    const brandId = (existing.docs[0] as { id: number }).id
                    results.existing++
                    await payload.update({
                        collection: 'brands',
                        id: brandId,
                        data: { productCount: data.count },
                    })
                    results.updated++
                } else {
                    const slug = brandName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
                    await payload.create({
                        collection: 'brands',
                        data: {
                            name: brandName,
                            slug,
                            productCount: data.count,
                            trustScore: 50,
                            trustGrade: 'C',
                        },
                    })
                    results.created++
                }
            } catch (error) {
                results.errors.push(`Failed: ${brandName}`)
            }
        }

        return Response.json({
            success: true,
            message: `Processed ${brandNames.size} unique brands`,
            results,
            brandsList: Array.from(brandNames.keys()).sort(),
        })
    } catch (error) {
        return Response.json({ error: 'Failed to populate brands' }, { status: 500 })
    }
}
