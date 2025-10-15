/**
 * MockLighthouseService unit tests
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { MockLighthouseService } from "../../services/MockLighthouseService.js";
import { createTestFile, cleanupTestFiles } from "../utils/test-helpers.js";
import { CIDGenerator } from "../../utils/cid-generator.js";

describe("MockLighthouseService", () => {
  let service: MockLighthouseService;
  let testFilePath: string;

  beforeEach(async () => {
    service = new MockLighthouseService();
    testFilePath = await createTestFile("test.txt", "Test file content");
    // Small delay to ensure file system is ready
    await new Promise((resolve) => setTimeout(resolve, 50));
  });

  afterEach(async () => {
    service.clear();
    // Delay cleanup slightly to avoid race conditions
    await new Promise((resolve) => setTimeout(resolve, 10));
  });

  describe("uploadFile", () => {
    it("should upload file successfully", async () => {
      const result = await service.uploadFile({ filePath: testFilePath });

      expect(result.cid).toBeDefined();
      expect(result.cid).toMatch(/^Qm[1-9A-HJ-NP-Za-km-z]{44}$/);
      expect(result.size).toBeGreaterThan(0);
      expect(result.encrypted).toBe(false);
      expect(result.uploadedAt).toBeInstanceOf(Date);
    });

    it("should upload with encryption flag", async () => {
      const result = await service.uploadFile({
        filePath: testFilePath,
        encrypt: true,
      });

      expect(result.encrypted).toBe(true);
    });

    it("should upload with tags", async () => {
      const tags = ["test", "upload"];
      const result = await service.uploadFile({
        filePath: testFilePath,
        tags,
      });

      expect(result.tags).toEqual(tags);
    });

    it("should upload with access conditions", async () => {
      const accessConditions = [
        {
          type: "token_balance" as any,
          condition: "balance",
          value: "100",
        },
      ];

      const result = await service.uploadFile({
        filePath: testFilePath,
        accessConditions,
      });

      expect(result.accessConditions).toEqual(accessConditions);
    });

    it("should throw error for non-existent file", async () => {
      await expect(service.uploadFile({ filePath: "/non/existent/file.txt" })).rejects.toThrow();
    });

    it("should complete upload within 500ms", async () => {
      const startTime = Date.now();
      await service.uploadFile({ filePath: testFilePath });
      const uploadTime = Date.now() - startTime;

      expect(uploadTime).toBeLessThan(500);
    });

    it("should track storage usage", async () => {
      await service.uploadFile({ filePath: testFilePath });
      const stats = service.getStorageStats();

      expect(stats.fileCount).toBe(1);
      expect(stats.totalSize).toBeGreaterThan(0);
    });
  });

  describe("fetchFile", () => {
    let uploadedCid: string;

    beforeEach(async () => {
      const result = await service.uploadFile({ filePath: testFilePath });
      uploadedCid = result.cid;
    });

    it("should fetch file successfully", async () => {
      const result = await service.fetchFile({ cid: uploadedCid });

      expect(result.cid).toBe(uploadedCid);
      expect(result.size).toBeGreaterThan(0);
      expect(result.downloadedAt).toBeInstanceOf(Date);
    });

    it("should fetch with custom output path", async () => {
      const outputPath = "/custom/output/path.txt";
      const result = await service.fetchFile({
        cid: uploadedCid,
        outputPath,
      });

      expect(result.filePath).toBe(outputPath);
    });

    it("should throw error for invalid CID", async () => {
      await expect(service.fetchFile({ cid: "invalid-cid" })).rejects.toThrow("Invalid CID format");
    });

    it("should throw error for non-existent CID", async () => {
      // Generate a valid CID that doesn't exist in storage
      const fakeCid = CIDGenerator.generate("nonexistent-file-xyz-12345");
      await expect(service.fetchFile({ cid: fakeCid })).rejects.toThrow("File not found");
    });

    it("should complete fetch within 500ms", async () => {
      const startTime = Date.now();
      await service.fetchFile({ cid: uploadedCid });
      const fetchTime = Date.now() - startTime;

      expect(fetchTime).toBeLessThan(500);
    });
  });

  describe("pinFile", () => {
    let uploadedCid: string;

    beforeEach(async () => {
      const result = await service.uploadFile({ filePath: testFilePath });
      uploadedCid = result.cid;
    });

    it("should pin file successfully", async () => {
      const result = await service.pinFile(uploadedCid);

      expect(result.success).toBe(true);
      expect(result.cid).toBe(uploadedCid);
      expect(result.pinned).toBe(true);
    });

    it("should throw error for invalid CID", async () => {
      await expect(service.pinFile("invalid-cid")).rejects.toThrow("Invalid CID format");
    });

    it("should throw error for non-existent CID", async () => {
      // Generate a valid CID that doesn't exist in storage
      const fakeCid = CIDGenerator.generate("nonexistent-file-abc-67890");
      await expect(service.pinFile(fakeCid)).rejects.toThrow("File not found");
    });
  });

  describe("unpinFile", () => {
    let uploadedCid: string;

    beforeEach(async () => {
      const result = await service.uploadFile({ filePath: testFilePath });
      uploadedCid = result.cid;
      await service.pinFile(uploadedCid);
    });

    it("should unpin file successfully", async () => {
      const result = await service.unpinFile(uploadedCid);

      expect(result.success).toBe(true);
      expect(result.cid).toBe(uploadedCid);
      expect(result.pinned).toBe(false);
    });
  });

  describe("getFileInfo", () => {
    let uploadedCid: string;

    beforeEach(async () => {
      const result = await service.uploadFile({ filePath: testFilePath });
      uploadedCid = result.cid;
    });

    it("should return file info", () => {
      const info = service.getFileInfo(uploadedCid);

      expect(info).toBeDefined();
      expect(info?.cid).toBe(uploadedCid);
      expect(info?.filePath).toBe(testFilePath);
    });

    it("should return undefined for non-existent CID", () => {
      const info = service.getFileInfo("QmYwAPJzv5CZsnAXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX");
      expect(info).toBeUndefined();
    });
  });

  describe("listFiles", () => {
    it("should list all uploaded files", async () => {
      await service.uploadFile({ filePath: testFilePath });
      const file2Path = await createTestFile("test2.txt", "Second test file");
      await service.uploadFile({ filePath: file2Path });

      const files = service.listFiles();
      expect(files).toHaveLength(2);
    });

    it("should return empty array when no files uploaded", () => {
      const files = service.listFiles();
      expect(files).toHaveLength(0);
    });
  });

  describe("getStorageStats", () => {
    it("should return accurate storage statistics", async () => {
      await service.uploadFile({ filePath: testFilePath });

      const stats = service.getStorageStats();

      expect(stats.fileCount).toBe(1);
      expect(stats.totalSize).toBeGreaterThan(0);
      expect(stats.maxSize).toBeDefined();
      expect(stats.utilization).toBeGreaterThan(0);
      expect(stats.utilization).toBeLessThan(100);
    });
  });

  describe("clear", () => {
    it("should clear all stored files", async () => {
      await service.uploadFile({ filePath: testFilePath });
      service.clear();

      const files = service.listFiles();
      expect(files).toHaveLength(0);

      const stats = service.getStorageStats();
      expect(stats.fileCount).toBe(0);
      expect(stats.totalSize).toBe(0);
    });
  });

  describe("storage limits", () => {
    it("should enforce storage quota", async () => {
      const smallService = new MockLighthouseService(100); // 100 bytes limit
      const largefile = await createTestFile("large.txt", "x".repeat(200));

      await expect(smallService.uploadFile({ filePath: largefile })).rejects.toThrow(
        "Storage quota exceeded",
      );
    });
  });
});
