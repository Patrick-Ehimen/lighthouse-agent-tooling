/**
 * Lighthouse Create Organization Tool
 * MCP tool for creating new organizations in multi-tenant environment
 */

import { Logger } from "@lighthouse-tooling/shared";
import {
  MCPToolDefinition,
  ExecutionTimeCategory,
  Organization,
  OrganizationSettings,
  TenantContext,
} from "@lighthouse-tooling/types";
import { TenantStore } from "../tenancy/storage/TenantStore.js";
import { ProgressAwareToolResult } from "./types.js";

interface CreateOrganizationParams {
  _tenantContext?: TenantContext;
  organizationId: string;
  name: string;
  displayName: string;
  description?: string;
  ownerId: string;
  ownerEmail: string;
  ownerDisplayName: string;
  settings?: Partial<OrganizationSettings>;
}

export class LighthouseCreateOrganizationTool {
  private tenantStore: TenantStore;
  private logger: Logger;

  constructor(tenantStore: TenantStore, logger?: Logger) {
    this.tenantStore = tenantStore;
    this.logger =
      logger ||
      Logger.getInstance({
        level: "info",
        component: "LighthouseCreateOrganizationTool",
      });
  }

  static getDefinition(): MCPToolDefinition {
    return {
      name: "lighthouse-create-organization",
      description: "Create a new organization in the multi-tenant system",
      inputSchema: {
        type: "object",
        properties: {
          organizationId: {
            type: "string",
            description:
              "Unique identifier for the organization (alphanumeric, hyphens, underscores)",
          },
          name: {
            type: "string",
            description: "Organization name (used internally)",
          },
          displayName: {
            type: "string",
            description: "Display name for the organization",
          },
          description: {
            type: "string",
            description: "Optional organization description",
          },
          ownerId: {
            type: "string",
            description: "User ID of the organization owner",
          },
          ownerEmail: {
            type: "string",
            description: "Email of the organization owner",
          },
          ownerDisplayName: {
            type: "string",
            description: "Display name of the organization owner",
          },
          settings: {
            type: "object",
            description: "Optional organization settings (defaults will be used if not provided)",
            properties: {
              defaultStorageQuota: {
                type: "number",
                description: "Default storage quota in bytes",
              },
              defaultRateLimit: {
                type: "number",
                description: "Default API rate limit (requests per minute)",
              },
              allowTeamCreation: {
                type: "boolean",
                description: "Allow team creation",
              },
              require2FA: {
                type: "boolean",
                description: "Require 2FA for all members",
              },
              dataRetentionDays: {
                type: "number",
                description: "Data retention policy in days (0 = infinite)",
              },
              maxFileSize: {
                type: "number",
                description: "Maximum file size in bytes",
              },
              enableAuditLog: {
                type: "boolean",
                description: "Enable audit logging",
              },
            },
          },
        },
        required: [
          "organizationId",
          "name",
          "displayName",
          "ownerId",
          "ownerEmail",
          "ownerDisplayName",
        ],
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
      const params = args as unknown as CreateOrganizationParams;

      this.logger.info("Creating organization", {
        organizationId: params.organizationId,
      });

      // Check if organization already exists
      const existing = await this.tenantStore.getOrganization(params.organizationId);
      if (existing) {
        return {
          success: false,
          error: `Organization already exists: ${params.organizationId}`,
          executionTime: Date.now() - startTime,
        };
      }

      // Get default settings from config
      const { DEFAULT_ORGANIZATION_SETTINGS } = await import("../config/server-config.js");

      // Create organization
      const organization: Organization = {
        id: params.organizationId,
        name: params.name,
        displayName: params.displayName,
        description: params.description,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ownerId: params.ownerId,
        settings: params.settings
          ? { ...DEFAULT_ORGANIZATION_SETTINGS, ...params.settings }
          : DEFAULT_ORGANIZATION_SETTINGS,
        status: "active",
        metadata: {
          createdBy: params._tenantContext?.user.userId || "system",
        },
      };

      await this.tenantStore.saveOrganization(organization);

      // Create default quota
      const { DEFAULT_USAGE_QUOTA } = await import("../config/server-config.js");
      await this.tenantStore.saveQuota(params.organizationId, { ...DEFAULT_USAGE_QUOTA });

      this.logger.info("Organization created successfully", {
        organizationId: params.organizationId,
      });

      return {
        success: true,
        data: {
          organization,
          message: "Organization created successfully",
        },
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      this.logger.error("Failed to create organization", error as Error);
      return {
        success: false,
        error: `Failed to create organization: ${(error as Error).message}`,
        executionTime: Date.now() - startTime,
      };
    }
  }
}
