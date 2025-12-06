/**
 * Tenant Storage Layer
 * Handles persistence of tenant data (organizations, teams, API keys, quotas)
 */

import {
  Organization,
  Team,
  TenantApiKey,
  UsageQuota,
  TenantAuditLog,
  TenantStorageConfig,
} from "@lighthouse-tooling/types";
import * as fs from "fs/promises";
import * as path from "path";
import { Logger } from "@lighthouse-tooling/shared";

/**
 * Tenant Store - Manages persistent storage of tenant data
 */
export class TenantStore {
  private config: TenantStorageConfig;
  private logger: Logger;
  private memoryCache: Map<string, any>;

  constructor(config: TenantStorageConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
    this.memoryCache = new Map();
  }

  /**
   * Initialize storage (create directories)
   */
  public async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.config.rootPath, { recursive: true });
      this.logger.info("Tenant store initialized", {
        rootPath: this.config.rootPath,
      });
    } catch (error) {
      this.logger.error("Failed to initialize tenant store", error as Error);
      throw error;
    }
  }

  // ==================== Organization Operations ====================

  /**
   * Get organization by ID
   */
  public async getOrganization(organizationId: string): Promise<Organization | null> {
    const cacheKey = `org:${organizationId}`;
    if (this.memoryCache.has(cacheKey)) {
      return this.memoryCache.get(cacheKey);
    }

    const orgPath = this.getOrganizationPath(organizationId);
    const org = await this.readJson<Organization>(path.join(orgPath, "organization.json"));

    if (org) {
      this.memoryCache.set(cacheKey, org);
    }

    return org;
  }

  /**
   * Save organization
   */
  public async saveOrganization(organization: Organization): Promise<void> {
    const orgPath = this.getOrganizationPath(organization.id);
    await fs.mkdir(orgPath, { recursive: true });
    await this.writeJson(path.join(orgPath, "organization.json"), organization);

    // Update cache
    this.memoryCache.set(`org:${organization.id}`, organization);
  }

  /**
   * List all organizations
   */
  public async listOrganizations(): Promise<Organization[]> {
    const organizations: Organization[] = [];
    try {
      const entries = await fs.readdir(this.config.rootPath, {
        withFileTypes: true,
      });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const org = await this.getOrganization(entry.name);
          if (org) {
            organizations.push(org);
          }
        }
      }
    } catch (error) {
      this.logger.error("Failed to list organizations", error as Error);
    }

    return organizations;
  }

  // ==================== Team Operations ====================

  /**
   * Get team by ID
   */
  public async getTeam(organizationId: string, teamId: string): Promise<Team | null> {
    const cacheKey = `team:${organizationId}:${teamId}`;
    if (this.memoryCache.has(cacheKey)) {
      return this.memoryCache.get(cacheKey);
    }

    const teamPath = this.getTeamPath(organizationId, teamId);
    const team = await this.readJson<Team>(path.join(teamPath, "team.json"));

    if (team) {
      this.memoryCache.set(cacheKey, team);
    }

    return team;
  }

  /**
   * Save team
   */
  public async saveTeam(organizationId: string, team: Team): Promise<void> {
    const teamPath = this.getTeamPath(organizationId, team.id);
    await fs.mkdir(teamPath, { recursive: true });
    await this.writeJson(path.join(teamPath, "team.json"), team);

    // Update cache
    this.memoryCache.set(`team:${organizationId}:${team.id}`, team);
  }

  /**
   * List teams in organization
   */
  public async listTeams(organizationId: string): Promise<Team[]> {
    const teams: Team[] = [];
    try {
      const teamsDir = path.join(this.getOrganizationPath(organizationId), "teams");

      try {
        const entries = await fs.readdir(teamsDir, { withFileTypes: true });

        for (const entry of entries) {
          if (entry.isDirectory()) {
            const team = await this.getTeam(organizationId, entry.name);
            if (team) {
              teams.push(team);
            }
          }
        }
      } catch (error: any) {
        if (error.code !== "ENOENT") {
          throw error;
        }
        // Directory doesn't exist yet, return empty array
      }
    } catch (error) {
      this.logger.error("Failed to list teams", error as Error, { organizationId });
    }

    return teams;
  }

  /**
   * Delete team
   */
  public async deleteTeam(organizationId: string, teamId: string): Promise<void> {
    const teamPath = this.getTeamPath(organizationId, teamId);
    await fs.rm(teamPath, { recursive: true, force: true });

    // Clear cache
    this.memoryCache.delete(`team:${organizationId}:${teamId}`);
  }

  // ==================== API Key Operations ====================

  /**
   * Get API key by ID
   */
  public async getApiKey(organizationId: string, keyId: string): Promise<TenantApiKey | null> {
    const cacheKey = `apikey:${organizationId}:${keyId}`;
    if (this.memoryCache.has(cacheKey)) {
      return this.memoryCache.get(cacheKey);
    }

    const apiKeyPath = this.getApiKeyPath(organizationId, keyId);
    const apiKey = await this.readJson<TenantApiKey>(apiKeyPath);

    if (apiKey) {
      this.memoryCache.set(cacheKey, apiKey);
    }

    return apiKey;
  }

  /**
   * Save API key
   */
  public async saveApiKey(organizationId: string, apiKey: TenantApiKey): Promise<void> {
    const keysDir = path.join(this.getOrganizationPath(organizationId), "keys");
    await fs.mkdir(keysDir, { recursive: true });

    const apiKeyPath = this.getApiKeyPath(organizationId, apiKey.id);
    await this.writeJson(apiKeyPath, apiKey);

    // Update cache
    this.memoryCache.set(`apikey:${organizationId}:${apiKey.id}`, apiKey);
  }

  /**
   * List API keys for organization
   */
  public async listApiKeys(organizationId: string): Promise<TenantApiKey[]> {
    const apiKeys: TenantApiKey[] = [];
    try {
      const keysDir = path.join(this.getOrganizationPath(organizationId), "keys");

      try {
        const entries = await fs.readdir(keysDir);

        for (const entry of entries) {
          if (entry.endsWith(".json")) {
            const keyId = entry.replace(".json", "");
            const apiKey = await this.getApiKey(organizationId, keyId);
            if (apiKey) {
              apiKeys.push(apiKey);
            }
          }
        }
      } catch (error: any) {
        if (error.code !== "ENOENT") {
          throw error;
        }
        // Directory doesn't exist yet, return empty array
      }
    } catch (error) {
      this.logger.error("Failed to list API keys", error as Error, { organizationId });
    }

    return apiKeys;
  }

  /**
   * Update API key status
   */
  public async updateApiKeyStatus(
    organizationId: string,
    keyId: string,
    status: "active" | "revoked" | "expired",
  ): Promise<void> {
    const apiKey = await this.getApiKey(organizationId, keyId);
    if (!apiKey) {
      throw new Error(`API key not found: ${keyId}`);
    }

    apiKey.status = status;
    await this.saveApiKey(organizationId, apiKey);
  }

  /**
   * Update API key last used timestamp
   */
  public async updateApiKeyLastUsed(organizationId: string, keyId: string): Promise<void> {
    const apiKey = await this.getApiKey(organizationId, keyId);
    if (!apiKey) {
      return;
    }

    apiKey.lastUsedAt = new Date().toISOString();
    if (!apiKey.usageStats) {
      apiKey.usageStats = {
        totalRequests: 0,
        failedRequests: 0,
        rateLimitHits: 0,
        bytesUploaded: 0,
        bytesDownloaded: 0,
      };
    }
    if (apiKey.usageStats) {
      apiKey.usageStats.totalRequests++;
      apiKey.usageStats.lastRequestAt = new Date().toISOString();
    }

    await this.saveApiKey(organizationId, apiKey);
  }

  // ==================== Quota Operations ====================

  /**
   * Get usage quota
   */
  public async getQuota(organizationId: string, teamId?: string): Promise<UsageQuota | null> {
    const cacheKey = teamId ? `quota:${organizationId}:${teamId}` : `quota:${organizationId}`;

    if (this.memoryCache.has(cacheKey)) {
      return this.memoryCache.get(cacheKey);
    }

    const quotaPath = teamId
      ? path.join(this.getTeamPath(organizationId, teamId), "quota.json")
      : path.join(this.getOrganizationPath(organizationId), "quota.json");

    const quota = await this.readJson<UsageQuota>(quotaPath);

    if (quota) {
      this.memoryCache.set(cacheKey, quota);
    }

    return quota;
  }

  /**
   * Save usage quota
   */
  public async saveQuota(
    organizationId: string,
    quota: UsageQuota,
    teamId?: string,
  ): Promise<void> {
    const quotaPath = teamId
      ? path.join(this.getTeamPath(organizationId, teamId), "quota.json")
      : path.join(this.getOrganizationPath(organizationId), "quota.json");

    await this.writeJson(quotaPath, quota);

    // Update cache
    const cacheKey = teamId ? `quota:${organizationId}:${teamId}` : `quota:${organizationId}`;
    this.memoryCache.set(cacheKey, quota);
  }

  /**
   * Update quota usage
   */
  public async updateQuotaUsage(
    organizationId: string,
    updates: {
      storageUsed?: number;
      requestsUsed?: number;
      bandwidthUsed?: number;
    },
    teamId?: string,
  ): Promise<void> {
    const quota = await this.getQuota(organizationId, teamId);
    if (!quota) {
      throw new Error(`Quota not found for organization: ${organizationId}`);
    }

    if (updates.storageUsed !== undefined) {
      quota.storageUsed = updates.storageUsed;
    }
    if (updates.requestsUsed !== undefined) {
      quota.requestsUsed = updates.requestsUsed;
    }
    if (updates.bandwidthUsed !== undefined) {
      quota.bandwidthUsed = updates.bandwidthUsed;
    }

    await this.saveQuota(organizationId, quota, teamId);
  }

  // ==================== Audit Log Operations ====================

  /**
   * Append audit log entry
   */
  public async appendAuditLog(organizationId: string, entry: TenantAuditLog): Promise<void> {
    const auditLogPath = path.join(this.getOrganizationPath(organizationId), "audit-log.jsonl");

    const line = JSON.stringify(entry) + "\n";
    await fs.appendFile(auditLogPath, line, "utf-8");
  }

  /**
   * Get recent audit logs
   */
  public async getAuditLogs(
    organizationId: string,
    limit: number = 100,
  ): Promise<TenantAuditLog[]> {
    const auditLogPath = path.join(this.getOrganizationPath(organizationId), "audit-log.jsonl");

    try {
      const content = await fs.readFile(auditLogPath, "utf-8");
      const lines = content.trim().split("\n");
      const logs: TenantAuditLog[] = [];

      // Read from end (most recent first)
      for (let i = lines.length - 1; i >= 0 && logs.length < limit; i--) {
        const line = lines[i];
        if (line && line.trim()) {
          logs.push(JSON.parse(line));
        }
      }

      return logs;
    } catch (error: any) {
      if (error.code === "ENOENT") {
        return []; // No audit log yet
      }
      throw error;
    }
  }

  // ==================== Helper Methods ====================

  /**
   * Get organization directory path
   */
  private getOrganizationPath(organizationId: string): string {
    return this.config.organizationPath(organizationId);
  }

  /**
   * Get team directory path
   */
  private getTeamPath(organizationId: string, teamId: string): string {
    return this.config.teamPath(organizationId, teamId);
  }

  /**
   * Get API key file path
   */
  private getApiKeyPath(organizationId: string, keyId: string): string {
    return path.join(this.getOrganizationPath(organizationId), "keys", `${keyId}.json`);
  }

  /**
   * Read JSON file
   */
  private async readJson<T>(filePath: string): Promise<T | null> {
    try {
      const content = await fs.readFile(filePath, "utf-8");
      return JSON.parse(content);
    } catch (error: any) {
      if (error.code === "ENOENT") {
        return null;
      }
      this.logger.error("Failed to read JSON file", error as Error, { filePath });
      throw error;
    }
  }

  /**
   * Write JSON file
   */
  private async writeJson(filePath: string, data: any): Promise<void> {
    const content = JSON.stringify(data, null, 2);
    await fs.writeFile(filePath, content, "utf-8");
  }

  /**
   * Clear cache
   */
  public clearCache(): void {
    this.memoryCache.clear();
  }
}
