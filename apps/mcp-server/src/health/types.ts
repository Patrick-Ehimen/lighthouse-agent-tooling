/**
 * Health Check Types
 */

export interface HealthCheckConfig {
  enabled: boolean;
  port: number;
  lighthouseApiUrl?: string;
  connectivityCheckInterval?: number;
  connectivityTimeout?: number;
}

export interface HealthStatus {
  status: "healthy";
  timestamp: string;
  uptime: number;
  version: string;
}

export interface ReadinessCheck {
  status: "up" | "down";
  [key: string]: unknown;
}

export interface ReadinessStatus {
  status: "ready" | "not_ready";
  timestamp: string;
  checks: {
    sdk: ReadinessCheck;
    cache: ReadinessCheck;
    lighthouse_api: ReadinessCheck;
    service_pool: ReadinessCheck;
  };
}
