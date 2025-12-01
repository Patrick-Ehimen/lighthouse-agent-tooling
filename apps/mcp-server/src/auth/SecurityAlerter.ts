/**
 * Security event alerting for failed authentications and suspicious activity
 */

import { SecurityEvent, SecurityEventType, MetricsCollector } from "./MetricsCollector.js";
import { AuthLogger } from "./AuthLogger.js";

/**
 * Alert severity levels
 */
export enum AlertSeverity {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  CRITICAL = "critical",
}

/**
 * Alert configuration
 */
export interface AlertConfig {
  enabled: boolean;
  thresholds: {
    failureRate: number; // Percentage
    rateLimitExceeded: number; // Count per time window
    suspiciousActivity: number; // Count per time window
    timeWindowMinutes: number;
  };
  notifications: {
    console: boolean;
    webhook?: string;
    email?: string;
  };
  cooldownMinutes: number; // Minimum time between similar alerts
}

/**
 * Alert notification
 */
export interface AlertNotification {
  id: string;
  timestamp: Date;
  severity: AlertSeverity;
  title: string;
  message: string;
  details: Record<string, unknown>;
  acknowledged: boolean;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
}

/**
 * Alert handler interface
 */
export interface AlertHandler {
  handleAlert(alert: AlertNotification): Promise<void>;
}

/**
 * Console alert handler
 */
export class ConsoleAlertHandler implements AlertHandler {
  async handleAlert(alert: AlertNotification): Promise<void> {
    const prefix = this.getSeverityPrefix(alert.severity);
    console.error(`${prefix} SECURITY ALERT: ${alert.title}`);
    console.error(`Message: ${alert.message}`);
    console.error(`Timestamp: ${alert.timestamp.toISOString()}`);
    console.error(`Details:`, JSON.stringify(alert.details, null, 2));
    console.error("---");
  }

  private getSeverityPrefix(severity: AlertSeverity): string {
    switch (severity) {
      case AlertSeverity.CRITICAL:
        return "🚨 CRITICAL";
      case AlertSeverity.HIGH:
        return "⚠️  HIGH";
      case AlertSeverity.MEDIUM:
        return "⚡ MEDIUM";
      case AlertSeverity.LOW:
      default:
        return "ℹ️  LOW";
    }
  }
}

/**
 * Webhook alert handler
 */
export class WebhookAlertHandler implements AlertHandler {
  constructor(private webhookUrl: string) {}

  async handleAlert(alert: AlertNotification): Promise<void> {
    try {
      const payload = {
        alert_id: alert.id,
        timestamp: alert.timestamp.toISOString(),
        severity: alert.severity,
        title: alert.title,
        message: alert.message,
        details: alert.details,
      };

      const response = await fetch(this.webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Webhook failed: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error("Failed to send webhook alert:", error);
    }
  }
}

/**
 * Default alert configuration
 */
export const DEFAULT_ALERT_CONFIG: AlertConfig = {
  enabled: true,
  thresholds: {
    failureRate: 10, // 10% failure rate
    rateLimitExceeded: 50, // 50 rate limit hits
    suspiciousActivity: 20, // 20 suspicious events
    timeWindowMinutes: 15,
  },
  notifications: {
    console: true,
  },
  cooldownMinutes: 5,
};

/**
 * Security alerting system
 */
export class SecurityAlerter {
  private config: AlertConfig;
  private handlers: AlertHandler[] = [];
  private alerts: AlertNotification[] = [];
  private lastAlertTimes = new Map<string, Date>();

  private logger?: AuthLogger;

  constructor(
    config: AlertConfig = DEFAULT_ALERT_CONFIG,
    _metricsCollector?: MetricsCollector,
    logger?: AuthLogger,
  ) {
    this.config = config;
    this.logger = logger;

    this.setupHandlers();
  }

  /**
   * Process a security event and potentially trigger alerts
   */
  async processSecurityEvent(event: SecurityEvent): Promise<void> {
    if (!this.config.enabled) return;

    // Log the security event
    if (this.logger) {
      this.logger.logSecurityEvent(event);
    }

    // Check if this event should trigger an alert
    const alert = this.evaluateEvent(event);
    if (alert) {
      await this.triggerAlert(alert);
    }

    // Check for pattern-based alerts
    await this.checkPatternAlerts();
  }

  /**
   * Manually trigger an alert
   */
  async triggerAlert(alert: AlertNotification): Promise<void> {
    // Check cooldown period
    const alertKey = `${alert.severity}-${alert.title}`;
    const lastAlert = this.lastAlertTimes.get(alertKey);
    const cooldownMs = this.config.cooldownMinutes * 60 * 1000;

    if (lastAlert && Date.now() - lastAlert.getTime() < cooldownMs) {
      return; // Still in cooldown period
    }

    // Store the alert
    this.alerts.push(alert);
    this.lastAlertTimes.set(alertKey, alert.timestamp);

    // Send to all handlers
    for (const handler of this.handlers) {
      try {
        await handler.handleAlert(alert);
      } catch (error) {
        console.error("Alert handler failed:", error);
      }
    }

    // Log the alert
    if (this.logger) {
      this.logger.logSecurityEvent({
        type: SecurityEventType.SUSPICIOUS_ACTIVITY,
        keyHash: "system",
        timestamp: alert.timestamp,
        details: {
          alertId: alert.id,
          title: alert.title,
          message: alert.message,
          severity: alert.severity,
        },
        severity: alert.severity,
      });
    }
  }

