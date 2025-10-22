/**
 * Dataset Tools Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Logger } from "@lighthouse-tooling/shared";
import { MockLighthouseService } from "../services/MockLighthouseService.js";
import {
  LighthouseCreateDatasetTool,
  LighthouseListDatasetsTool,
  LighthouseGetDatasetTool,
  LighthouseUpdateDatasetTool,
} from "../tools/index.js";

describe("Dataset Tools", () => {
  let mockService: MockLighthouseService;
  let logger: Logger;

  beforeEach(() => {
    mockService = new MockLighthouseService();
    logger = Logger.getInstance({ level: "error", component: "test" });
  });

  afterEach(() => {
    mockService.clear();
  });

  describe("LighthouseCreateDatasetTool", () => {
    let tool: LighthouseCreateDatasetTool;

    beforeEach(() => {
      tool = new LighthouseCreateDatasetTool(mockService, logger);
    });

    it("should have correct tool definition", () => {
      const definition = LighthouseCreateDatasetTool.getDefinition();
      expect(definition.name).toBe("lighthouse_create_dataset");
      expect(definition.description).toContain("Create a new dataset");
      expect(definition.requiresAuth).toBe(true);
    });

    it("should validate required parameters", async () => {
      const result = await tool.execute({});
      expect(result.success).toBe(false);
      expect(result.error).toContain("name is required");
    });

    it("should validate filePaths parameter", async () => {
      const result = await tool.execute({
        name: "Test Dataset",
        filePaths: [],
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("filePaths is required and must be a non-empty array");
    });

    it("should create dataset successfully with valid parameters", async () => {
      // Create test files first
      const testFiles = ["/tmp/test1.txt", "/tmp/test2.txt"];

      // Mock FileUtils to avoid actual file operations
      const { FileUtils } = await import("@lighthouse-tooling/shared");
      vi.spyOn(FileUtils, "fileExists").mockResolvedValue(true);
      vi.spyOn(FileUtils, "getFileInfo").mockResolvedValue({
        path: "/tmp/test.txt",
        name: "test.txt",
        extension: ".txt",
        size: 1024,
        lastModified: new Date(),
        hash: "mock-hash",
      });

      const result = await tool.execute({
        name: "Test Dataset",
        description: "A test dataset",
        filePaths: testFiles,
        encrypt: false,
        tags: ["test", "dataset"],
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.dataset.name).toBe("Test Dataset");
      expect(result.data.dataset.fileCount).toBe(2);
    });

    it("should handle file validation errors", async () => {
      // Mock FileUtils to simulate file not found
      const { FileUtils } = await import("@lighthouse-tooling/shared");
      vi.spyOn(FileUtils, "fileExists").mockResolvedValue(false);

      const result = await tool.execute({
        name: "Test Dataset",
        filePaths: ["/nonexistent/file.txt"],
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("File not found");
    });
  });

  describe("LighthouseListDatasetsTool", () => {
    let tool: LighthouseListDatasetsTool;

    beforeEach(() => {
      tool = new LighthouseListDatasetsTool(mockService, logger);
    });

    it("should have correct tool definition", () => {
      const definition = LighthouseListDatasetsTool.getDefinition();
      expect(definition.name).toBe("lighthouse_list_datasets");
      expect(definition.description).toContain("List all datasets");
      expect(definition.requiresAuth).toBe(true);
    });

    it("should list datasets with default parameters", async () => {
      const result = await tool.execute({});
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.datasets).toBeInstanceOf(Array);
      expect(result.data.pagination).toBeDefined();
    });

    it("should validate limit parameter", async () => {
      const result = await tool.execute({
        limit: 150, // exceeds max of 100
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("limit must be between 1 and 100");
    });

    it("should validate offset parameter", async () => {
      const result = await tool.execute({
        offset: -1,
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("offset must be 0 or greater");
    });
  });

  describe("LighthouseGetDatasetTool", () => {
    let tool: LighthouseGetDatasetTool;

    beforeEach(() => {
      tool = new LighthouseGetDatasetTool(mockService, logger);
    });

    it("should have correct tool definition", () => {
      const definition = LighthouseGetDatasetTool.getDefinition();
      expect(definition.name).toBe("lighthouse_get_dataset");
      expect(definition.description).toContain("Retrieve detailed information");
      expect(definition.requiresAuth).toBe(true);
    });

    it("should validate datasetId parameter", async () => {
      const result = await tool.execute({});
      expect(result.success).toBe(false);
      expect(result.error).toContain("datasetId is required");
    });

    it("should retrieve dataset successfully", async () => {
      // First create a dataset
      await mockService.createDataset({
        name: "Test Dataset",
        description: "Test description",
        filePaths: [],
        encrypt: false,
      });

      // Get the created dataset ID (it will be the first one)
      const datasets = await mockService.listDatasets();
      const datasetId = datasets.datasets[0].id;

      const result = await tool.execute({
        datasetId,
      });
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.dataset.id).toBe(datasetId);
    });

    it("should handle non-existent dataset", async () => {
      const result = await tool.execute({
        datasetId: "nonexistent",
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("Dataset not found");
    });
  });

  describe("LighthouseUpdateDatasetTool", () => {
    let tool: LighthouseUpdateDatasetTool;

    beforeEach(() => {
      tool = new LighthouseUpdateDatasetTool(mockService, logger);
    });

    it("should have correct tool definition", () => {
      const definition = LighthouseUpdateDatasetTool.getDefinition();
      expect(definition.name).toBe("lighthouse_update_dataset");
      expect(definition.description).toContain("Update an existing dataset");
      expect(definition.requiresAuth).toBe(true);
    });

    it("should validate datasetId parameter", async () => {
      const result = await tool.execute({});
      expect(result.success).toBe(false);
      expect(result.error).toContain("datasetId is required");
    });

    it("should require at least one update operation", async () => {
      const result = await tool.execute({
        datasetId: "dataset_1",
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("At least one update operation must be specified");
    });

    it("should update dataset with new description", async () => {
      // First create a dataset
      await mockService.createDataset({
        name: "Test Dataset",
        description: "Original description",
        filePaths: [],
        encrypt: false,
      });

      // Get the created dataset ID
      const datasets = await mockService.listDatasets();
      const datasetId = datasets.datasets[0].id;

      const result = await tool.execute({
        datasetId,
        description: "Updated description",
      });
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.dataset.description).toBe("Updated description");
    });

    it("should validate addFiles parameter", async () => {
      // Mock FileUtils to simulate file not found
      const { FileUtils } = await import("@lighthouse-tooling/shared");
      vi.spyOn(FileUtils, "fileExists").mockResolvedValue(false);

      const result = await tool.execute({
        datasetId: "dataset_1",
        addFiles: ["/nonexistent/file.txt"],
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("File not found");
    });
  });
});
