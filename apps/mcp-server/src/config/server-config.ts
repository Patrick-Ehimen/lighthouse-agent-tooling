/**
 * Server Configuration
 */

export interface ServerConfig {
  name: string;
  version: string;
  logLevel: "debug" | "info" | "warn" | "error";
  maxStorageSize: number;
  port?: number;
  enableMetrics: boolean;
  metricsInterval: number;
}

export const DEFAULT_SERVER_CONFIG: ServerConfig = {
  name: "lighthouse-storage",
  version: "0.1.0",
  logLevel: "info",
  maxStorageSize: 1024 * 1024 * 1024, // 1GB
  enableMetrics: true,
  metricsInterval: 60000, // 1 minute
};