  /**
   * Get all alerts
   */
  getAlerts(limit?: number, severity?: AlertSeverity): AlertNotification[] {
    let filtered = this.alerts;

    if (severity) {
      filtered = filtered.filter((alert) => alert.severity === severity);
    }

    if (limit) {
      filtered = filtered.slice(-limit);
    }

    return filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string, acknowledgedBy?: string): boolean {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (!alert) return false;

    alert.acknowledged = true;
    alert.acknowledgedAt = new Date();
    alert.acknowledgedBy = acknowledgedBy;

    return true;
  }

  /**
   * Get unacknowledged alerts
   */
  getUnacknowledgedAlerts(): AlertNotification[] {
    return this.alerts.filter((alert) => !alert.acknowledged);
  }

  /**
   * Clear old alerts
   */
  clearOldAlerts(olderThanHours: number = 24): void {
    const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    this.alerts = this.alerts.filter((alert) => alert.timestamp > cutoff);
  }

  /**
   * Add custom alert handler
   */
  addHandler(handler: AlertHandler): void {
    this.handlers.push(handler);
  }

  /**
   * Remove alert handler
   */
  removeHandler(handler: AlertHandler): void {
    const index = this.handlers.indexOf(handler);
    if (index > -1) {
      this.handlers.splice(index, 1);
    }
  }

  /**
   * Get alert statistics
   */
  getStats(): {
    totalAlerts: number;
    unacknowledged: number;
    bySeverity: Record<AlertSeverity, number>;
    recentAlerts: number;
  } {
    const bySeverity = {
      [AlertSeverity.LOW]: 0,
      [AlertSeverity.MEDIUM]: 0,
      [AlertSeverity.HIGH]: 0,
      [AlertSeverity.CRITICAL]: 0,
    };

    const recentCutoff = new Date(Date.now() - 60 * 60 * 1000); // Last hour
    let recentAlerts = 0;

    for (const alert of this.alerts) {
      bySeverity[alert.severity]++;
      if (alert.timestamp > recentCutoff) {
        recentAlerts++;
      }
    }

    return {
      totalAlerts: this.alerts.length,
      unacknowledged: this.getUnacknowledgedAlerts().length,
      bySeverity,
      recentAlerts,
    };
  }

  /**
   * Setup default alert handlers
   */
  private setupHandlers(): void {
    if (this.config.notifications.console) {
      this.addHandler(new ConsoleAlertHandler());
    }

    if (this.config.notifications.webhook) {
      this.addHandler(new WebhookAlertHandler(this.config.notifications.webhook));
    }
  }

  /**
   * Evaluate if a security event should trigger an alert
   */
  private evaluateEvent(event: SecurityEvent): AlertNotification | null {
    switch (event.type) {
      case SecurityEventType.AUTHENTICATION_FAILURE:
        return this.evaluateAuthFailure(event);

      case SecurityEventType.RATE_LIMIT_EXCEEDED:
        return this.evaluateRateLimit(event);

      case SecurityEventType.SUSPICIOUS_ACTIVITY:
        return this.evaluateSuspiciousActivity(event);

      case SecurityEventType.MULTIPLE_FAILURES:
        return this.evaluateMultipleFailures(event);

      default:
        return null;
    }
  }

  /**
   * Evaluate authentication failure event
   */
  private evaluateAuthFailure(event: SecurityEvent): AlertNotification | null {
    // Single auth failures are usually not critical unless part of a pattern
    if (event.severity === "critical") {
      return {
        id: this.generateAlertId(),
        timestamp: event.timestamp,
        severity: AlertSeverity.HIGH,
        title: "Critical Authentication Failure",
        message: `Critical authentication failure detected for key ${event.keyHash}`,
        details: event.details,
        acknowledged: false,
      };
    }

    return null;
  }

  /**
   * Evaluate rate limit event
   */
  private evaluateRateLimit(event: SecurityEvent): AlertNotification | null {
    return {
      id: this.generateAlertId(),
      timestamp: event.timestamp,
      severity: AlertSeverity.MEDIUM,
      title: "Rate Limit Exceeded",
      message: `Rate limit exceeded for key ${event.keyHash}`,
      details: event.details,
      acknowledged: false,
    };
  }

  /**
   * Evaluate suspicious activity event
   */
  private evaluateSuspiciousActivity(event: SecurityEvent): AlertNotification | null {
    return {
      id: this.generateAlertId(),
      timestamp: event.timestamp,
      severity: AlertSeverity.CRITICAL,
      title: "Suspicious Activity Detected",
      message: `Suspicious activity pattern detected for key ${event.keyHash}`,
      details: event.details,
      acknowledged: false,
    };
  }

  /**
   * Evaluate multiple failures event
   */
  private evaluateMultipleFailures(event: SecurityEvent): AlertNotification | null {
    const severity = event.keyHash === "system" ? AlertSeverity.CRITICAL : AlertSeverity.HIGH;

    return {
      id: this.generateAlertId(),
      timestamp: event.timestamp,
      severity,
      title: "Multiple Authentication Failures",
      message:
        event.keyHash === "system"
          ? "System-wide authentication failure rate exceeded threshold"
          : `Multiple authentication failures detected for key ${event.keyHash}`,
      details: event.details,
      acknowledged: false,
    };
  }

  /**
   * Check for pattern-based alerts
   */
  private async checkPatternAlerts(): Promise<void> {
    // This would analyze patterns in metrics collector
    // For now, we'll keep it simple
  }

  /**
   * Generate unique alert ID
   */
  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
}
