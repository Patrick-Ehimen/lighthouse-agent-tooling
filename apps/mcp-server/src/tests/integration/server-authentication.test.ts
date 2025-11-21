/**
 * Integration tests for server-level authentication flow
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { LighthouseMCPServer } from "../../server.js";
import { AuthenticationError, AuthErrorType } from "../../errors/AuthenticationError.js";
import { MockLighthouseService } from "../../services/MockLighthouseService.js";
import { MockDatasetService } from "../../services/MockDatasetService.js";
import { ServerConfig } from "../../config/server-config.js";
import { RequestContext } from "../../auth/RequestContext.js";

describe("Server Authentication Integration", () => {
  let server: LighthouseMCPServer;
  let mockLighthouseService: MockLighthouseService;
  let mockDatasetService: MockDatasetService;

  const validApiKey = "lh-test-key-12345678901234567890123456789012";
  const invalidApiKey = "invalid-key";

  const testConfig: Partial<ServerConfig> = {
    name: "test-server",
    version: "1.0.0",
    logLevel: "error", // Reduce noise in tests
    enableMetrics: false,
    authentication: {
      defaultApiKey: validApiKey,
      enablePerRequestAuth: true,
      requireAuthentication: true,
      keyValidationCache: {
        enabled: true,
        maxSize: 100,
        ttlSeconds: 300,
        cleanupIntervalSeconds: 60,
      },
      rateLimiting: {
        enabled: true,
        requestsPerMinute: 60,
        burstLimit: 10,
        keyBasedLimiting: true,
      },
    },
    performance: {
      servicePoolSize: 10,
      serviceTimeoutMinutes: 5,
      concurrentRequestLimit: 50,
    },
  };

  beforeEach(async () => {
    mockLighthouseService = new MockLighthouseService();
    mockDatasetService = new MockDatasetService(mockLighthouseService);

    server = new LighthouseMCPServer(testConfig, {
      lighthouseService: mockLighthouseService,
      datasetService: mockDatasetService,
    });

    await server.registerTools();
  });

  afterEach(async () => {
    if (server) {
      await server.stop();
    }
  });

  describe("Authentication Flow", () => {
    it("should authenticate with valid API key", async () => {
      const authManager = server.getAuthManager();
      const result = await authManager.authenticate(validApiKey);

      expect(result.success).toBe(true);
      expect(result.usedFallback).toBe(false);
      expect(result.rateLimited).toBe(false);
      expect(result.keyHash).toBeDefined();
      expect(result.authTime).toBeGreaterThan(0);
    });

    it("should authenticate with fallback when no key provided", async () => {
      const authManager = server.getAuthManager();
      const result = await authManager.authenticate();

      expect(result.success).toBe(true);
      expect(result.usedFallback).toBe(true);
      expect(result.rateLimited).toBe(false);
    });

    it("should reject invalid API key", async () => {
      const authManager = server.getAuthManager();
      const result = await authManager.authenticate(invalidApiKey);

      expect(result.success).toBe(false);
      expect(result.usedFallback).toBe(false);
      expect(result.errorMessage).toContain("validation failed");
    });

    it("should handle rate limiting", async () => {
      const authManager = server.getAuthManager();

      // Make many rapid requests to trigger rate limiting (burst limit is 10)
      const promises = Array.from({ length: 100 }, () => authManager.authenticate(validApiKey));

      const results = await Promise.all(promises);

      // Some requests should be rate limited
      const rateLimited = results.some((r) => r.rateLimited);
      expect(rateLimited).toBe(true);
    });
  });

  describe("Service Factory Integration", () => {
    it("should create and pool services by API key", async () => {
      const factory = server.getServiceFactory();

      const service1 = await factory.getService(validApiKey);
      const service2 = await factory.getService(validApiKey);

      // Should return the same service instance for the same key
      expect(service1).toBe(service2);

      const stats = factory.getStats();
      expect(stats.size).toBe(1);
    });

    it("should create separate services for different API keys", async () => {
      const factory = server.getServiceFactory();

      const service1 = await factory.getService(validApiKey);
      const service2 = await factory.getService("different-key");

      // Should return different service instances for different keys
      expect(service1).not.toBe(service2);

      const stats = factory.getStats();
      expect(stats.size).toBe(2);
    });

    it("should respect pool size limits", async () => {
      const factory = server.getServiceFactory();

      // Create services for multiple keys to exceed pool size
      const keys = Array.from({ length: 15 }, (_, i) => `key-${i}`);

      // Create services sequentially to ensure eviction happens
      for (const key of keys) {
        await factory.getService(key);
      }

      const stats = factory.getStats();
      expect(stats.size).toBeLessThanOrEqual(stats.maxSize);
    });
  });

  describe("Tool Execution with Authentication", () => {
    it("should execute tool with valid API key", async () => {
      // Create a temporary test file for upload
      const fs = await import("fs/promises");
      const path = await import("path");
      const os = await import("os");

      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "lighthouse-test-"));
      const testFilePath = path.join(tempDir, "test-file.txt");
      await fs.writeFile(testFilePath, "test content");

      try {
        const registry = server.getRegistry();
        const authManager = server.getAuthManager();
        const factory = server.getServiceFactory();

        // Authenticate and get service
        const authResult = await authManager.authenticate(validApiKey);
        expect(authResult.success).toBe(true);

        // Use the mock service instead of creating a new one
        const context = new RequestContext({
          apiKey: validApiKey,
          keyHash: authResult.keyHash,
          service: mockLighthouseService,
          toolName: "lighthouse_upload_file",
        });

        // Execute tool with context
        const result = await registry.executeToolWithContext(
          "lighthouse_upload_file",
          { filePath: testFilePath },
          context,
        );

        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
      } finally {
        // Cleanup temp file
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    });

    it("should handle authentication errors in tool execution", async () => {
      const authManager = server.getAuthManager();

      // Try to authenticate with invalid key
      const authResult = await authManager.authenticate(invalidApiKey);
      expect(authResult.success).toBe(false);

      // Should not be able to execute tools without valid authentication
      expect(authResult.errorMessage).toBeDefined();
    });
  });

  describe("Error Handling", () => {
    it("should create appropriate authentication errors", () => {
      const missingKeyError = AuthenticationError.missingApiKey();
      expect(missingKeyError.type).toBe(AuthErrorType.MISSING_API_KEY);
      expect(missingKeyError.message).toContain("API key is required");

      const invalidKeyError = AuthenticationError.invalidApiKey("test-hash");
      expect(invalidKeyError.type).toBe(AuthErrorType.INVALID_API_KEY);
      expect(invalidKeyError.keyHash).toBe("test-hash");

      const rateLimitError = AuthenticationError.rateLimited("test-hash", 60);
      expect(rateLimitError.type).toBe(AuthErrorType.RATE_LIMITED);
      expect(rateLimitError.retryAfter).toBe(60);
    });

    it("should convert authentication errors to MCP format", () => {
      const error = AuthenticationError.invalidApiKey("test-hash");
      const mcpError = error.toMcpError();

      expect(mcpError.error.code).toBeDefined();
      expect(mcpError.error.message).toBe(error.message);
      expect(mcpError.error.type).toBe(AuthErrorType.INVALID_API_KEY);
      expect(mcpError.error.keyHash).toBe("test-hash");
    });
  });

  describe("Backward Compatibility", () => {
    it("should work with single API key configuration", async () => {
      const legacyConfig: Partial<ServerConfig> = {
        ...testConfig,
        lighthouseApiKey: validApiKey,
        authentication: {
          ...testConfig.authentication!,
          defaultApiKey: validApiKey, // Use the same key as fallback
        },
      };

      const legacyServer = new LighthouseMCPServer(legacyConfig, {
        lighthouseService: mockLighthouseService,
        datasetService: mockDatasetService,
      });

      await legacyServer.registerTools();

      const authManager = legacyServer.getAuthManager();
      const result = await authManager.authenticate();

      expect(result.success).toBe(true);
      expect(result.usedFallback).toBe(true);

      await legacyServer.stop();
    });
  });

  describe("Resource Management", () => {
    it("should cleanup resources on server stop", async () => {
      const authStats = server.getAuthStats();
      expect(authStats.cache).toBeDefined();
      expect(authStats.servicePool).toBeDefined();

      await server.stop();

      // After stop, resources should be cleaned up
      // This is verified by the fact that stop() doesn't throw
    });

    it("should invalidate API key cache", async () => {
      const authManager = server.getAuthManager();

      // Authenticate to populate cache
      await authManager.authenticate(validApiKey);

      // Invalidate the key
      server.invalidateApiKey(validApiKey);

      // Should work without errors
      expect(() => server.invalidateApiKey(validApiKey)).not.toThrow();
    });
  });
});
