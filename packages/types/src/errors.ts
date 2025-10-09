/**
 * Error types and handling for Lighthouse AI integration
 * @fileoverview Defines error types, error codes, and retry configurations
 */

/**
 * Base Lighthouse error class
 */
export class LighthouseError extends Error {
  /** Error code */
  public readonly code: ErrorType;
  /** Error severity */
  public readonly severity: ErrorSeverity;
  /** Additional error data */
  public readonly data?: Record<string, unknown>;
  /** Original error (if wrapped) */
  public readonly originalError?: Error;
  /** Timestamp when the error occurred */
  public readonly timestamp: Date;
  /** Whether the error is retryable */
  public readonly retryable: boolean;

  constructor(
    message: string,
    code: ErrorType,
    severity: ErrorSeverity = ErrorSeverity.ERROR,
    data?: Record<string, unknown>,
    originalError?: Error,
    retryable: boolean = false,
  ) {
    super(message);
    this.name = "LighthouseError";
    this.code = code;
    this.severity = severity;
    this.data = data;
    this.originalError = originalError;
    this.timestamp = new Date();
    this.retryable = retryable;
  }

  /**
   * Convert error to JSON representation
   */
  toJSON(): ErrorJSON {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      severity: this.severity,
      data: this.data,
      timestamp: this.timestamp.toISOString(),
      retryable: this.retryable,
      stack: this.stack,
    };
  }
}

/**
 * JSON representation of an error
 */
export interface ErrorJSON {
  /** Error name */
  name: string;
  /** Error message */
  message: string;
  /** Error code */
  code: ErrorType;
  /** Error severity */
  severity: ErrorSeverity;
  /** Additional error data */
  data?: Record<string, unknown>;
  /** Error timestamp */
  timestamp: string;
  /** Whether error is retryable */
  retryable: boolean;
  /** Error stack trace */
  stack?: string;
}

/**
 * Types of errors that can occur in the Lighthouse system
 */
export enum ErrorType {
  /** Authentication errors */
  AUTHENTICATION_ERROR = "authentication_error",
  /** Authorization errors */
  AUTHORIZATION_ERROR = "authorization_error",
  /** Network errors */
  NETWORK_ERROR = "network_error",
  /** File operation errors */
  FILE_ERROR = "file_error",
  /** Encryption errors */
  ENCRYPTION_ERROR = "encryption_error",
  /** Upload errors */
  UPLOAD_ERROR = "upload_error",
  /** Download errors */
  DOWNLOAD_ERROR = "download_error",
  /** Dataset errors */
  DATASET_ERROR = "dataset_error",
  /** MCP protocol errors */
  MCP_ERROR = "mcp_error",
  /** Configuration errors */
  CONFIGURATION_ERROR = "configuration_error",
  /** Validation errors */
  VALIDATION_ERROR = "validation_error",
  /** Rate limit errors */
  RATE_LIMIT_ERROR = "rate_limit_error",
  /** Quota exceeded errors */
  QUOTA_EXCEEDED_ERROR = "quota_exceeded_error",
  /** Service unavailable errors */
  SERVICE_UNAVAILABLE_ERROR = "service_unavailable_error",
  /** Unknown errors */
  UNKNOWN_ERROR = "unknown_error",
}

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  /** Low severity - informational */
  INFO = "info",
  /** Medium severity - warning */
  WARNING = "warning",
  /** High severity - error */
  ERROR = "error",
  /** Critical severity - fatal */
  CRITICAL = "critical",
}

/**
 * Retry configuration for operations
 */
export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxAttempts: number;
  /** Initial delay between retries (in milliseconds) */
  initialDelay: number;
  /** Maximum delay between retries (in milliseconds) */
  maxDelay: number;
  /** Backoff multiplier for delay calculation */
  backoffMultiplier: number;
  /** Jitter factor for delay randomization */
  jitterFactor: number;
  /** Whether to use exponential backoff */
  exponentialBackoff: boolean;
  /** Retry conditions */
  retryConditions: RetryCondition[];
  /** Custom retry logic */
  customRetryLogic?: (error: Error, attempt: number) => boolean;
}

/**
 * Conditions for retrying operations
 */
export interface RetryCondition {
  /** Error types that should trigger retry */
  errorTypes: ErrorType[];
  /** HTTP status codes that should trigger retry */
  statusCodes?: number[];
  /** Custom condition function */
  condition?: (error: Error) => boolean;
}

/**
 * Retry attempt information
 */
