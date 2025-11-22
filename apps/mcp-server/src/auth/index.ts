/**
 * Authentication module exports
 */

export { AuthManager } from "./AuthManager.js";
export { KeyValidationCache } from "./KeyValidationCache.js";
export { RateLimiter } from "./RateLimiter.js";
export { SecureKeyHandler } from "./SecureKeyHandler.js";
export { RequestContext } from "./RequestContext.js";
export { LighthouseServiceFactory } from "./LighthouseServiceFactory.js";
export { MetricsCollector } from "./MetricsCollector.js";
export { AuthLogger } from "./AuthLogger.js";
export { SecurityAlerter } from "./SecurityAlerter.js";
export {
  MemoryManager,
  SensitiveData,
  memoryManager,
  createSensitive,
  clearSensitiveFields,
  withSecureContext,
} from "./MemoryManager.js";

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

export type {
  AuthMetrics,
  KeyUsageStats,
  SecurityEvent,
  SecurityEventType,
  MetricsConfig,
} from "./MetricsCollector.js";

export type { AuthLogEntry, AuditEntry, AuthLoggerConfig, AuthLogLevel } from "./AuthLogger.js";

export type {
  AlertConfig,
  AlertNotification,
  AlertHandler,
  AlertSeverity,
} from "./SecurityAlerter.js";

export type { MemoryManagerConfig } from "./MemoryManager.js";
