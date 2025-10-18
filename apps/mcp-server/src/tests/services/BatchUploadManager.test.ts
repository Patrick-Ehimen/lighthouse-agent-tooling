/**
 * BatchUploadManager tests
 * Tests for parallel upload with concurrency control and progress tracking
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { BatchUploadManager } from "../../services/BatchUploadManager.js";
import { MockLighthouseService } from "../../services/MockLighthouseService.js";
import { createTestFile, cleanupTestFiles } from "../utils/test-helpers.js";
import { DatasetProgress } from "../../services/IDatasetService.js";

describe("BatchUploadManager", () => {
  let manager: BatchUploadManager;
  let lighthouseService: MockLighthouseService;
  let testFiles: string[];

  beforeEach(async () => {
    lighthouseService = new MockLighthouseService();
    manager = new BatchUploadManager(lighthouseService);

    testFiles = [
      await createTestFile("batch1.txt", "Batch content 1"),
      await createTestFile("batch2.txt", "Batch content 2"),
      await createTestFile("batch3.txt", "Batch content 3"),
      await createTestFile("batch4.txt", "Batch content 4"),
      await createTestFile("batch5.txt", "Batch content 5"),
    ];

    await new Promise((resolve) => setTimeout(resolve, 50));
  });

  afterEach(async () => {
    lighthouseService.clear();
    await cleanupTestFiles();
    await new Promise((resolve) => setTimeout(resolve, 10));
  });

  describe("uploadFiles", () => {
    it("should upload files in parallel", async () => {
      const result = await manager.uploadFiles(testFiles, {}, { concurrency: 3 });

      expect(result.total).toBe(5);
      expect(result.successful).toBe(5);
      expect(result.failed).toBe(0);
      expect(result.successfulUploads).toHaveLength(5);
      expect(result.duration).toBeGreaterThan(0);
    });

    it("should respect concurrency limits", async () => {
      let maxConcurrent = 0;
      let currentConcurrent = 0;

      const originalUpload = lighthouseService.uploadFile.bind(lighthouseService);
      lighthouseService.uploadFile = vi.fn(async (params) => {
        currentConcurrent++;
        maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
        const result = await originalUpload(params);
        currentConcurrent--;
        return result;
      });

      await manager.uploadFiles(testFiles, {}, { concurrency: 2 });

      expect(maxConcurrent).toBeLessThanOrEqual(2);
    });

    it("should track progress during upload", async () => {
      const progressUpdates: DatasetProgress[] = [];

      await manager.uploadFiles(
        testFiles,
        {},
        {
          concurrency: 2,
          onProgress: (progress) => {
            progressUpdates.push({ ...progress });
          },
        },
      );

      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates[progressUpdates.length - 1].completed).toBe(5);
    });

    it("should handle partial failures", async () => {
      const filesWithInvalid = [...testFiles, "non-existent.txt"];

      const result = await manager.uploadFiles(filesWithInvalid, {});

      expect(result.total).toBe(6);
      expect(result.successful).toBe(5);
      expect(result.failed).toBe(1);
      expect(result.failedUploads).toHaveLength(1);
      expect(result.failedUploads[0].filePath).toBe("non-existent.txt");
    });

    it("should calculate average speed", async () => {
      const result = await manager.uploadFiles(testFiles, {});

      expect(result.averageSpeed).toBeGreaterThan(0);
    });

    it("should apply encryption config", async () => {
      const result = await manager.uploadFiles(testFiles, { encrypt: true });

      expect(result.successfulUploads.every((u) => u.encrypted)).toBe(true);
    });

    it("should apply access conditions", async () => {
      const accessConditions = [
        {
          type: "token_balance" as any,
          condition: "balance",
          value: "100",
        },
      ];

      const result = await manager.uploadFiles(testFiles, {
        encrypt: true,
        accessConditions,
      });

      expect(result.successfulUploads[0].accessConditions).toEqual(accessConditions);
    });

    it("should handle timeout", async () => {
      const result = await manager.uploadFiles([testFiles[0]], {}, { timeout: 1 });

      // Either succeeds quickly or fails with timeout
      expect(result.total).toBe(1);
    }, 10000);
  });

  describe("uploadFilesInBatches", () => {
    it("should process files in batches", async () => {
      const manyFiles = await Promise.all(
        Array.from({ length: 20 }, (_, i) => createTestFile(`batch${i}.txt`, `Content ${i}`)),
      );

      const result = await manager.uploadFilesInBatches(
        manyFiles,
        {},
        {
          batchSize: 5,
          concurrency: 2,
        },
      );

      expect(result.total).toBe(20);
      expect(result.successful).toBe(20);
      expect(result.failed).toBe(0);
    }, 60000);

    it("should track overall progress across batches", async () => {
      const manyFiles = await Promise.all(
        Array.from({ length: 15 }, (_, i) => createTestFile(`batch${i}.txt`, `Content ${i}`)),
      );

      const progressUpdates: DatasetProgress[] = [];

      await manager.uploadFilesInBatches(
        manyFiles,
        {},
        {
          batchSize: 5,
          concurrency: 2,
          onProgress: (progress) => {
            progressUpdates.push({ ...progress });
          },
        },
      );

      expect(progressUpdates.length).toBeGreaterThan(0);
      const lastUpdate = progressUpdates[progressUpdates.length - 1];
      expect(lastUpdate.total).toBe(15);
      expect(lastUpdate.completed).toBe(15);
    }, 60000);

    it("should handle partial failures across batches", async () => {
      const manyFiles = await Promise.all(
        Array.from({ length: 10 }, (_, i) => createTestFile(`batch${i}.txt`, `Content ${i}`)),
      );
      manyFiles.push("non-existent-1.txt", "non-existent-2.txt");

      const result = await manager.uploadFilesInBatches(
        manyFiles,
        {},
        {
          batchSize: 5,
          concurrency: 2,
        },
      );

      expect(result.total).toBe(12);
      expect(result.successful).toBe(10);
      expect(result.failed).toBe(2);
    }, 60000);
  });

  describe("getOptimalBatchConfig", () => {
    it("should recommend batching for large datasets", () => {
      const config = manager.getOptimalBatchConfig(1500);

      expect(config.useBatching).toBe(true);
      expect(config.batchSize).toBe(50);
      expect(config.concurrency).toBe(5);
    });

    it("should recommend parallel upload for medium datasets", () => {
      const config = manager.getOptimalBatchConfig(500);

      expect(config.useBatching).toBe(false);
      expect(config.concurrency).toBe(10);
    });

    it("should recommend default settings for small datasets", () => {
      const config = manager.getOptimalBatchConfig(50);

      expect(config.useBatching).toBe(false);
      expect(config.concurrency).toBe(5);
    });
  });

  describe("error handling", () => {
    it("should continue on individual file errors", async () => {
      const mixedFiles = [testFiles[0], "invalid-1.txt", testFiles[1], "invalid-2.txt"];

      const result = await manager.uploadFiles(mixedFiles, {});

      expect(result.successful).toBe(2);
      expect(result.failed).toBe(2);
      expect(result.successfulUploads).toHaveLength(2);
      expect(result.failedUploads).toHaveLength(2);
    });

    it("should provide error details for failed uploads", async () => {
      const result = await manager.uploadFiles(["non-existent.txt"], {});

      expect(result.failedUploads[0].error).toBeDefined();
      expect(result.failedUploads[0].retryAttempts).toBe(0);
      expect(result.failedUploads[0].failedAt).toBeInstanceOf(Date);
    });
  });

  describe("progress tracking", () => {
    it("should emit progress events", async () => {
      const progressEvents: DatasetProgress[] = [];

      manager.on("progress", (progress) => {
        progressEvents.push(progress);
      });

      await manager.uploadFiles(testFiles, {}, { concurrency: 2 });

      expect(progressEvents.length).toBeGreaterThan(0);
      expect(progressEvents[0].operation).toBe("upload");
      expect(progressEvents[0].total).toBe(5);
    });

    it("should calculate accurate percentage", async () => {
      const progressUpdates: DatasetProgress[] = [];

      await manager.uploadFiles(
        testFiles,
        {},
        {
          onProgress: (progress) => {
            progressUpdates.push({ ...progress });
          },
        },
      );

      const lastProgress = progressUpdates[progressUpdates.length - 1];
      expect(lastProgress.percentage).toBe(100);
    });

    it("should provide rate estimation", async () => {
      const progressUpdates: DatasetProgress[] = [];

      await manager.uploadFiles(
        testFiles,
        {},
        {
          onProgress: (progress) => {
            progressUpdates.push({ ...progress });
          },
        },
      );

      const progressWithRate = progressUpdates.find((p) => p.rate && p.rate > 0);
      expect(progressWithRate).toBeDefined();
    });
  });

  describe("performance", () => {
    it("should handle 50 files efficiently", async () => {
      const manyFiles = await Promise.all(
        Array.from({ length: 50 }, (_, i) => createTestFile(`perf${i}.txt`, `Content ${i}`)),
      );

      const start = Date.now();
      const result = await manager.uploadFiles(manyFiles, {}, { concurrency: 10 });
      const duration = Date.now() - start;

      expect(result.successful).toBe(50);
      expect(duration).toBeLessThan(30000); // Should complete within 30 seconds
    }, 60000);
  });
});
