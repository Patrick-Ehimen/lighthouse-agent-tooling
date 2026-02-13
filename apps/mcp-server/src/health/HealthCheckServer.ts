/**
 * Health Check HTTP Server
 *
 * Provides /health (liveness) and /ready (readiness) endpoints
 * on a configurable port, separate from the MCP stdio transport.
 */

import * as http from "node:http";
import * as https from "node:https";
import { Logger } from "@lighthouse-tooling/shared";
import { AuthManager } from "../auth/AuthManager.js";
import { LighthouseServiceFactory } from "../auth/LighthouseServiceFactory.js";
import { ILighthouseService } from "../services/ILighthouseService.js";
import { ToolRegistry } from "../registry/ToolRegistry.js";
import { ServerConfig } from "../config/server-config.js";
import { HealthCheckConfig, HealthStatus, ReadinessCheck, ReadinessStatus } from "./types.js";

export interface HealthCheckDependencies {
  authManager: AuthManager;
  serviceFactory: LighthouseServiceFactory;
  lighthouseService: ILighthouseService;
  registry: ToolRegistry;
  config: ServerConfig;
  logger: Logger;
}

export class HealthCheckServer {
  private httpServer: http.Server | null = null;
  private startTime: number = Date.now();
  private deps: HealthCheckDependencies;
  private healthConfig: HealthCheckConfig;
  private logger: Logger;

  private lastConnectivityCheck: {
    up: boolean;
    latencyMs: number;
    checkedAt: number;
  } | null = null;

  constructor(deps: HealthCheckDependencies, healthConfig: HealthCheckConfig) {
    this.deps = deps;
    this.healthConfig = healthConfig;
    this.logger = deps.logger;
  }

  async start(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.httpServer = http.createServer((req, res) => {
        this.handleRequest(req, res);
      });

      this.httpServer.on("error", (err) => {
        this.logger.error("Health check server error", err);
        reject(err);
      });

      this.httpServer.listen(this.healthConfig.port, "127.0.0.1", () => {
        this.startTime = Date.now();
        this.logger.info("Health check server listening", {
          port: this.healthConfig.port,
        });
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (!this.httpServer) {
        resolve();
        return;
      }

      this.httpServer.close((err) => {
        this.httpServer = null;
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  getPort(): number | null {
    if (!this.httpServer) return null;
    const addr = this.httpServer.address();
    if (addr && typeof addr === "object") {
      return addr.port;
    }
    return null;
  }

  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    const url = req.url?.split("?")[0];

    if (req.method !== "GET") {
      this.sendJSON(res, 405, { error: "Method not allowed" });
      return;
    }

    switch (url) {
      case "/health":
        this.handleHealth(res);
        break;
      case "/ready":
        this.handleReady(res).catch((err) => {
          this.logger.error("Readiness check failed", err);
          this.sendJSON(res, 500, { error: "Internal server error" });
        });
        break;
      default:
        this.sendJSON(res, 404, { error: "Not found" });
        break;
    }
  }

  private handleHealth(res: http.ServerResponse): void {
    const status: HealthStatus = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      version: this.deps.config.version,
    };

    this.sendJSON(res, 200, status);
  }

  private async handleReady(res: http.ServerResponse): Promise<void> {
    const [sdkCheck, cacheCheck, connectivityCheck, poolCheck] = await Promise.all([
      this.checkSDK(),
      this.checkCache(),
      this.checkLighthouseConnectivity(),
      this.checkServicePool(),
    ]);

    const allUp =
      sdkCheck.status === "up" &&
      cacheCheck.status === "up" &&
      connectivityCheck.status === "up" &&
      poolCheck.status === "up";

    const status: ReadinessStatus = {
      status: allUp ? "ready" : "not_ready",
      timestamp: new Date().toISOString(),
      checks: {
        sdk: sdkCheck,
        cache: cacheCheck,
        lighthouse_api: connectivityCheck,
        service_pool: poolCheck,
      },
    };

    this.sendJSON(res, allUp ? 200 : 503, status);
  }

  private checkSDK(): ReadinessCheck {
    try {
      const stats = this.deps.lighthouseService.getStorageStats();
      return { status: "up", fileCount: stats.fileCount, utilization: stats.utilization };
    } catch {
      return { status: "down" };
    }
  }

  private checkCache(): ReadinessCheck {
    try {
      const stats = this.deps.authManager.getCacheStats();
      return {
        status: "up",
        size: stats.size,
        maxSize: stats.maxSize,
        hitRate: stats.hitRate,
      };
    } catch {
      return { status: "down" };
    }
  }

  private checkServicePool(): ReadinessCheck {
    try {
      const stats = this.deps.serviceFactory.getStats();
      return {
        status: "up",
        size: stats.size,
        maxSize: stats.maxSize,
      };
    } catch {
      return { status: "down" };
    }
  }

  async checkLighthouseConnectivity(): Promise<ReadinessCheck> {
    const interval = this.healthConfig.connectivityCheckInterval ?? 30000;
    const now = Date.now();

    if (this.lastConnectivityCheck && now - this.lastConnectivityCheck.checkedAt < interval) {
      return {
        status: this.lastConnectivityCheck.up ? "up" : "down",
        latency_ms: this.lastConnectivityCheck.latencyMs,
      };
    }

    const timeout = this.healthConfig.connectivityTimeout ?? 5000;
    const apiUrl = this.healthConfig.lighthouseApiUrl ?? "https://api.lighthouse.storage";

    try {
      const latencyMs = await this.pingLighthouseApi(apiUrl, timeout);
      this.lastConnectivityCheck = { up: true, latencyMs, checkedAt: now };
      return { status: "up", latency_ms: latencyMs };
    } catch {
      this.lastConnectivityCheck = { up: false, latencyMs: 0, checkedAt: now };
      return { status: "down", latency_ms: 0 };
    }
  }

  private pingLighthouseApi(apiUrl: string, timeout: number): Promise<number> {
    return new Promise<number>((resolve, reject) => {
      const start = Date.now();
      const url = new URL("/api/lighthouse/file_info?cid=test", apiUrl);

      const req = https.get(
        {
          hostname: url.hostname,
          path: url.pathname + url.search,
          port: url.port || 443,
          timeout,
        },
        (res) => {
          // Any response means the API is reachable
          res.resume(); // Drain the response
          resolve(Date.now() - start);
        },
      );

      req.on("error", (err) => reject(err));
      req.on("timeout", () => {
        req.destroy();
        reject(new Error("Connectivity check timed out"));
      });
    });
  }

  private sendJSON(res: http.ServerResponse, statusCode: number, body: unknown): void {
    const json = JSON.stringify(body);
    res.writeHead(statusCode, {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(json),
      "Cache-Control": "no-cache, no-store",
    });
    res.end(json);
  }
}
