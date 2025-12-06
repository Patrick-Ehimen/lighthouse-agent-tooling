/**
 * Lighthouse Create API Key Tool
 * MCP tool for creating new API keys for organizations/teams
 */

import { Logger } from "@lighthouse-tooling/shared";
import {
  MCPToolDefinition,
  ExecutionTimeCategory,
  TenantApiKey,
  Permission,
  TenantContext,
} from "@lighthouse-tooling/types";
import { TenantStore } from "../tenancy/storage/TenantStore.js";
import { ProgressAwareToolResult } from "./types.js";
import * as crypto from "crypto";

interface CreateApiKeyParams {
  _tenantContext?: TenantContext;
  organizationId: string;
  teamId?: string;
  name: string;
  expiresInDays?: number;
  permissions?: Permission[];
}

export class LighthouseCreateApiKeyTool {
  private tenantStore: TenantStore;
  private logger: Logger;

  constructor(tenantStore: TenantStore, logger?: Logger) {
    this.tenantStore = tenantStore;
    this.logger =
      logger ||
      Logger.getInstance({
        level: "info",
        component: "LighthouseCreateApiKeyTool",
      });
  }

  static getDefinition(): MCPToolDefinition {
    return {
      name: "lighthouse-create-api-key",
      description: "Create a new API key for an organization or team",
      inputSchema: {
        type: "object",
        properties: {
          organizationId: {
            type: "string",
            description: "Organization ID",
          },
          teamId: {
            type: "string",
            description: "Optional team ID to scope the key to a specific team",
          },
          name: {
            type: "string",
            description: "Descriptive name for the API key",
          },
          expiresInDays: {
            type: "number",
            description: "Optional expiration period in days (omit for no expiration)",
            minimum: 1,
          },
          permissions: {
            type: "array",
            description:
              "Optional custom permissions (if not provided, uses role-based permissions)",
            items: {
              type: "string",
              description: "Permission name (e.g., 'file:upload', 'dataset:create')",
            },
          },
        },
        required: ["organizationId", "name"],
        additionalProperties: false,
      },
      requiresAuth: true,
      supportsBatch: false,
      executionTime: ExecutionTimeCategory.FAST,
    };
  }

  private generateKeyId(): string {
    return crypto.randomBytes(8).toString("hex");
  }

  private generateSecret(): string {
    return crypto.randomBytes(32).toString("hex");
  }

  private formatApiKey(
    organizationId: string,
    teamId: string | undefined,
    keyId: string,
    secret: string,
  ): string {
    if (teamId) {
      return `org_${organizationId}_team_${teamId}_key_${keyId}.${secret}`;
    }
    return `org_${organizationId}_key_${keyId}.${secret}`;
  }

  async execute(args: Record<string, unknown>): Promise<ProgressAwareToolResult> {
    const startTime = Date.now();

    try {
      const params = args as unknown as CreateApiKeyParams;

      this.logger.info("Creating API key", {
        organizationId: params.organizationId,
        teamId: params.teamId,
        name: params.name,
      });

      // Check if organization exists
      const organization = await this.tenantStore.getOrganization(params.organizationId);
      if (!organization) {
        return {
          success: false,
          error: `Organization not found: ${params.organizationId}`,
          executionTime: Date.now() - startTime,
        };
      }

      // Check if team exists (if teamId provided)
      if (params.teamId) {
        const team = await this.tenantStore.getTeam(params.organizationId, params.teamId);
        if (!team) {
          return {
            success: false,
            error: `Team not found: ${params.teamId}`,
            executionTime: Date.now() - startTime,
          };
        }
      }

      // Check API key quota
      const quota = await this.tenantStore.getQuota(params.organizationId, params.teamId);
      if (quota && quota.currentApiKeys >= quota.maxApiKeys) {
        return {
          success: false,
          error: `API key quota exceeded. Maximum keys: ${quota.maxApiKeys}`,
          executionTime: Date.now() - startTime,
        };
      }

      // Generate key components
      const keyId = this.generateKeyId();
      const secret = this.generateSecret();
      const keyHash = crypto.createHash("sha256").update(secret).digest("hex");

      // Format the full API key
      const fullApiKey = this.formatApiKey(params.organizationId, params.teamId, keyId, secret);

      // Calculate expiration if specified
      let expiresAt: string | undefined;
      if (params.expiresInDays) {
        const expDate = new Date();
        expDate.setDate(expDate.getDate() + params.expiresInDays);
        expiresAt = expDate.toISOString();
      }

      // Create API key entity
      const apiKey: TenantApiKey = {
        id: keyId,
        organizationId: params.organizationId,
        teamId: params.teamId,
        createdBy: params._tenantContext?.user.userId || "system",
        name: params.name,
        key: fullApiKey,
        keyHash,
        createdAt: new Date().toISOString(),
        expiresAt,
        status: "active",
        permissions: params.permissions,
        usageStats: {
          totalRequests: 0,
          failedRequests: 0,
          rateLimitHits: 0,
          bytesUploaded: 0,
          bytesDownloaded: 0,
        },
        metadata: {
          createdVia: "mcp-tool",
        },
      };

      await this.tenantStore.saveApiKey(params.organizationId, apiKey);

      // Update quota count
      if (quota) {
        quota.currentApiKeys += 1;
        await this.tenantStore.saveQuota(params.organizationId, quota, params.teamId);
      }

      this.logger.info("API key created successfully", {
        organizationId: params.organizationId,
        teamId: params.teamId,
        keyId,
      });

      return {
        success: true,
        data: {
          apiKey: {
            ...apiKey,
            // Return the full key only once - it won't be retrievable later
            key: fullApiKey,
          },
          message:
            "API key created successfully. Store the key securely - it cannot be retrieved later.",
          warning: "This is the only time the full API key will be displayed!",
        },
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      this.logger.error("Failed to create API key", error as Error);
      return {
        success: false,
        error: `Failed to create API key: ${(error as Error).message}`,
        executionTime: Date.now() - startTime,
      };
    }
  }
}
