/**
 * Tests for LighthouseBatchDownloadTool
 */

import fs from "fs/promises";
import { constants as fsConstants } from "fs";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { Logger } from "@lighthouse-tooling/shared";
import { BatchOperationResult, BatchDownloadFileResult } from "@lighthouse-tooling/sdk-wrapper";
import { ILighthouseService } from "../../services/ILighthouseService.js";
import { LighthouseBatchDownloadTool } from "../LighthouseBatchDownloadTool.js";

// Valid CID v0 examples (46 chars, base58, starts with Qm)
const VALID_CID_1 = "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG";
const VALID_CID_2 = "QmPZ9gcCEpqKTo6aq61g2nXGUhM4iCL3ewB6LDXZCtioEB";
const VALID_CID_V1 = "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";

// Mock dependencies
vi.mock("fs/promises");
vi.mock("@lighthouse-tooling/shared");

const mockFs = fs as any;
const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
} as unknown as Logger;

describe("LighthouseBatchDownloadTool", () => {
  let tool: LighthouseBatchDownloadTool;
  let mockService: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockService = {
      uploadFile: vi.fn(),
      fetchFile: vi.fn(),
      pinFile: vi.fn(),
      unpinFile: vi.fn(),
      getFileInfo: vi.fn(),
      listFiles: vi.fn(),
      getStorageStats: vi.fn(),
      clear: vi.fn(),
      createDataset: vi.fn(),
      updateDataset: vi.fn(),
      getDataset: vi.fn(),
      listDatasets: vi.fn(),
      deleteDataset: vi.fn(),
      batchUploadFiles: vi.fn(),
      batchDownloadFiles: vi.fn(),
    };

    tool = new LighthouseBatchDownloadTool(mockService, mockLogger);
  });

  describe("getDefinition", () => {
    it("should return correct tool definition", () => {
      const definition = LighthouseBatchDownloadTool.getDefinition();

      expect(definition.name).toBe("lighthouse_batch_download");
      expect(definition.description).toContain("Download multiple files");
      expect(definition.requiresAuth).toBe(true);
      expect(definition.supportsBatch).toBe(true);
      expect(definition.executionTime).toBe("slow");

      // Check required fields
      expect(definition.inputSchema.required).toContain("cids");
      expect(definition.inputSchema.properties.cids).toBeDefined();
      expect(definition.inputSchema.properties.outputDir).toBeDefined();
      expect(definition.inputSchema.properties.concurrency).toBeDefined();
      expect(definition.inputSchema.properties.decrypt).toBeDefined();
      expect(definition.inputSchema.properties.continueOnError).toBeDefined();
    });
  });

  describe("execute - success cases", () => {
    beforeEach(() => {
      // Mock directory access
      mockFs.access.mockResolvedValue(undefined);
      mockFs.mkdir.mockResolvedValue(undefined);
    });

    it("should download multiple files successfully", async () => {
      const mockResult: BatchOperationResult<BatchDownloadFileResult> = {
        total: 2,
        successful: 2,
        failed: 0,
        successRate: 100,
        totalDuration: 500,
        averageDuration: 250,
        results: [
          {
            id: VALID_CID_1,
            success: true,
            data: {
              cid: VALID_CID_1,
              filePath: "/output/file1.txt",
              size: 1024,
              decrypted: false,
            },
            duration: 200,
            retries: 0,
          },
          {
            id: VALID_CID_2,
            success: true,
            data: {
              cid: VALID_CID_2,
              filePath: "/output/file2.txt",
              size: 2048,
              decrypted: false,
            },
            duration: 300,
            retries: 0,
          },
        ],
      };

      mockService.batchDownloadFiles.mockResolvedValue(mockResult);

      const result = await tool.execute({
        cids: [VALID_CID_1, VALID_CID_2],
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect((result.data as any).total).toBe(2);
      expect((result.data as any).successful).toBe(2);
      expect((result.data as any).failed).toBe(0);
      expect(mockService.batchDownloadFiles).toHaveBeenCalledWith(
        [VALID_CID_1, VALID_CID_2],
        expect.objectContaining({
          concurrency: 3,
          continueOnError: true,
        }),
      );
    });

    it("should download files with custom output directory", async () => {
      const mockResult: BatchOperationResult<BatchDownloadFileResult> = {
        total: 1,
        successful: 1,
        failed: 0,
        successRate: 100,
        totalDuration: 200,
        averageDuration: 200,
        results: [
          {
            id: VALID_CID_1,
            success: true,
            data: {
              cid: VALID_CID_1,
              filePath: "/custom/output/file.txt",
              size: 1024,
              decrypted: false,
            },
            duration: 200,
            retries: 0,
          },
        ],
      };

      mockService.batchDownloadFiles.mockResolvedValue(mockResult);

      await tool.execute({
        cids: [VALID_CID_1],
        outputDir: "/custom/output",
      });

      expect(mockService.batchDownloadFiles).toHaveBeenCalledWith(
        [VALID_CID_1],
        expect.objectContaining({
          outputDir: "/custom/output",
        }),
      );
    });

    it("should download files with decryption enabled", async () => {
      const mockResult: BatchOperationResult<BatchDownloadFileResult> = {
        total: 1,
        successful: 1,
        failed: 0,
        successRate: 100,
        totalDuration: 300,
        averageDuration: 300,
        results: [
          {
            id: VALID_CID_1,
            success: true,
            data: {
              cid: VALID_CID_1,
              filePath: "/output/file.txt",
              size: 1024,
              decrypted: true,
            },
            duration: 300,
            retries: 0,
          },
        ],
      };

      mockService.batchDownloadFiles.mockResolvedValue(mockResult);

      const result = await tool.execute({
        cids: [VALID_CID_1],
        decrypt: true,
      });

      expect(result.success).toBe(true);
      expect(mockService.batchDownloadFiles).toHaveBeenCalledWith(
        [VALID_CID_1],
        expect.objectContaining({
          decrypt: true,
        }),
      );
    });

    it("should handle partial failures with continueOnError", async () => {
      const mockResult: BatchOperationResult<BatchDownloadFileResult> = {
        total: 2,
        successful: 1,
        failed: 1,
        successRate: 50,
        totalDuration: 400,
        averageDuration: 200,
        results: [
          {
            id: VALID_CID_1,
            success: true,
            data: {
              cid: VALID_CID_1,
              filePath: "/output/file1.txt",
              size: 1024,
              decrypted: false,
            },
            duration: 200,
            retries: 0,
          },
          {
            id: VALID_CID_2,
            success: false,
            error: "Download failed",
            duration: 200,
            retries: 0,
          },
        ],
      };

      mockService.batchDownloadFiles.mockResolvedValue(mockResult);

      const result = await tool.execute({
        cids: [VALID_CID_1, VALID_CID_2],
      });

      expect(result.success).toBe(false);
      expect((result.data as any).total).toBe(2);
      expect((result.data as any).successful).toBe(1);
      expect((result.data as any).failed).toBe(1);
    });

    it("should download files with CID v1 format", async () => {
      const mockResult: BatchOperationResult<BatchDownloadFileResult> = {
        total: 1,
        successful: 1,
        failed: 0,
        successRate: 100,
        totalDuration: 200,
        averageDuration: 200,
        results: [
          {
            id: VALID_CID_V1,
            success: true,
            data: {
              cid: VALID_CID_V1,
              filePath: "/output/file.txt",
              size: 1024,
              decrypted: false,
            },
            duration: 200,
            retries: 0,
          },
        ],
      };

      mockService.batchDownloadFiles.mockResolvedValue(mockResult);

      const result = await tool.execute({
        cids: [VALID_CID_V1],
      });

      expect(result.success).toBe(true);
    });
  });

  describe("execute - validation errors", () => {
    it("should fail when cids is missing", async () => {
      const result = await tool.execute({});

      expect(result.success).toBe(false);
      expect(result.error).toContain("cids is required");
    });

    it("should fail when cids is not an array", async () => {
      const result = await tool.execute({
        cids: VALID_CID_1,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("cids is required and must be an array");
    });

    it("should fail when cids is empty", async () => {
      const result = await tool.execute({
        cids: [],
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("cids cannot be empty");
    });

    it("should fail when cids exceeds 100", async () => {
      // Generate 101 valid-looking CIDs (the validation will fail before checking count anyway)
      const cids = Array.from({ length: 101 }, () => VALID_CID_1);

      const result = await tool.execute({ cids });

      expect(result.success).toBe(false);
      expect(result.error).toContain("cids cannot exceed 100 files");
    });

    it("should fail when CID format is invalid", async () => {
      const result = await tool.execute({
        cids: ["invalid-cid", "also-invalid"],
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid CID format");
    });

    it("should fail when CID v0 has wrong length", async () => {
      const result = await tool.execute({
        cids: ["QmShort"],
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid CID format");
    });

    it("should fail when output directory is not writable", async () => {
      mockFs.access.mockRejectedValue(new Error("EACCES"));
      mockFs.mkdir.mockRejectedValue(new Error("EACCES"));

      const result = await tool.execute({
        cids: [VALID_CID_1],
        outputDir: "/readonly/dir",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Cannot write to output directory");
    });

    it("should fail when concurrency is out of range", async () => {
      const result = await tool.execute({
        cids: [VALID_CID_1],
        concurrency: 20,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("concurrency must be a number between 1 and 10");
    });

    it("should fail when decrypt is not boolean", async () => {
      const result = await tool.execute({
        cids: [VALID_CID_1],
        decrypt: "yes",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("decrypt must be a boolean");
    });
  });

  describe("execute - service errors", () => {
    beforeEach(() => {
      mockFs.access.mockResolvedValue(undefined);
    });

    it("should handle service errors", async () => {
      mockService.batchDownloadFiles.mockRejectedValue(new Error("Service unavailable"));

      const result = await tool.execute({
        cids: [VALID_CID_1],
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Batch download failed: Service unavailable");
    });

    it("should handle unknown errors", async () => {
      mockService.batchDownloadFiles.mockRejectedValue("Unknown error");

      const result = await tool.execute({
        cids: [VALID_CID_1],
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Batch download failed: Unknown error occurred");
    });
  });

  describe("CID validation", () => {
    it("should accept valid CID v0 format", async () => {
      mockFs.access.mockResolvedValue(undefined);

      const mockResult: BatchOperationResult<BatchDownloadFileResult> = {
        total: 1,
        successful: 1,
        failed: 0,
        successRate: 100,
        totalDuration: 200,
        averageDuration: 200,
        results: [
          {
            id: VALID_CID_1,
            success: true,
            data: {
              cid: VALID_CID_1,
              filePath: "/output/file.txt",
              size: 1024,
              decrypted: false,
            },
            duration: 200,
            retries: 0,
          },
        ],
      };

      mockService.batchDownloadFiles.mockResolvedValue(mockResult);

      const result = await tool.execute({
        cids: [VALID_CID_1],
      });

      expect(result.success).toBe(true);
    });

    it("should accept valid CID v1 format", async () => {
      mockFs.access.mockResolvedValue(undefined);

      const mockResult: BatchOperationResult<BatchDownloadFileResult> = {
        total: 1,
        successful: 1,
        failed: 0,
        successRate: 100,
        totalDuration: 200,
        averageDuration: 200,
        results: [
          {
            id: VALID_CID_V1,
            success: true,
            data: {
              cid: VALID_CID_V1,
              filePath: "/output/file.txt",
              size: 1024,
              decrypted: false,
            },
            duration: 200,
            retries: 0,
          },
        ],
      };

      mockService.batchDownloadFiles.mockResolvedValue(mockResult);

      const result = await tool.execute({
        cids: [VALID_CID_V1],
      });

      expect(result.success).toBe(true);
    });

    it("should reject test-specific CID patterns in production", async () => {
      // QmTest... should no longer be valid since we removed the test bypass
      const result = await tool.execute({
        cids: ["QmTestABC123456789012345678901234567"],
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid CID format");
    });
  });

  describe("metadata tracking", () => {
    beforeEach(() => {
      mockFs.access.mockResolvedValue(undefined);
    });

    it("should track execution time and metadata", async () => {
      const mockResult: BatchOperationResult<BatchDownloadFileResult> = {
        total: 1,
        successful: 1,
        failed: 0,
        successRate: 100,
        totalDuration: 200,
        averageDuration: 200,
        results: [
          {
            id: VALID_CID_1,
            success: true,
            data: {
              cid: VALID_CID_1,
              filePath: "/output/file.txt",
              size: 1024,
              decrypted: false,
            },
            duration: 200,
            retries: 0,
          },
        ],
      };

      mockService.batchDownloadFiles.mockResolvedValue(mockResult);

      const result = await tool.execute({
        cids: [VALID_CID_1],
      });

      expect(result.success).toBe(true);
      expect(result.metadata?.executionTime).toBeDefined();
      expect(result.metadata?.totalFiles).toBe(1);
      expect(result.metadata?.successfulDownloads).toBe(1);
      expect(result.metadata?.failedDownloads).toBe(0);
      expect(result.metadata?.successRate).toBe(100);
    });
  });
});
