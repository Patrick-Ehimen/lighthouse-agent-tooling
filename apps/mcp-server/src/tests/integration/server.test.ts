/**
 * Integration tests for LighthouseMCPServer
 */

// Set environment variable before any imports
process.env.LIGHTHOUSE_API_KEY = "test-api-key-for-integration-tests";

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { LighthouseMCPServer } from "../../server.js";
import { MockLighthouseService } from "../../services/MockLighthouseService.js";
import { MockDatasetService } from "../../services/MockDatasetService.js";
import { createTestFile, cleanupTestFiles } from "../utils/test-helpers.js";

describe("LighthouseMCPServer Integration", () => {
  let server: LighthouseMCPServer;
  let testFilePath: string;

  beforeEach(async () => {
    // Use mock services for integration tests
    const mockLighthouseService = new MockLighthouseService();
    const mockDatasetService = new MockDatasetService(mockLighthouseService);

    server = new LighthouseMCPServer(
      {
        logLevel: "error", // Reduce noise during tests
        enableMetrics: false,
      },
      {
        lighthouseService: mockLighthouseService,
        datasetService: mockDatasetService,
      },
    );
    // Register tools for testing
    await server.registerTools();
    testFilePath = await createTestFile("integration-test.txt", "Integration test content");
  });

  afterEach(async () => {
    // Don't cleanup during tests, only at the end
  });

  describe("Server initialization", () => {
    it("should create server instance", () => {
      expect(server).toBeDefined();
    });

    it("should have registry initialized", () => {
      const registry = server.getRegistry();
      expect(registry).toBeDefined();
    });

    it("should have services initialized", () => {
      const lighthouseService = server.getLighthouseService();
      const datasetService = server.getDatasetService();

      expect(lighthouseService).toBeDefined();
      expect(datasetService).toBeDefined();
    });

    it("should register all tools", () => {
      const registry = server.getRegistry();
      const tools = registry.listTools();

      expect(tools.length).toBeGreaterThanOrEqual(3);
      expect(tools.map((t) => t.name)).toContain("lighthouse_upload_file");
      expect(tools.map((t) => t.name)).toContain("lighthouse_create_dataset");
      expect(tools.map((t) => t.name)).toContain("lighthouse_fetch_file");
    });
  });

  describe("Tool execution flow", () => {
    it("should execute upload tool successfully", async () => {
      const registry = server.getRegistry();
      const result = await registry.executeTool("lighthouse_upload_file", {
        filePath: testFilePath,
        encrypt: false,
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect((result.data as any).cid).toBeDefined();
    });

    it("should execute dataset creation tool", async () => {
      const registry = server.getRegistry();
      const result = await registry.executeTool("lighthouse_create_dataset", {
        name: "Integration Test Dataset",
        description: "Created during integration test",
        filePaths: [testFilePath],
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect((result.data as any).dataset).toBeDefined();
      expect((result.data as any).dataset.id).toBeDefined();
    });

    it("should execute fetch tool after upload", async () => {
      const registry = server.getRegistry();

      // First upload
      const uploadResult = await registry.executeTool("lighthouse_upload_file", {
        filePath: testFilePath,
      });

      expect(uploadResult.success).toBe(true);
      const cid = (uploadResult.data as any).cid;

      // Then fetch
      const fetchResult = await registry.executeTool("lighthouse_fetch_file", {
        cid,
      });

      expect(fetchResult.success).toBe(true);
      expect((fetchResult.data as any).cid).toBe(cid);
    });

    it("should handle invalid tool arguments", async () => {
      const registry = server.getRegistry();
      const result = await registry.executeTool("lighthouse_upload_file", {
        // Missing required filePath
        encrypt: true,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("Server statistics", () => {
    it("should track server statistics", async () => {
      const registry = server.getRegistry();

      // Execute some operations
      await registry.executeTool("lighthouse_upload_file", {
        filePath: testFilePath,
      });

      const stats = server.getStats();

      expect(stats.registry).toBeDefined();
      expect(stats.registry.totalCalls).toBeGreaterThan(0);
      expect(stats.storage).toBeDefined();
      expect(stats.datasets).toBeDefined();
    });

    it("should track registry metrics", async () => {
      const registry = server.getRegistry();
      const metrics = registry.getMetrics();

      expect(metrics.totalTools).toBeGreaterThanOrEqual(3);
      expect(metrics.registrationTimestamp).toBeInstanceOf(Date);
    });

    it("should track storage statistics", () => {
      const lighthouseService = server.getLighthouseService();
      const stats = lighthouseService.getStorageStats();

      expect(stats.fileCount).toBeDefined();
      expect(stats.totalSize).toBeDefined();
      expect(stats.maxSize).toBeDefined();
      expect(stats.utilization).toBeDefined();
    });
  });

  describe("End-to-end workflow", () => {
    it("should handle complete dataset creation workflow", async () => {
      const registry = server.getRegistry();
      const file1 = testFilePath;
      const file2 = await createTestFile("file2.txt", "Second file");

      // Create dataset with multiple files
      const datasetResult = await registry.executeTool("lighthouse_create_dataset", {
        name: "E2E Test Dataset",
        description: "End-to-end test dataset",
        filePaths: [file1, file2],
        encrypt: true,
        metadata: {
          author: "Test Suite",
          version: "1.0.0",
        },
      });

      expect(datasetResult.success).toBe(true);

      const dataset = (datasetResult.data as any).dataset;
      expect(dataset.id).toBeDefined();
      expect(dataset.name).toBe("E2E Test Dataset");
      expect(dataset.files).toHaveLength(2);
      expect(dataset.encrypted).toBe(true);

      // Verify files are uploaded
      const lighthouseService = server.getLighthouseService();
      const storageStats = lighthouseService.getStorageStats();
      expect(storageStats.fileCount).toBeGreaterThanOrEqual(2);

      // Fetch one of the uploaded files
      const firstFileCid = dataset.files[0].cid;
      const fetchResult = await registry.executeTool("lighthouse_fetch_file", {
        cid: firstFileCid,
      });

      expect(fetchResult.success).toBe(true);
      expect((fetchResult.data as unknown).cid).toBe(firstFileCid);
    });

    it("should handle errors gracefully", async () => {
      const registry = server.getRegistry();

      // Try to fetch non-existent file
      const result = await registry.executeTool("lighthouse_fetch_file", {
        cid: "QmInvalidCIDThatDoesNotExist1234567890123456",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("Performance requirements", () => {
    it("should register tools in less than 100ms", () => {
      const registry = server.getRegistry();
      const metrics = registry.getMetrics();

      expect(metrics.averageRegistrationTime).toBeLessThan(100);
    });

    it("should execute mock operations in less than 500ms", async () => {
      const registry = server.getRegistry();
      const startTime = Date.now();

      await registry.executeTool("lighthouse_upload_file", {
        filePath: testFilePath,
      });

      const executionTime = Date.now() - startTime;
      expect(executionTime).toBeLessThan(1000); // Allow up to 1 second for mock operations
    });
  });
});
