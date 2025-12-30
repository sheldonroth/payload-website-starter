import type { CollectionConfig } from 'payload'
import { createAuditLog } from './AuditLog'

export const InvestigationPolls: CollectionConfig = {
    slug: 'investigation-polls',
    access: {
        read: () => true,
        create: ({ req }) => !!req.user?.isAdmin,
        update: ({ req }) => !!req.user?.isAdmin,
        delete: ({ req }) => !!req.user?.isAdmin,
    },
    admin: {
        useAsTitle: 'title',
        defaultColumns: ['title', 'status', 'endDate', 'totalVotes'],
        group: 'Community',
    },
    hooks: {
        afterChange: [
            // ============================================
            // POLL → INVESTIGATION PIPELINE
            // When poll closes, auto-create investigation article
            // ============================================
            async ({ doc, previousDoc, req, operation }) => {
                // Only trigger when status changes to 'closed'
                if (
                    operation === 'update' &&
                    previousDoc?.status === 'active' &&
                    doc?.status === 'closed'
                ) {
                    try {
                        // Find the winning option
                        const options = (doc.options || []) as Array<{
                            name: string
                            description?: string
                            votes: number
                        }>

                        if (options.length === 0) return doc

                        const winner = options.reduce((a, b) =>
                            (b.votes || 0) > (a.votes || 0) ? b : a
                        )

                        // Find related products for this investigation
                        const searchTerms = winner.name.toLowerCase().split(' ')
                        const relatedProducts = await req.payload.find({
                            collection: 'products',
                            where: {
                                or: searchTerms.map(term => ({
                                    name: { contains: term },
                                })),
                            },
                            limit: 10,
                        })

                        // Create investigation article draft
                        const article = await req.payload.create({
                            collection: 'articles',
                            data: {
                                title: `Investigation: ${winner.name}`,
                                slug: `investigation-${winner.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`,
                                excerpt: `Community-requested investigation into ${winner.name}. ${doc.totalVotes || 0} community members voted in this poll. ${winner.description || ''}`,
                                content: {
                                    root: {
                                        type: 'root',
                                        version: 1,
                                        direction: 'ltr' as const,
                                        format: '' as const,
                                        indent: 0,
                                        children: [
                                            {
                                                type: 'heading',
                                                tag: 'h2',
                                                version: 1,
                                                direction: 'ltr' as const,
                                                format: '' as const,
                                                indent: 0,
                                                children: [{ text: `Why We're Investigating ${winner.name}`, type: 'text', version: 1 }],
                                            },
                                            {
                                                type: 'paragraph',
                                                version: 1,
                                                direction: 'ltr' as const,
                                                format: '' as const,
                                                indent: 0,
                                                textFormat: 0,
                                                children: [{
                                                    text: `This investigation was requested by our community through a poll that received ${doc.totalVotes || 0} votes.`,
                                                    type: 'text',
                                                    version: 1,
                                                }],
                                            },
                                            {
                                                type: 'paragraph',
                                                version: 1,
                                                direction: 'ltr' as const,
                                                format: '' as const,
                                                indent: 0,
                                                textFormat: 0,
                                                children: [{
                                                    text: winner.description || 'More details coming soon.',
                                                    type: 'text',
                                                    version: 1,
                                                }],
                                            },
                                        ],
                                    },
                                },
                                category: 'investigation',
                                status: 'draft',
                                author: 'The Product Report Team',
                                publishedAt: new Date().toISOString(),
                                readTime: 5,
                                relatedProducts: relatedProducts.docs.map(p => (p as { id: number }).id),
                            },
                        })

                        // Create audit log
                        await createAuditLog(req.payload, {
                            action: 'article_generated',
                            sourceType: 'system',
                            sourceId: String(doc.id),
                            targetCollection: 'articles',
                            targetId: article.id as number,
                            targetName: `Investigation: ${winner.name}`,
                            metadata: {
                                pollTitle: doc.title,
                                winningOption: winner.name,
                                totalVotes: doc.totalVotes,
                                relatedProductsCount: relatedProducts.docs.length,
                            },
                            performedBy: (req.user as { id?: number })?.id,
                        })

                        // Log for notification
                        console.log(`📰 Created investigation article for "${winner.name}" from poll "${doc.title}"`)

                        // Also log poll closed
                        await createAuditLog(req.payload, {
                            action: 'poll_closed',
                            sourceType: 'system',
                            targetCollection: 'investigation-polls',
                            targetId: doc.id as number,
                            targetName: doc.title as string,
                            metadata: {
                                totalVotes: doc.totalVotes,
                                winner: winner.name,
                                options: options.map(o => ({ name: o.name, votes: o.votes })),
                            },
                            performedBy: (req.user as { id?: number })?.id,
                        })
                    } catch (error) {
                        console.error('Failed to create investigation article:', error)
                    }
                }

                return doc
            },
        ],
    },
    fields: [
        {
            name: 'title',
            type: 'text',
            required: true,
            label: 'Poll Question',
            admin: {
                description: 'e.g., "What should we investigate next?"',
            },
        },
        {
            name: 'description',
            type: 'textarea',
            label: 'Description',
            admin: {
                description: 'Additional context for the poll',
            },
        },
        {
            name: 'status',
            type: 'select',
            required: true,
            defaultValue: 'active',
            options: [
                { label: 'Active', value: 'active' },
                { label: 'Closed', value: 'closed' },
            ],
            admin: {
                position: 'sidebar',
            },
        },
        {
            name: 'endDate',
            type: 'date',
            label: 'Voting Ends',
            admin: {
                position: 'sidebar',
                description: 'Leave empty for no end date',
            },
        },
        {
            name: 'options',
            type: 'array',
            required: true,
            minRows: 2,
            maxRows: 10,
            label: 'Vote Options',
            fields: [
                {
                    name: 'name',
                    type: 'text',
                    required: true,
                    label: 'Option Name',
                },
                {
                    name: 'description',
                    type: 'text',
                    label: 'Description',
                },
                {
                    name: 'votes',
                    type: 'number',
                    defaultValue: 0,
                    admin: {
                        readOnly: true,
                    },
                },
            ],
        },
        {
            name: 'voters',
            type: 'json',
            defaultValue: {},
            admin: {
                description: 'Map of userId -> optionIndex tracking who voted',
                readOnly: true,
            },
        },
        {
            name: 'totalVotes',
            type: 'number',
            defaultValue: 0,
            admin: {
                readOnly: true,
                position: 'sidebar',
            },
        },
    ],
}
