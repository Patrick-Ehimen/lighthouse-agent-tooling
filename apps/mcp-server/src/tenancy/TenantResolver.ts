/**
 * Tenant Resolver
 * Resolves tenant context from API keys and validates access
 */

import {
  TenantContext,
  TenantResolutionResult,
  TenantErrorCode,
  Organization,
  Team,
  TeamMember,
  TenantApiKey,
  UsageQuota,
  Permission,
  ROLE_PERMISSIONS,
} from "@lighthouse-tooling/types";
import { TenantStore } from "./storage/TenantStore.js";
import { rbac } from "../auth/rbac/index.js";
import { Logger } from "@lighthouse-tooling/shared";

/**
 * API Key format: org_{orgId}_team_{teamId}_key_{keyId}.{secret}
 * Legacy format: {secret} (mapped to default organization)
 */
export interface ParsedApiKey {
  organizationId: string;
  teamId?: string;
  keyId: string;
  secret: string;
  isLegacy: boolean;
}

/**
 * Tenant resolution options
 */
export interface TenantResolverOptions {
  /** Storage instance */
  store: TenantStore;
  /** Logger instance */
  logger: Logger;
  /** Default organization ID for legacy keys */
  defaultOrganizationId: string;
  /** Enable strict isolation (prevent cross-tenant access) */
  strictIsolation: boolean;
}

/**
 * Tenant Resolver - Main class for resolving tenant context
 */
export class TenantResolver {
  private store: TenantStore;
  private logger: Logger;
  private defaultOrganizationId: string;
  private strictIsolation: boolean;

  constructor(options: TenantResolverOptions) {
    this.store = options.store;
    this.logger = options.logger;
    this.defaultOrganizationId = options.defaultOrganizationId;
    this.strictIsolation = options.strictIsolation;
  }

  /**
   * Parse API key to extract tenant information
   */
  public parseApiKey(apiKey: string): ParsedApiKey {
    // New format: org_{orgId}_team_{teamId}_key_{keyId}.{secret}
    const newFormatRegex =
      /^org_([a-zA-Z0-9_-]+)(?:_team_([a-zA-Z0-9_-]+))?_key_([a-zA-Z0-9_-]+)\.(.+)$/;
    const match = apiKey.match(newFormatRegex);

    if (match) {
      return {
        organizationId: match[1]!,
        teamId: match[2],
        keyId: match[3]!,
        secret: match[4]!,
        isLegacy: false,
      };
    }

    // Legacy format: {secret}
    // Generate a deterministic key ID from the secret
    const keyId = this.generateKeyIdFromSecret(apiKey);
    return {
      organizationId: this.defaultOrganizationId,
      teamId: undefined,
      keyId,
      secret: apiKey,
      isLegacy: true,
    };
  }

