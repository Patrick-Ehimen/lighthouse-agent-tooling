/**
 * Structured logging for authentication events and audit trails
 */

import { SecurityEvent } from "./MetricsCollector.js";
import { AuthenticationResult, LogContext } from "./types.js";

/**
 * Log levels for authentication events
 */
export enum AuthLogLevel {
  DEBUG = "debug",
  INFO = "info",
  WARN = "warn",
  ERROR = "error",
  SECURITY = "security",
}

/**
 * Authentication log entry
 */
export interface AuthLogEntry {
  timestamp: string;
  level: AuthLogLevel;
  event: string;
  keyHash: string;
  requestId?: string;
  toolName?: string;
  details: Record<string, unknown>;
  sanitizedDetails?: Record<string, unknown>;
}

/**
 * Audit trail entry
 */
export interface AuditEntry {
  timestamp: string;
  action: string;
  keyHash: string;
  requestId?: string;
  toolName?: string;
  success: boolean;
  duration?: number;
  details: Record<string, unknown>;
}

/**
 * Logger configuration
 */
export interface AuthLoggerConfig {
  enabled: boolean;
  logLevel: AuthLogLevel;
  includeStackTrace: boolean;
  maxLogEntries: number;
  auditTrailEnabled: boolean;
  sensitiveFields: string[];
}

/**
 * Default logger configuration
 */
export const DEFAULT_AUTH_LOGGER_CONFIG: AuthLoggerConfig = {
  enabled: true,
  logLevel: AuthLogLevel.INFO,
  includeStackTrace: false,
  maxLogEntries: 10000,
  auditTrailEnabled: true,
  sensitiveFields: ["apiKey", "password", "token", "secret", "key"],
};

/**
 * Structured logger for authentication events
 */
export class AuthLogger {
  private config: AuthLoggerConfig;
  private logEntries: AuthLogEntry[] = [];
  private auditTrail: AuditEntry[] = [];

  constructor(config: AuthLoggerConfig = DEFAULT_AUTH_LOGGER_CONFIG) {
    this.config = config;
  }

  /**
   * Log authentication attempt
   */
  logAuthentication(result: AuthenticationResult, context?: LogContext): void {
    if (!this.config.enabled) return;

    const entry: AuthLogEntry = {
      timestamp: new Date().toISOString(),
      level: result.success ? AuthLogLevel.INFO : AuthLogLevel.WARN,
      event: "authentication_attempt",
      keyHash: result.keyHash,
      requestId: context?.requestId,
      toolName: context?.toolName,
      details: {
        success: result.success,
        usedFallback: result.usedFallback,
        rateLimited: result.rateLimited,
        authTime: result.authTime,
        errorMessage: result.errorMessage,
      },
    };

    this.addLogEntry(entry);

    // Add to audit trail
    if (this.config.auditTrailEnabled) {
      this.addAuditEntry({
        timestamp: entry.timestamp,
        action: "authenticate",
        keyHash: result.keyHash,
        requestId: context?.requestId,
        toolName: context?.toolName,
        success: result.success,
        duration: result.authTime,
        details: {
          usedFallback: result.usedFallback,
          rateLimited: result.rateLimited,
        },
      });
    }
  }

  /**
   * Log security event
   */
  logSecurityEvent(event: SecurityEvent, context?: LogContext): void {
    if (!this.config.enabled) return;

    const logLevel = this.getLogLevelForSeverity(event.severity);

    const entry: AuthLogEntry = {
      timestamp: event.timestamp.toISOString(),
      level: logLevel,
      event: "security_event",
      keyHash: event.keyHash,
      requestId: context?.requestId,
      toolName: context?.toolName,
      details: {
        type: event.type,
        severity: event.severity,
        ...event.details,
      },
    };

    this.addLogEntry(entry);

    // Add to audit trail for critical events
    if (this.config.auditTrailEnabled && event.severity === "critical") {
      this.addAuditEntry({
        timestamp: entry.timestamp,
        action: "security_event",
        keyHash: event.keyHash,
        requestId: context?.requestId,
        toolName: context?.toolName,
        success: false,
        details: {
          type: event.type,
          severity: event.severity,
          ...this.sanitizeDetails(event.details),
        },
      });
    }
  }

