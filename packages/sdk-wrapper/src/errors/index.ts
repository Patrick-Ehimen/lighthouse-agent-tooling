/**
 * Error handling system for the Lighthouse AI SDK
 */

export { ErrorHandler } from "./ErrorHandler";
export { CircuitBreaker, CircuitState } from "./CircuitBreaker";
export {
  LighthouseError,
  NetworkError,
  AuthenticationError,
  RateLimitError,
  TimeoutError,
  ValidationError,
  FileNotFoundError,
  InsufficientStorageError,
} from "./errors";
export type { RetryPolicy, ErrorMetrics, CircuitBreakerConfig } from "./types";
