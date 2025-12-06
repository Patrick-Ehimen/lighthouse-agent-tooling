/**
 * Default Organization Initializer
 * Creates a default organization for backward compatibility with legacy API keys
 */

import {
  Organization,
  Team,
  TeamMember,
  Role,
  UsageQuota,
  TenantApiKey,
  OrganizationSettings,
} from "@lighthouse-tooling/types";
import { TenantStore } from "./storage/TenantStore.js";
import { Logger } from "@lighthouse-tooling/shared";

/**
 * Default organization initializer options
 */
export interface DefaultOrgInitOptions {
  organizationId: string;
  organizationSettings: OrganizationSettings;
  defaultQuota: UsageQuota;
  apiKey?: string;
}

/**
 * Default Organization Initializer
 */
export class DefaultOrganizationInitializer {
  private store: TenantStore;
  private logger: Logger;

  constructor(store: TenantStore, logger: Logger) {
    this.store = store;
    this.logger = logger;
  }

  /**
   * Initialize default organization
   * Creates organization, default team, and migrates existing API key if provided
   */
  public async initialize(options: DefaultOrgInitOptions): Promise<void> {
    const { organizationId, organizationSettings, defaultQuota, apiKey } = options;

    // Check if organization already exists
    const existing = await this.store.getOrganization(organizationId);
    if (existing) {
      this.logger.info("Default organization already exists", {
        organizationId,
      });
      return;
    }

    this.logger.info("Initializing default organization", { organizationId });

    // Create default organization
    const organization: Organization = {
      id: organizationId,
      name: organizationId,
      displayName: "Default Organization",
      description: "Default organization for single-tenant mode",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ownerId: "system",
      settings: organizationSettings,
      status: "active",
      metadata: {
        isDefault: true,
        createdBy: "system",
      },
    };

    await this.store.saveOrganization(organization);

    // Create default team
    const defaultTeam: Team = {
      id: "default",
      organizationId,
      name: "default",
      displayName: "Default Team",
      description: "Default team for all users",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ownerId: "system",
      members: [
        {
          userId: "system",
          email: "system@lighthouse.storage",
          displayName: "System Administrator",
          role: Role.OWNER,
          joinedAt: new Date().toISOString(),
          status: "active",
        },
      ],
      status: "active",
      metadata: {
        isDefault: true,
      },
    };

    await this.store.saveTeam(organizationId, defaultTeam);

    // Create default quota
    await this.store.saveQuota(organizationId, { ...defaultQuota });

    // Migrate legacy API key if provided
    if (apiKey) {
      await this.migrateLegacyApiKey(organizationId, apiKey);
    }

    this.logger.info("Default organization initialized successfully", {
      organizationId,
    });
  }

  /**
   * Migrate legacy API key to tenant format
   */
  private async migrateLegacyApiKey(organizationId: string, apiKey: string): Promise<void> {
    const crypto = require("crypto");
    const keyId = crypto.createHash("sha256").update(apiKey).digest("hex").slice(0, 16);

    // Check if already migrated
    const existing = await this.store.getApiKey(organizationId, keyId);
    if (existing) {
      this.logger.info("Legacy API key already migrated", { keyId });
      return;
    }

    const tenantApiKey: TenantApiKey = {
      id: keyId,
      organizationId,
      createdBy: "system",
      name: "Legacy API Key (Auto-migrated)",
      key: apiKey,
      keyHash: keyId,
      createdAt: new Date().toISOString(),
      status: "active",
      usageStats: {
        totalRequests: 0,
        failedRequests: 0,
        rateLimitHits: 0,
        bytesUploaded: 0,
        bytesDownloaded: 0,
      },
      metadata: {
        migrated: true,
        migratedAt: new Date().toISOString(),
      },
    };

    await this.store.saveApiKey(organizationId, tenantApiKey);

    this.logger.info("Legacy API key migrated", { keyId });
  }

  /**
   * Ensure default organization exists
   */
  public async ensureDefaultOrganization(options: DefaultOrgInitOptions): Promise<Organization> {
    await this.initialize(options);

    const organization = await this.store.getOrganization(options.organizationId);
    if (!organization) {
      throw new Error(`Failed to initialize default organization: ${options.organizationId}`);
    }

    return organization;
  }

  /**
   * Add user to default organization
   */
  public async addUserToDefaultOrg(
    organizationId: string,
    userId: string,
    email: string,
    displayName: string,
    role: Role = Role.MEMBER,
  ): Promise<void> {
    const teams = await this.store.listTeams(organizationId);
    const defaultTeam = teams.find((t) => t.id === "default");

    if (!defaultTeam) {
      throw new Error(`Default team not found in organization: ${organizationId}`);
    }

    // Check if user already exists
    const existingMember = defaultTeam.members.find((m: TeamMember) => m.userId === userId);
    if (existingMember) {
      this.logger.info("User already exists in default team", { userId });
      return;
    }

    // Add new member
    const newMember: TeamMember = {
      userId,
      email,
      displayName,
      role,
      joinedAt: new Date().toISOString(),
      status: "active",
    };

    defaultTeam.members.push(newMember);
    defaultTeam.updatedAt = new Date().toISOString();

    await this.store.saveTeam(organizationId, defaultTeam);

    this.logger.info("User added to default organization", {
      userId,
      organizationId,
      role,
    });
  }
}
