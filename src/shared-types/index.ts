/**
 * Shared Types Definition
 *
 * This file contains shared type definitions that are used across the stack.
 * The CMS (Payload) is the source of truth for these types.
 *
 * Usage:
 * - Import from '@/shared-types' in the CMS
 * - Copy or publish as a package for mobile/web clients
 */

// =============================================================================
// 1. Product Types
// =============================================================================

/**
 * Standardize ID as string (what Payload actually returns)
 */
export type ProductId = string

/**
 * Standardize verdict values for product safety classification
 */
export type ProductVerdict = 'recommend' | 'caution' | 'avoid' | 'pending'

/**
 * Map for mobile display - human-readable verdict labels
 */
export const VerdictDisplayMap = {
  recommend: 'CLEAN',
  caution: 'CAUTION',
  avoid: 'SKIP',
  pending: 'PENDING_LAB',
} as const

export type VerdictDisplayValue = (typeof VerdictDisplayMap)[ProductVerdict]

/**
 * Base product interface with common fields
 */
export interface ProductBase {
  id: ProductId
  barcode: string
  productName: string
  brand?: string
  verdict?: ProductVerdict
  overallGrade?: 'A' | 'B' | 'C' | 'D' | 'F'
}

// =============================================================================
// 2. Error Codes
// =============================================================================

/**
 * Standardized error codes across all services
 */
export const ErrorCodes = {
  // Client errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  RATE_LIMITED: 'RATE_LIMITED',

  // Server errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT',

  // Domain errors
  PRODUCT_NOT_FOUND: 'PRODUCT_NOT_FOUND',
  DUPLICATE_VOTE: 'DUPLICATE_VOTE',
  INVALID_BARCODE: 'INVALID_BARCODE',
} as const

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes]

/**
 * Standard API error structure
 */
export interface ApiError {
  code: ErrorCode
  message: string
  details?: unknown
}

// =============================================================================
// 3. Vote Types
// =============================================================================

/**
 * Types of user votes/interactions with products
 */
export type VoteType = 'search' | 'scan' | 'member_scan'

/**
 * Weight multipliers for different vote types
 * Higher weights indicate stronger user intent
 */
export const VoteWeights: Record<VoteType, number> = {
  search: 1,
  scan: 5,
  member_scan: 20,
}

// =============================================================================
// 4. Subscription Types
// =============================================================================

/**
 * User subscription status values
 */
export type SubscriptionStatus = 'free' | 'trial' | 'premium' | 'cancelled'

/**
 * Supported subscription platforms
 */
export type SubscriptionPlatform = 'ios' | 'android' | 'web'

/**
 * User subscription information
 */
export interface UserSubscription {
  status: SubscriptionStatus
  expiresAt?: string
  platform?: SubscriptionPlatform
}

// =============================================================================
// 5. API Response Types
// =============================================================================

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: ApiError
}

/**
 * Paginated response structure (matches Payload's pagination)
 */
export interface PaginatedResponse<T> {
  docs: T[]
  totalDocs: number
  page: number
  totalPages: number
  hasNextPage: boolean
  hasPrevPage: boolean
}

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Type guard to check if a value is a valid ProductVerdict
 */
export function isProductVerdict(value: unknown): value is ProductVerdict {
  return (
    typeof value === 'string' &&
    ['recommend', 'caution', 'avoid', 'pending'].includes(value)
  )
}

/**
 * Type guard to check if a value is a valid ErrorCode
 */
export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === 'string' && Object.values(ErrorCodes).includes(value as ErrorCode)
}

/**
 * Type guard to check if a value is a valid VoteType
 */
export function isVoteType(value: unknown): value is VoteType {
  return typeof value === 'string' && ['search', 'scan', 'member_scan'].includes(value)
}

/**
 * Type guard to check if a value is a valid SubscriptionStatus
 */
export function isSubscriptionStatus(value: unknown): value is SubscriptionStatus {
  return (
    typeof value === 'string' && ['free', 'trial', 'premium', 'cancelled'].includes(value)
  )
}

// =============================================================================
// Utility Types
// =============================================================================

/**
 * Helper type to make all properties optional recursively
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

/**
 * Helper type to extract the data type from an ApiResponse
 */
export type ExtractApiData<T> = T extends ApiResponse<infer U> ? U : never

/**
 * Helper type to extract the docs type from a PaginatedResponse
 */
export type ExtractPaginatedDocs<T> = T extends PaginatedResponse<infer U> ? U : never