  /**
   * Log tool execution
   */
  logToolExecution(
    toolName: string,
    keyHash: string,
    success: boolean,
    duration: number,
    context?: LogContext,
    error?: string,
  ): void {
    if (!this.config.enabled) return;

    const entry: AuthLogEntry = {
      timestamp: new Date().toISOString(),
      level: success ? AuthLogLevel.INFO : AuthLogLevel.ERROR,
      event: "tool_execution",
      keyHash,
      requestId: context?.requestId,
      toolName,
      details: {
        success,
        duration,
        error,
      },
    };

    this.addLogEntry(entry);

    // Add to audit trail
    if (this.config.auditTrailEnabled) {
      this.addAuditEntry({
        timestamp: entry.timestamp,
        action: "tool_execution",
        keyHash,
        requestId: context?.requestId,
        toolName,
        success,
        duration,
        details: {
          error: error ? this.sanitizeError(error) : undefined,
        },
      });
    }
  }

  /**
   * Log rate limiting event
   */
  logRateLimit(keyHash: string, remaining: number, resetTime: Date, context?: LogContext): void {
    if (!this.config.enabled) return;

    const entry: AuthLogEntry = {
      timestamp: new Date().toISOString(),
      level: AuthLogLevel.WARN,
      event: "rate_limit",
      keyHash,
      requestId: context?.requestId,
      toolName: context?.toolName,
      details: {
        remaining,
        resetTime: resetTime.toISOString(),
        retryAfter: Math.ceil((resetTime.getTime() - Date.now()) / 1000),
      },
    };

    this.addLogEntry(entry);
  }

  /**
   * Log cache operation
   */
  logCacheOperation(
    operation: "hit" | "miss" | "set" | "invalidate",
    keyHash: string,
    context?: LogContext,
  ): void {
    if (!this.config.enabled || !this.shouldLog(AuthLogLevel.DEBUG)) return;

    const entry: AuthLogEntry = {
      timestamp: new Date().toISOString(),
      level: AuthLogLevel.DEBUG,
      event: "cache_operation",
      keyHash,
      requestId: context?.requestId,
      toolName: context?.toolName,
      details: {
        operation,
      },
    };

    this.addLogEntry(entry);
  }

  /**
   * Get recent log entries
   */
  getLogEntries(limit?: number, level?: AuthLogLevel): AuthLogEntry[] {
    let entries = this.logEntries;

    if (level) {
      entries = entries.filter((entry) => entry.level === level);
    }

    if (limit) {
      entries = entries.slice(-limit);
    }

    return entries;
  }

  /**
   * Get audit trail entries
   */
  getAuditTrail(limit?: number, since?: Date): AuditEntry[] {
    let entries = this.auditTrail;

    if (since) {
      entries = entries.filter((entry) => new Date(entry.timestamp) >= since);
    }

    if (limit) {
      entries = entries.slice(-limit);
    }

    return entries;
  }

  /**
   * Get security events from logs
   */
  getSecurityEvents(since?: Date): AuthLogEntry[] {
    const cutoff = since || new Date(Date.now() - 60 * 60 * 1000); // Last hour by default

    return this.logEntries.filter(
      (entry) => entry.event === "security_event" && new Date(entry.timestamp) >= cutoff,
    );
  }

  /**
   * Export logs in structured format
   */
  exportLogs(format: "json" | "csv" = "json"): string {
    if (format === "csv") {
      return this.exportAsCSV();
    }

    return JSON.stringify(
      {
        logs: this.logEntries,
        auditTrail: this.auditTrail,
        exportedAt: new Date().toISOString(),
      },
      null,
      2,
    );
  }

  /**
   * Clear all logs
   */
  clear(): void {
    this.logEntries = [];
    this.auditTrail = [];
  }

