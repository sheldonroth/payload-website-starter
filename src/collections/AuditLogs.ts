import type { CollectionConfig } from 'payload'

/**
 * Admin Audit Logs Collection
 *
 * Tracks all admin CRUD actions for security and compliance.
 * Automatically populated via global afterChange hooks.
 * Read-only - cannot be created/updated/deleted via admin UI.
 *
 * Different from `audit-log` which tracks AI/system events.
 * This collection specifically tracks admin user actions on any collection.
 */
export const AdminAuditLogs: CollectionConfig = {
    slug: 'admin-audit-logs',
    labels: {
        singular: 'Admin Audit Log',
        plural: 'Admin Audit Logs',
    },
    admin: {
        useAsTitle: 'action',
        defaultColumns: ['action', 'collection', 'adminEmail', 'timestamp', 'documentId'],
        group: 'Admin',
        description: 'Track all admin actions for security and compliance',
    },
    access: {
        // Only admins can read audit logs
        read: ({ req: { user } }) => (user as { role?: string })?.role === 'admin',
        // Audit logs are created programmatically only
        create: () => false,
        update: () => false,
        delete: () => false,
    },
    fields: [
        {
            name: 'action',
            type: 'select',
            required: true,
            options: [
                { label: 'Create', value: 'create' },
                { label: 'Update', value: 'update' },
                { label: 'Delete', value: 'delete' },
                { label: 'Login', value: 'login' },
                { label: 'Logout', value: 'logout' },
                { label: 'Settings Change', value: 'settings_change' },
                { label: 'Bulk Operation', value: 'bulk_operation' },
            ],
            admin: {
                description: 'Type of action performed',
            },
        },
        {
            name: 'collection',
            type: 'text',
            required: true,
            admin: {
                description: 'Collection or global that was affected',
            },
        },
        {
            name: 'documentId',
            type: 'text',
            admin: {
                description: 'ID of the document that was affected',
            },
        },
        {
            name: 'documentTitle',
            type: 'text',
            admin: {
                description: 'Title/name of the document for easy identification',
            },
        },
        {
            name: 'adminUser',
            type: 'relationship',
            relationTo: 'users',
            admin: {
                description: 'User who performed the action',
            },
        },
        {
            name: 'adminEmail',
            type: 'email',
            required: true,
            admin: {
                description: 'Email of the admin who performed the action',
            },
        },
        {
            name: 'changes',
            type: 'json',
            admin: {
                description: 'Array of field changes: [{ field, oldValue, newValue }]',
            },
        },
        {
            name: 'summary',
            type: 'text',
            admin: {
                description: 'Human-readable summary of changes',
            },
        },
        {
            name: 'ipAddress',
            type: 'text',
            admin: {
                description: 'IP address of the request',
            },
        },
        {
            name: 'userAgent',
            type: 'text',
            admin: {
                description: 'Browser/client user agent',
            },
        },
        {
            name: 'timestamp',
            type: 'date',
            required: true,
            defaultValue: () => new Date().toISOString(),
            admin: {
                date: {
                    pickerAppearance: 'dayAndTime',
                },
                description: 'When the action occurred',
            },
        },
    ],
    timestamps: true,
}

export default AdminAuditLogs
