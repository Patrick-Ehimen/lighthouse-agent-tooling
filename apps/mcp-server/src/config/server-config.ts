/**
 * Server Configuration
 */

import { AuthConfig, PerformanceConfig } from "../auth/types.js";
import { MultiTenancyConfig, OrganizationSettings, UsageQuota } from "@lighthouse-tooling/types";
import * as path from "path";
import * as os from "os";

export interface ServerConfig {
  name: string;
  version: string;
  logLevel: "debug" | "info" | "warn" | "error";
  maxStorageSize: number;
  port?: number;
  enableMetrics: boolean;
  metricsInterval: number;
  lighthouseApiKey?: string;
  authentication?: AuthConfig;
  performance?: PerformanceConfig;
  multiTenancy?: MultiTenancyConfig;
}

export const DEFAULT_AUTH_CONFIG: AuthConfig = {
  defaultApiKey: process.env.LIGHTHOUSE_API_KEY,
  enablePerRequestAuth: true,
  requireAuthentication: true,
  keyValidationCache: {
    enabled: true,
    maxSize: 1000,
    ttlSeconds: 300, // 5 minutes
    cleanupIntervalSeconds: 60,
  },
  rateLimiting: {
    enabled: true,
    requestsPerMinute: 60,
    burstLimit: 10,
    keyBasedLimiting: true,
  },
};

export const DEFAULT_PERFORMANCE_CONFIG: PerformanceConfig = {
  servicePoolSize: 50,
  serviceTimeoutMinutes: 30,
  concurrentRequestLimit: 100,
};

export const DEFAULT_ORGANIZATION_SETTINGS: OrganizationSettings = {
  defaultStorageQuota: 10 * 1024 * 1024 * 1024, // 10GB
  defaultRateLimit: 1000, // 1000 requests per minute
  allowTeamCreation: true,
  require2FA: false,
  dataRetentionDays: 365, // 1 year
  allowedFileTypes: [], // Empty = all allowed
  maxFileSize: 5 * 1024 * 1024 * 1024, // 5GB
  enableAuditLog: true,
};

export const DEFAULT_USAGE_QUOTA: UsageQuota = {
  storageLimit: 10 * 1024 * 1024 * 1024, // 10GB
  storageUsed: 0,
  requestLimit: 100000, // 100k requests per month
  requestsUsed: 0,
  bandwidthLimit: 100 * 1024 * 1024 * 1024, // 100GB per month
  bandwidthUsed: 0,
  maxTeams: 10,
  currentTeams: 0,
  maxMembersPerTeam: 50,
  maxApiKeys: 100,
  currentApiKeys: 0,
  resetDate: getNextMonthDate(),
};

export const DEFAULT_MULTI_TENANCY_CONFIG: MultiTenancyConfig = {
  enabled: process.env.MULTI_TENANCY_ENABLED === "true" || false,
  defaultOrganizationId: "default",
  storage: {
    rootPath: path.join(os.homedir(), ".lighthouse-tenancy"),
    organizationPath: (orgId: string) => path.join(os.homedir(), ".lighthouse-tenancy", orgId),
    teamPath: (orgId: string, teamId: string) =>
      path.join(os.homedir(), ".lighthouse-tenancy", orgId, "teams", teamId),
    enableEncryption: false,
    backendType: "local",
  },
  defaultOrganizationSettings: DEFAULT_ORGANIZATION_SETTINGS,
  defaultQuota: DEFAULT_USAGE_QUOTA,
  strictIsolation: true,
  auditLogRetentionDays: 90,
};

export const DEFAULT_SERVER_CONFIG: ServerConfig = {
  name: "lighthouse-storage",
  version: "0.1.0",
  logLevel: "info",
  maxStorageSize: 1024 * 1024 * 1024, // 1GB
  enableMetrics: false, // Disabled by default to avoid interfering with MCP stdio protocol
  metricsInterval: 60000, // 1 minute
  lighthouseApiKey: process.env.LIGHTHOUSE_API_KEY,
  authentication: DEFAULT_AUTH_CONFIG,
  performance: DEFAULT_PERFORMANCE_CONFIG,
  multiTenancy: DEFAULT_MULTI_TENANCY_CONFIG,
};

/**
 * Get the first day of next month
 */
function getNextMonthDate(): string {
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return nextMonth.toISOString();
}
