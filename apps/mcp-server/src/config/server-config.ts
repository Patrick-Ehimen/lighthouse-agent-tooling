/**
 * Server Configuration
 */

import { AuthConfig, PerformanceConfig } from "../auth/types.js";

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
};
