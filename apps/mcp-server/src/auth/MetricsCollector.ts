/**
 * Metrics collector for authentication and usage statistics
 */

import { AuthenticationResult } from "./types.js";

/**
 * Authentication metrics interface
 */
export interface AuthMetrics {
  // Authentication statistics
  totalRequests: number;
  authenticatedRequests: number;
  fallbackRequests: number;
  failedAuthentications: number;

  // Performance metrics
  averageAuthTime: number;
  cacheHitRate: number;

  // Security metrics
  rateLimitedRequests: number;
  uniqueApiKeys: number;

  // Per-key metrics (using hashes)
  keyUsageStats: Map<string, KeyUsageStats>;
}

/**
 * Per-key usage statistics
 */
export interface KeyUsageStats {
  keyHash: string;
  requestCount: number;
  lastUsed: Date;
  errorCount: number;
  averageResponseTime: number;
  totalResponseTime: number;
  rateLimitedCount: number;
}

/**
 * Security event types
 */
export enum SecurityEventType {
  AUTHENTICATION_FAILURE = "AUTHENTICATION_FAILURE",
  RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",
  INVALID_KEY_FORMAT = "INVALID_KEY_FORMAT",
  SUSPICIOUS_ACTIVITY = "SUSPICIOUS_ACTIVITY",
  MULTIPLE_FAILURES = "MULTIPLE_FAILURES",
}

/**
 * Security event interface
 */
export interface SecurityEvent {
  type: SecurityEventType;
  keyHash: string;
  timestamp: Date;
  details: Record<string, unknown>;
  severity: "low" | "medium" | "high" | "critical";
}

/**
 * Metrics collector configuration
 */
export interface MetricsConfig {
  enabled: boolean;
  retentionPeriodHours: number;
  alertThresholds: {
    failureRatePercent: number;
    rateLimitThreshold: number;
    suspiciousActivityThreshold: number;
  };
  cleanupIntervalMinutes: number;
}

/**
 * Default metrics configuration
 */
export const DEFAULT_METRICS_CONFIG: MetricsConfig = {
  enabled: true,
  retentionPeriodHours: 24,
  alertThresholds: {
    failureRatePercent: 10,
    rateLimitThreshold: 100,
    suspiciousActivityThreshold: 50,
  },
  cleanupIntervalMinutes: 60,
};

/**
 * Metrics collector for authentication and security events
 */
export class MetricsCollector {
  private metrics: AuthMetrics;
  private config: MetricsConfig;
  private securityEvents: SecurityEvent[] = [];
  private authTimings: number[] = [];
  private cacheHits = 0;
  private cacheMisses = 0;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(config: MetricsConfig = DEFAULT_METRICS_CONFIG) {
    this.config = config;
    this.metrics = {
      totalRequests: 0,
      authenticatedRequests: 0,
      fallbackRequests: 0,
      failedAuthentications: 0,
      averageAuthTime: 0,
      cacheHitRate: 0,
      rateLimitedRequests: 0,
      uniqueApiKeys: 0,
      keyUsageStats: new Map(),
    };

    // Don't start cleanup interval automatically in tests
    if (this.config.enabled && process.env.NODE_ENV !== "test") {
      this.startCleanupInterval();
    }
  }

  /**
   * Record an authentication attempt
   */
  recordAuthentication(result: AuthenticationResult): void {
    if (!this.config.enabled) return;

    this.metrics.totalRequests++;

    if (result.success) {
      this.metrics.authenticatedRequests++;
      if (result.usedFallback) {
        this.metrics.fallbackRequests++;
      }
    } else {
      this.metrics.failedAuthentications++;

      // Record security event for failed authentication
      this.recordSecurityEvent({
        type: SecurityEventType.AUTHENTICATION_FAILURE,
        keyHash: result.keyHash,
        timestamp: new Date(),
        details: {
          errorMessage: result.errorMessage,
          usedFallback: result.usedFallback,
          authTime: result.authTime,
        },
        severity: "medium",
      });
    }

    if (result.rateLimited) {
      this.metrics.rateLimitedRequests++;
      this.recordSecurityEvent({
        type: SecurityEventType.RATE_LIMIT_EXCEEDED,
        keyHash: result.keyHash,
        timestamp: new Date(),
        details: {
          authTime: result.authTime,
        },
        severity: "high",
      });
    }

    // Update per-key stats
    this.updateKeyStats(result.keyHash, result);

    // Update timing metrics
    if (result.authTime !== undefined) {
      this.authTimings.push(result.authTime);
      this.updateAverageAuthTime();
    }

    // Check for suspicious activity
    this.checkSuspiciousActivity(result.keyHash);
  }

