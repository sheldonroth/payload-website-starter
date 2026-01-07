/**
 * Unit tests for cron-utils
 *
 * Tests the retry logic, circuit breaker, and batch processing utilities.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  withRetry,
  sleep,
  retryable,
  processBatchWithRetry,
  withCircuitBreaker,
} from '@/utilities/cron-utils'

describe('cron-utils', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  describe('sleep', () => {
    it('resolves after the specified delay', async () => {
      const promise = sleep(1000)
      vi.advanceTimersByTime(1000)
      await expect(promise).resolves.toBeUndefined()
    })
  })

  describe('withRetry', () => {
    it('returns success on first attempt when function succeeds', async () => {
      const fn = vi.fn().mockResolvedValue('success')

      const promise = withRetry(fn)
      vi.runAllTimers()
      const result = await promise

      expect(result.success).toBe(true)
      expect(result.data).toBe('success')
      expect(result.attempts).toBe(1)
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('retries on failure and eventually succeeds', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockRejectedValueOnce(new Error('fail 2'))
        .mockResolvedValue('success')

      const promise = withRetry(fn, { maxRetries: 3, initialDelayMs: 100 })

      // First attempt fails
      await vi.advanceTimersByTimeAsync(1)

      // Second attempt after delay
      await vi.advanceTimersByTimeAsync(150)

      // Third attempt after delay
      await vi.advanceTimersByTimeAsync(300)

      const result = await promise

      expect(result.success).toBe(true)
      expect(result.data).toBe('success')
      expect(result.attempts).toBe(3)
      expect(fn).toHaveBeenCalledTimes(3)
    })

    it('returns failure after exhausting retries', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('always fails'))

      const promise = withRetry(fn, { maxRetries: 2, initialDelayMs: 100 })

      // Run all timers to complete all retries
      await vi.runAllTimersAsync()

      const result = await promise

      expect(result.success).toBe(false)
      expect(result.error).toBe('always fails')
      expect(result.attempts).toBe(3) // Initial + 2 retries
      expect(fn).toHaveBeenCalledTimes(3)
    })

    it('respects maxDelayMs cap', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('fail'))
      const onRetry = vi.fn()

      const promise = withRetry(fn, {
        maxRetries: 5,
        initialDelayMs: 10000,
        maxDelayMs: 15000,
        exponentialBase: 2,
        onRetry,
      })

      await vi.runAllTimersAsync()
      await promise

      // Check that delays were capped
      const delays = onRetry.mock.calls.map((call) => call[2])
      for (const delay of delays) {
        expect(delay).toBeLessThanOrEqual(15000 * 1.3) // Allow for jitter
      }
    })

    it('calls onRetry callback with correct arguments', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('test error'))
        .mockResolvedValue('success')

      const onRetry = vi.fn()

      const promise = withRetry(fn, { maxRetries: 1, initialDelayMs: 100, onRetry })

      await vi.runAllTimersAsync()
      await promise

      expect(onRetry).toHaveBeenCalledTimes(1)
      expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error), expect.any(Number))
      expect(onRetry.mock.calls[0][1].message).toBe('test error')
    })

    it('tracks duration correctly', async () => {
      vi.useRealTimers() // Need real timers for duration

      const fn = vi.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50))
        return 'done'
      })

      const result = await withRetry(fn, { maxRetries: 0 })

      expect(result.success).toBe(true)
      expect(result.duration).toBeGreaterThanOrEqual(40) // Allow some variance
      expect(result.duration).toBeLessThan(200)

      vi.useFakeTimers() // Restore fake timers
    })
  })

  describe('retryable', () => {
    it('wraps a function to be retryable', async () => {
      const fn = vi.fn().mockResolvedValue('result')
      const wrapped = retryable(fn)

      const result = await wrapped()

      expect(result).toBe('result')
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('throws error after exhausting retries', async () => {
      vi.useRealTimers() // Need real timers for async operations

      const fn = vi.fn().mockRejectedValue(new Error('permanent failure'))
      const wrapped = retryable(fn, { maxRetries: 1, initialDelayMs: 10 })

      await expect(wrapped()).rejects.toThrow('permanent failure')
      expect(fn).toHaveBeenCalledTimes(2)

      vi.useFakeTimers()
    })

    it('passes arguments to the wrapped function', async () => {
      const fn = vi.fn().mockImplementation(async (a: number, b: string) => `${a}-${b}`)
      const wrapped = retryable(fn)

      const result = await wrapped(42, 'test')

      expect(result).toBe('42-test')
      expect(fn).toHaveBeenCalledWith(42, 'test')
    })
  })

  describe('processBatchWithRetry', () => {
    it('processes all items successfully', async () => {
      vi.useRealTimers()

      const items = [1, 2, 3, 4, 5]
      const processor = vi.fn().mockImplementation(async (n: number) => n * 2)

      const result = await processBatchWithRetry(items, processor, {
        concurrency: 2,
      })

      expect(result.successful).toEqual([2, 4, 6, 8, 10])
      expect(result.failed).toHaveLength(0)
      expect(processor).toHaveBeenCalledTimes(5)

      vi.useFakeTimers()
    })

    it('handles partial failures', async () => {
      vi.useRealTimers()

      const items = [1, 2, 3, 4, 5]
      const processor = vi.fn().mockImplementation(async (n: number) => {
        if (n === 3) throw new Error('Item 3 failed')
        return n * 2
      })

      const result = await processBatchWithRetry(items, processor, {
        concurrency: 5,
        itemRetries: 0, // No retries
      })

      expect(result.successful).toEqual([2, 4, 8, 10])
      expect(result.failed).toHaveLength(1)
      expect(result.failed[0]).toEqual({ item: 3, error: 'Item 3 failed' })

      vi.useFakeTimers()
    })

    it('respects concurrency limit', async () => {
      vi.useRealTimers()

      const items = [1, 2, 3, 4, 5, 6]
      let maxConcurrent = 0
      let currentConcurrent = 0

      const processor = vi.fn().mockImplementation(async (n: number) => {
        currentConcurrent++
        maxConcurrent = Math.max(maxConcurrent, currentConcurrent)
        await new Promise((resolve) => setTimeout(resolve, 50))
        currentConcurrent--
        return n
      })

      await processBatchWithRetry(items, processor, { concurrency: 2 })

      expect(maxConcurrent).toBeLessThanOrEqual(2)

      vi.useFakeTimers()
    })

    it('calls onItemError for failed items', async () => {
      vi.useRealTimers()

      const items = [1, 2, 3]
      const onItemError = vi.fn()
      const processor = vi.fn().mockImplementation(async (n: number) => {
        if (n === 2) throw new Error('Failed')
        return n
      })

      await processBatchWithRetry(items, processor, {
        itemRetries: 0,
        onItemError,
      })

      expect(onItemError).toHaveBeenCalledTimes(1)
      expect(onItemError).toHaveBeenCalledWith(2, expect.any(Error))

      vi.useFakeTimers()
    })
  })

  describe('withCircuitBreaker', () => {
    it('allows calls when circuit is closed', async () => {
      const fn = vi.fn().mockResolvedValue('success')

      const result = await withCircuitBreaker('test-service', fn)

      expect(result).toBe('success')
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('opens circuit after reaching failure threshold', async () => {
      vi.useRealTimers()

      const fn = vi.fn().mockRejectedValue(new Error('service down'))

      // Fail enough times to trip the circuit
      for (let i = 0; i < 5; i++) {
        await expect(withCircuitBreaker('failing-service', fn, {
          failureThreshold: 5,
        })).rejects.toThrow('service down')
      }

      // Next call should fail immediately with circuit breaker error
      await expect(withCircuitBreaker('failing-service', fn, {
        failureThreshold: 5,
        resetTimeMs: 60000,
      })).rejects.toThrow('Circuit breaker open')

      // Function should not have been called for the last attempt
      expect(fn).toHaveBeenCalledTimes(5)

      vi.useFakeTimers()
    })

    it('resets failures on success', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockRejectedValueOnce(new Error('fail 2'))
        .mockResolvedValue('success')

      // Two failures
      await expect(withCircuitBreaker('reset-test', fn)).rejects.toThrow()
      await expect(withCircuitBreaker('reset-test', fn)).rejects.toThrow()

      // Success resets counter
      const result = await withCircuitBreaker('reset-test', fn)
      expect(result).toBe('success')

      // Should be able to fail again without tripping circuit immediately
      fn.mockRejectedValueOnce(new Error('new fail'))
      await expect(withCircuitBreaker('reset-test', fn, {
        failureThreshold: 3,
      })).rejects.toThrow('new fail')
    })

    it('half-opens circuit after reset time', async () => {
      vi.useRealTimers()

      const fn = vi.fn().mockRejectedValue(new Error('service down'))

      // Trip the circuit
      for (let i = 0; i < 3; i++) {
        await expect(withCircuitBreaker('timeout-test', fn, {
          failureThreshold: 3,
          resetTimeMs: 100,
        })).rejects.toThrow('service down')
      }

      // Circuit should be open
      await expect(withCircuitBreaker('timeout-test', fn, {
        failureThreshold: 3,
        resetTimeMs: 100,
      })).rejects.toThrow('Circuit breaker open')

      // Wait for reset time
      await new Promise((resolve) => setTimeout(resolve, 150))

      // Circuit should be half-open, allowing a retry
      fn.mockResolvedValueOnce('recovered')
      const result = await withCircuitBreaker('timeout-test', fn, {
        failureThreshold: 3,
        resetTimeMs: 100,
      })

      expect(result).toBe('recovered')

      vi.useFakeTimers()
    })
  })
})