  /**
   * Get log statistics
   */
  getStats(): {
    totalEntries: number;
    auditEntries: number;
    securityEvents: number;
    errorCount: number;
    oldestEntry?: string;
    newestEntry?: string;
  } {
    const securityEvents = this.logEntries.filter(
      (entry) => entry.event === "security_event",
    ).length;
    const errorCount = this.logEntries.filter((entry) => entry.level === AuthLogLevel.ERROR).length;

    return {
      totalEntries: this.logEntries.length,
      auditEntries: this.auditTrail.length,
      securityEvents,
      errorCount,
      oldestEntry: this.logEntries.length > 0 ? this.logEntries[0]?.timestamp : undefined,
      newestEntry:
        this.logEntries.length > 0
          ? this.logEntries[this.logEntries.length - 1]?.timestamp
          : undefined,
    };
  }

  /**
   * Add log entry with size management
   */
  private addLogEntry(entry: AuthLogEntry): void {
    // Sanitize sensitive details
    entry.sanitizedDetails = this.sanitizeDetails(entry.details);

    this.logEntries.push(entry);

    // Manage log size
    if (this.logEntries.length > this.config.maxLogEntries) {
      this.logEntries = this.logEntries.slice(-this.config.maxLogEntries);
    }
  }

  /**
   * Add audit trail entry
   */
  private addAuditEntry(entry: AuditEntry): void {
    // Sanitize sensitive details
    entry.details = this.sanitizeDetails(entry.details);

    this.auditTrail.push(entry);

    // Manage audit trail size
    if (this.auditTrail.length > this.config.maxLogEntries) {
      this.auditTrail = this.auditTrail.slice(-this.config.maxLogEntries);
    }
  }

  /**
   * Sanitize sensitive information from details
   */
  private sanitizeDetails(details: Record<string, unknown>): Record<string, unknown> {
    const sanitized = { ...details };

    for (const field of this.config.sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = "[REDACTED]";
      }
    }

    // Also sanitize error messages that might contain sensitive data
    if (sanitized.errorMessage && typeof sanitized.errorMessage === "string") {
      sanitized.errorMessage = this.sanitizeError(sanitized.errorMessage);
    }

    return sanitized;
  }

  /**
   * Sanitize error messages
   */
  private sanitizeError(error: string): string {
    let sanitized = error;

    // Remove potential API keys from error messages (common patterns)
    sanitized = sanitized.replace(/sk-[a-zA-Z0-9]+/g, "[REDACTED_KEY]");
    sanitized = sanitized.replace(/key-[a-zA-Z0-9]+/g, "[REDACTED_KEY]");
    sanitized = sanitized.replace(/\b[a-zA-Z0-9]{20,}\b/g, "[REDACTED_KEY]");

    // Remove file paths that might contain sensitive info
    sanitized = sanitized.replace(/\/[^\s]+/g, "[PATH]");

    return sanitized;
  }

  /**
   * Get log level for security event severity
   */
  private getLogLevelForSeverity(severity: string): AuthLogLevel {
    switch (severity) {
      case "critical":
        return AuthLogLevel.SECURITY;
      case "high":
        return AuthLogLevel.ERROR;
      case "medium":
        return AuthLogLevel.WARN;
      case "low":
      default:
        return AuthLogLevel.INFO;
    }
  }

  /**
   * Check if we should log at the given level
   */
  private shouldLog(level: AuthLogLevel): boolean {
    const levels = [
      AuthLogLevel.DEBUG,
      AuthLogLevel.INFO,
      AuthLogLevel.WARN,
      AuthLogLevel.ERROR,
      AuthLogLevel.SECURITY,
    ];
    const currentLevelIndex = levels.indexOf(this.config.logLevel);
    const requestedLevelIndex = levels.indexOf(level);

    return requestedLevelIndex >= currentLevelIndex;
  }

  /**
   * Export logs as CSV format
   */
  private exportAsCSV(): string {
    const headers = ["timestamp", "level", "event", "keyHash", "requestId", "toolName", "details"];
    const rows = [headers.join(",")];

    for (const entry of this.logEntries) {
      const row = [
        entry.timestamp,
        entry.level,
        entry.event,
        entry.keyHash,
        entry.requestId || "",
        entry.toolName || "",
        JSON.stringify(entry.sanitizedDetails || entry.details).replace(/"/g, '""'),
      ];
      rows.push(row.join(","));
    }

    return rows.join("\n");
  }
}