  /**
   * Record cache hit or miss
   */
  recordCacheAccess(hit: boolean): void {
    if (!this.config.enabled) return;

    if (hit) {
      this.cacheHits++;
    } else {
      this.cacheMisses++;
    }

    this.updateCacheHitRate();
  }

  /**
   * Record a security event
   */
  recordSecurityEvent(event: SecurityEvent): void {
    if (!this.config.enabled) return;

    this.securityEvents.push(event);

    // Clean up old events if needed
    const cutoffTime = new Date(Date.now() - this.config.retentionPeriodHours * 60 * 60 * 1000);
    this.securityEvents = this.securityEvents.filter((e) => e.timestamp > cutoffTime);
  }

  /**
   * Get current metrics
   */
  getMetrics(): AuthMetrics {
    return {
      ...this.metrics,
      keyUsageStats: new Map(this.metrics.keyUsageStats),
    };
  }

  /**
   * Get security events within time range
   */
  getSecurityEvents(since?: Date): SecurityEvent[] {
    const cutoff = since || new Date(Date.now() - 60 * 60 * 1000); // Last hour by default
    return this.securityEvents.filter((event) => event.timestamp >= cutoff);
  }

  /**
   * Get metrics for a specific key hash
   */
  getKeyMetrics(keyHash: string): KeyUsageStats | undefined {
    return this.metrics.keyUsageStats.get(keyHash);
  }

  /**
   * Get failure rate for a specific key
   */
  getKeyFailureRate(keyHash: string): number {
    const stats = this.metrics.keyUsageStats.get(keyHash);
    if (!stats || stats.requestCount === 0) return 0;
    return (stats.errorCount / stats.requestCount) * 100;
  }

  /**
   * Check if alerts should be triggered
   */
  checkAlerts(): SecurityEvent[] {
    const alerts: SecurityEvent[] = [];

    // Check overall failure rate
    const overallFailureRate =
      this.metrics.totalRequests > 0
        ? (this.metrics.failedAuthentications / this.metrics.totalRequests) * 100
        : 0;

    if (overallFailureRate > this.config.alertThresholds.failureRatePercent) {
      alerts.push({
        type: SecurityEventType.MULTIPLE_FAILURES,
        keyHash: "system",
        timestamp: new Date(),
        details: {
          failureRate: overallFailureRate,
          threshold: this.config.alertThresholds.failureRatePercent,
          totalRequests: this.metrics.totalRequests,
          failedRequests: this.metrics.failedAuthentications,
        },
        severity: "critical",
      });
    }

    // Check per-key failure rates
    for (const [keyHash, stats] of Array.from(this.metrics.keyUsageStats.entries())) {
      const keyFailureRate = this.getKeyFailureRate(keyHash);
      if (
        keyFailureRate > this.config.alertThresholds.failureRatePercent &&
        stats.requestCount >= 10
      ) {
        alerts.push({
          type: SecurityEventType.MULTIPLE_FAILURES,
          keyHash,
          timestamp: new Date(),
          details: {
            failureRate: keyFailureRate,
            threshold: this.config.alertThresholds.failureRatePercent,
            requestCount: stats.requestCount,
            errorCount: stats.errorCount,
          },
          severity: "high",
        });
      }
    }

    return alerts;
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.metrics = {
      totalRequests: 0,
      authenticatedRequests: 0,
      fallbackRequests: 0,
      failedAuthentications: 0,
      averageAuthTime: 0,
      cacheHitRate: 0,
      rateLimitedRequests: 0,
      uniqueApiKeys: 0,
      keyUsageStats: new Map(),
    };
    this.securityEvents = [];
    this.authTimings = [];
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }

