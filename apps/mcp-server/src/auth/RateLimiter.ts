/**
 * Rate limiter with sliding window algorithm and per-key limits
 */

import { RateLimitConfig, RateLimitEntry, RateLimitResult } from "./types.js";

export class RateLimiter {
  private limits = new Map<string, RateLimitEntry>();
  private config: RateLimitConfig;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(config: RateLimitConfig) {
    this.config = config;

    // Cleanup expired entries every minute
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Check if a request is allowed for the given key
   */
  isAllowed(keyHash: string): RateLimitResult {
    if (!this.config.enabled) {
      return {
        allowed: true,
        remaining: Infinity,
        resetTime: new Date(Date.now() + 60000),
      };
    }

    const now = Date.now();
    const windowStart = now - 60 * 1000; // 1 minute window

    let entry = this.limits.get(keyHash);
    if (!entry) {
      entry = { requests: [], burstCount: 0 };
      this.limits.set(keyHash, entry);
    }

    // Remove old requests outside the window
    entry.requests = entry.requests.filter((time) => time > windowStart);

    // Check rate limits
    const requestsInWindow = entry.requests.length;
    const canMakeRequest = requestsInWindow < this.config.requestsPerMinute;

    if (canMakeRequest) {
      entry.requests.push(now);

      return {
        allowed: true,
        remaining: this.config.requestsPerMinute - entry.requests.length,
        resetTime: new Date(windowStart + 60000),
      };
    }

    const retryAfter = Math.ceil((windowStart + 60000 - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      resetTime: new Date(windowStart + 60000),
      retryAfter: retryAfter > 0 ? retryAfter : 1,
    };
  }

  /**
   * Record a request for the given key
   */
  recordRequest(keyHash: string): void {
    if (!this.config.enabled) return;

    const now = Date.now();
    const windowStart = now - 60 * 1000;

    let entry = this.limits.get(keyHash);
    if (!entry) {
      entry = { requests: [], burstCount: 0 };
      this.limits.set(keyHash, entry);
    }

    // Remove old requests
    entry.requests = entry.requests.filter((time) => time > windowStart);
    entry.requests.push(now);
    entry.burstCount++;

    // Reset burst count if this is the first request in the window
    if (entry.requests.length === 1) {
      entry.burstCount = 1;
    }
  }

  /**
   * Get current rate limit status for a key
   */
  getStatus(keyHash: string): RateLimitResult {
    if (!this.config.enabled) {
      return {
        allowed: true,
        remaining: Infinity,
        resetTime: new Date(Date.now() + 60000),
      };
    }

    const now = Date.now();
    const windowStart = now - 60 * 1000;

    const entry = this.limits.get(keyHash);
    if (!entry) {
      return {
        allowed: true,
        remaining: this.config.requestsPerMinute,
        resetTime: new Date(windowStart + 60000),
      };
    }

    // Filter to current window
    const currentRequests = entry.requests.filter((time) => time > windowStart);
    const remaining = Math.max(0, this.config.requestsPerMinute - currentRequests.length);

    return {
      allowed: remaining > 0,
      remaining,
      resetTime: new Date(windowStart + 60000),
      retryAfter: remaining === 0 ? Math.ceil((windowStart + 60000 - now) / 1000) : undefined,
    };
  }

  /**
   * Reset rate limit for a specific key
   */
  reset(keyHash: string): void {
    this.limits.delete(keyHash);
  }

  /**
   * Clear all rate limit data
   */
  clear(): void {
    this.limits.clear();
  }

  /**
   * Clean up old entries
   */
  private cleanup(): void {
    const now = Date.now();
    const windowStart = now - 60 * 1000;
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.limits.entries()) {
      // Remove old requests
      entry.requests = entry.requests.filter((time) => time > windowStart);

      // If no requests in current window, remove entry
      if (entry.requests.length === 0) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach((key) => this.limits.delete(key));
  }

  /**
   * Destroy the rate limiter and cleanup resources
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
    this.clear();
  }
}
