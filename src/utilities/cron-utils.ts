/**
 * Cron Job Utilities
 *
 * Provides retry logic, logging, error handling, and idempotency for background jobs.
 */

// Note: getPayload and config are imported dynamically in functions that need them
// to avoid breaking tests that don't need payload

import { cache } from './redis-cache'

// ═══════════════════════════════════════════════════════════════
// IDEMPOTENCY CONSTANTS
// ═══════════════════════════════════════════════════════════════

/**
 * Lock TTLs for different cron job types (in seconds)
 * These determine how long a job "owns" its execution slot
 */
export const CronLockTTL = {
    /** Quick jobs (< 30 seconds) - lock for 2 minutes */
    QUICK: 2 * 60,
    /** Medium jobs (30 seconds - 5 minutes) - lock for 10 minutes */
    MEDIUM: 10 * 60,
    /** Long jobs (> 5 minutes) - lock for 30 minutes */
    LONG: 30 * 60,
    /** Batch jobs that process many records - lock for 1 hour */
    BATCH: 60 * 60,
} as const

export type CronLockTTLValue = (typeof CronLockTTL)[keyof typeof CronLockTTL]

/**
 * Skip window - if job ran within this window, skip execution
 * Prevents duplicate runs when cron triggers multiple times
 */
export const CronSkipWindow = {
    /** For hourly crons - skip if ran within 30 minutes */
    HOURLY: 30 * 60,
    /** For daily crons - skip if ran within 12 hours */
    DAILY: 12 * 60 * 60,
    /** For weekly crons - skip if ran within 3 days */
    WEEKLY: 3 * 24 * 60 * 60,
} as const

// ═══════════════════════════════════════════════════════════════
// IDEMPOTENCY FUNCTIONS
// ═══════════════════════════════════════════════════════════════

interface CronLockResult {
    acquired: boolean
    skipped: boolean
    reason?: string
    lockId?: string
    lastRun?: string
}

/**
 * Attempt to acquire a distributed lock for a cron job.
 * Returns lock status and whether to skip execution.
 *
 * @param jobName - Unique identifier for the cron job
 * @param options - Lock configuration
 * @returns Lock result indicating if execution should proceed
 */
export async function acquireCronLock(
    jobName: string,
    options: {
        lockTTL?: number  // How long to hold the lock (seconds)
        skipWindow?: number  // Skip if ran within this window (seconds)
        instanceId?: string  // Unique identifier for this instance
    } = {}
): Promise<CronLockResult> {
    const {
        lockTTL = CronLockTTL.MEDIUM,
        skipWindow = 0,  // No skip window by default
        instanceId = `${process.env.VERCEL_GIT_COMMIT_SHA || 'local'}-${Date.now()}`,
    } = options

    const lockKey = `cron:lock:${jobName}`
    const lastRunKey = `cron:lastrun:${jobName}`

    try {
        // Check skip window - if job ran recently, skip this execution
        if (skipWindow > 0) {
            const lastRun = await cache.get<string>(lastRunKey)
            if (lastRun) {
                const lastRunTime = new Date(lastRun).getTime()
                const elapsed = (Date.now() - lastRunTime) / 1000
                if (elapsed < skipWindow) {
                    return {
                        acquired: false,
                        skipped: true,
                        reason: `Job ran ${Math.round(elapsed / 60)} minutes ago (within ${Math.round(skipWindow / 60)} minute skip window)`,
                        lastRun,
                    }
                }
            }
        }

        // Try to acquire the lock using SETNX pattern
        // Note: Redis SETNX is atomic, but our fallback isn't
        const existingLock = await cache.get<{ instanceId: string; acquiredAt: string }>(lockKey)

        if (existingLock) {
            // Lock exists - another instance is running or hasn't released
            return {
                acquired: false,
                skipped: false,
                reason: `Lock held by ${existingLock.instanceId} since ${existingLock.acquiredAt}`,
            }
        }

        // No lock exists - acquire it
        const lockData = {
            instanceId,
            acquiredAt: new Date().toISOString(),
        }

        await cache.set(lockKey, lockData, lockTTL)

        // Double-check we got the lock (handle race condition in fallback)
        // In production with Redis, this is unnecessary due to SETNX atomicity
        const verifyLock = await cache.get<{ instanceId: string }>(lockKey)
        if (verifyLock?.instanceId !== instanceId) {
            // Lost the race
            return {
                acquired: false,
                skipped: false,
                reason: 'Lost lock race to another instance',
            }
        }

        return {
            acquired: true,
            skipped: false,
            lockId: instanceId,
        }

    } catch (error) {
        console.error(`[Cron Lock] Error acquiring lock for ${jobName}:`, error)
        // On error, allow execution but log the issue
        // This prevents cache failures from blocking all cron jobs
        return {
            acquired: true,
            skipped: false,
            reason: 'Lock check failed, allowing execution',
        }
    }
}

/**
 * Release a cron lock after job completion
 */
