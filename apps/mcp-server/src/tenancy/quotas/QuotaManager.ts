/**
 * Quota Manager
 * Manages and enforces usage quotas for organizations and teams
 */

import { UsageQuota, TenantContext, TenantErrorCode } from "@lighthouse-tooling/types";
import { TenantStore } from "../storage/TenantStore.js";
import { Logger } from "@lighthouse-tooling/shared";

/**
 * Quota check result
 */
export interface QuotaCheckResult {
  allowed: boolean;
  reason?: string;
  remaining?: {
    storage?: number;
    requests?: number;
    bandwidth?: number;
  };
  resetDate?: string;
}

/**
 * Quota update operation
 */
export interface QuotaUpdate {
  storage?: number;
  requests?: number;
  bandwidth?: number;
}

/**
 * Quota alert threshold
 */
export interface QuotaAlertThreshold {
  percentage: number; // 0-100
  onAlert: (context: TenantContext, quotaType: string, usage: number) => void;
}

/**
 * Quota Manager Options
 */
export interface QuotaManagerOptions {
  store: TenantStore;
  logger: Logger;
  alertThresholds?: QuotaAlertThreshold[];
  enableAutoReset?: boolean;
  resetCheckInterval?: number; // milliseconds
}

/**
 * Quota Manager - Tracks and enforces usage limits
 */
export class QuotaManager {
  private store: TenantStore;
  private logger: Logger;
  private alertThresholds: QuotaAlertThreshold[];
  private enableAutoReset: boolean;
  private resetCheckInterval: number;
  private resetTimer?: NodeJS.Timeout;

  constructor(options: QuotaManagerOptions) {
    this.store = options.store;
    this.logger = options.logger;
    this.alertThresholds = options.alertThresholds || [
      { percentage: 80, onAlert: this.defaultAlertHandler.bind(this) },
      { percentage: 90, onAlert: this.defaultAlertHandler.bind(this) },
      { percentage: 95, onAlert: this.defaultAlertHandler.bind(this) },
    ];
    this.enableAutoReset = options.enableAutoReset ?? true;
    this.resetCheckInterval = options.resetCheckInterval || 3600000; // 1 hour

    if (this.enableAutoReset) {
      this.startAutoResetCheck();
    }
  }

  /**
   * Check if operation is within quota limits
   */
  public async checkQuota(
    context: TenantContext,
    operation: "storage" | "request" | "bandwidth",
    amount: number = 1,
  ): Promise<QuotaCheckResult> {
    const quota = context.quota;

    // Check if quota needs reset
    if (this.shouldResetQuota(quota)) {
      await this.resetMonthlyQuota(context.organization.id, context.team?.id);
      // Reload quota after reset
      const updatedQuota = await this.store.getQuota(context.organization.id, context.team?.id);
      if (updatedQuota) {
        context.quota = updatedQuota;
      }
    }

    switch (operation) {
      case "storage":
        return this.checkStorageQuota(quota, amount);

      case "request":
        return this.checkRequestQuota(quota, amount);

      case "bandwidth":
        return this.checkBandwidthQuota(quota, amount);

      default:
        return {
          allowed: false,
          reason: `Unknown operation type: ${operation}`,
        };
    }
  }

  /**
   * Check storage quota
   */
  private checkStorageQuota(quota: UsageQuota, amount: number): QuotaCheckResult {
    const newUsage = quota.storageUsed + amount;

    if (newUsage > quota.storageLimit) {
      return {
        allowed: false,
        reason: `Storage quota exceeded. Limit: ${this.formatBytes(quota.storageLimit)}, Current: ${this.formatBytes(quota.storageUsed)}, Requested: ${this.formatBytes(amount)}`,
        remaining: {
          storage: Math.max(0, quota.storageLimit - quota.storageUsed),
        },
      };
    }

    return {
      allowed: true,
      remaining: {
        storage: quota.storageLimit - newUsage,
      },
      resetDate: quota.resetDate,
    };
  }

  /**
   * Check request quota
   */
  private checkRequestQuota(quota: UsageQuota, amount: number = 1): QuotaCheckResult {
    const newUsage = quota.requestsUsed + amount;

    if (newUsage > quota.requestLimit) {
      return {
        allowed: false,
        reason: `Request quota exceeded. Limit: ${quota.requestLimit}, Current: ${quota.requestsUsed}`,
        remaining: {
          requests: Math.max(0, quota.requestLimit - quota.requestsUsed),
        },
        resetDate: quota.resetDate,
      };
    }

    return {
      allowed: true,
      remaining: {
        requests: quota.requestLimit - newUsage,
      },
      resetDate: quota.resetDate,
    };
  }

  /**
   * Check bandwidth quota
   */
  private checkBandwidthQuota(quota: UsageQuota, amount: number): QuotaCheckResult {
    const newUsage = quota.bandwidthUsed + amount;

    if (newUsage > quota.bandwidthLimit) {
      return {
        allowed: false,
        reason: `Bandwidth quota exceeded. Limit: ${this.formatBytes(quota.bandwidthLimit)}, Current: ${this.formatBytes(quota.bandwidthUsed)}, Requested: ${this.formatBytes(amount)}`,
        remaining: {
          bandwidth: Math.max(0, quota.bandwidthLimit - quota.bandwidthUsed),
        },
        resetDate: quota.resetDate,
      };
    }

    return {
      allowed: true,
      remaining: {
        bandwidth: quota.bandwidthLimit - newUsage,
      },
      resetDate: quota.resetDate,
    };
  }

