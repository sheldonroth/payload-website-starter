/**
 * Sentry API Client for CMS Integration
 *
 * Allows querying Sentry for issues, events, and project information.
 * Use this in your Payload CMS to display error metrics, track releases, etc.
 *
 * Environment Variables:
 * - SENTRY_API_TOKEN: Personal API token with event:read, org:read, project:read scopes
 * - SENTRY_ORG_SLUG: Your Sentry organization slug
 */

const SENTRY_API_BASE = 'https://sentry.io/api/0'

interface SentryRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: Record<string, unknown>
}

export interface SentryIssue {
  id: string
  shortId: string
  title: string
  culprit: string
  permalink: string
  firstSeen: string
  lastSeen: string
  count: string
  userCount: number
  level: 'fatal' | 'error' | 'warning' | 'info' | 'debug'
  status: 'resolved' | 'unresolved' | 'ignored'
  isUnhandled: boolean
  metadata: {
    type?: string
    value?: string
    filename?: string
    function?: string
  }
  project: {
    id: string
    name: string
    slug: string
  }
}

export interface SentryProject {
  id: string
  slug: string
  name: string
  platform: string
  dateCreated: string
  isBookmarked: boolean
  isMember: boolean
  hasAccess: boolean
}

export interface SentryEvent {
  eventID: string
  context: Record<string, unknown>
  dateCreated: string
  user: {
    id?: string
    email?: string
    username?: string
    ip_address?: string
  } | null
  tags: Array<{ key: string; value: string }>
  platform: string
  message?: string
}

export interface SentryStats {
  received: number[]
  rejected: number[]
  blacklisted: number[]
}

/**
 * Check if Sentry API is configured
 */
export function isSentryConfigured(): boolean {
  return !!(process.env.SENTRY_API_TOKEN && process.env.SENTRY_ORG_SLUG)
}

/**
 * Make an authenticated request to the Sentry API
 */
async function sentryRequest<T>(endpoint: string, options: SentryRequestOptions = {}): Promise<T> {
  const token = process.env.SENTRY_API_TOKEN

  if (!token) {
    throw new Error('SENTRY_API_TOKEN environment variable is not set')
  }

  const url = `${SENTRY_API_BASE}${endpoint}`
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Sentry API error (${response.status}): ${errorText}`)
  }

  return response.json()
}

/**
 * Get the organization slug from environment
 */
function getOrgSlug(): string {
  const slug = process.env.SENTRY_ORG_SLUG
  if (!slug) {
    throw new Error('SENTRY_ORG_SLUG environment variable is not set')
  }
  return slug
}

// ============================================================================
// API Methods
// ============================================================================

/**
 * List all projects in the organization
 */
export async function listProjects(): Promise<SentryProject[]> {
  return sentryRequest<SentryProject[]>(`/organizations/${getOrgSlug()}/projects/`)
}

/**
 * Get recent issues for a project
 * @param projectSlug - The project slug (e.g., "react-native")
 * @param options - Query options
 */
export async function getProjectIssues(
  projectSlug: string,
  options: {
    query?: string // Sentry search query (e.g., "is:unresolved level:error")
    limit?: number // Max results (default 25)
    statsPeriod?: string // Time period (e.g., "24h", "7d", "30d")
  } = {},
): Promise<SentryIssue[]> {
  const params = new URLSearchParams()

  if (options.query) params.set('query', options.query)
  if (options.limit) params.set('limit', options.limit.toString())
  if (options.statsPeriod) params.set('statsPeriod', options.statsPeriod)

  const queryString = params.toString()
  const endpoint = `/projects/${getOrgSlug()}/${projectSlug}/issues/${queryString ? `?${queryString}` : ''}`

  return sentryRequest<SentryIssue[]>(endpoint)
}

/**
 * Get issue details by ID
 */
export async function getIssue(issueId: string): Promise<SentryIssue> {
  return sentryRequest<SentryIssue>(`/issues/${issueId}/`)
}

/**
 * Get events for an issue
 */
export async function getIssueEvents(issueId: string, limit = 10): Promise<SentryEvent[]> {
  return sentryRequest<SentryEvent[]>(`/issues/${issueId}/events/?limit=${limit}`)
}

/**
 * Get project stats (error counts over time)
 */
export async function getProjectStats(projectSlug: string, statsPeriod = '24h'): Promise<SentryStats> {
  return sentryRequest<SentryStats>(
    `/projects/${getOrgSlug()}/${projectSlug}/stats/?stat=received&stat=rejected&stat=blacklisted&statsPeriod=${statsPeriod}`,
  )
}

/**
 * Get organization-wide issue counts
 */
export async function getOrganizationStats(): Promise<{
  totalIssues: number
  unresolvedIssues: number
  criticalIssues: number
}> {
  // Get unresolved issues count
  const unresolvedIssues = await sentryRequest<SentryIssue[]>(
    `/organizations/${getOrgSlug()}/issues/?query=is:unresolved&limit=1`,
  )

  // Get critical/fatal issues
  const criticalIssues = await sentryRequest<SentryIssue[]>(
    `/organizations/${getOrgSlug()}/issues/?query=is:unresolved level:fatal OR level:error&limit=1`,
  )

  // Note: Total count comes from response headers in real implementation
  return {
    totalIssues: 0, // Would parse from X-Hits header
    unresolvedIssues: unresolvedIssues.length,
    criticalIssues: criticalIssues.length,
  }
}

// ============================================================================
// Dashboard Helpers
// ============================================================================

/**
 * Get dashboard summary for CMS admin
 */
export async function getDashboardSummary() {
  if (!isSentryConfigured()) {
    return { error: 'Sentry not configured', configured: false }
  }

  try {
    const projects = await listProjects()
    const mobileProject = projects.find((p) => p.slug === 'react-native')

    if (!mobileProject) {
      return { error: 'Mobile project not found', projects: projects.map((p) => p.slug) }
    }

    const [recentIssues, stats] = await Promise.all([
      getProjectIssues(mobileProject.slug, {
        query: 'is:unresolved',
        limit: 5,
        statsPeriod: '24h',
      }),
      getProjectStats(mobileProject.slug, '24h'),
    ])

    return {
      configured: true,
      project: mobileProject,
      recentIssues: recentIssues.map((issue) => ({
        id: issue.id,
        shortId: issue.shortId,
        title: issue.title,
        count: issue.count,
        level: issue.level,
        lastSeen: issue.lastSeen,
        permalink: issue.permalink,
      })),
      stats: {
        received: stats.received.reduce((a, b) => a + b, 0),
        rejected: stats.rejected.reduce((a, b) => a + b, 0),
      },
    }
  } catch (error) {
    console.error('[Sentry] Failed to fetch dashboard:', error)
    return { error: String(error), configured: true }
  }
}
