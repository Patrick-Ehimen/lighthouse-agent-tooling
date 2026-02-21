/**
 * Server Configuration
 */

import { AuthConfig, PerformanceConfig } from "../auth/types.js";
import { MultiTenancyConfig, OrganizationSettings, UsageQuota } from "@lighthouse-tooling/types";
import { HealthCheckConfig } from "../health/types.js";
import * as path from "path";
import * as os from "os";

export interface ConnectionPoolServerConfig {
  maxConnections: number;
  idleTimeoutMs: number;
  requestTimeoutMs: number;
  keepAlive: boolean;
}

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
  connectionPool?: ConnectionPoolServerConfig;
  healthCheck?: HealthCheckConfig;
}

/**
 * Get default auth config with API key read at runtime (not module load time)
 * This ensures environment variables set after module import are respected
 */
export function getDefaultAuthConfig(): AuthConfig {
  return {
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
}

/**
 * Default auth config - reads API key at module load time for backward compatibility.
 * For runtime reading of env vars, use getDefaultAuthConfig() instead.
 */
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

export const DEFAULT_CONNECTION_POOL_CONFIG: ConnectionPoolServerConfig = {
  maxConnections: parseInt(process.env.LIGHTHOUSE_POOL_MAX_CONNECTIONS || "10", 10),
  idleTimeoutMs: parseInt(process.env.LIGHTHOUSE_POOL_IDLE_TIMEOUT || "60000", 10),
  requestTimeoutMs: parseInt(process.env.LIGHTHOUSE_POOL_REQUEST_TIMEOUT || "30000", 10),
  keepAlive: process.env.LIGHTHOUSE_POOL_KEEP_ALIVE !== "false",
};

export const DEFAULT_HEALTH_CHECK_CONFIG: HealthCheckConfig = {
  enabled: process.env.HEALTH_CHECK_ENABLED === "true",
  port: parseInt(process.env.HEALTH_CHECK_PORT || "8080", 10),
  lighthouseApiUrl: process.env.LIGHTHOUSE_API_URL || "https://api.lighthouse.storage",
  connectivityCheckInterval: 30000,
  connectivityTimeout: 5000,
  metricsEnabled: process.env.PROMETHEUS_METRICS_ENABLED !== "false", // Enabled by default
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

/**
 * Get default server config with API key read at runtime
 */
export function getDefaultServerConfig(): ServerConfig {
  return {
    name: "lighthouse-storage",
    version: "0.1.0",
    logLevel: "info",
    maxStorageSize: 1024 * 1024 * 1024, // 1GB
    enableMetrics: true,
    metricsInterval: 60000, // 1 minute
    lighthouseApiKey: process.env.LIGHTHOUSE_API_KEY,
    authentication: getDefaultAuthConfig(),
    performance: DEFAULT_PERFORMANCE_CONFIG,
    multiTenancy: DEFAULT_MULTI_TENANCY_CONFIG,
    connectionPool: DEFAULT_CONNECTION_POOL_CONFIG,
    healthCheck: DEFAULT_HEALTH_CHECK_CONFIG,
  };
}

/**
 * Default server config - reads API key at module load time for backward compatibility.
 * For runtime reading of env vars, use getDefaultServerConfig() instead.
 */
export const DEFAULT_SERVER_CONFIG: ServerConfig = {
  name: "lighthouse-storage",
  version: "0.1.0",
  logLevel: "info",
  maxStorageSize: 1024 * 1024 * 1024, // 1GB
  enableMetrics: true,
  metricsInterval: 60000, // 1 minute
  lighthouseApiKey: process.env.LIGHTHOUSE_API_KEY,
  authentication: DEFAULT_AUTH_CONFIG,
  performance: DEFAULT_PERFORMANCE_CONFIG,
  multiTenancy: DEFAULT_MULTI_TENANCY_CONFIG,
  connectionPool: DEFAULT_CONNECTION_POOL_CONFIG,
  healthCheck: DEFAULT_HEALTH_CHECK_CONFIG,
};

/**
 * Get the first day of next month
 */
function getNextMonthDate(): string {
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return nextMonth.toISOString();
}
