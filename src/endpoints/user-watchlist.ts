import type { PayloadHandler } from 'payload'

/**
 * User Ingredient Watchlist Endpoints
 *
 * NOTE: Disabled - Ingredients collection has been archived.
 * All endpoints return 410 Gone status.
 */

const disabledResponse = () => Response.json(
    { error: 'Ingredient watchlist feature has been disabled' },
    { status: 410 }
)

export const userWatchlistGetHandler: PayloadHandler = async () => disabledResponse()
export const userWatchlistAddHandler: PayloadHandler = async () => disabledResponse()
export const userWatchlistRemoveHandler: PayloadHandler = async () => disabledResponse()
export const checkWatchlistConflictsHandler: PayloadHandler = async () => disabledResponse()
