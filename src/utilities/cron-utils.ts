/**
 * Cron Job Utilities
 *
 * Provides retry logic, logging, and error handling for background jobs.
 */

// Note: getPayload and config are imported dynamically in functions that need them
// to avoid breaking tests that don't need payload

interface RetryOptions {
  maxRetries?: number
  initialDelayMs?: number
  maxDelayMs?: number
  exponentialBase?: number
  onRetry?: (attempt: number, error: Error, delayMs: number) => void
}

interface JobResult<T> {
  success: boolean
  data?: T
  error?: string
  attempts: number
  duration: number
}

/**
 * Executes an async function with automatic retry on failure.
 * Uses exponential backoff with jitter.
 *
 * @param fn - The async function to execute
 * @param options - Retry configuration
 * @returns JobResult with success status and data or error
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<JobResult<T>> {
  const {
    maxRetries = 3,
    initialDelayMs = 1000,
    maxDelayMs = 30000,
    exponentialBase = 2,
    onRetry,
  } = options

  let lastError: Error | null = null
  let attempts = 0
  const startTime = Date.now()

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    attempts++

    try {
      const data = await fn()
      return {
        success: true,
        data,
        attempts,
        duration: Date.now() - startTime,
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      // If we've exhausted retries, return failure
      if (attempt === maxRetries) {
        break
      }

      // Calculate delay with exponential backoff + jitter
      const baseDelay = initialDelayMs * Math.pow(exponentialBase, attempt)
      const jitter = Math.random() * 0.3 * baseDelay // 30% jitter
      const delayMs = Math.min(baseDelay + jitter, maxDelayMs)

      if (onRetry) {
        onRetry(attempt + 1, lastError, delayMs)
      } else {
        console.log(`[Retry] Attempt ${attempt + 1} failed, retrying in ${Math.round(delayMs)}ms...`)
      }

      await sleep(delayMs)
    }
  }

  return {
    success: false,
    error: lastError?.message || 'Unknown error',
    attempts,
    duration: Date.now() - startTime,
  }
}

/**
 * Sleep utility
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Logs a cron job execution to the audit log.
 * Creates a record of when jobs ran and their status.
 */
export async function logCronExecution(
  jobName: string,
  status: 'started' | 'success' | 'error',
  metadata?: {
    duration?: number
    attempts?: number
    error?: string
    result?: unknown
  }
): Promise<void> {
  try {
    // Dynamic imports to avoid breaking tests
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    const payload = await getPayload({ config })

    await payload.create({
      collection: 'audit-log',
      data: {
        action: 'cron_execution',
        success: status === 'success',
        metadata: {
          jobName,
          status,
          ...(metadata || {}),
          timestamp: new Date().toISOString(),
        },
      },
    })
  } catch (error) {
    // Don't let logging errors break the cron job
    console.error(`[Cron Log] Failed to log ${jobName} execution:`, error)
  }
}

/**
 * Wrapper for cron job handlers that adds retry logic and logging.
 *
 * Usage:
 * ```ts
 * export const GET = wrapCronHandler('my-job', async (payload) => {
 *   // Job logic here
 *   return { processed: 10 }
 * })
 * ```
 */