  /**
   * Destroy the metrics collector and cleanup resources
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
  }

  /**
   * Update per-key statistics
   */
  private updateKeyStats(keyHash: string, result: AuthenticationResult): void {
    let stats = this.metrics.keyUsageStats.get(keyHash);

    if (!stats) {
      stats = {
        keyHash,
        requestCount: 0,
        lastUsed: new Date(),
        errorCount: 0,
        averageResponseTime: 0,
        totalResponseTime: 0,
        rateLimitedCount: 0,
      };
      this.metrics.keyUsageStats.set(keyHash, stats);
      this.metrics.uniqueApiKeys = this.metrics.keyUsageStats.size;
    }

    stats.requestCount++;
    stats.lastUsed = new Date();

    if (!result.success) {
      stats.errorCount++;
    }

    if (result.rateLimited) {
      stats.rateLimitedCount++;
    }

    if (result.authTime !== undefined) {
      stats.totalResponseTime += result.authTime;
      stats.averageResponseTime = stats.totalResponseTime / stats.requestCount;
    }
  }

  /**
   * Update average authentication time
   */
  private updateAverageAuthTime(): void {
    if (this.authTimings.length === 0) return;

    // Keep only recent timings (last 1000)
    if (this.authTimings.length > 1000) {
      this.authTimings = this.authTimings.slice(-1000);
    }

    const sum = this.authTimings.reduce((acc, time) => acc + time, 0);
    this.metrics.averageAuthTime = sum / this.authTimings.length;
  }

  /**
   * Update cache hit rate
   */
  private updateCacheHitRate(): void {
    const total = this.cacheHits + this.cacheMisses;
    this.metrics.cacheHitRate = total > 0 ? (this.cacheHits / total) * 100 : 0;
  }

  /**
   * Check for suspicious activity patterns
   */
  private checkSuspiciousActivity(keyHash: string): void {
    const stats = this.metrics.keyUsageStats.get(keyHash);
    if (!stats) return;

    // Check for rapid successive failures
    const recentEvents = this.securityEvents.filter(
      (event) =>
        event.keyHash === keyHash &&
        event.timestamp > new Date(Date.now() - 5 * 60 * 1000) && // Last 5 minutes
        event.type === SecurityEventType.AUTHENTICATION_FAILURE,
    );

    if (recentEvents.length >= this.config.alertThresholds.suspiciousActivityThreshold) {
      this.recordSecurityEvent({
        type: SecurityEventType.SUSPICIOUS_ACTIVITY,
        keyHash,
        timestamp: new Date(),
        details: {
          recentFailures: recentEvents.length,
          threshold: this.config.alertThresholds.suspiciousActivityThreshold,
          timeWindow: "5 minutes",
        },
        severity: "critical",
      });
    }
  }

  /**
   * Start cleanup interval for old data
   */
  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(
      () => {
        this.cleanupOldData();
      },
      this.config.cleanupIntervalMinutes * 60 * 1000,
    );
  }

  /**
   * Clean up old data beyond retention period
   */
  private cleanupOldData(): void {
    const cutoffTime = new Date(Date.now() - this.config.retentionPeriodHours * 60 * 60 * 1000);

    // Clean up security events
    this.securityEvents = this.securityEvents.filter((event) => event.timestamp > cutoffTime);

    // Clean up old key stats (remove keys not used in retention period)
    for (const [keyHash, stats] of Array.from(this.metrics.keyUsageStats.entries())) {
      if (stats.lastUsed < cutoffTime) {
        this.metrics.keyUsageStats.delete(keyHash);
      }
    }

    this.metrics.uniqueApiKeys = this.metrics.keyUsageStats.size;
  }
}
