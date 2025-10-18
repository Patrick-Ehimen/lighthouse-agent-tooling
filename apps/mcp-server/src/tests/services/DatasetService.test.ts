/**
 * DatasetService tests
 * Comprehensive tests for dataset management with versioning and parallel uploads
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { DatasetService } from "../../services/DatasetService.js";
import { MockLighthouseService } from "../../services/MockLighthouseService.js";
import { createTestFile, cleanupTestFiles } from "../utils/test-helpers.js";
import { DatasetConfig, DatasetUpdate } from "@lighthouse-tooling/types";

describe("DatasetService", () => {
  let service: DatasetService;
  let lighthouseService: MockLighthouseService;
  let testFiles: string[];

  beforeEach(async () => {
    lighthouseService = new MockLighthouseService();
    service = new DatasetService(lighthouseService);

    // Create test files
    testFiles = [
      await createTestFile("test1.txt", "Test content 1"),
      await createTestFile("test2.txt", "Test content 2"),
      await createTestFile("test3.txt", "Test content 3"),
    ];

    await new Promise((resolve) => setTimeout(resolve, 50));
  });

  afterEach(async () => {
    service.clear();
    lighthouseService.clear();
    await cleanupTestFiles();
    await new Promise((resolve) => setTimeout(resolve, 10));
  });

  describe("createDataset", () => {
    it("should create dataset with parallel uploads", async () => {
      const config: DatasetConfig = {
        name: "Test Dataset",
        description: "A test dataset",
      };

      const dataset = await service.createDataset(config, testFiles);

      expect(dataset.id).toBeDefined();
      expect(dataset.name).toBe("Test Dataset");
      expect(dataset.version).toBe("1.0.0");
      expect(dataset.files).toHaveLength(3);
      expect(dataset.createdAt).toBeInstanceOf(Date);
    });

    it("should create encrypted dataset", async () => {
      const config: DatasetConfig = {
        name: "Encrypted Dataset",
        encrypt: true,
      };

      const dataset = await service.createDataset(config, [testFiles[0]]);

      expect(dataset.encrypted).toBe(true);
      expect(dataset.files[0].encrypted).toBe(true);
    });

    it("should create dataset with metadata", async () => {
      const config: DatasetConfig = {
        name: "Dataset with Metadata",
        metadata: {
          author: "Test Author",
          license: "MIT",
          category: "test",
          keywords: ["test", "dataset"],
        },
      };

      const dataset = await service.createDataset(config, [testFiles[0]]);

      expect(dataset.metadata.author).toBe("Test Author");
      expect(dataset.metadata.license).toBe("MIT");
      expect(dataset.metadata.keywords).toEqual(["test", "dataset"]);
    });

    it("should handle large file count with configurable concurrency", async () => {
      const manyFiles = await Promise.all(
        Array.from({ length: 20 }, (_, i) => createTestFile(`large${i}.txt`, `Content ${i}`)),
      );

      const config: DatasetConfig = {
        name: "Large Dataset",
      };

      const dataset = await service.createDataset(config, manyFiles, { concurrency: 10 });

      expect(dataset.files).toHaveLength(20);
    }, 30000); // 30 second timeout for large operation

    it("should continue on individual file failures", async () => {
      const invalidFiles = [...testFiles, "non-existent-file.txt"];

      const config: DatasetConfig = {
        name: "Partial Success Dataset",
      };

      const dataset = await service.createDataset(config, invalidFiles, {
        continueOnError: true,
      });

      // Should have created dataset with successful files
      expect(dataset.files.length).toBeGreaterThan(0);
      expect(dataset.files.length).toBeLessThan(invalidFiles.length);
    });

    it("should throw error for duplicate dataset name", async () => {
      const config: DatasetConfig = {
        name: "Duplicate Dataset",
      };

      await service.createDataset(config, [testFiles[0]]);

      await expect(service.createDataset(config, [testFiles[1]])).rejects.toThrow("already exists");
    });

    it("should throw error for empty files array", async () => {
      const config: DatasetConfig = {
        name: "Empty Dataset",
      };

      await expect(service.createDataset(config, [])).rejects.toThrow(
        "At least one file is required",
      );
    });
  });

  describe("getDataset", () => {
    it("should retrieve dataset by ID", async () => {
      const config: DatasetConfig = {
        name: "Test Dataset",
      };

      const created = await service.createDataset(config, [testFiles[0]]);
      const retrieved = await service.getDataset(created.id);

      expect(retrieved.id).toBe(created.id);
      expect(retrieved.name).toBe("Test Dataset");
    });

    it("should retrieve dataset at specific version", async () => {
      const config: DatasetConfig = {
        name: "Versioned Dataset",
      };

      const dataset = await service.createDataset(config, [testFiles[0]]);

      // Update to create new version
      await service.updateDataset(dataset.id, {
        description: "Updated description",
      });

      // Get original version
      const originalVersion = await service.getDataset(dataset.id, "1.0.0");
      expect(originalVersion.version).toBe("1.0.0");
    });

    it("should throw error for non-existent dataset", async () => {
      await expect(service.getDataset("nonexistent-id")).rejects.toThrow("Dataset not found");
    });
  });

  describe("updateDataset", () => {
    it("should update dataset description", async () => {
      const config: DatasetConfig = {
        name: "Original Dataset",
      };

      const dataset = await service.createDataset(config, [testFiles[0]]);

      const updated = await service.updateDataset(dataset.id, {
        description: "Updated description",
      });

      expect(updated.description).toBe("Updated description");
      expect(updated.version).not.toBe(dataset.version);
    });

    it("should add files to dataset", async () => {
      const config: DatasetConfig = {
        name: "Growing Dataset",
      };

      const dataset = await service.createDataset(config, [testFiles[0]]);
      const originalCount = dataset.files.length;

      const updated = await service.updateDataset(dataset.id, {
        addFiles: [testFiles[1], testFiles[2]],
      });

      expect(updated.files.length).toBe(originalCount + 2);
    });

    it("should remove files from dataset", async () => {
      const config: DatasetConfig = {
        name: "Shrinking Dataset",
      };

      const dataset = await service.createDataset(config, testFiles);
      const cidsToRemove = [dataset.files[0].cid];

      const updated = await service.updateDataset(dataset.id, {
        removeFiles: cidsToRemove,
      });

      expect(updated.files.length).toBe(testFiles.length - 1);
      expect(updated.files.find((f) => f.cid === cidsToRemove[0])).toBeUndefined();
    });

    it("should update metadata", async () => {
      const config: DatasetConfig = {
        name: "Metadata Dataset",
        metadata: { author: "Original Author" },
      };

      const dataset = await service.createDataset(config, [testFiles[0]]);

      const updated = await service.updateDataset(dataset.id, {
        metadata: { author: "Updated Author", license: "Apache-2.0" },
      });

      expect(updated.metadata.author).toBe("Updated Author");
      expect(updated.metadata.license).toBe("Apache-2.0");
    });

    it("should create new version on update", async () => {
      const config: DatasetConfig = {
        name: "Version Test Dataset",
      };

      const dataset = await service.createDataset(config, [testFiles[0]]);
      const originalVersion = dataset.version;

      await service.updateDataset(dataset.id, {
        description: "Updated",
      });

      const versions = await service.listVersions(dataset.id);
      expect(versions.length).toBeGreaterThan(1);
    });
  });

  describe("listDatasets", () => {
    beforeEach(async () => {
      await service.createDataset(
        {
          name: "Dataset 1",
          encrypt: true,
          metadata: { category: "research", keywords: ["test", "data"] },
        },
        [testFiles[0]],
      );

      await service.createDataset(
        {
          name: "Dataset 2",
          encrypt: false,
          metadata: { category: "backup", keywords: ["backup"] },
        },
        [testFiles[1]],
      );
    });

    it("should list all datasets", async () => {
      const datasets = await service.listDatasets();
      expect(datasets.length).toBeGreaterThanOrEqual(2);
    });

    it("should filter by encryption status", async () => {
      const encrypted = await service.listDatasets({ encrypted: true });
      expect(encrypted.length).toBeGreaterThan(0);
      expect(encrypted.every((d) => d.encrypted)).toBe(true);
    });

    it("should filter by name pattern", async () => {
      const filtered = await service.listDatasets({ namePattern: "Dataset 1" });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe("Dataset 1");
    });

    it("should filter by tags/keywords", async () => {
      const filtered = await service.listDatasets({ tags: ["test"] });
      expect(filtered.length).toBeGreaterThan(0);
    });

    it("should filter by category", async () => {
      const filtered = await service.listDatasets({ category: "research" });
      expect(filtered.length).toBeGreaterThan(0);
      expect(filtered[0].metadata.category).toBe("research");
    });

    it("should support pagination", async () => {
      const page1 = await service.listDatasets({ limit: 1, offset: 0 });
      const page2 = await service.listDatasets({ limit: 1, offset: 1 });

      expect(page1).toHaveLength(1);
      expect(page2).toHaveLength(1);
      expect(page1[0].id).not.toBe(page2[0].id);
    });
  });

  describe("deleteDataset", () => {
    it("should delete dataset", async () => {
      const config: DatasetConfig = {
        name: "To Delete",
      };

      const dataset = await service.createDataset(config, [testFiles[0]]);

      const result = await service.deleteDataset(dataset.id);
      expect(result).toBe(true);

      await expect(service.getDataset(dataset.id)).rejects.toThrow("Dataset not found");
    });

    it("should return false for non-existent dataset", async () => {
      const result = await service.deleteDataset("nonexistent-id");
      expect(result).toBe(false);
    });
  });

  describe("versioning", () => {
    it("should list versions", async () => {
      const config: DatasetConfig = {
        name: "Versioned Dataset",
      };

      const dataset = await service.createDataset(config, [testFiles[0]]);

      // Create more versions
      await service.updateDataset(dataset.id, { description: "Update 1" });
      await service.updateDataset(dataset.id, { description: "Update 2" });

      const versions = await service.listVersions(dataset.id);
      expect(versions.length).toBeGreaterThanOrEqual(3);
    });

    it("should rollback to previous version", async () => {
      const config: DatasetConfig = {
        name: "Rollback Dataset",
        description: "Original",
      };

      const dataset = await service.createDataset(config, [testFiles[0]]);
      const originalVersion = dataset.version;

      await service.updateDataset(dataset.id, { description: "Modified" });

      const rolledBack = await service.rollbackToVersion(dataset.id, originalVersion);
      expect(rolledBack.description).toBe("Original");
    });

    it("should compare versions", async () => {
      const config: DatasetConfig = {
        name: "Compare Dataset",
      };

      const dataset = await service.createDataset(config, [testFiles[0]]);
      const v1 = dataset.version;

      await service.updateDataset(dataset.id, { addFiles: [testFiles[1]] });
      const updated = await service.getDataset(dataset.id);
      const v2 = updated.version;

      const diff = await service.compareVersions(dataset.id, v1, v2);
      expect(diff.filesAdded.length).toBe(1);
      expect(diff.summary).toContain("file");
    });
  });

  describe("statistics", () => {
    it("should get dataset statistics", async () => {
      const config: DatasetConfig = {
        name: "Stats Dataset",
      };

      const dataset = await service.createDataset(config, testFiles);

      const stats = await service.getDatasetStats(dataset.id);

      expect(stats.fileCount).toBe(testFiles.length);
      expect(stats.totalSize).toBeGreaterThan(0);
      expect(stats.averageFileSize).toBeGreaterThan(0);
      expect(stats.version).toBe(dataset.version);
    });

    it("should get overall service statistics", () => {
      const stats = service.getAllStats();

      expect(stats).toHaveProperty("totalDatasets");
      expect(stats).toHaveProperty("totalFiles");
      expect(stats).toHaveProperty("totalSize");
      expect(stats).toHaveProperty("totalVersions");
    });
  });

  describe("performance", () => {
    it("should handle 100 files efficiently", async () => {
      const manyFiles = await Promise.all(
        Array.from({ length: 100 }, (_, i) => createTestFile(`perf${i}.txt`, `Content ${i}`)),
      );

      const config: DatasetConfig = {
        name: "Performance Dataset",
      };

      const start = Date.now();
      const dataset = await service.createDataset(config, manyFiles, { concurrency: 10 });
      const duration = Date.now() - start;

      expect(dataset.files).toHaveLength(100);
      expect(duration).toBeLessThan(60000); // Should complete within 60 seconds
    }, 120000); // 2 minute timeout
  });
});
