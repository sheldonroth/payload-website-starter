import { PayloadHandler } from 'payload'

/**
 * Poll Voting Endpoint
 * POST /api/polls/vote
 *
 * Allows users to vote on investigation polls.
 * Prevents duplicate votes via userId (logged in) or fingerprintHash (anonymous).
 */

interface VoteRequest {
  pollId: number
  optionIndex: number
  fingerprintHash?: string // For anonymous voting
}

export const pollVoteHandler: PayloadHandler = async (req) => {
  try {
    const body = await req.json?.() as VoteRequest | undefined

    if (!body?.pollId || body.optionIndex === undefined) {
      return Response.json(
        { error: 'pollId and optionIndex are required' },
        { status: 400 }
      )
    }

    const { pollId, optionIndex, fingerprintHash } = body

    // Get voter identifier (userId for logged in, fingerprint for anonymous)
    const user = req.user as { id?: number } | undefined
    const voterId = user?.id ? `user_${user.id}` : fingerprintHash ? `fp_${fingerprintHash}` : null

    if (!voterId) {
      return Response.json(
        { error: 'Must be logged in or provide fingerprintHash to vote' },
        { status: 401 }
      )
    }

    // Fetch the poll
    const poll = await req.payload.findByID({
      collection: 'investigation-polls',
      id: pollId,
    })

    if (!poll) {
      return Response.json(
        { error: 'Poll not found' },
        { status: 404 }
      )
    }

    // Check if poll is active
    if (poll.status !== 'active') {
      return Response.json(
        { error: 'This poll is closed and no longer accepting votes' },
        { status: 400 }
      )
    }

    // Check if poll has ended
    if (poll.endDate && new Date(poll.endDate) < new Date()) {
      return Response.json(
        { error: 'This poll has ended' },
        { status: 400 }
      )
    }

    // Check if option index is valid
    const options = (poll.options || []) as Array<{
      id?: string
      name: string
      description?: string
      votes: number
    }>

    if (optionIndex < 0 || optionIndex >= options.length) {
      return Response.json(
        { error: 'Invalid option index' },
        { status: 400 }
      )
    }

    // Check if user already voted
    const voters = (poll.voters || {}) as Record<string, number>

    if (voters[voterId] !== undefined) {
      const previousVote = voters[voterId]
      return Response.json({
        success: false,
        error: 'You have already voted on this poll',
        previousVote: previousVote,
        votedFor: options[previousVote]?.name,
        poll: {
          id: poll.id,
          title: poll.title,
          options: options.map(o => ({ name: o.name, votes: o.votes })),
          totalVotes: poll.totalVotes,
        },
      }, { status: 400 })
    }

    // Record the vote
    const updatedOptions = options.map((option, idx) => ({
      ...option,
      votes: idx === optionIndex ? (option.votes || 0) + 1 : option.votes || 0,
    }))

    const updatedVoters = {
      ...voters,
      [voterId]: optionIndex,
    }

    const updatedTotalVotes = ((poll.totalVotes as number) || 0) + 1

    // Update the poll
    const updatedPoll = await req.payload.update({
      collection: 'investigation-polls',
      id: pollId,
      data: {
        options: updatedOptions,
        voters: updatedVoters,
        totalVotes: updatedTotalVotes,
      },
    })

    console.log(`[Poll Vote] ${voterId} voted for option ${optionIndex} on poll ${pollId}`)

    return Response.json({
      success: true,
      message: `Vote recorded for "${options[optionIndex].name}"`,
      poll: {
        id: updatedPoll.id,
        title: updatedPoll.title,
        options: updatedOptions.map(o => ({ name: o.name, votes: o.votes })),
        totalVotes: updatedTotalVotes,
      },
    })

  } catch (error) {
    console.error('[Poll Vote] Error:', error)
    return Response.json(
      { error: 'Failed to record vote' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/polls/active
 *
 * Returns all active polls for the frontend to display.
 */
export const pollsActiveHandler: PayloadHandler = async (req) => {
  try {
    const polls = await req.payload.find({
      collection: 'investigation-polls',
      where: {
        status: { equals: 'active' },
      },
      sort: '-createdAt',
      limit: 10,
    })

    // Get voter identifier to check if user already voted
    const user = req.user as { id?: number } | undefined
    const url = new URL(req.url || '', 'http://localhost')
    const fingerprintHash = url.searchParams.get('fingerprint')
    const voterId = user?.id ? `user_${user.id}` : fingerprintHash ? `fp_${fingerprintHash}` : null

    const pollsWithVoteStatus = polls.docs.map(poll => {
      const voters = (poll.voters || {}) as Record<string, number>
      const options = (poll.options || []) as Array<{
        name: string
        description?: string
        votes: number
      }>

      const hasVoted = voterId ? voters[voterId] !== undefined : false
      const userVote = voterId && hasVoted ? voters[voterId] : null

      return {
        id: poll.id,
        title: poll.title,
        description: poll.description,
        endDate: poll.endDate,
        totalVotes: poll.totalVotes,
        options: options.map((o, idx) => ({
          index: idx,
          name: o.name,
          description: o.description,
          votes: o.votes,
          percentage: poll.totalVotes ? Math.round((o.votes / (poll.totalVotes as number)) * 100) : 0,
        })),
        hasVoted,
        userVote,
      }
    })

    return Response.json({
      success: true,
      polls: pollsWithVoteStatus,
    })

  } catch (error) {
    console.error('[Polls Active] Error:', error)
    return Response.json(
      { error: 'Failed to fetch polls' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/polls/:id
 *
 * Returns a single poll by ID with vote percentages.
 */
export const pollGetHandler: PayloadHandler = async (req) => {
  try {
    const url = new URL(req.url || '', 'http://localhost')
    const pollId = url.searchParams.get('id')

    if (!pollId) {
      return Response.json(
        { error: 'Poll ID is required' },
        { status: 400 }
      )
    }

    const poll = await req.payload.findByID({
      collection: 'investigation-polls',
      id: parseInt(pollId, 10),
    })

    if (!poll) {
      return Response.json(
        { error: 'Poll not found' },
        { status: 404 }
      )
    }

    // Get voter identifier
    const user = req.user as { id?: number } | undefined
    const fingerprintHash = url.searchParams.get('fingerprint')
    const voterId = user?.id ? `user_${user.id}` : fingerprintHash ? `fp_${fingerprintHash}` : null

    const voters = (poll.voters || {}) as Record<string, number>
    const options = (poll.options || []) as Array<{
      name: string
      description?: string
      votes: number
    }>

    const hasVoted = voterId ? voters[voterId] !== undefined : false
    const userVote = voterId && hasVoted ? voters[voterId] : null

    return Response.json({
      success: true,
      poll: {
        id: poll.id,
        title: poll.title,
        description: poll.description,
        status: poll.status,
        endDate: poll.endDate,
        totalVotes: poll.totalVotes,
        options: options.map((o, idx) => ({
          index: idx,
          name: o.name,
          description: o.description,
          votes: o.votes,
          percentage: poll.totalVotes ? Math.round((o.votes / (poll.totalVotes as number)) * 100) : 0,
        })),
        hasVoted,
        userVote,
      },
    })

  } catch (error) {
    console.error('[Poll Get] Error:', error)
    return Response.json(
      { error: 'Failed to fetch poll' },
      { status: 500 }
    )
  }
}