export async function releaseCronLock(
    jobName: string,
    options: {
        recordLastRun?: boolean  // Record timestamp for skip window
        skipWindow?: number  // How long to remember this run
    } = {}
): Promise<void> {
    const { recordLastRun = true, skipWindow = CronSkipWindow.HOURLY } = options

    const lockKey = `cron:lock:${jobName}`
    const lastRunKey = `cron:lastrun:${jobName}`

    try {
        // Delete the lock
        await cache.del(lockKey)

        // Record last run time for skip window checking
        if (recordLastRun) {
            await cache.set(lastRunKey, new Date().toISOString(), skipWindow)
        }
    } catch (error) {
        console.error(`[Cron Lock] Error releasing lock for ${jobName}:`, error)
    }
}

/**
 * Simple idempotency guard for existing cron jobs.
 *
 * Usage:
 * ```ts
 * export async function GET(request: Request) {
 *   // Auth check first...
 *
 *   const idempotencyCheck = await cronIdempotencyGuard('my-job', {
 *     lockTTL: CronLockTTL.MEDIUM,
 *   })
 *   if (idempotencyCheck.skip) {
 *     return NextResponse.json(idempotencyCheck.response)
 *   }
 *
 *   try {
 *     // Job logic here...
 *   } finally {
 *     await idempotencyCheck.release()
 *   }
 * }
 * ```
 */
export async function cronIdempotencyGuard(
    jobName: string,
    options: {
        lockTTL?: number
        skipWindow?: number
    } = {}
): Promise<{
    skip: boolean
    response?: { success: boolean; skipped: boolean; reason?: string; jobName: string }
    release: () => Promise<void>
}> {
    const { lockTTL = CronLockTTL.MEDIUM, skipWindow = 0 } = options

    const lockResult = await acquireCronLock(jobName, { lockTTL, skipWindow })

    if (!lockResult.acquired) {
        return {
            skip: true,
            response: {
                success: true, // Not an error
                skipped: true,
                reason: lockResult.reason,
                jobName,
            },
            release: async () => {}, // No-op since we didn't acquire
        }
    }

    return {
        skip: false,
        release: async () => {
            await releaseCronLock(jobName, {
                recordLastRun: true,
                skipWindow: skipWindow || CronSkipWindow.HOURLY,
            })
        },
    }
}

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
 * Options for cron job wrapper including idempotency settings
 */
export interface CronHandlerOptions extends RetryOptions {
  /** How long to hold the execution lock (seconds). Default: MEDIUM (10 minutes) */
  lockTTL?: number
  /** Skip execution if job ran within this window (seconds). Default: 0 (no skip) */
  skipWindow?: number
  /** Enable idempotency checking. Default: true */
  enableIdempotency?: boolean
}

/**
 * Wrapper for cron job handlers that adds retry logic, logging, and idempotency.
 *
 * Usage:
 * ```ts
 * export const GET = wrapCronHandler('my-job', async (payload) => {
 *   // Job logic here
 *   return { processed: 10 }
 * }, {
 *   lockTTL: CronLockTTL.MEDIUM,
 *   skipWindow: CronSkipWindow.HOURLY,
 * })
 * ```
 */
export function wrapCronHandler<T>(
  jobName: string,
  handler: (payload: unknown) => Promise<T>,
  options?: CronHandlerOptions
) {
  const {
    lockTTL = CronLockTTL.MEDIUM,
    skipWindow = 0,
    enableIdempotency = true,
    ...retryOptions
  } = options || {}

  return async (request: Request): Promise<Response> => {
    // Verify authorization
    const cronSecret = request.headers.get('authorization')?.replace('Bearer ', '')
    const apiKey = request.headers.get('x-api-key')

    const validCronSecret = cronSecret === process.env.CRON_SECRET
    const validApiKey = apiKey === process.env.PAYLOAD_API_SECRET

    if (!validCronSecret && !validApiKey) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // IDEMPOTENCY CHECK: Prevent duplicate/concurrent executions
    if (enableIdempotency) {
      const lockResult = await acquireCronLock(jobName, {
        lockTTL,
        skipWindow,
      })

      if (!lockResult.acquired) {
        const message = lockResult.skipped
          ? `Skipped: ${lockResult.reason}`
          : `Lock not acquired: ${lockResult.reason}`

        console.log(`[${jobName}] ${message}`)

        return Response.json({
          success: true, // Not an error - intentionally skipped
          jobName,
          skipped: true,
          reason: lockResult.reason,
          lastRun: lockResult.lastRun,
        })
      }
    }

    // Log job start
    await logCronExecution(jobName, 'started')

    // Dynamic imports to avoid breaking tests
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    const payload = await getPayload({ config })

    try {
      // Execute with retry
      const result = await withRetry(
        () => handler(payload),
        {
          ...retryOptions,
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
    } finally {
      // ALWAYS release the lock, even on error
      if (enableIdempotency) {
        await releaseCronLock(jobName, {
          recordLastRun: true,
          skipWindow: skipWindow || CronSkipWindow.HOURLY,
        })
      }
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
