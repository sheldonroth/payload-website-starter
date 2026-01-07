import type { PayloadHandler, PayloadRequest } from 'payload'

// Statuses that allow voting
const VOTEABLE_STATUSES = ['pending', 'reviewing']

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
        // 1. Get the current submission
        const submission = await req.payload.findByID({
            collection: 'user-submissions' as 'users',
            id,
        })

        if (!submission) {
            return Response.json({ error: 'Submission not found' }, { status: 404 })
        }

        // 2. SECURITY: Only allow voting on pending/reviewing submissions
        const submissionStatus = (submission as { status?: string }).status
        if (!submissionStatus || !VOTEABLE_STATUSES.includes(submissionStatus)) {
            return Response.json({
                error: 'Voting is only allowed on pending submissions',
                code: 'NOT_VOTEABLE'
            }, { status: 403 })
        }

        // 3. Check if user already voted
        const userId = typeof req.user === 'object' ? (req.user as { id: number }).id : req.user
        const voters = ((submission as { voters?: number[] }).voters || []) as number[]

        // Ensure voters is an array of IDs
        if (voters.includes(Number(userId))) {
            return Response.json({ error: 'Already voted', code: 'ALREADY_VOTED' }, { status: 400 })
        }

        // 4. Update the submission (removed overrideAccess for security)
        const updatedSubmission = await req.payload.update({
            collection: 'user-submissions' as 'users',
            id,
            data: {
                voteCount: ((submission as { voteCount?: number }).voteCount || 0) + 1,
                voters: [...voters, userId],
            } as Record<string, unknown>,
            // Use req context for proper access control instead of overrideAccess
            req,
        })

        return Response.json({
            success: true,
            voteCount: (updatedSubmission as { voteCount?: number }).voteCount
        })

    } catch (error) {
        console.error('Vote failed:', error)
        return Response.json({ error: 'Internal server error' }, { status: 500 })
    }
}
