import type { Access } from 'payload'

export const isSelfOrAdmin: Access = ({ req: { user }, id }) => {
    // Allow admins to do anything
    if (user?.collection === 'users' && user?.isAdmin) {
        return true
    }

    // Allow users to access their own data
    if (user && user.id === id) {
        return true
    }

    // Allow users to read/update if the query specifically targets their own ID
    // This logic is handled by Payload's query constraint capabilities
    if (user) {
        return {
            id: {
                equals: user.id,
            },
        }
    }

    return false
}
