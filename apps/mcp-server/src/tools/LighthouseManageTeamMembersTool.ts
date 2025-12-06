/**
 * Lighthouse Manage Team Members Tool
 * MCP tool for adding/removing team members and updating roles
 */

import { Logger } from "@lighthouse-tooling/shared";
import {
  MCPToolDefinition,
  ExecutionTimeCategory,
  TeamMember,
  Role,
  TenantContext,
} from "@lighthouse-tooling/types";
import { TenantStore } from "../tenancy/storage/TenantStore.js";
import { ProgressAwareToolResult } from "./types.js";

interface ManageTeamMembersParams {
  _tenantContext?: TenantContext;
  organizationId: string;
  teamId: string;
  action: "add" | "remove" | "update-role";
  userId: string;
  email?: string;
  displayName?: string;
  role?: Role;
}

export class LighthouseManageTeamMembersTool {
  private tenantStore: TenantStore;
  private logger: Logger;

  constructor(tenantStore: TenantStore, logger?: Logger) {
    this.tenantStore = tenantStore;
    this.logger =
      logger ||
      Logger.getInstance({
        level: "info",
        component: "LighthouseManageTeamMembersTool",
      });
  }

  static getDefinition(): MCPToolDefinition {
    return {
      name: "lighthouse-manage-team-members",
      description: "Add, remove, or update team members and their roles",
      inputSchema: {
        type: "object",
        properties: {
          organizationId: {
            type: "string",
            description: "Organization ID",
          },
          teamId: {
            type: "string",
            description: "Team ID",
          },
          action: {
            type: "string",
            enum: ["add", "remove", "update-role"],
            description: "Action to perform: add, remove, or update-role",
          },
          userId: {
            type: "string",
            description: "User ID of the member",
          },
          email: {
            type: "string",
            description: "Email of the member (required for 'add' action)",
          },
          displayName: {
            type: "string",
            description: "Display name of the member (required for 'add' action)",
          },
          role: {
            type: "string",
            enum: ["owner", "admin", "member", "viewer"],
            description: "Role to assign (required for 'add' and 'update-role' actions)",
          },
        },
        required: ["organizationId", "teamId", "action", "userId"],
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
      const params = args as unknown as ManageTeamMembersParams;

      this.logger.info("Managing team member", {
        organizationId: params.organizationId,
        teamId: params.teamId,
        action: params.action,
        userId: params.userId,
      });

      // Get team
      const team = await this.tenantStore.getTeam(params.organizationId, params.teamId);
      if (!team) {
        return {
          success: false,
          error: `Team not found: ${params.teamId}`,
          executionTime: Date.now() - startTime,
        };
      }

      const existingMemberIndex = team.members.findIndex((m) => m.userId === params.userId);

      switch (params.action) {
        case "add": {
          // Validate required parameters
          if (!params.email || !params.displayName || !params.role) {
            return {
              success: false,
              error: "email, displayName, and role are required for 'add' action",
              executionTime: Date.now() - startTime,
            };
          }

          // Check if member already exists
          if (existingMemberIndex !== -1) {
            return {
              success: false,
              error: `Member already exists: ${params.userId}`,
              executionTime: Date.now() - startTime,
            };
          }

          // Check member quota
          const quota = await this.tenantStore.getQuota(params.organizationId, params.teamId);
          if (quota && team.members.length >= quota.maxMembersPerTeam) {
            return {
              success: false,
              error: `Member quota exceeded. Maximum members: ${quota.maxMembersPerTeam}`,
              executionTime: Date.now() - startTime,
            };
          }

          // Add new member
          const newMember: TeamMember = {
            userId: params.userId,
            email: params.email,
            displayName: params.displayName,
            role: params.role,
            joinedAt: new Date().toISOString(),
            status: "active",
          };

          team.members.push(newMember);
          team.updatedAt = new Date().toISOString();

          await this.tenantStore.saveTeam(params.organizationId, team);

          this.logger.info("Team member added", {
            organizationId: params.organizationId,
            teamId: params.teamId,
            userId: params.userId,
            role: params.role,
          });

          return {
            success: true,
            data: {
              team,
              member: newMember,
              message: "Team member added successfully",
            },
            executionTime: Date.now() - startTime,
          };
        }

        case "remove": {
          // Check if member exists
          if (existingMemberIndex === -1) {
            return {
              success: false,
              error: `Member not found: ${params.userId}`,
              executionTime: Date.now() - startTime,
            };
          }

          // Cannot remove owner
          if (team.members[existingMemberIndex]?.userId === team.ownerId) {
            return {
              success: false,
              error: "Cannot remove team owner",
              executionTime: Date.now() - startTime,
            };
          }

          // Remove member
          team.members.splice(existingMemberIndex, 1);
          team.updatedAt = new Date().toISOString();

          await this.tenantStore.saveTeam(params.organizationId, team);

          this.logger.info("Team member removed", {
            organizationId: params.organizationId,
            teamId: params.teamId,
            userId: params.userId,
          });

          return {
            success: true,
            data: {
              team,
              message: "Team member removed successfully",
            },
            executionTime: Date.now() - startTime,
          };
        }

        case "update-role": {
          // Validate required parameters
          if (!params.role) {
            return {
              success: false,
              error: "role is required for 'update-role' action",
              executionTime: Date.now() - startTime,
            };
          }

          // Check if member exists
          if (existingMemberIndex === -1) {
            return {
              success: false,
              error: `Member not found: ${params.userId}`,
              executionTime: Date.now() - startTime,
            };
          }

          // Update role
          const member = team.members[existingMemberIndex];
          if (member) {
            member.role = params.role;
            team.updatedAt = new Date().toISOString();

            await this.tenantStore.saveTeam(params.organizationId, team);

            this.logger.info("Team member role updated", {
              organizationId: params.organizationId,
              teamId: params.teamId,
              userId: params.userId,
              newRole: params.role,
            });

            return {
              success: true,
              data: {
                team,
                member,
                message: "Team member role updated successfully",
              },
              executionTime: Date.now() - startTime,
            };
          }

          return {
            success: false,
            error: "Failed to update member role",
            executionTime: Date.now() - startTime,
          };
        }

        default:
          return {
            success: false,
            error: `Invalid action: ${params.action}`,
            executionTime: Date.now() - startTime,
          };
      }
    } catch (error) {
      this.logger.error("Failed to manage team member", error as Error);
      return {
        success: false,
        error: `Failed to manage team member: ${(error as Error).message}`,
        executionTime: Date.now() - startTime,
      };
    }
  }
}
