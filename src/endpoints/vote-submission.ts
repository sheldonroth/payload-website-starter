import type { PayloadHandler, PayloadRequest } from 'payload'

export const voteSubmissionHandler: PayloadHandler = async (req: PayloadRequest) => {
    const body = await req.json?.() || {}
    const { id } = body

    if (!req.user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!id) {
        return Response.json({ error: 'Missing submission ID' }, { status: 400 })
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

        // 2. Check if user already voted
        const userId = typeof req.user === 'object' ? (req.user as { id: number }).id : req.user
        const voters = ((submission as { voters?: number[] }).voters || []) as number[]

        // Ensure voters is an array of IDs
        if (voters.includes(Number(userId))) {
            return Response.json({ error: 'Already voted', code: 'ALREADY_VOTED' }, { status: 400 })
        }

        // 3. Update the submission
        const updatedSubmission = await req.payload.update({
            collection: 'user-submissions' as 'users',
            id,
            data: {
                voteCount: ((submission as { voteCount?: number }).voteCount || 0) + 1,
                voters: [...voters, userId],
            } as Record<string, unknown>,
            // Bypass access control since we validated the specific action
            overrideAccess: true,
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
