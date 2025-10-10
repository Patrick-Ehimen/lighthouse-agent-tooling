/**
 * Custom error classes for different failure scenarios in the Lighthouse SDK.
 *
 * These error classes provide intelligent classification of failures to enable
 * appropriate retry strategies and error handling patterns.
 */

/**
 * Base error class for all Lighthouse SDK errors.
 *
 * Provides common properties for error classification, retry logic,
 * and error chaining to maintain context from original errors.
 *
 * @example
 * ```typescript
 * try {
 *   await sdk.uploadFile('./file.txt');
 * } catch (error) {
 *   if (error instanceof LighthouseError) {
 *     console.log(`Error code: ${error.code}`);
 *     console.log(`Retryable: ${error.retryable}`);
 *     if (error.originalError) {
 *       console.log(`Original: ${error.originalError.message}`);
 *     }
 *   }
 * }
 * ```
 */
export class LighthouseError extends Error {
  public readonly code: string;
  public readonly retryable: boolean;
  public readonly statusCode?: number;
  public readonly originalError?: Error;

  constructor(
    message: string,
    code: string,
    retryable: boolean = false,
    statusCode?: number,
    originalError?: Error,
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.retryable = retryable;
    this.statusCode = statusCode;
    this.originalError = originalError;

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Network-related errors including connection failures, DNS resolution issues, and socket errors.
 *
 * These errors are automatically marked as retryable since network issues are often transient.
 * The SDK will apply exponential backoff retry logic for these errors.
 */
export class NetworkError extends LighthouseError {
  constructor(message: string, originalError?: Error) {
    super(message, "NETWORK_ERROR", true, undefined, originalError);
  }
}

/**
 * Authentication and authorization errors including invalid API keys, expired tokens, and permission issues.
 *
 * These errors are not retryable by default since they typically require user intervention
 * to resolve (e.g., updating API keys or requesting additional permissions).
 */
export class AuthenticationError extends LighthouseError {
  constructor(message: string, statusCode?: number, originalError?: Error) {
    super(message, "AUTH_ERROR", false, statusCode, originalError);
  }
}

/**
 * Rate limiting errors when API usage limits are exceeded.
 *
 * These errors are retryable and include retry-after information when available.
 * The SDK will respect the retry-after header and apply appropriate delays.
 */
export class RateLimitError extends LighthouseError {
  public readonly retryAfter?: number;

  constructor(message: string, retryAfter?: number, originalError?: Error) {
    super(message, "RATE_LIMIT_ERROR", true, 429, originalError);
    this.retryAfter = retryAfter;
  }
}

/**
 * Timeout errors
 */
export class TimeoutError extends LighthouseError {
  constructor(message: string, originalError?: Error) {
    super(message, "TIMEOUT_ERROR", true, undefined, originalError);
  }
}

/**
 * Validation errors for invalid input
 */
export class ValidationError extends LighthouseError {
  constructor(message: string, originalError?: Error) {
    super(message, "VALIDATION_ERROR", false, 400, originalError);
  }
}

/**
 * File not found errors
 */
export class FileNotFoundError extends LighthouseError {
  constructor(message: string, originalError?: Error) {
    super(message, "FILE_NOT_FOUND", false, 404, originalError);
  }
}

/**
 * Insufficient storage errors
 */
export class InsufficientStorageError extends LighthouseError {
  constructor(message: string, originalError?: Error) {
    super(message, "INSUFFICIENT_STORAGE", false, 507, originalError);
  }
}
