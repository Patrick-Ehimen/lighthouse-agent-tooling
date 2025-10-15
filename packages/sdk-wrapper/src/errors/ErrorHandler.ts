import { EventEmitter } from "eventemitter3";
import {
  LighthouseError,
  NetworkError,
  AuthenticationError,
  RateLimitError,
  TimeoutError,
  ValidationError,
  FileNotFoundError,
  InsufficientStorageError,
} from "./errors";
import { RetryPolicy, ErrorMetrics } from "./types";

/**
 * Intelligent error classification and handling system
 */
export class ErrorHandler extends EventEmitter {
  private metrics: ErrorMetrics;
  private defaultRetryPolicy: RetryPolicy;

  constructor(retryPolicy?: Partial<RetryPolicy>) {
    super();

    this.defaultRetryPolicy = {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 30000,
      backoffMultiplier: 2,
      jitter: true,
      timeout: 30000,
      ...retryPolicy,
    };

    this.metrics = {
      totalErrors: 0,
      errorsByType: {},
      retryAttempts: 0,
      successfulRetries: 0,
      circuitBreakerTrips: 0,
    };
  }

  /**
   * Classify an error into appropriate error type
   */
  classifyError(error: Error | any, context?: string): LighthouseError {
    // If already a LighthouseError, return as-is
    if (error instanceof LighthouseError) {
      return error;
    }

    const message = error.message || "Unknown error";
    const statusCode = error.status || error.statusCode;

    // Timeout errors (check before network errors since timeouts can have network-like codes)
    if (this.isTimeoutError(error)) {
      return new TimeoutError(
        `Operation timed out${context ? ` in ${context}` : ""}: ${message}`,
        error,
      );
    }

    // Network errors
    if (this.isNetworkError(error)) {
      return new NetworkError(`Network error${context ? ` in ${context}` : ""}: ${message}`, error);
    }

    // Authentication errors
    if (statusCode === 401 || statusCode === 403 || message.includes("auth")) {
      return new AuthenticationError(
        `Authentication failed${context ? ` in ${context}` : ""}: ${message}`,
        statusCode,
        error,
      );
    }

    // Rate limit errors
    if (
      statusCode === 429 ||
      message.includes("rate limit") ||
      message.includes("too many requests")
    ) {
      const retryAfter = this.extractRetryAfter(error);
      return new RateLimitError(
        `Rate limit exceeded${context ? ` in ${context}` : ""}: ${message}`,
        retryAfter,
        error,
      );
    }

    // Timeout errors
    if (this.isTimeoutError(error)) {
      return new TimeoutError(
        `Operation timed out${context ? ` in ${context}` : ""}: ${message}`,
        error,
      );
    }

    // File not found
    if (statusCode === 404 || message.includes("not found")) {
      return new FileNotFoundError(
        `Resource not found${context ? ` in ${context}` : ""}: ${message}`,
        error,
      );
    }

    // Validation errors
    if (statusCode === 400 || message.includes("invalid") || message.includes("validation")) {
      return new ValidationError(
        `Validation failed${context ? ` in ${context}` : ""}: ${message}`,
        error,
      );
    }

    // Storage errors
    if (statusCode === 507 || message.includes("storage") || message.includes("quota")) {
      return new InsufficientStorageError(
        `Storage limit exceeded${context ? ` in ${context}` : ""}: ${message}`,
        error,
      );
    }

    // Default to generic error
    return new LighthouseError(
      `Operation failed${context ? ` in ${context}` : ""}: ${message}`,
      "UNKNOWN_ERROR",
      this.isRetryableError(error),
      statusCode,
      error,
    );
  }

  /**
   * Execute operation with retry logic and error handling
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: string,
    customPolicy?: Partial<RetryPolicy>,
  ): Promise<T> {
    const policy = { ...this.defaultRetryPolicy, ...customPolicy };
    let lastError: LighthouseError | undefined;

    for (let attempt = 0; attempt <= policy.maxRetries; attempt++) {
      try {
        // Apply timeout if specified
        if (policy.timeout) {
          return await this.withTimeout(operation(), policy.timeout);
        }
        return await operation();
      } catch (error) {
        lastError = this.classifyError(error, context);
        this.recordError(lastError);

        // Don't retry if not retryable or max attempts reached
        if (!lastError.retryable || attempt === policy.maxRetries) {
          break;
        }

        this.metrics.retryAttempts++;
        this.emit("retry", { attempt, error: lastError, context });

        // Calculate delay with exponential backoff and jitter
        const delay = this.calculateDelay(attempt, policy);
        await this.sleep(delay);
      }
    }

    if (lastError) {
      this.emit("error", lastError);
      throw lastError;
    }

    // This should never happen, but TypeScript needs it
    throw new Error("Operation failed without error details");
  }

  /**
   * Get current error metrics
   */
  getMetrics(): ErrorMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset error metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalErrors: 0,
      errorsByType: {},
      retryAttempts: 0,
      successfulRetries: 0,
      circuitBreakerTrips: 0,
    };
  }

  /**
   * Check if error is network-related
   */
  private isNetworkError(error: any): boolean {
    // Don't classify timeout errors as network errors
    if (this.isTimeoutError(error)) {
      return false;
    }

    const networkCodes = ["ENOTFOUND", "ECONNREFUSED", "ECONNRESET"];
    const networkMessages = ["network", "connection", "dns", "socket"];

    return (
      networkCodes.includes(error.code) ||
      networkMessages.some((msg) => error.message?.toLowerCase().includes(msg))
    );
  }

  /**
   * Check if error is timeout-related
   */
  private isTimeoutError(error: any): boolean {
    return (
      error.code === "ETIMEDOUT" ||
      error.name === "TimeoutError" ||
      error.message?.includes("timeout") ||
      error.message?.includes("timed out")
    );
  }

  /**
   * Check if error is generally retryable
   */
  private isRetryableError(error: any): boolean {
    const retryableMessages = ["network", "timeout", "connection", "temporary", "server error"];
    const retryableCodes = [500, 502, 503, 504];

    return (
      retryableCodes.includes(error.status || error.statusCode) ||
      retryableMessages.some((msg) => error.message?.toLowerCase().includes(msg))
    );
  }

  /**
   * Extract retry-after header value
   */
  private extractRetryAfter(error: unknown): number | undefined {
    const retryAfter = (error as any).headers?.["retry-after"] || (error as any).retryAfter;
    return retryAfter ? parseInt(retryAfter, 10) * 1000 : undefined;
  }

  /**
   * Record error in metrics
   */
  private recordError(error: LighthouseError): void {
    this.metrics.totalErrors++;
    this.metrics.errorsByType[error.code] = (this.metrics.errorsByType[error.code] || 0) + 1;
    this.metrics.lastErrorAt = new Date();
  }

  /**
   * Calculate delay with exponential backoff
   */
  private calculateDelay(attempt: number, policy: RetryPolicy): number {
    let delay = policy.baseDelay * Math.pow(policy.backoffMultiplier, attempt);
    delay = Math.min(delay, policy.maxDelay);

    if (policy.jitter) {
      delay += Math.random() * 1000;
    }

    return delay;
  }

  /**
   * Add timeout to a promise
   */
  private withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new TimeoutError(`Operation timed out after ${timeoutMs}ms`)),
          timeoutMs,
        ),
      ),
    ]);
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
