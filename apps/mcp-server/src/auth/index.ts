/**
 * Authentication module exports
 */

export { AuthManager } from "./AuthManager.js";
export { KeyValidationCache } from "./KeyValidationCache.js";
export { RateLimiter } from "./RateLimiter.js";
export { SecureKeyHandler } from "./SecureKeyHandler.js";
export { RequestContext } from "./RequestContext.js";
export { LighthouseServiceFactory } from "./LighthouseServiceFactory.js";

export type {
  AuthConfig,
  ValidationResult,
  RateLimitInfo,
  RateLimitResult,
  CacheConfig,
  RateLimitConfig,
  PerformanceConfig,
  RequestContextParams,
  LogContext,
  CacheEntry,
  RateLimitEntry,
  ServiceEntry,
  AuthenticationResult,
} from "./types.js";
