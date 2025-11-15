/**
 * Authentication types and interfaces
 */

import { ILighthouseService } from "../services/ILighthouseService.js";

/**
 * Result of API key validation
 */
export interface ValidationResult {
  isValid: boolean;
  keyHash: string;
  expiresAt?: Date;
  errorMessage?: string;
  rateLimitInfo?: RateLimitInfo;
}

/**
 * Rate limit information
 */
export interface RateLimitInfo {
  remaining: number;
  resetTime: Date;
  limit: number;
}

/**
 * Rate limit result
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: Date;
  retryAfter?: number;
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  enabled: boolean;
  maxSize: number;
  ttlSeconds: number;
  cleanupIntervalSeconds: number;
}

/**
 * Rate limiting configuration
 */
export interface RateLimitConfig {
  enabled: boolean;
  requestsPerMinute: number;
  burstLimit: number;
  keyBasedLimiting: boolean;
}

/**
 * Authentication configuration
 */
export interface AuthConfig {
  defaultApiKey?: string;
  enablePerRequestAuth: boolean;
  requireAuthentication: boolean;
  keyValidationCache: CacheConfig;
  rateLimiting: RateLimitConfig;
}

/**
 * Performance configuration
 */
export interface PerformanceConfig {
  servicePoolSize: number;
  serviceTimeoutMinutes: number;
  concurrentRequestLimit: number;
}

/**
 * Request context parameters
 */
export interface RequestContextParams {
  apiKey: string;
  keyHash: string;
  service: ILighthouseService;
  toolName: string;
}

/**
 * Log context for secure logging
 */
export interface LogContext {
  requestId: string;
  keyHash: string;
  toolName: string;
  timestamp: string;
}

/**
 * Cache entry for validation results
 */
export interface CacheEntry {
  result: ValidationResult;
  expiresAt: number;
  lastAccessed: number;
}

/**
 * Rate limit entry
 */
export interface RateLimitEntry {
  requests: number[];
  burstCount: number;
}

/**
 * Service entry for pooling
 */
export interface ServiceEntry {
  service: ILighthouseService;
  created: number;
  lastUsed: number;
  keyHash: string;
}

/**
 * Authentication result
 */
export interface AuthenticationResult {
  success: boolean;
  keyHash: string;
  usedFallback: boolean;
  rateLimited: boolean;
  authTime?: number;
  errorMessage?: string;
}