  /**
   * Resolve tenant context from API key
   */
  public async resolveTenant(apiKey: string): Promise<TenantResolutionResult> {
    try {
      // Parse the API key
      const parsed = this.parseApiKey(apiKey);

      // Load organization
      const organization = await this.store.getOrganization(parsed.organizationId);
      if (!organization) {
        return this.errorResult(
          TenantErrorCode.ORGANIZATION_NOT_FOUND,
          `Organization not found: ${parsed.organizationId}`,
        );
      }

      // Check organization status
      if (organization.status === "suspended") {
        return this.errorResult(
          TenantErrorCode.ORGANIZATION_SUSPENDED,
          `Organization is suspended`,
        );
      }

      if (organization.status === "deleted") {
        return this.errorResult(TenantErrorCode.ORGANIZATION_NOT_FOUND, `Organization is deleted`);
      }

      // Load team if specified
      let team: Team | undefined;
      if (parsed.teamId) {
        const loadedTeam = await this.store.getTeam(parsed.organizationId, parsed.teamId);
        team = loadedTeam || undefined;
        if (!team) {
          return this.errorResult(
            TenantErrorCode.TEAM_NOT_FOUND,
            `Team not found: ${parsed.teamId}`,
          );
        }

        // Check team status
        if (team.status === "suspended") {
          return this.errorResult(TenantErrorCode.TEAM_SUSPENDED, `Team is suspended`);
        }

        if (team.status === "deleted") {
          return this.errorResult(TenantErrorCode.TEAM_NOT_FOUND, `Team is deleted`);
        }
      }

      // Load API key details
      const tenantApiKey = await this.store.getApiKey(parsed.organizationId, parsed.keyId);

      if (!tenantApiKey) {
        return this.errorResult(TenantErrorCode.API_KEY_NOT_FOUND, `API key not found`);
      }

      // Validate API key status
      if (tenantApiKey.status === "revoked") {
        return this.errorResult(TenantErrorCode.API_KEY_REVOKED, `API key has been revoked`);
      }

      if (tenantApiKey.status === "expired") {
        return this.errorResult(TenantErrorCode.API_KEY_EXPIRED, `API key has expired`);
      }

      // Check expiration
      if (tenantApiKey.expiresAt && new Date(tenantApiKey.expiresAt) < new Date()) {
        // Mark as expired
        await this.store.updateApiKeyStatus(parsed.organizationId, parsed.keyId, "expired");
        return this.errorResult(TenantErrorCode.API_KEY_EXPIRED, `API key has expired`);
      }

      // Load user (the creator of the API key)
      const user = await this.findUserInTeams(organization, team, tenantApiKey.createdBy);

      if (!user) {
        return this.errorResult(
          TenantErrorCode.USER_NOT_FOUND,
          `User not found: ${tenantApiKey.createdBy}`,
        );
      }

      // Check user status
      if (user.status === "suspended") {
        return this.errorResult(TenantErrorCode.USER_SUSPENDED, `User is suspended`);
      }

      // Get effective permissions
      const permissions = this.getEffectivePermissions(user, tenantApiKey);

      // Load usage quota
      const quota = await this.store.getQuota(parsed.organizationId, parsed.teamId);

      if (!quota) {
        return this.errorResult(
          TenantErrorCode.ORGANIZATION_NOT_FOUND,
          `Quota not found for organization`,
        );
      }

      // Build tenant context
      const context: TenantContext = {
        organization,
        team,
        user,
        apiKey: tenantApiKey,
        permissions,
        quota,
      };

      // Update last used timestamp
      await this.store.updateApiKeyLastUsed(parsed.organizationId, parsed.keyId);

      this.logger.debug("Tenant resolved successfully", {
        organizationId: organization.id,
        teamId: team?.id,
        userId: user.userId,
        permissions: permissions.length,
      });

      return {
        success: true,
        context,
      };
    } catch (error) {
      this.logger.error("Failed to resolve tenant", error as Error);
      return this.errorResult(
        TenantErrorCode.ORGANIZATION_NOT_FOUND,
        `Failed to resolve tenant: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Find user in organization or team
   */
  private async findUserInTeams(
    organization: Organization,
    team: Team | undefined,
    userId: string,
  ): Promise<TeamMember | undefined> {
    // If team is specified, look in team members
    if (team) {
      return team.members.find((member) => member.userId === userId);
    }

    // Otherwise, search across all teams in organization
    const teams = await this.store.listTeams(organization.id);
    for (const t of teams) {
      const member = t.members.find((m) => m.userId === userId);
      if (member) {
        return member;
      }
    }

    return undefined;
  }

  /**
   * Get effective permissions for user
   */
  private getEffectivePermissions(user: TeamMember, apiKey: TenantApiKey): Permission[] {
    // If API key has scoped permissions, use those
    if (apiKey.permissions && apiKey.permissions.length > 0) {
      return apiKey.permissions;
    }

    // Otherwise, use role-based permissions
    return ROLE_PERMISSIONS[user.role] || [];
  }

  /**
   * Validate tenant context permissions
   */
  public validatePermission(context: TenantContext, permission: Permission): boolean {
    return context.permissions.includes(permission);
  }

  /**
   * Validate quota limits
   */
  public async validateQuota(
    context: TenantContext,
    operation: "storage" | "request" | "bandwidth",
    amount: number,
  ): Promise<TenantResolutionResult> {
    const quota = context.quota;

    switch (operation) {
      case "storage":
        if (quota.storageUsed + amount > quota.storageLimit) {
          return this.errorResult(
            TenantErrorCode.QUOTA_EXCEEDED,
            `Storage quota exceeded. Limit: ${quota.storageLimit}, Used: ${quota.storageUsed}, Requested: ${amount}`,
          );
        }
        break;

      case "request":
        if (quota.requestsUsed + amount > quota.requestLimit) {
          return this.errorResult(
            TenantErrorCode.QUOTA_EXCEEDED,
            `Request quota exceeded. Limit: ${quota.requestLimit}, Used: ${quota.requestsUsed}`,
          );
        }
        break;

      case "bandwidth":
        if (quota.bandwidthUsed + amount > quota.bandwidthLimit) {
          return this.errorResult(
            TenantErrorCode.QUOTA_EXCEEDED,
            `Bandwidth quota exceeded. Limit: ${quota.bandwidthLimit}, Used: ${quota.bandwidthUsed}, Requested: ${amount}`,
          );
        }
        break;
    }

    return { success: true };
  }

  /**
   * Generate a deterministic key ID from secret (for legacy keys)
   */
  private generateKeyIdFromSecret(secret: string): string {
    const crypto = require("crypto");
    return crypto.createHash("sha256").update(secret).digest("hex").slice(0, 16);
  }

  /**
   * Create error result
   */
  private errorResult(errorCode: TenantErrorCode, message: string): TenantResolutionResult {
    return {
      success: false,
      error: message,
      errorCode,
    };
  }

  /**
   * Migrate legacy API key to new format
   */
  public async migrateLegacyKey(
    apiKey: string,
    userId: string,
    userName: string,
    userEmail: string,
  ): Promise<TenantApiKey | null> {
    const parsed = this.parseApiKey(apiKey);

    if (!parsed.isLegacy) {
      return null; // Already migrated
    }

    this.logger.info("Migrating legacy API key", { keyId: parsed.keyId });

    // Check if already migrated
    const existing = await this.store.getApiKey(this.defaultOrganizationId, parsed.keyId);

    if (existing) {
      return existing;
    }

    // Create new tenant API key entry
    const tenantApiKey: TenantApiKey = {
      id: parsed.keyId,
      organizationId: this.defaultOrganizationId,
      createdBy: userId,
      name: "Legacy API Key (Migrated)",
      key: apiKey,
      keyHash: this.generateKeyIdFromSecret(apiKey),
      createdAt: new Date().toISOString(),
      status: "active",
      usageStats: {
        totalRequests: 0,
        failedRequests: 0,
        rateLimitHits: 0,
        bytesUploaded: 0,
        bytesDownloaded: 0,
      },
    };

    await this.store.saveApiKey(this.defaultOrganizationId, tenantApiKey);
    return tenantApiKey;
  }
}
