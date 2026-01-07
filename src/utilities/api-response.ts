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

// Standard API success interface
export interface ApiSuccess<T> {
  success: true
  data: T
}

// Error codes enum for standardized error identification
export enum ErrorCode {
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  RATE_LIMITED = 'RATE_LIMITED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  BAD_REQUEST = 'BAD_REQUEST',
  CONFLICT = 'CONFLICT',
  GONE = 'GONE',
}

// HTTP status code mapping for error codes
const ERROR_STATUS_MAP: Record<ErrorCode, number> = {
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.VALIDATION_ERROR]: 400,
  [ErrorCode.RATE_LIMITED]: 429,
  [ErrorCode.INTERNAL_ERROR]: 500,
  [ErrorCode.BAD_REQUEST]: 400,
  [ErrorCode.CONFLICT]: 409,
  [ErrorCode.GONE]: 410,
}

/**
 * Creates a standardized error response
 *
 * @param code - The error code from ErrorCode enum
 * @param message - Human-readable error message
 * @param status - HTTP status code (defaults to mapped status for error code)
 * @param details - Optional additional details about the error
 * @returns Response object with JSON error payload
 */
export function errorResponse(
  code: ErrorCode,
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
 * @param status - HTTP status code (defaults to 200)
 * @returns Response object with JSON success payload
 */
export function successResponse<T>(data: T, status: number = 200): Response {
  const body: ApiSuccess<T> = {
    success: true,
    data,
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
