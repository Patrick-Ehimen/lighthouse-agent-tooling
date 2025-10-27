/**
 * Error handling utilities with retry logic and structured error management
 */

import {
  ERROR_CODES,
  ERROR_MESSAGES,
  RECOVERABLE_ERROR_CODES,
  API_RETRY_CONFIG,
} from "../constants";

export interface RetryConfig {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  retryCondition?: (error: Error) => boolean;
}

export interface LighthouseError extends Error {
  code: string;
  category: string;
  recoverable: boolean;
  context?: Record<string, any>;
  timestamp: string;
}

export class RetryManager {
  /**
   * Execute an operation with retry logic
   */
  static async withRetry<T>(operation: () => Promise<T>, config: RetryConfig = {}): Promise<T> {
    const {
      maxRetries = API_RETRY_CONFIG.MAX_RETRIES,
      initialDelay = API_RETRY_CONFIG.INITIAL_DELAY,
      maxDelay = API_RETRY_CONFIG.MAX_DELAY,
      backoffMultiplier = API_RETRY_CONFIG.BACKOFF_MULTIPLIER,
      retryCondition = this.defaultRetryCondition,
    } = config;

    let lastError: Error;
    let delay = initialDelay;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        // Don't retry on the last attempt or if retry condition fails
        if (attempt === maxRetries || !retryCondition(lastError)) {
          throw lastError;
        }

        // Wait before retrying
        await this.delay(Math.min(delay, maxDelay));
        delay *= backoffMultiplier;
      }
    }

    throw lastError!;
  }

  /**
   * Default retry condition - retry on recoverable errors
   */
  private static defaultRetryCondition(error: Error): boolean {
    if (error instanceof LighthouseErrorImpl) {
      return RECOVERABLE_ERROR_CODES.includes(error.code as any);
    }

    // Retry on network-related errors
    const networkErrorPatterns = [
      /network/i,
      /timeout/i,
      /connection/i,
      /econnreset/i,
      /enotfound/i,
    ];

    return networkErrorPatterns.some((pattern) => pattern.test(error.message));
  }

  /**
   * Delay execution for specified milliseconds
   */
  private static delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export class LighthouseErrorImpl extends Error implements LighthouseError {
  public readonly code: string;
  public readonly category: string;
  public readonly recoverable: boolean;
  public readonly context?: Record<string, any>;
  public readonly timestamp: string;

  constructor(code: keyof typeof ERROR_CODES, message?: string, context?: Record<string, any>) {
    const errorMessage = message || ERROR_MESSAGES[ERROR_CODES[code]] || "Unknown error";
    super(errorMessage);

    this.name = "LighthouseError";
    this.code = ERROR_CODES[code];
    this.category = LighthouseErrorImpl.determineCategory(this.code);
    this.recoverable = RECOVERABLE_ERROR_CODES.includes(this.code as any);
    this.context = context;
    this.timestamp = new Date().toISOString();

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, LighthouseErrorImpl);
    }
  }

  private static determineCategory(code: string): string {
    if (code.startsWith("AUTH_")) return "authentication";
    if (code.startsWith("FILE_")) return "file_operation";
    if (code.startsWith("NET_")) return "network";
    if (code.startsWith("VAL_")) return "validation";
    if (code.startsWith("SYS_")) return "system";
    if (code.startsWith("MCP_")) return "mcp";
    return "unknown";
  }

  /**
   * Convert error to JSON for logging or API responses
   */
  toJSON(): Record<string, any> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      category: this.category,
      recoverable: this.recoverable,
      context: this.context,
      timestamp: this.timestamp,
      stack: this.stack,
    };
  }
}

/**
 * Error factory functions for common error types
 */
export class ErrorFactory {
  static authentication(message?: string, context?: Record<string, any>): LighthouseError {
    return new LighthouseErrorImpl("AUTHENTICATION_FAILED", message, context);
  }

  static fileNotFound(filePath: string, context?: Record<string, any>): LighthouseError {
    return new LighthouseErrorImpl("FILE_NOT_FOUND", `File not found: ${filePath}`, {
      filePath,
      ...context,
    });
  }

  static validation(field: string, value: any, context?: Record<string, any>): LighthouseError {
    return new LighthouseErrorImpl("VALIDATION_ERROR", `Validation failed for field: ${field}`, {
      field,
      value,
      ...context,
    });
  }

  static network(message?: string, context?: Record<string, any>): LighthouseError {
    return new LighthouseErrorImpl("NETWORK_ERROR", message, context);
  }

  static system(message?: string, context?: Record<string, any>): LighthouseError {
    return new LighthouseErrorImpl("SYSTEM_ERROR", message, context);
  }
}

/**
 * Global error handler for unhandled errors
 */
export class GlobalErrorHandler {
  private static handlers: Array<(error: Error) => void> = [];

  static addHandler(handler: (error: Error) => void): void {
    this.handlers.push(handler);
  }

  static removeHandler(handler: (error: Error) => void): void {
    const index = this.handlers.indexOf(handler);
    if (index > -1) {
      this.handlers.splice(index, 1);
    }
  }

  static handleError(error: Error): void {
    this.handlers.forEach((handler) => {
      try {
        handler(error);
      } catch (handlerError) {
        console.error("Error in error handler:", handlerError);
      }
    });
  }

  static setup(): void {
    process.on("uncaughtException", this.handleError.bind(this));
    process.on("unhandledRejection", (reason) => {
      const error = reason instanceof Error ? reason : new Error(String(reason));
      this.handleError(error);
    });
  }
}
