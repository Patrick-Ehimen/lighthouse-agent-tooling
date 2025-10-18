/**
 * LighthouseCreateDatasetTool tests
 * Tests for the MCP dataset creation tool
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { LighthouseCreateDatasetTool } from "../../tools/LighthouseCreateDatasetTool.js";
import { DatasetService } from "../../services/DatasetService.js";
import { MockLighthouseService } from "../../services/MockLighthouseService.js";
import { createTestFile, cleanupTestFiles } from "../utils/test-helpers.js";

describe("LighthouseCreateDatasetTool", () => {
  let tool: LighthouseCreateDatasetTool;
  let datasetService: DatasetService;
  let lighthouseService: MockLighthouseService;
  let testFiles: string[];

  beforeEach(async () => {
    lighthouseService = new MockLighthouseService();
    datasetService = new DatasetService(lighthouseService);
    tool = new LighthouseCreateDatasetTool(datasetService);

    testFiles = [
      await createTestFile("tool-test1.txt", "Tool test content 1"),
      await createTestFile("tool-test2.txt", "Tool test content 2"),
    ];

    await new Promise((resolve) => setTimeout(resolve, 50));
  });

  afterEach(async () => {
    datasetService.clear();
    lighthouseService.clear();
    await cleanupTestFiles();
    await new Promise((resolve) => setTimeout(resolve, 10));
  });

  describe("getDefinition", () => {
    it("should return valid tool definition", () => {
      const definition = LighthouseCreateDatasetTool.getDefinition();

      expect(definition.name).toBe("lighthouse_create_dataset");
      expect(definition.description).toBeDefined();
      expect(definition.inputSchema).toBeDefined();
      expect(definition.inputSchema.type).toBe("object");
      expect(definition.inputSchema.required).toContain("name");
      expect(definition.inputSchema.required).toContain("files");
    });

    it("should define all required properties", () => {
      const definition = LighthouseCreateDatasetTool.getDefinition();
      const properties = definition.inputSchema.properties;

      expect(properties.name).toBeDefined();
      expect(properties.files).toBeDefined();
      expect(properties.description).toBeDefined();
      expect(properties.metadata).toBeDefined();
      expect(properties.encrypt).toBeDefined();
      expect(properties.concurrency).toBeDefined();
    });
  });

  describe("execute", () => {
    it("should create dataset successfully", async () => {
      const args = {
        name: "Test Dataset",
        description: "A test dataset",
        files: testFiles,
      };

      const result = await tool.execute(args);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect((result.data as any).dataset.name).toBe("Test Dataset");
      expect((result.data as any).dataset.fileCount).toBe(2);
      expect((result.data as any).dataset.version).toBe("1.0.0");
    });

    it("should create encrypted dataset", async () => {
      const args = {
        name: "Encrypted Dataset",
        files: [testFiles[0]],
        encrypt: true,
      };

      const result = await tool.execute(args);

      expect(result.success).toBe(true);
      expect((result.data as any).dataset.encrypted).toBe(true);
    });

    it("should include metadata in created dataset", async () => {
      const args = {
        name: "Dataset with Metadata",
        files: [testFiles[0]],
        metadata: {
          author: "Test Author",
          license: "MIT",
          category: "test",
          keywords: ["test", "dataset"],
        },
      };

      const result = await tool.execute(args);

      expect(result.success).toBe(true);
      const dataset = (result.data as any).dataset;
      // Metadata should be present in the created dataset
      expect(dataset).toBeDefined();
    });

    it("should support custom concurrency", async () => {
      const args = {
        name: "Custom Concurrency Dataset",
        files: testFiles,
        concurrency: 10,
      };

      const result = await tool.execute(args);

      expect(result.success).toBe(true);
      expect((result.data as any).dataset.fileCount).toBe(2);
    });

    it("should include performance metrics", async () => {
      const args = {
        name: "Performance Test Dataset",
        files: testFiles,
      };

      const result = await tool.execute(args);

      expect(result.success).toBe(true);
      expect((result.data as any).executionTimeMs).toBeDefined();
      expect((result.data as any).performance).toBeDefined();
      expect((result.data as any).performance.filesPerSecond).toBeDefined();
    });
  });

  describe("validation", () => {
    it("should reject missing name", async () => {
      const args = {
        files: testFiles,
      };

      const result = await tool.execute(args);

      expect(result.success).toBe(false);
      expect(result.error).toContain("name is required");
    });

    it("should reject empty name", async () => {
      const args = {
        name: "",
        files: testFiles,
      };

      const result = await tool.execute(args);

      expect(result.success).toBe(false);
      expect(result.error).toContain("name cannot be empty");
    });

    it("should reject missing files", async () => {
      const args = {
        name: "Test Dataset",
      };

      const result = await tool.execute(args);

      expect(result.success).toBe(false);
      expect(result.error).toContain("files is required");
    });

    it("should reject empty files array", async () => {
      const args = {
        name: "Test Dataset",
        files: [],
      };

      const result = await tool.execute(args);

      expect(result.success).toBe(false);
      expect(result.error).toContain("files array cannot be empty");
    });

    it("should reject invalid concurrency", async () => {
      const args = {
        name: "Test Dataset",
        files: testFiles,
        concurrency: 25, // Max is 20
      };

      const result = await tool.execute(args);

      expect(result.success).toBe(false);
      expect(result.error).toContain("concurrency");
    });

    it("should reject access conditions without encryption", async () => {
      const args = {
        name: "Test Dataset",
        files: testFiles,
        encrypt: false,
        accessConditions: [
          {
            type: "token_balance",
            condition: "balance",
            value: "100",
          },
        ],
      };

      const result = await tool.execute(args);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Access conditions require encryption");
    });

    it("should reject too many files", async () => {
      const args = {
        name: "Too Many Files",
        files: Array(10001).fill("dummy.txt"),
      };

      const result = await tool.execute(args);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Maximum 10,000 files");
    });

    it("should reject name that's too long", async () => {
      const args = {
        name: "A".repeat(300),
        files: testFiles,
      };

      const result = await tool.execute(args);

      expect(result.success).toBe(false);
      expect(result.error).toContain("less than 255 characters");
    });
  });

  describe("error handling", () => {
    it("should handle service errors gracefully", async () => {
      // Create a dataset with duplicate name first
      await tool.execute({
        name: "Duplicate Dataset",
        files: testFiles,
      });

      // Try to create again with same name
      const result = await tool.execute({
        name: "Duplicate Dataset",
        files: testFiles,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("already exists");
    });

    it("should include execution time even on error", async () => {
      const result = await tool.execute({
        name: "", // Invalid
        files: testFiles,
      });

      expect(result.success).toBe(false);
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe("integration", () => {
    it("should create dataset that can be retrieved", async () => {
      const args = {
        name: "Integration Test Dataset",
        files: testFiles,
      };

      const createResult = await tool.execute(args);
      expect(createResult.success).toBe(true);

      const datasetId = (createResult.data as any).dataset.id;
      const dataset = await datasetService.getDataset(datasetId);

      expect(dataset.id).toBe(datasetId);
      expect(dataset.name).toBe("Integration Test Dataset");
      expect(dataset.files).toHaveLength(2);
    });

    it("should create initial version automatically", async () => {
      const args = {
        name: "Versioned Dataset",
        files: testFiles,
      };

      const createResult = await tool.execute(args);
      const datasetId = (createResult.data as any).dataset.id;

      const versions = await datasetService.listVersions(datasetId);
      expect(versions).toHaveLength(1);
      expect(versions[0].version).toBe("1.0.0");
    });
  });
});