export function wrapCronHandler<T>(
  jobName: string,
  handler: (payload: unknown) => Promise<T>,
  options?: RetryOptions
) {
  return async (request: Request): Promise<Response> => {
    // Verify authorization
    const cronSecret = request.headers.get('authorization')?.replace('Bearer ', '')
    const apiKey = request.headers.get('x-api-key')

    const validCronSecret = cronSecret === process.env.CRON_SECRET
    const validApiKey = apiKey === process.env.PAYLOAD_API_SECRET

    if (!validCronSecret && !validApiKey) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Log job start
    await logCronExecution(jobName, 'started')

    // Dynamic imports to avoid breaking tests
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    const payload = await getPayload({ config })

    // Execute with retry
    const result = await withRetry(
      () => handler(payload),
      {
        ...options,
        onRetry: (attempt, error, delayMs) => {
          console.log(`[${jobName}] Attempt ${attempt} failed: ${error.message}. Retrying in ${Math.round(delayMs)}ms...`)
        },
      }
    )

    // Log result
    await logCronExecution(
      jobName,
      result.success ? 'success' : 'error',
      {
        duration: result.duration,
        attempts: result.attempts,
        error: result.error,
        result: result.data,
      }
    )

    if (result.success) {
      return Response.json({
        success: true,
        jobName,
        data: result.data,
        duration: result.duration,
        attempts: result.attempts,
      })
    } else {
      return Response.json(
        {
          error: result.error,
          jobName,
          duration: result.duration,
          attempts: result.attempts,
        },
        { status: 500 }
      )
    }
  }
}

/**
 * Creates a retryable version of any async function.
 * Useful for wrapping external API calls within cron jobs.
 */
export function retryable<T, Args extends unknown[]>(
  fn: (...args: Args) => Promise<T>,
  options?: RetryOptions
): (...args: Args) => Promise<T> {
  return async (...args: Args): Promise<T> => {
    const result = await withRetry(() => fn(...args), options)

    if (result.success && result.data !== undefined) {
      return result.data
    }

    throw new Error(result.error || 'Retryable function failed')
  }
}

/**
 * Batch processor with retry for each item.
 * Processes items in parallel with a concurrency limit.
 */
export async function processBatchWithRetry<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  options: {
    concurrency?: number
    itemRetries?: number
    onItemError?: (item: T, error: Error) => void
  } = {}
): Promise<{
  successful: R[]
  failed: { item: T; error: string }[]
}> {
  const { concurrency = 5, itemRetries = 2, onItemError } = options

  const successful: R[] = []
  const failed: { item: T; error: string }[] = []

  // Process in batches
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency)

    await Promise.all(
      batch.map(async (item) => {
        const result = await withRetry(() => processor(item), {
          maxRetries: itemRetries,
        })

        if (result.success && result.data !== undefined) {
          successful.push(result.data)
        } else {
          failed.push({ item, error: result.error || 'Unknown error' })
          if (onItemError) {
            onItemError(item, new Error(result.error))
          }
        }
      })
    )
  }

  return { successful, failed }
}

/**
 * Circuit breaker for external service calls.
 * Prevents repeated calls to failing services.
 */
interface CircuitBreakerState {
  failures: number
  lastFailure: number
  isOpen: boolean
}

const circuitBreakers = new Map<string, CircuitBreakerState>()

export async function withCircuitBreaker<T>(
  key: string,
  fn: () => Promise<T>,
  options: {
    failureThreshold?: number
    resetTimeMs?: number
  } = {}
): Promise<T> {
  const { failureThreshold = 5, resetTimeMs = 60000 } = options

  let state = circuitBreakers.get(key)

  if (!state) {
    state = { failures: 0, lastFailure: 0, isOpen: false }
    circuitBreakers.set(key, state)
  }

  // Check if circuit is open
  if (state.isOpen) {
    const timeSinceLastFailure = Date.now() - state.lastFailure

    if (timeSinceLastFailure < resetTimeMs) {
      throw new Error(`Circuit breaker open for ${key}. Retry after ${Math.ceil((resetTimeMs - timeSinceLastFailure) / 1000)}s`)
    }

    // Reset circuit for retry
    state.isOpen = false
    state.failures = 0
  }

  try {
    const result = await fn()

    // Success - reset failures
    state.failures = 0
    return result
  } catch (error) {
    state.failures++
    state.lastFailure = Date.now()

    if (state.failures >= failureThreshold) {
      state.isOpen = true
      console.error(`[Circuit Breaker] ${key} tripped after ${state.failures} failures`)
    }

    throw error
  }
}
