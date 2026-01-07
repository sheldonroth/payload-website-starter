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
        // SECURITY: Only admins can read audit logs (contains sensitive operations)
        read: ({ req }) => {
            if (!req.user) return false
            const role = (req.user as { role?: string }).role
            const isAdminFlag = (req.user as { isAdmin?: boolean }).isAdmin
            return role === 'admin' || isAdminFlag === true
        },
        // SECURITY: Only allow internal system creates (not from API)
        create: ({ req }) => {
            // Allow if called internally (no user context or admin user)
            if (!req.user) return true // System calls
            const role = (req.user as { role?: string }).role
            return role === 'admin'
        },
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
                { label: '📝 AI Draft Created', value: 'ai_draft_created' },
                { label: '❌ Error', value: 'error' },
                // Subscription events
                { label: '💳 Subscription Started', value: 'subscription_started' },
                { label: '🔄 Subscription Renewed', value: 'subscription_renewed' },
                { label: '❌ Subscription Cancelled', value: 'subscription_cancelled' },
                { label: '⏸️ Subscription Paused', value: 'subscription_paused' },
                { label: '⚠️ Billing Issue', value: 'billing_issue' },
                { label: '🎁 Trial Started', value: 'trial_started' },
                { label: '✅ Trial Converted', value: 'trial_converted' },
                // Sentry alert events
                { label: '🔴 Sentry Issue Created', value: 'sentry_issue_created' },
                { label: '🟢 Sentry Issue Resolved', value: 'sentry_issue_resolved' },
                { label: '📈 Sentry Spike Alert', value: 'sentry_spike_alert' },
                { label: '🔁 Sentry Regression Alert', value: 'sentry_regression_alert' },
                { label: '🔥 Sentry Critical Alert', value: 'sentry_critical_alert' },
                // Cron job events
                { label: '⏰ Cron Execution', value: 'cron_execution' },
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
                { label: '💰 RevenueCat', value: 'revenuecat' },
                { label: '🐛 Sentry', value: 'sentry' },
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
                { label: 'User Submissions', value: 'user-submissions' },
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

        // === RETRY CAPABILITY ===
        {
            name: 'retryable',
            type: 'checkbox',
            defaultValue: false,
            label: 'Can Retry',
            admin: {
                position: 'sidebar',
                description: 'Whether this error can be retried',
                condition: (data) => data?.action === 'error',
            },
        },
        {
            name: 'retryEndpoint',
            type: 'text',
            label: 'Retry Endpoint',
            admin: {
                description: 'API endpoint to call for retry',
                condition: (data) => data?.retryable,
            },
        },
        {
            name: 'retryPayload',
            type: 'json',
            label: 'Retry Payload',
            admin: {
                description: 'Data to send when retrying',
                condition: (data) => data?.retryable,
            },
        },
        {
            name: 'retryCount',
            type: 'number',
            defaultValue: 0,
            label: 'Retry Attempts',
            admin: {
                description: 'Number of retry attempts made',
                condition: (data) => data?.retryable,
            },
        },
        {
            name: 'resolvedAt',
            type: 'date',
            label: 'Resolved At',
            admin: {
                description: 'When this error was resolved',
                condition: (data) => data?.action === 'error',
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
        // Retry capability fields
        retryable?: boolean
        retryEndpoint?: string
        retryPayload?: Record<string, unknown>
    }
): Promise<void> {
    try {
        await payload.create({
            collection: 'audit-log',
            data: {
                ...data,
                success: data.success ?? true,
                retryable: data.retryable ?? false,
            },
        })
    } catch (error) {
        // Don't let audit logging failures break the main operation
        console.error('Failed to create audit log:', error)
    }
}
