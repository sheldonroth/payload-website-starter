import { PayloadHandler } from 'payload/config'
import type { PayloadRequest } from 'payload/types'

export const voteSubmission: PayloadHandler = async (req: PayloadRequest, res): Promise<void> => {
    const { id } = req.body || {}

    if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' })
        return
    }

    if (!id) {
        res.status(400).json({ error: 'Missing submission ID' })
        return
    }

    try {
        // 1. Get the current submission
        const submission = await req.payload.findByID({
            collection: 'user-submissions',
            id,
        })

        if (!submission) {
            res.status(404).json({ error: 'Submission not found' })
            return
        }

        // 2. Check if user already voted
        const userId = typeof req.user === 'object' ? req.user.id : req.user
        const voters = (submission.voters as number[]) || []

        // Ensure voters is an array of IDs
        if (voters.includes(Number(userId))) {
            res.status(400).json({ error: 'Already voted', code: 'ALREADY_VOTED' })
            return
        }

        // 3. Update the submission
        const updatedSubmission = await req.payload.update({
            collection: 'user-submissions',
            id,
            data: {
                voteCount: (submission.voteCount || 0) + 1,
                voters: [...voters, userId],
            },
            // Bypass access control since we validated the specific action
            overrideAccess: true,
        })

        res.status(200).json({
            success: true,
            voteCount: updatedSubmission.voteCount
        })

    } catch (error) {
        console.error('Vote failed:', error)
        res.status(500).json({ error: 'Internal server error' })
    }
}