  /**
   * Record usage (increment quota counters)
   */
  public async recordUsage(context: TenantContext, usage: QuotaUpdate): Promise<void> {
    const quota = context.quota;
    const updates: {
      storageUsed?: number;
      requestsUsed?: number;
      bandwidthUsed?: number;
    } = {};

    if (usage.storage !== undefined) {
      const newStorageUsed = quota.storageUsed + usage.storage;
      updates.storageUsed = newStorageUsed;
      this.checkAlertThresholds(context, "storage", newStorageUsed, quota.storageLimit);
    }

    if (usage.requests !== undefined) {
      const newRequestsUsed = quota.requestsUsed + usage.requests;
      updates.requestsUsed = newRequestsUsed;
      this.checkAlertThresholds(context, "requests", newRequestsUsed, quota.requestLimit);
    }

    if (usage.bandwidth !== undefined) {
      const newBandwidthUsed = quota.bandwidthUsed + usage.bandwidth;
      updates.bandwidthUsed = newBandwidthUsed;
      this.checkAlertThresholds(context, "bandwidth", newBandwidthUsed, quota.bandwidthLimit);
    }

    await this.store.updateQuotaUsage(context.organization.id, updates, context.team?.id);

    // Update context quota
    if (updates.storageUsed !== undefined) {
      context.quota.storageUsed = updates.storageUsed;
    }
    if (updates.requestsUsed !== undefined) {
      context.quota.requestsUsed = updates.requestsUsed;
    }
    if (updates.bandwidthUsed !== undefined) {
      context.quota.bandwidthUsed = updates.bandwidthUsed;
    }

    this.logger.debug("Quota usage recorded", {
      organizationId: context.organization.id,
      teamId: context.team?.id,
      updates,
    });
  }

  /**
   * Get current quota status
   */
  public getQuotaStatus(quota: UsageQuota): {
    storage: { used: number; limit: number; percentage: number };
    requests: { used: number; limit: number; percentage: number };
    bandwidth: { used: number; limit: number; percentage: number };
    resetDate: string;
  } {
    return {
      storage: {
        used: quota.storageUsed,
        limit: quota.storageLimit,
        percentage: (quota.storageUsed / quota.storageLimit) * 100,
      },
      requests: {
        used: quota.requestsUsed,
        limit: quota.requestLimit,
        percentage: (quota.requestsUsed / quota.requestLimit) * 100,
      },
      bandwidth: {
        used: quota.bandwidthUsed,
        limit: quota.bandwidthLimit,
        percentage: (quota.bandwidthUsed / quota.bandwidthLimit) * 100,
      },
      resetDate: quota.resetDate,
    };
  }

  /**
   * Reset monthly quota counters
   */
  public async resetMonthlyQuota(organizationId: string, teamId?: string): Promise<void> {
    const quota = await this.store.getQuota(organizationId, teamId);
    if (!quota) {
      throw new Error(`Quota not found for organization: ${organizationId}`);
    }

    // Reset monthly counters
    quota.requestsUsed = 0;
    quota.bandwidthUsed = 0;

    // Set next reset date (first day of next month)
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    quota.resetDate = nextMonth.toISOString();

    await this.store.saveQuota(organizationId, quota, teamId);

    this.logger.info("Monthly quota reset", {
      organizationId,
      teamId,
      nextResetDate: quota.resetDate,
    });
  }

  /**
   * Check if quota should be reset
   */
  private shouldResetQuota(quota: UsageQuota): boolean {
    const resetDate = new Date(quota.resetDate);
    const now = new Date();
    return now >= resetDate;
  }

  /**
   * Check alert thresholds and trigger alerts
   */
  private checkAlertThresholds(
    context: TenantContext,
    quotaType: string,
    used: number,
    limit: number,
  ): void {
    const percentage = (used / limit) * 100;

    for (const threshold of this.alertThresholds) {
      if (percentage >= threshold.percentage) {
        threshold.onAlert(context, quotaType, percentage);
      }
    }
  }

  /**
   * Default alert handler
   */
  private defaultAlertHandler(context: TenantContext, quotaType: string, usage: number): void {
    this.logger.warn("Quota threshold exceeded", {
      organizationId: context.organization.id,
      teamId: context.team?.id,
      quotaType,
      usagePercentage: usage.toFixed(2),
    });
  }

  /**
   * Start auto-reset check timer
   */
  private startAutoResetCheck(): void {
    this.resetTimer = setInterval(async () => {
      try {
        await this.checkAndResetExpiredQuotas();
      } catch (error) {
        this.logger.error("Failed to check expired quotas", error as Error);
      }
    }, this.resetCheckInterval);
  }

  /**
   * Check and reset all expired quotas
   */
  private async checkAndResetExpiredQuotas(): Promise<void> {
    const organizations = await this.store.listOrganizations();

    for (const org of organizations) {
      // Reset organization quota
      const orgQuota = await this.store.getQuota(org.id);
      if (orgQuota && this.shouldResetQuota(orgQuota)) {
        await this.resetMonthlyQuota(org.id);
      }

      // Reset team quotas
      const teams = await this.store.listTeams(org.id);
      for (const team of teams) {
        const teamQuota = await this.store.getQuota(org.id, team.id);
        if (teamQuota && this.shouldResetQuota(teamQuota)) {
          await this.resetMonthlyQuota(org.id, team.id);
        }
      }
    }
  }

  /**
   * Stop auto-reset check timer
   */
  public stop(): void {
    if (this.resetTimer) {
      clearInterval(this.resetTimer);
      this.resetTimer = undefined;
    }
  }

  /**
   * Format bytes for display
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return "0 Bytes";

    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  }
}
