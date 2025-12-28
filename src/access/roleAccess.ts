import type { Access } from 'payload'

/**
 * Check if user is admin or product_editor
 * Used for create/update access on Products and Categories
 */
export const isEditorOrAdmin: Access = ({ req: { user } }) => {
    if (!user) return false
    const role = (user as { role?: string }).role
    return role === 'admin' || role === 'product_editor'
}

/**
 * Check if user is admin only
 * Used for delete access - product_editors cannot delete
 */
export const isAdmin: Access = ({ req: { user } }) => {
    if (!user) return false
    const role = (user as { role?: string }).role
    const isAdminFlag = (user as { isAdmin?: boolean }).isAdmin
    return role === 'admin' || isAdminFlag === true
}

/**
 * Allow read for everyone (public access)
 */
export const publicRead: Access = () => true
