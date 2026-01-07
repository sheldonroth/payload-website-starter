import type { PayloadHandler } from 'payload'

interface StatsigGate {
  id: string
  name: string
  description?: string
  isEnabled: boolean
  rules: {
    name: string
    passPercentage: number
    conditions: {
      type: string
      targetValue: string[] | number
      operator: string
      field: string
    }[]
  }[]
  salt: string
  defaultValue: boolean
  lastModifiedTime: number
  tags?: string[]
  creatorName?: string
  checksPerHour?: number
}

interface CachedGates {
  data: StatsigGate[]
  timestamp: number
}

// In-memory cache with 5-minute TTL
let gatesCache: CachedGates | null = null
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

/**
 * Statsig Feature Gates API Endpoint
 *
 * Fetches all feature gates from Statsig Console API.
 * Caches results for 5 minutes to avoid rate limiting.
 */
export const statsigGatesHandler: PayloadHandler = async (req) => {
  try {
    const consoleApiKey = process.env.STATSIG_CONSOLE_API_KEY

    if (!consoleApiKey) {
      return Response.json(
        { error: 'STATSIG_CONSOLE_API_KEY not configured' },
        { status: 500 }
      )
    }

    // Check cache
    const now = Date.now()
    if (gatesCache && now - gatesCache.timestamp < CACHE_TTL) {
      return Response.json({
        data: gatesCache.data,
        cached: true,
        lastUpdated: new Date(gatesCache.timestamp).toISOString(),
      })
    }

    // Fetch from Statsig Console API
    const response = await fetch('https://statsigapi.net/console/v1/gates', {
      method: 'GET',
      headers: {
        'STATSIG-API-KEY': consoleApiKey,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[StatsigGates] API error:', response.status, errorText)
      return Response.json(
        { error: `Statsig API error: ${response.status}` },
        { status: response.status }
      )
    }

    const result = await response.json()
    const gates: StatsigGate[] = result.data || []

    // Update cache
    gatesCache = {
      data: gates,
      timestamp: now,
    }

    return Response.json({
      data: gates,
      cached: false,
      lastUpdated: new Date(now).toISOString(),
    })
  } catch (error) {
    console.error('[StatsigGates] Error:', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
