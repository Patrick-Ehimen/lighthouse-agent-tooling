/**
 * Lighthouse Create Team Tool
 * MCP tool for creating teams within organizations
 */

import { Logger } from "@lighthouse-tooling/shared";
import {
  MCPToolDefinition,
  ExecutionTimeCategory,
  Team,
  TeamMember,
  Role,
  TenantContext,
} from "@lighthouse-tooling/types";
import { TenantStore } from "../tenancy/storage/TenantStore.js";
import { ProgressAwareToolResult } from "./types.js";

interface CreateTeamParams {
  _tenantContext?: TenantContext;
  organizationId: string;
  teamId: string;
  name: string;
  displayName: string;
  description?: string;
  ownerId: string;
  ownerEmail: string;
  ownerDisplayName: string;
}

export class LighthouseCreateTeamTool {
  private tenantStore: TenantStore;
  private logger: Logger;

  constructor(tenantStore: TenantStore, logger?: Logger) {
    this.tenantStore = tenantStore;
    this.logger =
      logger ||
      Logger.getInstance({
        level: "info",
        component: "LighthouseCreateTeamTool",
      });
  }

  static getDefinition(): MCPToolDefinition {
    return {
      name: "lighthouse-create-team",
      description: "Create a new team within an organization",
      inputSchema: {
        type: "object",
        properties: {
          organizationId: {
            type: "string",
            description: "Organization ID to create the team in",
          },
          teamId: {
            type: "string",
            description: "Unique identifier for the team (alphanumeric, hyphens, underscores)",
          },
          name: {
            type: "string",
            description: "Team name (used internally)",
          },
          displayName: {
            type: "string",
            description: "Display name for the team",
          },
          description: {
            type: "string",
            description: "Optional team description",
          },
          ownerId: {
            type: "string",
            description: "User ID of the team owner",
          },
          ownerEmail: {
            type: "string",
            description: "Email of the team owner",
          },
          ownerDisplayName: {
            type: "string",
            description: "Display name of the team owner",
          },
        },
        required: [
          "organizationId",
          "teamId",
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
      const params = args as unknown as CreateTeamParams;

      this.logger.info("Creating team", {
        organizationId: params.organizationId,
        teamId: params.teamId,
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

      // Check if team already exists
      const existing = await this.tenantStore.getTeam(params.organizationId, params.teamId);
      if (existing) {
        return {
          success: false,
          error: `Team already exists: ${params.teamId}`,
          executionTime: Date.now() - startTime,
        };
      }

      // Check team quota
      const quota = await this.tenantStore.getQuota(params.organizationId);
      if (quota && quota.currentTeams >= quota.maxTeams) {
        return {
          success: false,
          error: `Team quota exceeded. Maximum teams: ${quota.maxTeams}`,
          executionTime: Date.now() - startTime,
        };
      }

      // Create team owner member
      const ownerMember: TeamMember = {
        userId: params.ownerId,
        email: params.ownerEmail,
        displayName: params.ownerDisplayName,
        role: Role.OWNER,
        joinedAt: new Date().toISOString(),
        status: "active",
      };

      // Create team
      const team: Team = {
        id: params.teamId,
        organizationId: params.organizationId,
        name: params.name,
        displayName: params.displayName,
        description: params.description,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ownerId: params.ownerId,
        members: [ownerMember],
        status: "active",
        metadata: {
          createdBy: params._tenantContext?.user.userId || "system",
        },
      };

      await this.tenantStore.saveTeam(params.organizationId, team);

      // Update team count in quota
      if (quota) {
        quota.currentTeams += 1;
        await this.tenantStore.saveQuota(params.organizationId, quota);
      }

      this.logger.info("Team created successfully", {
        organizationId: params.organizationId,
        teamId: params.teamId,
      });

      return {
        success: true,
        data: {
          team,
          message: "Team created successfully",
        },
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      this.logger.error("Failed to create team", error as Error);
      return {
        success: false,
        error: `Failed to create team: ${(error as Error).message}`,
        executionTime: Date.now() - startTime,
      };
    }
  }
}
