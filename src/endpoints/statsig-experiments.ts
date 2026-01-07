/**
 * Statsig Experiments API Endpoint
 *
 * Fetches experiment data from the Statsig Console API.
 * Uses server-side caching to minimize API calls.
 *
 * Required Environment Variable:
 * - STATSIG_CONSOLE_API_KEY: Console API key (starts with 'console-')
 *
 * Note: This uses the Console API (not the Server or Client SDK keys).
 * Get your Console API key from:
 * Statsig Console -> Settings -> Keys & Environments -> Console API Keys
 */

import type { PayloadHandler } from 'payload'

// Cache configuration
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes
let cache: { data: unknown; timestamp: number } | null = null

interface StatsigExperiment {
  id: string
  name: string
  description?: string
  hypothesis?: string
  status: string
  type?: string
  groups: { name: string; weight: number; json?: Record<string, unknown> }[]
  allocation?: number
  tags?: string[]
  layerAssignment?: {
    layer: string
    isDefault: boolean
  }
  startTime?: string
  endTime?: string
  lastModifiedTime: string
  creatorName?: string
  creatorID?: string
}

export const statsigExperimentsHandler: PayloadHandler = async (req) => {
  const apiKey = process.env.STATSIG_CONSOLE_API_KEY

  // Validate API key exists
  if (!apiKey) {
    console.error('[Statsig] STATSIG_CONSOLE_API_KEY not configured')
    return Response.json(
      {
        error: 'Statsig API key not configured',
        message: 'Add STATSIG_CONSOLE_API_KEY to your environment variables',
      },
      { status: 500 }
    )
  }

  // Validate key format
  if (!apiKey.startsWith('console-')) {
    console.error('[Statsig] Invalid API key format - must start with "console-"')
    return Response.json(
      {
        error: 'Invalid Statsig API key format',
        message: 'The key should be a Console API key (starts with "console-"), not a Server or Client key',
      },
      { status: 500 }
    )
  }

  // Check cache
  if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
    console.log('[Statsig] Returning cached data')
    return Response.json({
      ...(cache.data as object),
      cached: true,
      lastUpdated: new Date(cache.timestamp).toISOString(),
    })
  }

  try {
    console.log('[Statsig] Fetching experiments from API...')

    const response = await fetch('https://statsigapi.net/console/v1/experiments', {
      method: 'GET',
      headers: {
        'STATSIG-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[Statsig] API error:', response.status, errorText)

      // Handle specific error cases
      if (response.status === 401) {
        return Response.json(
          {
            error: 'Statsig authentication failed',
            message: 'Check that your Console API key is valid and has the correct permissions',
          },
          { status: 401 }
        )
      }

      if (response.status === 403) {
        return Response.json(
          {
            error: 'Statsig permission denied',
            message: 'The API key does not have permission to read experiments',
          },
          { status: 403 }
        )
      }

      return Response.json(
        {
          error: `Statsig API error: ${response.status}`,
          message: errorText || 'Unknown error from Statsig API',
        },
        { status: response.status }
      )
    }

    const data = await response.json()
    console.log('[Statsig] Fetched', data.data?.length || 0, 'experiments')

    // Transform data to ensure consistent shape
    const experiments: StatsigExperiment[] = (data.data || []).map((exp: Record<string, unknown>) => ({
      id: exp.id,
      name: exp.name,
      description: exp.description,
      hypothesis: exp.hypothesis,
      status: exp.status,
      type: exp.type,
      groups: exp.groups || [],
      allocation: exp.allocation,
      tags: exp.tags || [],
      layerAssignment: exp.layerAssignment,
      startTime: exp.startTime,
      endTime: exp.endTime,
      lastModifiedTime: exp.lastModifiedTime,
      creatorName: exp.creatorName,
      creatorID: exp.creatorID,
    }))

    // Sort: active first, then by lastModifiedTime
    experiments.sort((a, b) => {
      if (a.status === 'active' && b.status !== 'active') return -1
      if (b.status === 'active' && a.status !== 'active') return 1
      return new Date(b.lastModifiedTime).getTime() - new Date(a.lastModifiedTime).getTime()
    })

    const responseData = {
      data: experiments,
      message: 'success',
      cached: false,
      lastUpdated: new Date().toISOString(),
    }

    // Cache the response
    cache = { data: responseData, timestamp: Date.now() }

    return Response.json(responseData)
  } catch (error) {
    console.error('[Statsig] Fetch error:', error)
    return Response.json(
      {
        error: 'Failed to fetch experiments',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

export default statsigExperimentsHandler
