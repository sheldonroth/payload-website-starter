import type {
    CollectionAfterChangeHook,
    CollectionAfterDeleteHook,
    GlobalAfterChangeHook,
    PayloadRequest,
    Payload,
} from 'payload'

/**
 * Calculate the differences between two objects
 * Returns an array of { field, oldValue, newValue }
 */
function calculateChanges(
    oldDoc: Record<string, unknown> | null | undefined,
    newDoc: Record<string, unknown>,
    fieldsToIgnore: string[] = ['updatedAt', 'createdAt', '_status', 'version']
): Array<{ field: string; oldValue: unknown; newValue: unknown }> {
    const changes: Array<{ field: string; oldValue: unknown; newValue: unknown }> = []

    if (!oldDoc) {
        // For create operations, just note the new values for key fields
        const keyFields = ['name', 'title', 'slug', 'email', 'status', 'isActive']
        for (const key of keyFields) {
            if (newDoc[key] !== undefined) {
                changes.push({
                    field: key,
                    oldValue: null,
                    newValue: newDoc[key],
                })
            }
        }
        return changes
    }

    // Compare all keys
    const allKeys = new Set([...Object.keys(oldDoc), ...Object.keys(newDoc)])

    for (const key of allKeys) {
        if (fieldsToIgnore.includes(key)) continue

        const oldValue = oldDoc[key]
        const newValue = newDoc[key]

        // Skip if values are the same (simple comparison)
        if (JSON.stringify(oldValue) === JSON.stringify(newValue)) continue

        // Truncate large values for readability
        const truncate = (val: unknown): unknown => {
            if (typeof val === 'string' && val.length > 200) {
                return val.substring(0, 200) + '...'
            }
            if (Array.isArray(val) && val.length > 10) {
                return `[Array of ${val.length} items]`
            }
            if (typeof val === 'object' && val !== null) {
                const str = JSON.stringify(val)
                if (str.length > 200) {
                    return '[Complex Object]'
                }
            }
            return val
        }

        changes.push({
            field: key,
            oldValue: truncate(oldValue),
            newValue: truncate(newValue),
        })
    }

    return changes
}

/**
 * Generate a human-readable summary of changes
 */
function generateSummary(
    action: string,
    changes: Array<{ field: string; oldValue: unknown; newValue: unknown }>
): string {
    if (action === 'create') {
        return 'Created new document'
    }
    if (action === 'delete') {
        return 'Deleted document'
    }
    if (changes.length === 0) {
        return 'No significant changes detected'
    }
    if (changes.length <= 3) {
        return `Updated: ${changes.map((c) => c.field).join(', ')}`
    }
    return `Updated ${changes.length} fields`
}

/**
 * Extract IP address from request
 */
function getIpAddress(req: PayloadRequest): string | undefined {
    const forwarded = req.headers?.get?.('x-forwarded-for')
    if (forwarded) {
        return typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : undefined
    }
    return undefined
}

/**
 * Extract user agent from request
 */
function getUserAgent(req: PayloadRequest): string | undefined {
    return req.headers?.get?.('user-agent') || undefined
}

/**
 * Collections to exclude from audit logging
 */
const EXCLUDED_COLLECTIONS = [
    'admin-audit-logs', // Don't audit the admin audit log itself
    'audit-log', // Don't audit the system audit log
    'payload-locked-documents',
    'payload-preferences',
    'payload-migrations',
    'search-queries', // High volume, not useful to audit
    'notification-sends', // High volume notification tracking
]

/**
 * Create audit log entry - bypasses TypeScript strict checking
 * Types will be fully available after build regenerates payload-types.ts
 */
async function createAdminAuditLog(
    payload: Payload,
    data: {
        action: string
        collection: string
        documentId?: string
        documentTitle?: string
        adminUser?: string | number
        adminEmail: string
        changes?: unknown
        summary?: string
        ipAddress?: string
        userAgent?: string
        timestamp: string
    }
): Promise<void> {
    try {
        // Use dynamic access to bypass strict type checking
        // The collection exists but types haven't been regenerated yet
        const createFn = payload.create.bind(payload)
        await createFn({
            collection: 'admin-audit-logs' as any,
            data: data as any,
        })
    } catch (error) {
        console.error('[AuditLog] Failed to create audit log entry:', error)
    }
}

