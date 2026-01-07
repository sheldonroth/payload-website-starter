import type { PayloadHandler } from 'payload'
import { goneError } from '../utilities/api-response'

/**
 * User Ingredient Watchlist Endpoints
 *
 * NOTE: Disabled - Ingredients collection has been archived.
 * All endpoints return 410 Gone status.
 *
 * @openapi
 * /user/watchlist:
 *   get:
 *     summary: Get user's ingredient watchlist (DISABLED)
 *     description: |
 *       This feature has been disabled. The Ingredients collection has been archived.
 *       All requests will receive a 410 Gone status.
 *     tags: [User, Watchlist]
 *     deprecated: true
 *     responses:
 *       410:
 *         description: Feature has been disabled
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Ingredient watchlist feature has been disabled"
 *   post:
 *     summary: Add ingredient to watchlist (DISABLED)
 *     description: |
 *       This feature has been disabled. The Ingredients collection has been archived.
 *       All requests will receive a 410 Gone status.
 *     tags: [User, Watchlist]
 *     deprecated: true
 *     responses:
 *       410:
 *         description: Feature has been disabled
 *   delete:
 *     summary: Remove ingredient from watchlist (DISABLED)
 *     description: |
 *       This feature has been disabled. The Ingredients collection has been archived.
 *       All requests will receive a 410 Gone status.
 *     tags: [User, Watchlist]
 *     deprecated: true
 *     responses:
 *       410:
 *         description: Feature has been disabled
 *
 * @openapi
 * /user/watchlist/check-conflicts:
 *   post:
 *     summary: Check product for watchlist conflicts (DISABLED)
 *     description: |
 *       This feature has been disabled. The Ingredients collection has been archived.
 *       All requests will receive a 410 Gone status.
 *     tags: [User, Watchlist]
 *     deprecated: true
 *     responses:
 *       410:
 *         description: Feature has been disabled
 */

const disabledResponse = () => goneError('Ingredient watchlist feature has been disabled')

export const userWatchlistGetHandler: PayloadHandler = async () => disabledResponse()
export const userWatchlistAddHandler: PayloadHandler = async () => disabledResponse()
export const userWatchlistRemoveHandler: PayloadHandler = async () => disabledResponse()
export const checkWatchlistConflictsHandler: PayloadHandler = async () => disabledResponse()
