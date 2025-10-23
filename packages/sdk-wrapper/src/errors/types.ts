/**
 * Error handling types and interfaces
 */

/**
 * Retry policy configuration
 */
export interface RetryPolicy {
  /** Maximum number of retry attempts */
  maxRetries: number;
  /** Base delay between retries in milliseconds */
  baseDelay: number;
  /** Maximum delay between retries in milliseconds */
  maxDelay: number;
  /** Multiplier for exponential backoff */
  backoffMultiplier: number;
  /** Add random jitter to delays */
  jitter: boolean;
  /** Timeout for each attempt in milliseconds */
  timeout?: number;
}

/**
 * Error metrics for monitoring
 */
export interface ErrorMetrics {
  /** Total number of errors */
  totalErrors: number;
  /** Errors by type */
  errorsByType: Record<string, number>;
  /** Retry attempts */
  retryAttempts: number;
  /** Successful retries */
  successfulRetries: number;
  /** Circuit breaker trips */
  circuitBreakerTrips: number;
  /** Last error timestamp */
  lastErrorAt?: Date;
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  /** Failure threshold to open circuit */
  failureThreshold: number;
  /** Success threshold to close circuit */
  successThreshold: number;
  /** Timeout before attempting to close circuit */
  timeout: number;
  /** Monitoring window in milliseconds */
  monitoringWindow: number;
}