/**
 * Create an afterChange hook that logs to admin-audit-logs collection
 */
export const createAuditLogHook = (collectionSlug: string): CollectionAfterChangeHook => {
    return async ({ doc, previousDoc, operation, req }) => {
        // Skip if this collection should not be audited
        if (EXCLUDED_COLLECTIONS.includes(collectionSlug)) {
            return doc
        }

        // Only log actions by authenticated admin users
        const user = req.user as { id?: string | number; email?: string; role?: string } | null
        if (!user || user.role !== 'admin') {
            return doc
        }

        const changes = calculateChanges(
            previousDoc as Record<string, unknown> | undefined,
            doc as Record<string, unknown>
        )

        // Get document title for easier identification
        const docRecord = doc as Record<string, unknown>
        const documentTitle =
            (docRecord.name as string) ||
            (docRecord.title as string) ||
            (docRecord.slug as string) ||
            (docRecord.email as string) ||
            undefined

        await createAdminAuditLog(req.payload, {
            action: operation,
            collection: collectionSlug,
            documentId: String(docRecord.id),
            documentTitle,
            adminUser: user.id,
            adminEmail: user.email || 'unknown',
            changes,
            summary: generateSummary(operation, changes),
            ipAddress: getIpAddress(req),
            userAgent: getUserAgent(req),
            timestamp: new Date().toISOString(),
        })

        return doc
    }
}

/**
 * Create an afterDelete hook that logs deletions to admin-audit-logs
 */
export const createAuditDeleteHook = (collectionSlug: string): CollectionAfterDeleteHook => {
    return async ({ doc, req }) => {
        // Skip if this collection should not be audited
        if (EXCLUDED_COLLECTIONS.includes(collectionSlug)) {
            return doc
        }

        // Only log actions by authenticated admin users
        const user = req.user as { id?: string | number; email?: string; role?: string } | null
        if (!user || user.role !== 'admin') {
            return doc
        }

        const docRecord = doc as Record<string, unknown>
        const documentTitle =
            (docRecord.name as string) ||
            (docRecord.title as string) ||
            (docRecord.slug as string) ||
            (docRecord.email as string) ||
            undefined

        await createAdminAuditLog(req.payload, {
            action: 'delete',
            collection: collectionSlug,
            documentId: String(docRecord.id),
            documentTitle,
            adminUser: user.id,
            adminEmail: user.email || 'unknown',
            changes: [],
            summary: `Deleted: ${documentTitle || docRecord.id}`,
            ipAddress: getIpAddress(req),
            userAgent: getUserAgent(req),
            timestamp: new Date().toISOString(),
        })

        return doc
    }
}

/**
 * Create an afterChange hook for globals
 */
export const createGlobalAuditHook = (globalSlug: string): GlobalAfterChangeHook => {
    return async ({ doc, previousDoc, req }) => {
        // Only log actions by authenticated admin users
        const user = req.user as { id?: string | number; email?: string; role?: string } | null
        if (!user || user.role !== 'admin') {
            return doc
        }

        const changes = calculateChanges(
            previousDoc as Record<string, unknown> | undefined,
            doc as Record<string, unknown>
        )

        // Skip if no actual changes
        if (changes.length === 0) {
            return doc
        }

        await createAdminAuditLog(req.payload, {
            action: 'settings_change',
            collection: globalSlug,
            documentId: globalSlug,
            documentTitle: globalSlug,
            adminUser: user.id,
            adminEmail: user.email || 'unknown',
            changes,
            summary: generateSummary('update', changes),
            ipAddress: getIpAddress(req),
            userAgent: getUserAgent(req),
            timestamp: new Date().toISOString(),
        })

        return doc
    }
}
