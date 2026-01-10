import type { CollectionConfig } from 'payload'
import { createAuditLogHook, createAuditDeleteHook } from '../hooks/auditLog'

/**
 * ProductVotes Collection
 *
 * "Proof of Possession" voting system for untested products.
 *
 * When a user scans a product we don't have, they're casting a "vote"
 * that says "I actually own this product and want it tested."
 *
 * Weighted Voting System:
 * - Search = 1x weight (curiosity signal)
 * - Scan = 5x weight (proof of possession)
 * - Member Scan = 20x weight (premium verified possession)
 *
 * When votes reach threshold, product is queued for lab testing.
 */
export const ProductVotes: CollectionConfig = {
    slug: 'product-votes',
    access: {
        read: () => true,
        create: () => true, // API creates votes
        update: ({ req }) => !!req.user, // Admin only
        delete: ({ req }) => !!req.user, // Admin only
    },
    admin: {
        useAsTitle: 'barcode',
        defaultColumns: ['barcode', 'productName', 'urgencyFlag', 'scansLast24h', 'fundingProgress', 'status', 'updatedAt'],
        group: 'Community',
        description: 'Product testing votes from barcode scans (Proof of Possession)',
    },
    hooks: {
        beforeChange: [
            async ({ data, originalDoc, operation }) => {
                // Only process updates where status changed
                if (operation !== 'update' || !originalDoc || !data) return data

                const previousStatus = originalDoc.status
                const newStatus = data.status

                // If status changed, add to status history
                if (newStatus && previousStatus !== newStatus) {
                    const statusHistory = data.statusHistory || originalDoc.statusHistory || []
                    statusHistory.push({
                        status: newStatus,
                        changedAt: new Date().toISOString(),
                    })
                    data.statusHistory = statusHistory

                    // Set thresholdReachedAt if reaching threshold
                    if (newStatus === 'threshold_reached' && !originalDoc.thresholdReachedAt) {
                        data.thresholdReachedAt = new Date().toISOString()
                    }
                }

                return data
            },
        ],
        afterChange: [
            createAuditLogHook('product-votes'),
            async ({ doc, previousDoc, req, operation }) => {
                // Only process updates where status changed to 'complete'
                if (operation !== 'update' || !previousDoc) return doc

                const previousStatus = previousDoc.status
                const newStatus = doc.status

                // Send completion notifications when status changes to complete
                if (newStatus === 'complete' && previousStatus !== 'complete') {
                    // Check if notification already sent
                    if (doc.notificationsSent?.resultsReady) {
                        return doc
                    }

                    try {
                        // Find all push tokens subscribed to this barcode
                        const { docs: tokens } = await req.payload.find({
                            collection: 'push-tokens',
                            where: {
                                and: [
                                    { isActive: { equals: true } },
                                    { 'productSubscriptions.barcode': { equals: doc.barcode } },
                                ],
                            },
                            limit: 1000,
                        })

                        if (tokens.length > 0) {
                            console.log(`[ProductVotes] Sending completion notifications for ${doc.barcode} to ${tokens.length} subscribers`)

                            // Import push library dynamically to avoid circular deps
                            const { sendPushNotificationBatch, createResultsReadyNotification } = await import('../lib/push')

                            // Get linked product score if available
                            let score = 0
                            if (doc.linkedProduct) {
                                const linkedProductId = typeof doc.linkedProduct === 'object' ? doc.linkedProduct.id : doc.linkedProduct
                                try {
                                    const product = await req.payload.findByID({
                                        collection: 'products',
                                        id: linkedProductId,
                                    })
                                    score = (product as { overallScore?: number }).overallScore || 0
                                } catch {
                                    // Product not found, use 0
                                }
                            }

                            // Build notification messages
                            const messages = tokens.map((token) =>
                                createResultsReadyNotification(
                                    (token as { token: string }).token,
                                    doc.productName || 'Your product',
                                    score,
                                    doc.barcode,
                                    doc.linkedProduct ? String(typeof doc.linkedProduct === 'object' ? doc.linkedProduct.id : doc.linkedProduct) : undefined
                                )
                            )

                            // Send notifications
                            await sendPushNotificationBatch(messages)

                            // Mark as notified
                            await req.payload.update({
                                collection: 'product-votes',
                                id: doc.id,
                                data: {
                                    notificationsSent: {
                                        ...doc.notificationsSent,
                                        resultsReady: true,
                                    },
                                } as any,
                            })

                            console.log(`[ProductVotes] Sent ${messages.length} completion notifications for ${doc.barcode}`)
                        }
                    } catch (error) {
                        console.error('[ProductVotes] Error sending completion notifications:', error)
                    }
                }

                return doc
            },
        ],
    },
    fields: [
        // === PRODUCT IDENTIFICATION ===
        {
            name: 'barcode',
            type: 'text',
            required: true,
            unique: true,
            index: true,
            admin: {
                description: 'UPC/EAN barcode of the product',
            },
        },
        {
            name: 'productName',
            type: 'text',
            admin: {
                description: 'Product name (if known from Open Food Facts or user submission)',
            },
        },
        {
            name: 'brand',
            type: 'text',
            admin: {
                description: 'Brand name (if known)',
            },
        },
        {
            name: 'imageUrl',
            type: 'text',
            admin: {
                description: 'Product image URL (if available from external source)',
            },
        },

        // === VOTING METRICS ===
        {
            name: 'totalWeightedVotes',
            type: 'number',
            required: true,
            defaultValue: 0,
            index: true,
            admin: {
                description: 'Total weighted vote score (Search=1x, Scan=5x, Member=20x)',
            },
        },
        {
            name: 'searchCount',
            type: 'number',
            defaultValue: 0,
            admin: {
                description: 'Number of text searches for this product',
            },
        },
        {
            name: 'scanCount',
            type: 'number',
            defaultValue: 0,
            admin: {
                description: 'Number of barcode scans (non-member)',
            },
        },
        {
            name: 'memberScanCount',
            type: 'number',
            defaultValue: 0,
            admin: {
                description: 'Number of barcode scans by members',
            },
        },
        {
            name: 'uniqueVoters',
            type: 'number',
            defaultValue: 0,
            admin: {
                description: 'Count of unique devices/users who voted',
            },
        },

        // === FUNDING PROGRESS ===
        {
            name: 'fundingThreshold',
            type: 'number',
            defaultValue: 1000,
            admin: {
                description: 'Weighted vote threshold to trigger lab testing',
            },
        },
        {
            name: 'fundingProgress',
            type: 'number',
            defaultValue: 0,
            admin: {
                description: 'Percentage progress toward testing threshold (0-100)',
                readOnly: true,
            },
            hooks: {
                beforeChange: [
                    ({ siblingData }) => {
                        const total = siblingData?.totalWeightedVotes || 0
                        const threshold = siblingData?.fundingThreshold || 1000
                        return Math.min(100, Math.round((total / threshold) * 100))
                    },
                ],
            },
        },

        // === STATUS ===
        {
            name: 'status',
            type: 'select',
            required: true,
            defaultValue: 'collecting_votes',
            index: true,
            options: [
                { label: 'Collecting Votes', value: 'collecting_votes' },
                { label: 'Threshold Reached', value: 'threshold_reached' },
                { label: 'Queued for Testing', value: 'queued' },
                { label: 'Sourcing Product', value: 'sourcing' },
                { label: 'In Lab Testing', value: 'testing' },
                { label: 'Results Review', value: 'results_review' },
                { label: 'Testing Complete', value: 'complete' },
            ],
            admin: {
                position: 'sidebar',
            },
        },
        {
            name: 'thresholdReachedAt',
            type: 'date',
            admin: {
                position: 'sidebar',
                description: 'When the voting threshold was reached',
            },
        },
        {
            name: 'queuePosition',
            type: 'number',
            admin: {
                position: 'sidebar',
                description: 'Position in the testing queue (1 = next up)',
            },
        },
        {
            name: 'estimatedCompletionDate',
            type: 'date',
            admin: {
                position: 'sidebar',
                description: 'Estimated date when testing will be complete',
            },
        },

        // === STATUS TIMELINE ===
        {
            name: 'statusHistory',
            type: 'array',
            admin: {
                description: 'History of status changes with timestamps',
            },
            fields: [
                {
                    name: 'status',
                    type: 'select',
                    required: true,
                    options: [
                        { label: 'Collecting Votes', value: 'collecting_votes' },
                        { label: 'Threshold Reached', value: 'threshold_reached' },
                        { label: 'Queued for Testing', value: 'queued' },
                        { label: 'Sourcing Product', value: 'sourcing' },
                        { label: 'In Lab Testing', value: 'testing' },
                        { label: 'Results Review', value: 'results_review' },
                        { label: 'Testing Complete', value: 'complete' },
                    ],
                },
                {
                    name: 'changedAt',
                    type: 'date',
                    required: true,
                    defaultValue: () => new Date().toISOString(),
                },
                {
                    name: 'notes',
                    type: 'text',
                    admin: {
                        description: 'Optional notes about this status change',
                    },
                },
            ],
        },

        // === NOTIFICATION TRACKING ===
        {
            name: 'notificationsSent',
            type: 'group',
            admin: {
                description: 'Track which notifications have been sent',
            },
            fields: [
                {
                    name: 'thresholdReached',
                    type: 'checkbox',
                    defaultValue: false,
                },
                {
                    name: 'testingStarted',
                    type: 'checkbox',
                    defaultValue: false,
                },
                {
                    name: 'resultsReady',
                    type: 'checkbox',
                    defaultValue: false,
                },
            ],
        },

        // === LINKED PRODUCT (when testing complete) ===
        {
            name: 'linkedProduct',
            type: 'relationship',
            relationTo: 'products',
            admin: {
                description: 'The tested product (set when testing is complete)',
                condition: (data) => data?.status === 'complete',
            },
        },

        // === VOTER TRACKING (for unique voter counting & notifications) ===
        {
            name: 'voterFingerprints',
            type: 'json',
            defaultValue: [],
            admin: {
                description: 'Array of device fingerprints who voted (for uniqueness)',
                position: 'sidebar',
            },
        },
        {
            name: 'photoContributors',
            type: 'json',
            defaultValue: [],
            admin: {
                description: 'Users who added photos to this request (bounty votes +10x). Structure: [{ fingerprintId, userId?, submissionId, contributedAt, bonusWeight: 10 }]',
            },
        },
        {
            name: 'totalContributors',
            type: 'number',
            defaultValue: 0,
            admin: {
                description: 'Count of users who contributed photos (bounty voters)',
            },
        },
        {
            name: 'notifyOnComplete',
            type: 'json',
            defaultValue: [],
            admin: {
                description: 'Array of user IDs/emails to notify when testing completes',
            },
        },

        // === CASE ATTRIBUTION ===
        // Who documented this product first? Who else helped?
        // This is the heart of the My Cases recognition system.
        {
            name: 'firstScout',
            type: 'relationship',
            relationTo: 'contributor-profiles',
            admin: {
                description: 'The first contributor to open this case',
                readOnly: true,
            },
        },
        {
            name: 'firstScoutNumber',
            type: 'number',
            admin: {
                description: 'Contributor number of the first documenter (for display)',
                readOnly: true,
            },
        },
        {
            name: 'scoutContributors',
            type: 'json',
            defaultValue: [],
            admin: {
                description: 'All contributors who documented this. Structure: [{ scoutId, scoutNumber, fingerprintHash, scoutPosition, contributedAt }]',
            },
        },
        {
            name: 'totalScouts',
            type: 'number',
            defaultValue: 0,
            admin: {
                description: 'Total number of contributors who documented this product',
                readOnly: true,
            },
        },

        // === EXTERNAL DATA ===
        {
            name: 'openFoodFactsData',
            type: 'json',
            admin: {
                description: 'Cached data from Open Food Facts API',
                condition: (data) => !!data?.openFoodFactsData,
            },
        },

        // === RANKING ===
        {
            name: 'rank',
            type: 'number',
            admin: {
                description: 'Current rank in the voting queue (1 = most wanted)',
                position: 'sidebar',
                readOnly: true,
            },
        },

        // === VELOCITY TRACKING (My Cases) ===
        // Tracks scan momentum for prioritization - trending products get tested faster
        {
            name: 'scanTimestamps',
            type: 'json',
            defaultValue: [],
            admin: {
                // Hidden from admin - internal use only
                condition: () => false,
            },
        },
        {
            name: 'scansLast24h',
            type: 'number',
            defaultValue: 0,
            admin: {
                description: 'Scans in the last 24 hours',
                readOnly: true,
            },
        },
        {
            name: 'scansLast7d',
            type: 'number',
            defaultValue: 0,
            admin: {
                description: 'Scans in the last 7 days',
                readOnly: true,
            },
        },
        {
            name: 'velocityScore',
            type: 'number',
            defaultValue: 0,
            index: true,
            admin: {
                description: 'Auto-calculated priority score: (24h × 5) + 7d + weighted votes',
                readOnly: true,
            },
        },
        {
            name: 'urgencyFlag',
            type: 'select',
            defaultValue: 'normal',
            index: true,
            options: [
                { label: '🟢 Normal', value: 'normal' },
                { label: '🔥 Trending', value: 'trending' },
                { label: '🚨 Urgent', value: 'urgent' },
            ],
            admin: {
                description: 'Auto-set based on velocity: Trending (20+ 24h / 100+ 7d), Urgent (100+ 24h / 500+ 7d)',
                readOnly: true,
                position: 'sidebar',
            },
        },

        // === NOTIFICATION TRACKING ===
        {
            name: 'lastTrendingNotification',
            type: 'date',
            admin: {
                description: 'Last time trending notifications were sent for this product',
                readOnly: true,
                condition: () => false, // Hidden from admin
            },
        },
        {
            name: 'previousQueuePosition',
            type: 'number',
            admin: {
                description: 'Queue position at last notification (for calculating jump)',
                readOnly: true,
                condition: () => false, // Hidden from admin
            },
        },
    ],
    timestamps: true,
}
