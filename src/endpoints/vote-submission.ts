import type { PayloadHandler, PayloadRequest } from 'payload'
import { atomicVoteUpdate } from '../utilities/atomic-operations'

// Statuses that allow voting
const VOTEABLE_STATUSES = ['pending', 'reviewing']

// Note: MAX_RETRIES and RETRY_DELAY_MS are handled by atomicVoteUpdate utility

/**
 * Vote Submission Handler
 *
 * Allows users to vote on user submissions. Uses atomic operations
 * with retry logic to prevent race conditions when multiple users
 * vote on the same submission simultaneously.
 *
 * Race Condition Fix:
 * - Previous implementation read voteCount, then wrote voteCount + 1
 * - If two requests interleaved, one vote would be lost
 * - Now uses atomicVoteUpdate with retry logic on conflict
 */
export const voteSubmissionHandler: PayloadHandler = async (req: PayloadRequest) => {
    const body = await req.json?.() || {}
    const { id } = body

    if (!req.user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!id) {
        return Response.json({ error: 'Missing submission ID' }, { status: 400 })
    }

    // Validate ID format to prevent injection
    if (typeof id !== 'number' && typeof id !== 'string') {
        return Response.json({ error: 'Invalid submission ID format' }, { status: 400 })
    }

    try {
        // Get user ID for voting
        const userId = typeof req.user === 'object' ? (req.user as { id: number }).id : req.user

        // First, verify the submission exists and is voteable
        // This is a quick check before attempting the atomic update
        const submission = await req.payload.findByID({
            collection: 'user-submissions' as 'users',
            id,
        })

        if (!submission) {
            return Response.json({ error: 'Submission not found' }, { status: 404 })
        }

        // SECURITY: Only allow voting on pending/reviewing submissions
        const submissionStatus = (submission as { status?: string }).status
        if (!submissionStatus || !VOTEABLE_STATUSES.includes(submissionStatus)) {
            return Response.json({
                error: 'Voting is only allowed on pending submissions',
                code: 'NOT_VOTEABLE'
            }, { status: 403 })
        }

        // Use atomic vote update to prevent race conditions
        // This handles the read-check-update cycle with retry logic
        const result = await atomicVoteUpdate(
            req.payload,
            {
                collection: 'user-submissions',
                id,
                voterId: Number(userId),
                voterField: 'voters',
                countField: 'voteCount',
                req,
            }
        )

        if (!result.success) {
            if (result.error === 'Document not found') {
                return Response.json({ error: 'Submission not found' }, { status: 404 })
            }
            console.error('[vote-submission] Atomic update failed:', result.error)
            return Response.json({ error: 'Vote failed due to concurrent update' }, { status: 500 })
        }

        // If user already voted, the atomic update will return isNewVoter = false
        if (!result.isNewVoter) {
            return Response.json({ error: 'Already voted', code: 'ALREADY_VOTED' }, { status: 400 })
        }

        return Response.json({
            success: true,
            voteCount: result.newCount
        })

    } catch (error) {
        console.error('Vote failed:', error)
        return Response.json({ error: 'Internal server error' }, { status: 500 })
    }
}
