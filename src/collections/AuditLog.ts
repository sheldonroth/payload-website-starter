import type { CollectionConfig } from 'payload'

/**
 * AuditLog Collection
 *
 * Tracks all AI actions, rule applications, and system events.
 * Provides full provenance tracking for compliance and debugging.
 */
export const AuditLog: CollectionConfig = {
    slug: 'audit-log',
    access: {
        read: ({ req }) => !!req.user,
        create: () => true, // System can always create
        update: () => false, // Immutable logs
        delete: ({ req }) => !!(req.user as { isAdmin?: boolean })?.isAdmin,
    },
    admin: {
        useAsTitle: 'action',
        defaultColumns: ['action', 'targetCollection', 'sourceType', 'createdAt'],
        group: 'System',
        description: 'Immutable audit trail of all AI and system actions',
    },
    fields: [
        // === ACTION TYPE ===
        {
            name: 'action',
            type: 'select',
            required: true,
            options: [
                { label: '🤖 AI Product Created', value: 'ai_product_created' },
                { label: '🧪 AI Ingredient Parsed', value: 'ai_ingredient_parsed' },
                { label: '⚖️ AI Verdict Set', value: 'ai_verdict_set' },
                { label: '📋 Rule Applied', value: 'rule_applied' },
                { label: '🔗 Ingredient Cascade', value: 'ingredient_cascade' },
                { label: '✋ Manual Override', value: 'manual_override' },
                { label: '🔄 Product Merged', value: 'product_merged' },
                { label: '📁 Category Created', value: 'category_created' },
                { label: '🖼️ Image Enriched', value: 'image_enriched' },
                { label: '📊 Poll Closed', value: 'poll_closed' },
                { label: '📰 Article Generated', value: 'article_generated' },
                { label: '⚠️ Conflict Detected', value: 'conflict_detected' },
                { label: '🔍 Freshness Check', value: 'freshness_check' },
            ],
            admin: {
                position: 'sidebar',
            },
        },

        // === SOURCE INFO ===
        {
            name: 'sourceType',
            type: 'select',
            options: [
                { label: '📺 YouTube', value: 'youtube' },
                { label: '🎵 TikTok', value: 'tiktok' },
                { label: '🛒 Amazon', value: 'amazon' },
                { label: '🌐 Web URL', value: 'web_url' },
                { label: '📱 Barcode', value: 'barcode' },
                { label: '👤 Manual', value: 'manual' },
                { label: '⚙️ System', value: 'system' },
                { label: '📋 Rule', value: 'rule' },
            ],
            admin: {
                position: 'sidebar',
            },
        },
        {
            name: 'sourceId',
            type: 'text',
            label: 'Source Identifier',
            admin: {
                description: 'Video ID, URL, UPC, or rule ID',
            },
        },
        {
            name: 'sourceUrl',
            type: 'text',
            label: 'Source URL',
        },

        // === TARGET INFO ===
        {
            name: 'targetCollection',
            type: 'select',
            options: [
                { label: 'Products', value: 'products' },
                { label: 'Ingredients', value: 'ingredients' },
                { label: 'Categories', value: 'categories' },
                { label: 'Videos', value: 'videos' },
                { label: 'Articles', value: 'articles' },
                { label: 'Polls', value: 'investigation-polls' },
            ],
        },
        {
            name: 'targetId',
            type: 'number',
            label: 'Target Record ID',
        },
        {
            name: 'targetName',
            type: 'text',
            label: 'Target Name',
            admin: {
                description: 'Human-readable name for quick reference',
            },
        },

        // === CHANGE DATA ===
        {
            name: 'before',
            type: 'json',
            label: 'Before State',
            admin: {
                description: 'State before the action (for updates)',
            },
        },
        {
            name: 'after',
            type: 'json',
            label: 'After State',
            admin: {
                description: 'State after the action',
            },
        },
        {
            name: 'metadata',
            type: 'json',
            label: 'Additional Metadata',
            admin: {
                description: 'Extra context (rule details, AI response, etc.)',
            },
        },

        // === AI INFO ===
        {
            name: 'aiModel',
            type: 'text',
            label: 'AI Model Used',
            admin: {
                description: 'e.g., gemini-2.0-flash',
            },
        },
        {
            name: 'confidence',
            type: 'number',
            min: 0,
            max: 100,
            label: 'Confidence Score',
            admin: {
                description: 'AI confidence percentage if available',
            },
        },

        // === ACTOR ===
        {
            name: 'performedBy',
            type: 'relationship',
            relationTo: 'users',
            label: 'Performed By',
            admin: {
                description: 'User who triggered this action (null for system)',
            },
        },

        // === RESULT ===
        {
            name: 'success',
            type: 'checkbox',
            defaultValue: true,
            admin: {
                position: 'sidebar',
            },
        },
        {
            name: 'errorMessage',
            type: 'text',
            admin: {
                condition: (data) => !data?.success,
            },
        },
    ],
    timestamps: true,
}

/**
 * Helper function to create audit log entries
 */
export async function createAuditLog(
    payload: { create: Function },
    data: {
        action: string
        sourceType?: string
        sourceId?: string
        sourceUrl?: string
        targetCollection?: string
        targetId?: number
        targetName?: string
        before?: Record<string, unknown>
        after?: Record<string, unknown>
        metadata?: Record<string, unknown>
        aiModel?: string
        confidence?: number
        performedBy?: number
        success?: boolean
        errorMessage?: string
    }
): Promise<void> {
    try {
        await payload.create({
            collection: 'audit-log',
            data: {
                ...data,
                success: data.success ?? true,
            },
        })
    } catch (error) {
        // Don't let audit logging failures break the main operation
        console.error('Failed to create audit log:', error)
    }
}