export interface RetryAttempt {
  /** Attempt number (1-based) */
  attempt: number;
  /** Maximum attempts allowed */
  maxAttempts: number;
  /** Delay before this attempt (in milliseconds) */
  delay: number;
  /** Total elapsed time (in milliseconds) */
  elapsedTime: number;
  /** Whether this is the final attempt */
  isFinalAttempt: boolean;
  /** Error that triggered the retry */
  error: Error;
}

/**
 * Retry result
 */
export interface RetryResult<T> {
  /** Whether the operation succeeded */
  success: boolean;
  /** Result data (if successful) */
  result?: T;
  /** Final error (if failed) */
  error?: Error;
  /** Number of attempts made */
  attempts: number;
  /** Total time taken (in milliseconds) */
  totalTime: number;
  /** Retry attempts made */
  retryAttempts: RetryAttempt[];
}

/**
 * Error handler configuration
 */
export interface ErrorHandlerConfig {
  /** Whether to log errors */
  logErrors: boolean;
  /** Whether to report errors to external service */
  reportErrors: boolean;
  /** Error reporting endpoint */
  reportingEndpoint?: string;
  /** Custom error handlers */
  customHandlers: CustomErrorHandler[];
  /** Error filtering */
  errorFilter?: ErrorFilter;
}

/**
 * Custom error handler
 */
export interface CustomErrorHandler {
  /** Handler name */
  name: string;
  /** Error types this handler processes */
  errorTypes: ErrorType[];
  /** Handler function */
  handler: (error: LighthouseError) => Promise<void> | void;
  /** Whether handler is enabled */
  enabled: boolean;
}

/**
 * Error filter configuration
 */
export interface ErrorFilter {
  /** Error types to include */
  includeTypes?: ErrorType[];
  /** Error types to exclude */
  excludeTypes?: ErrorType[];
  /** Severity levels to include */
  includeSeverities?: ErrorSeverity[];
  /** Severity levels to exclude */
  excludeSeverities?: ErrorSeverity[];
  /** Custom filter function */
  customFilter?: (error: LighthouseError) => boolean;
}

/**
 * Error metrics and statistics
 */
export interface ErrorMetrics {
  /** Total number of errors */
  totalErrors: number;
  /** Errors by type */
  errorsByType: Record<ErrorType, number>;
  /** Errors by severity */
  errorsBySeverity: Record<ErrorSeverity, number>;
  /** Error rate (errors per minute) */
  errorRate: number;
  /** Most common error types */
  topErrors: Array<{
    type: ErrorType;
    count: number;
    percentage: number;
  }>;
  /** Error trends over time */
  trends: ErrorTrend[];
}

/**
 * Error trend over time
 */
export interface ErrorTrend {
  /** Time period */
  period: string;
  /** Number of errors in this period */
  count: number;
  /** Error rate in this period */
  rate: number;
}

/**
 * Default retry configurations for different operation types
 */
export const DEFAULT_RETRY_CONFIGS: Record<string, RetryConfig> = {
  /** File upload operations */
  upload: {
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
    jitterFactor: 0.1,
    exponentialBackoff: true,
    retryConditions: [
      {
        errorTypes: [ErrorType.NETWORK_ERROR, ErrorType.UPLOAD_ERROR],
        statusCodes: [500, 502, 503, 504],
      },
    ],
  },
  /** File download operations */
  download: {
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
    jitterFactor: 0.1,
    exponentialBackoff: true,
    retryConditions: [
      {
        errorTypes: [ErrorType.NETWORK_ERROR, ErrorType.DOWNLOAD_ERROR],
        statusCodes: [500, 502, 503, 504],
      },
    ],
  },
  /** Authentication operations */
  auth: {
    maxAttempts: 2,
    initialDelay: 500,
    maxDelay: 2000,
    backoffMultiplier: 2,
    jitterFactor: 0.1,
    exponentialBackoff: true,
    retryConditions: [
      {
        errorTypes: [ErrorType.AUTHENTICATION_ERROR],
        statusCodes: [401, 403],
      },
    ],
  },
  /** MCP operations */
  mcp: {
    maxAttempts: 2,
    initialDelay: 500,
    maxDelay: 5000,
    backoffMultiplier: 2,
    jitterFactor: 0.1,
    exponentialBackoff: true,
    retryConditions: [
      {
        errorTypes: [ErrorType.MCP_ERROR, ErrorType.NETWORK_ERROR],
        statusCodes: [500, 502, 503, 504],
      },
    ],
  },
};
