/**
 * Standard API Response Utilities
 *
 * Provides consistent response formats across all API endpoints.
 */

// Standard API error interface
export interface ApiError {
  error: string
  code: string
  details?: unknown
}

// Standard API success interface with optional meta
export interface ApiSuccess<T> {
  success: true
  data: T
  meta?: ResponseMeta
}

// Meta information for paginated or cached responses
export interface ResponseMeta {
  cached?: boolean
  page?: number
  totalPages?: number
  totalDocs?: number
  limit?: number
  hasNextPage?: boolean
  hasPrevPage?: boolean
}

// Error codes taxonomy - const object for better tree-shaking and type inference
export const ErrorCodes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  BAD_REQUEST: 'BAD_REQUEST',
  CONFLICT: 'CONFLICT',
  GONE: 'GONE',
  METHOD_NOT_ALLOWED: 'METHOD_NOT_ALLOWED',
} as const

// Type derived from ErrorCodes for type safety
export type ErrorCodeType = typeof ErrorCodes[keyof typeof ErrorCodes]

// Error codes enum for backwards compatibility
export enum ErrorCode {
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  RATE_LIMITED = 'RATE_LIMITED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  BAD_REQUEST = 'BAD_REQUEST',
  CONFLICT = 'CONFLICT',
  GONE = 'GONE',
  METHOD_NOT_ALLOWED = 'METHOD_NOT_ALLOWED',
}

// HTTP status code mapping for error codes
const ERROR_STATUS_MAP: Record<string, number> = {
  [ErrorCodes.UNAUTHORIZED]: 401,
  [ErrorCodes.FORBIDDEN]: 403,
  [ErrorCodes.NOT_FOUND]: 404,
  [ErrorCodes.VALIDATION_ERROR]: 400,
  [ErrorCodes.RATE_LIMITED]: 429,
  [ErrorCodes.INTERNAL_ERROR]: 500,
  [ErrorCodes.EXTERNAL_SERVICE_ERROR]: 502,
  [ErrorCodes.BAD_REQUEST]: 400,
  [ErrorCodes.CONFLICT]: 409,
  [ErrorCodes.GONE]: 410,
  [ErrorCodes.METHOD_NOT_ALLOWED]: 405,
}

/**
 * Creates a standardized error response
 *
 * @param code - The error code from ErrorCodes const or ErrorCode enum
 * @param message - Human-readable error message
 * @param status - HTTP status code (defaults to mapped status for error code)
 * @param details - Optional additional details about the error
 * @returns Response object with JSON error payload
 */
export function errorResponse(
  code: ErrorCodeType | ErrorCode | string,
  message: string,
  status?: number,
  details?: unknown
): Response {
  const httpStatus = status ?? ERROR_STATUS_MAP[code] ?? 500

  const body: ApiError = {
    error: message,
    code,
    ...(details !== undefined && { details }),
  }

  return Response.json(body, { status: httpStatus })
}

/**
 * Creates a standardized success response
 *
 * @param data - The response data payload
 * @param statusOrMeta - HTTP status code (defaults to 200) or meta object
 * @returns Response object with JSON success payload
 */
export function successResponse<T>(
  data: T,
  statusOrMeta?: number | ResponseMeta
): Response {
  let status = 200
  let meta: ResponseMeta | undefined

  if (typeof statusOrMeta === 'number') {
    status = statusOrMeta
  } else if (statusOrMeta) {
    meta = statusOrMeta
  }

  const body: ApiSuccess<T> = {
    success: true,
    data,
    ...(meta && { meta }),
  }

  return Response.json(body, { status })
}

/**
 * Creates a validation error response with field-specific errors
 *
 * @param message - General validation error message
 * @param fields - Optional record of field names to error messages
 * @returns Response object with validation error details
 */
export function validationError(
  message: string,
  fields?: Record<string, string>
): Response {
  return errorResponse(
    ErrorCode.VALIDATION_ERROR,
    message,
    400,
    fields ? { fields } : undefined
  )
}

/**
 * Creates an unauthorized error response
 *
 * @param message - Error message (defaults to 'Authentication required')
 * @returns Response object with 401 status
 */
export function unauthorizedError(message: string = 'Authentication required'): Response {
  return errorResponse(ErrorCode.UNAUTHORIZED, message)
}

/**
 * Creates a not found error response
 *
 * @param resource - The type of resource that was not found
 * @returns Response object with 404 status
 */
export function notFoundError(resource: string = 'Resource'): Response {
  return errorResponse(ErrorCode.NOT_FOUND, `${resource} not found`)
}

/**
 * Creates an internal server error response
 *
 * @param message - Error message (defaults to 'Internal server error')
 * @returns Response object with 500 status
 */
export function internalError(message: string = 'Internal server error'): Response {
  return errorResponse(ErrorCode.INTERNAL_ERROR, message)
}

/**
 * Creates a conflict error response (for duplicate resources)
 *
 * @param message - Error message describing the conflict
 * @param details - Optional details about the existing resource
 * @returns Response object with 409 status
 */
export function conflictError(message: string, details?: unknown): Response {
  return errorResponse(ErrorCode.CONFLICT, message, 409, details)
}

/**
 * Creates a gone error response (for permanently removed resources)
 *
 * @param message - Error message describing what was removed
 * @returns Response object with 410 status
 */
export function goneError(message: string): Response {
  return errorResponse(ErrorCode.GONE, message)
}

/**
 * Creates a bad request error response
 *
 * @param message - Error message describing the invalid request
 * @param details - Optional details about what was invalid
 * @returns Response object with 400 status
 */
export function badRequestError(message: string, details?: unknown): Response {
  return errorResponse(ErrorCode.BAD_REQUEST, message, 400, details)
}

/**
 * Creates a method not allowed error response
 *
 * @param message - Error message (defaults to 'Method not allowed')
 * @returns Response object with 405 status
 */
export function methodNotAllowedError(message: string = 'Method not allowed'): Response {
  return errorResponse(ErrorCodes.METHOD_NOT_ALLOWED, message)
}

/**
 * Creates a forbidden error response
 *
 * @param message - Error message (defaults to 'Access forbidden')
 * @returns Response object with 403 status
 */
export function forbiddenError(message: string = 'Access forbidden'): Response {
  return errorResponse(ErrorCodes.FORBIDDEN, message)
}

/**
 * Creates a rate limited error response
 *
 * @param message - Error message (defaults to 'Too many requests')
 * @param retryAfter - Optional seconds until rate limit resets
 * @returns Response object with 429 status
 */
export function rateLimitedError(message: string = 'Too many requests', retryAfter?: number): Response {
  return errorResponse(
    ErrorCodes.RATE_LIMITED,
    message,
    429,
    retryAfter ? { retryAfter } : undefined
  )
}

/**
 * Creates an external service error response
 *
 * @param message - Error message describing the external service failure
 * @param service - Optional name of the external service that failed
 * @returns Response object with 502 status
 */
export function externalServiceError(message: string, service?: string): Response {
  return errorResponse(
    ErrorCodes.EXTERNAL_SERVICE_ERROR,
    message,
    502,
    service ? { service } : undefined
  )
}
