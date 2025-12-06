/**
 * Lighthouse View Quota Tool
 * MCP tool for viewing quota usage and limits
 */

import { Logger } from "@lighthouse-tooling/shared";
import { MCPToolDefinition, ExecutionTimeCategory, TenantContext } from "@lighthouse-tooling/types";
import { TenantStore } from "../tenancy/storage/TenantStore.js";
import { QuotaManager } from "../tenancy/quotas/QuotaManager.js";
import { ProgressAwareToolResult } from "./types.js";

interface ViewQuotaParams {
  _tenantContext?: TenantContext;
  organizationId: string;
  teamId?: string;
}

export class LighthouseViewQuotaTool {
  private tenantStore: TenantStore;
  private quotaManager: QuotaManager;
  private logger: Logger;

  constructor(tenantStore: TenantStore, quotaManager: QuotaManager, logger?: Logger) {
    this.tenantStore = tenantStore;
    this.quotaManager = quotaManager;
    this.logger =
      logger ||
      Logger.getInstance({
        level: "info",
        component: "LighthouseViewQuotaTool",
      });
  }

  static getDefinition(): MCPToolDefinition {
    return {
      name: "lighthouse-view-quota",
      description: "View quota usage and limits for an organization or team",
      inputSchema: {
        type: "object",
        properties: {
          organizationId: {
            type: "string",
            description: "Organization ID",
          },
          teamId: {
            type: "string",
            description: "Optional team ID to view team-specific quota",
          },
        },
        required: ["organizationId"],
        additionalProperties: false,
      },
      requiresAuth: true,
      supportsBatch: false,
      executionTime: ExecutionTimeCategory.FAST,
    };
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  }

  async execute(args: Record<string, unknown>): Promise<ProgressAwareToolResult> {
    const startTime = Date.now();

    try {
      const params = args as unknown as ViewQuotaParams;

      this.logger.info("Viewing quota", {
        organizationId: params.organizationId,
        teamId: params.teamId,
      });

      // Get quota
      const quota = await this.tenantStore.getQuota(params.organizationId, params.teamId);

      if (!quota) {
        return {
          success: false,
          error: "Quota not found",
          executionTime: Date.now() - startTime,
        };
      }

      // Get quota status with percentages
      const status = this.quotaManager.getQuotaStatus(quota);

      // Format for human readability
      const formattedQuota = {
        storage: {
          used: this.formatBytes(status.storage.used),
          limit: this.formatBytes(status.storage.limit),
          remaining: this.formatBytes(status.storage.limit - status.storage.used),
          percentage: `${status.storage.percentage.toFixed(2)}%`,
          alert:
            status.storage.percentage >= 90
              ? "CRITICAL"
              : status.storage.percentage >= 80
                ? "WARNING"
                : "OK",
        },
        requests: {
          used: status.requests.used.toLocaleString(),
          limit: status.requests.limit.toLocaleString(),
          remaining: (status.requests.limit - status.requests.used).toLocaleString(),
          percentage: `${status.requests.percentage.toFixed(2)}%`,
          alert:
            status.requests.percentage >= 90
              ? "CRITICAL"
              : status.requests.percentage >= 80
                ? "WARNING"
                : "OK",
        },
        bandwidth: {
          used: this.formatBytes(status.bandwidth.used),
          limit: this.formatBytes(status.bandwidth.limit),
          remaining: this.formatBytes(status.bandwidth.limit - status.bandwidth.used),
          percentage: `${status.bandwidth.percentage.toFixed(2)}%`,
          alert:
            status.bandwidth.percentage >= 90
              ? "CRITICAL"
              : status.bandwidth.percentage >= 80
                ? "WARNING"
                : "OK",
        },
        teams: {
          current: quota.currentTeams,
          max: quota.maxTeams,
          remaining: quota.maxTeams - quota.currentTeams,
        },
        apiKeys: {
          current: quota.currentApiKeys,
          max: quota.maxApiKeys,
          remaining: quota.maxApiKeys - quota.currentApiKeys,
        },
        resetDate: status.resetDate,
        scope: params.teamId ? `Team: ${params.teamId}` : `Organization: ${params.organizationId}`,
      };

      this.logger.info("Quota viewed successfully", {
        organizationId: params.organizationId,
        teamId: params.teamId,
      });

      return {
        success: true,
        data: {
          quota: formattedQuota,
          rawQuota: quota,
          message: "Quota information retrieved successfully",
        },
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      this.logger.error("Failed to view quota", error as Error);
      return {
        success: false,
        error: `Failed to view quota: ${(error as Error).message}`,
        executionTime: Date.now() - startTime,
      };
    }
  }
}
