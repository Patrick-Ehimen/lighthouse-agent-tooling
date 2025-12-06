/**
 * Lighthouse List API Keys Tool
 * MCP tool for listing API keys in an organization
 */

import { Logger } from "@lighthouse-tooling/shared";
import { MCPToolDefinition, ExecutionTimeCategory, TenantContext } from "@lighthouse-tooling/types";
import { TenantStore } from "../tenancy/storage/TenantStore.js";
import { ProgressAwareToolResult } from "./types.js";

interface ListApiKeysParams {
  _tenantContext?: TenantContext;
  organizationId: string;
}

export class LighthouseListApiKeysTool {
  private tenantStore: TenantStore;
  private logger: Logger;

  constructor(tenantStore: TenantStore, logger?: Logger) {
    this.tenantStore = tenantStore;
    this.logger =
      logger ||
      Logger.getInstance({
        level: "info",
        component: "LighthouseListApiKeysTool",
      });
  }

  static getDefinition(): MCPToolDefinition {
    return {
      name: "lighthouse-list-api-keys",
      description: "List all API keys for an organization",
      inputSchema: {
        type: "object",
        properties: {
          organizationId: {
            type: "string",
            description: "Organization ID",
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

  async execute(args: Record<string, unknown>): Promise<ProgressAwareToolResult> {
    const startTime = Date.now();

    try {
      const params = args as unknown as ListApiKeysParams;

      this.logger.info("Listing API keys", {
        organizationId: params.organizationId,
      });

      // Get all API keys for the organization
      const apiKeys = await this.tenantStore.listApiKeys(params.organizationId);

      // Remove sensitive key information
      const sanitizedKeys = apiKeys.map((key) => ({
        id: key.id,
        name: key.name,
        organizationId: key.organizationId,
        teamId: key.teamId,
        createdBy: key.createdBy,
        createdAt: key.createdAt,
        expiresAt: key.expiresAt,
        lastUsedAt: key.lastUsedAt,
        status: key.status,
        permissions: key.permissions,
        usageStats: key.usageStats,
        // DO NOT include the actual key or keyHash
      }));

      this.logger.info("API keys listed successfully", {
        organizationId: params.organizationId,
        count: sanitizedKeys.length,
      });

      return {
        success: true,
        data: {
          apiKeys: sanitizedKeys,
          count: sanitizedKeys.length,
          message: `Found ${sanitizedKeys.length} API key(s)`,
        },
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      this.logger.error("Failed to list API keys", error as Error);
      return {
        success: false,
        error: `Failed to list API keys: ${(error as Error).message}`,
        executionTime: Date.now() - startTime,
      };
    }
  }
}
