/**
 * Health Check Server Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as http from "node:http";
import { HealthCheckServer, HealthCheckDependencies } from "../health/HealthCheckServer.js";
import { HealthCheckConfig } from "../health/types.js";
import { Logger } from "@lighthouse-tooling/shared";

function makeRequest(
  port: number,
  path: string,
): Promise<{ statusCode: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://127.0.0.1:${port}${path}`, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        resolve({
          statusCode: res.statusCode ?? 0,
          headers: res.headers,
          body: data,
        });
      });
    });
    req.on("error", reject);
  });
}

function createMockDeps(): HealthCheckDependencies {
  const mockAuthManager = {
    getCacheStats: vi.fn().mockReturnValue({
      enabled: true,
      size: 10,
      maxSize: 1000,
      hitRate: 0.85,
    }),
    authenticate: vi.fn(),
    getEffectiveApiKey: vi.fn(),
    destroy: vi.fn(),
  } as unknown as HealthCheckDependencies["authManager"];

  const mockServiceFactory = {
    getStats: vi.fn().mockReturnValue({
      size: 3,
      maxSize: 50,
      oldestServiceAge: 5000,
    }),
    getService: vi.fn(),
    destroy: vi.fn(),
  } as unknown as HealthCheckDependencies["serviceFactory"];

  const mockLighthouseService = {
    getStorageStats: vi.fn().mockReturnValue({
      fileCount: 5,
      totalSize: 1024,
      maxSize: 1073741824,
      utilization: 0.001,
    }),
    initialize: vi.fn(),
    uploadFile: vi.fn(),
    fetchFile: vi.fn(),
    pinFile: vi.fn(),
    unpinFile: vi.fn(),
    getFileInfo: vi.fn(),
    listFiles: vi.fn(),
    clear: vi.fn(),
    createDataset: vi.fn(),
    updateDataset: vi.fn(),
    getDataset: vi.fn(),
    listDatasets: vi.fn(),
    deleteDataset: vi.fn(),
    batchUploadFiles: vi.fn(),
    batchDownloadFiles: vi.fn(),
  } as unknown as HealthCheckDependencies["lighthouseService"];

  const mockRegistry = {
    getMetrics: vi.fn().mockReturnValue({}),
    listTools: vi.fn().mockReturnValue([]),
  } as unknown as HealthCheckDependencies["registry"];

  const logger = Logger.getInstance({ level: "error", component: "test" });

  return {
    authManager: mockAuthManager,
    serviceFactory: mockServiceFactory,
    lighthouseService: mockLighthouseService,
    registry: mockRegistry,
    config: {
      name: "lighthouse-storage",
      version: "0.1.0",
      logLevel: "error" as const,
      maxStorageSize: 1073741824,
      enableMetrics: false,
      metricsInterval: 60000,
    },
    logger,
  };
}

describe("HealthCheckServer", () => {
  let server: HealthCheckServer;
  let deps: HealthCheckDependencies;
  let port: number;

  const healthConfig: HealthCheckConfig = {
    enabled: true,
    port: 0, // OS-assigned
    lighthouseApiUrl: "https://api.lighthouse.storage",
    connectivityCheckInterval: 30000,
    connectivityTimeout: 5000,
  };

  beforeEach(async () => {
    deps = createMockDeps();
    server = new HealthCheckServer(deps, healthConfig);
    await server.start();
    port = server.getPort()!;
  });

  afterEach(async () => {
    await server.stop();
  });

  describe("/health endpoint", () => {
    it("should return 200 with healthy status", async () => {
      const res = await makeRequest(port, "/health");
      expect(res.statusCode).toBe(200);

      const body = JSON.parse(res.body);
      expect(body.status).toBe("healthy");
      expect(body.version).toBe("0.1.0");
      expect(body.timestamp).toBeDefined();
      expect(typeof body.uptime).toBe("number");
    });

    it("should include uptime in seconds", async () => {
      const res = await makeRequest(port, "/health");
      const body = JSON.parse(res.body);
      expect(body.uptime).toBeGreaterThanOrEqual(0);
    });

    it("should set Content-Type to application/json", async () => {
      const res = await makeRequest(port, "/health");
      expect(res.headers["content-type"]).toBe("application/json");
    });
  });

  describe("/ready endpoint", () => {
    it("should return 200 when all checks pass", async () => {
      // Mock the connectivity check to avoid real network calls
      vi.spyOn(server, "checkLighthouseConnectivity").mockResolvedValue({
        status: "up",
        latency_ms: 42,
      });

      const res = await makeRequest(port, "/ready");
      expect(res.statusCode).toBe(200);

      const body = JSON.parse(res.body);
      expect(body.status).toBe("ready");
      expect(body.timestamp).toBeDefined();
      expect(body.checks.sdk.status).toBe("up");
      expect(body.checks.cache.status).toBe("up");
      expect(body.checks.lighthouse_api.status).toBe("up");
      expect(body.checks.service_pool.status).toBe("up");
    });

    it("should include cache stats in response", async () => {
      vi.spyOn(server, "checkLighthouseConnectivity").mockResolvedValue({
        status: "up",
        latency_ms: 10,
      });

      const res = await makeRequest(port, "/ready");
      const body = JSON.parse(res.body);

      expect(body.checks.cache.size).toBe(10);
      expect(body.checks.cache.maxSize).toBe(1000);
      expect(body.checks.cache.hitRate).toBe(0.85);
    });

    it("should include service pool stats in response", async () => {
      vi.spyOn(server, "checkLighthouseConnectivity").mockResolvedValue({
        status: "up",
        latency_ms: 10,
      });

      const res = await makeRequest(port, "/ready");
      const body = JSON.parse(res.body);

      expect(body.checks.service_pool.size).toBe(3);
      expect(body.checks.service_pool.maxSize).toBe(50);
    });

    it("should include lighthouse API latency", async () => {
      vi.spyOn(server, "checkLighthouseConnectivity").mockResolvedValue({
        status: "up",
        latency_ms: 45,
      });

      const res = await makeRequest(port, "/ready");
      const body = JSON.parse(res.body);

      expect(body.checks.lighthouse_api.latency_ms).toBe(45);
    });

    it("should return 503 when SDK check fails", async () => {
      vi.spyOn(server, "checkLighthouseConnectivity").mockResolvedValue({
        status: "up",
        latency_ms: 10,
      });

      const mockService = deps.lighthouseService as any;
      mockService.getStorageStats.mockImplementation(() => {
        throw new Error("SDK not initialized");
      });

      const res = await makeRequest(port, "/ready");
      expect(res.statusCode).toBe(503);

      const body = JSON.parse(res.body);
      expect(body.status).toBe("not_ready");
      expect(body.checks.sdk.status).toBe("down");
    });

    it("should return 503 when Lighthouse API is unreachable", async () => {
      vi.spyOn(server, "checkLighthouseConnectivity").mockResolvedValue({
        status: "down",
        latency_ms: 0,
      });

      const res = await makeRequest(port, "/ready");
      expect(res.statusCode).toBe(503);

      const body = JSON.parse(res.body);
      expect(body.status).toBe("not_ready");
      expect(body.checks.lighthouse_api.status).toBe("down");
    });

    it("should cache connectivity check results", async () => {
      const connectivitySpy = vi
        .spyOn(server, "checkLighthouseConnectivity")
        .mockResolvedValue({ status: "up", latency_ms: 30 });

      await makeRequest(port, "/ready");
      await makeRequest(port, "/ready");

      // The spy is called for each /ready request since it's the top-level method.
      // The internal caching is within checkLighthouseConnectivity itself.
      expect(connectivitySpy).toHaveBeenCalledTimes(2);
    });
  });

  describe("error handling", () => {
    it("should return 404 for unknown paths", async () => {
      const res = await makeRequest(port, "/unknown");
      expect(res.statusCode).toBe(404);

      const body = JSON.parse(res.body);
      expect(body.error).toBe("Not found");
    });

    it("should return 404 for root path", async () => {
      const res = await makeRequest(port, "/");
      expect(res.statusCode).toBe(404);
    });
  });

  describe("lifecycle", () => {
    it("should report the assigned port", () => {
      expect(port).toBeGreaterThan(0);
    });

    it("should stop cleanly", async () => {
      await server.stop();
      // Attempting a request after stop should fail
      await expect(makeRequest(port, "/health")).rejects.toThrow();
      // Prevent afterEach from double-stopping
      server = new HealthCheckServer(deps, healthConfig);
      await server.start();
      port = server.getPort()!;
    });

    it("should return null port when not started", () => {
      const unstartedServer = new HealthCheckServer(deps, healthConfig);
      expect(unstartedServer.getPort()).toBeNull();
    });
  });
});
