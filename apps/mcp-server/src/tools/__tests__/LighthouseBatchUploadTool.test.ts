/**
 * Tests for LighthouseBatchUploadTool
 */

import fs from "fs/promises";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { Logger } from "@lighthouse-tooling/shared";
import { BatchOperationResult, FileInfo } from "@lighthouse-tooling/sdk-wrapper";
import { ILighthouseService } from "../../services/ILighthouseService.js";
import { LighthouseBatchUploadTool } from "../LighthouseBatchUploadTool.js";

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

describe("LighthouseBatchUploadTool", () => {
  let tool: LighthouseBatchUploadTool;
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

    tool = new LighthouseBatchUploadTool(mockService, mockLogger);
  });

  describe("getDefinition", () => {
    it("should return correct tool definition", () => {
      const definition = LighthouseBatchUploadTool.getDefinition();

      expect(definition.name).toBe("lighthouse_batch_upload");
      expect(definition.description).toContain("Upload multiple files");
      expect(definition.requiresAuth).toBe(true);
      expect(definition.supportsBatch).toBe(true);
      expect(definition.executionTime).toBe("slow");

      // Check required fields
      expect(definition.inputSchema.required).toContain("filePaths");
      expect(definition.inputSchema.properties.filePaths).toBeDefined();
      expect(definition.inputSchema.properties.concurrency).toBeDefined();
      expect(definition.inputSchema.properties.encrypt).toBeDefined();
      expect(definition.inputSchema.properties.continueOnError).toBeDefined();
    });
  });

  describe("execute - success cases", () => {
    beforeEach(() => {
      // Mock file stats for valid files
      mockFs.stat.mockImplementation((path: string) => {
        if (path.includes("nonexistent")) {
          return Promise.reject(new Error("ENOENT: no such file or directory"));
        }
        if (path.includes("huge")) {
          return Promise.resolve({ isFile: () => true, size: 200 * 1024 * 1024 });
        }
        return Promise.resolve({ isFile: () => true, size: 1024 });
      });
    });

    it("should upload multiple files successfully", async () => {
      const mockResult: BatchOperationResult<FileInfo> = {
        total: 2,
        successful: 2,
        failed: 0,
        successRate: 100,
        totalDuration: 500,
        averageDuration: 250,
        results: [
          {
            id: "/test/file1.txt",
            success: true,
            data: {
              hash: "QmTestCID1",
              name: "file1.txt",
              size: 1024,
              mimeType: "text/plain",
              uploadedAt: new Date(),
              encrypted: false,
            },
            duration: 200,
            retries: 0,
          },
          {
            id: "/test/file2.txt",
            success: true,
            data: {
              hash: "QmTestCID2",
              name: "file2.txt",
              size: 2048,
              mimeType: "text/plain",
              uploadedAt: new Date(),
              encrypted: false,
            },
            duration: 300,
            retries: 0,
          },
        ],
      };

      mockService.batchUploadFiles.mockResolvedValue(mockResult);

      const result = await tool.execute({
        filePaths: ["/test/file1.txt", "/test/file2.txt"],
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect((result.data as any).total).toBe(2);
      expect((result.data as any).successful).toBe(2);
      expect((result.data as any).failed).toBe(0);
      expect(mockService.batchUploadFiles).toHaveBeenCalledWith(
        ["/test/file1.txt", "/test/file2.txt"],
        expect.objectContaining({
          concurrency: 3,
          continueOnError: true,
        }),
      );
    });

    it("should upload files with custom concurrency", async () => {
      const mockResult: BatchOperationResult<FileInfo> = {
        total: 1,
        successful: 1,
        failed: 0,
        successRate: 100,
        totalDuration: 200,
        averageDuration: 200,
        results: [
          {
            id: "/test/file.txt",
            success: true,
            data: {
              hash: "QmTestCID",
              name: "file.txt",
              size: 1024,
              mimeType: "text/plain",
              uploadedAt: new Date(),
              encrypted: false,
            },
            duration: 200,
            retries: 0,
          },
        ],
      };

      mockService.batchUploadFiles.mockResolvedValue(mockResult);

      await tool.execute({
        filePaths: ["/test/file.txt"],
        concurrency: 5,
      });

      expect(mockService.batchUploadFiles).toHaveBeenCalledWith(
        ["/test/file.txt"],
        expect.objectContaining({
          concurrency: 5,
        }),
      );
    });

    it("should upload encrypted files with access conditions", async () => {
      const accessConditions = [{ type: "token_balance", condition: ">=", value: "1000" }];

      const mockResult: BatchOperationResult<FileInfo> = {
        total: 1,
        successful: 1,
        failed: 0,
        successRate: 100,
        totalDuration: 300,
        averageDuration: 300,
        results: [
          {
            id: "/test/secret.txt",
            success: true,
            data: {
              hash: "QmTestCID",
              name: "secret.txt",
              size: 1024,
              mimeType: "text/plain",
              uploadedAt: new Date(),
              encrypted: true,
            },
            duration: 300,
            retries: 0,
          },
        ],
      };

      mockService.batchUploadFiles.mockResolvedValue(mockResult);

      const result = await tool.execute({
        filePaths: ["/test/secret.txt"],
        encrypt: true,
        accessConditions,
      });

      expect(result.success).toBe(true);
      expect(mockService.batchUploadFiles).toHaveBeenCalledWith(
        ["/test/secret.txt"],
        expect.objectContaining({
          encrypt: true,
          accessConditions,
        }),
      );
    });

    it("should handle partial failures with continueOnError", async () => {
      const mockResult: BatchOperationResult<FileInfo> = {
        total: 2,
        successful: 1,
        failed: 1,
        successRate: 50,
        totalDuration: 400,
        averageDuration: 200,
        results: [
          {
            id: "/test/file1.txt",
            success: true,
            data: {
              hash: "QmTestCID1",
              name: "file1.txt",
              size: 1024,
              mimeType: "text/plain",
              uploadedAt: new Date(),
              encrypted: false,
            },
            duration: 200,
            retries: 0,
          },
          {
            id: "/test/file2.txt",
            success: false,
            error: "Upload failed",
            duration: 200,
            retries: 0,
          },
        ],
      };

      mockService.batchUploadFiles.mockResolvedValue(mockResult);

      const result = await tool.execute({
        filePaths: ["/test/file1.txt", "/test/file2.txt"],
      });

      expect(result.success).toBe(false);
      expect((result.data as any).total).toBe(2);
      expect((result.data as any).successful).toBe(1);
      expect((result.data as any).failed).toBe(1);
    });
  });

  describe("execute - validation errors", () => {
    it("should fail when filePaths is missing", async () => {
      const result = await tool.execute({});

      expect(result.success).toBe(false);
      expect(result.error).toContain("filePaths is required");
    });

    it("should fail when filePaths is not an array", async () => {
      const result = await tool.execute({
        filePaths: "/test/file.txt",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("filePaths is required and must be an array");
    });

    it("should fail when filePaths is empty", async () => {
      const result = await tool.execute({
        filePaths: [],
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("filePaths cannot be empty");
    });

    it("should fail when filePaths exceeds 100 files", async () => {
      const filePaths = Array.from({ length: 101 }, (_, i) => `/test/file${i}.txt`);

      const result = await tool.execute({ filePaths });

      expect(result.success).toBe(false);
      expect(result.error).toContain("filePaths cannot exceed 100 files");
    });

    it("should fail when file does not exist", async () => {
      mockFs.stat.mockRejectedValue(new Error("ENOENT"));

      const result = await tool.execute({
        filePaths: ["/nonexistent/file.txt"],
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Cannot access files");
    });

    it("should fail when file is too large", async () => {
      mockFs.stat.mockResolvedValue({
        isFile: () => true,
        size: 200 * 1024 * 1024,
      });

      const result = await tool.execute({
        filePaths: ["/test/huge-file.txt"],
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("exceed 100MB limit");
    });

    it("should fail when concurrency is out of range", async () => {
      mockFs.stat.mockResolvedValue({ isFile: () => true, size: 1024 });

      const result = await tool.execute({
        filePaths: ["/test/file.txt"],
        concurrency: 20,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("concurrency must be a number between 1 and 10");
    });

    it("should fail when encrypt is not boolean", async () => {
      mockFs.stat.mockResolvedValue({ isFile: () => true, size: 1024 });

      const result = await tool.execute({
        filePaths: ["/test/file.txt"],
        encrypt: "yes",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("encrypt must be a boolean");
    });

    it("should fail when access conditions are provided without encryption", async () => {
      mockFs.stat.mockResolvedValue({ isFile: () => true, size: 1024 });

      const result = await tool.execute({
        filePaths: ["/test/file.txt"],
        encrypt: false,
        accessConditions: [{ type: "token_balance", condition: ">=", value: "1000" }],
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Access conditions require encryption");
    });

    it("should fail when tags contain non-strings", async () => {
      mockFs.stat.mockResolvedValue({ isFile: () => true, size: 1024 });

      const result = await tool.execute({
        filePaths: ["/test/file.txt"],
        tags: ["valid", 123],
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("tags[1] must be a string");
    });
  });

  describe("execute - service errors", () => {
    beforeEach(() => {
      mockFs.stat.mockResolvedValue({ isFile: () => true, size: 1024 });
    });

    it("should handle service errors", async () => {
      mockService.batchUploadFiles.mockRejectedValue(new Error("Service unavailable"));

      const result = await tool.execute({
        filePaths: ["/test/file.txt"],
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Batch upload failed: Service unavailable");
    });

    it("should handle unknown errors", async () => {
      mockService.batchUploadFiles.mockRejectedValue("Unknown error");

      const result = await tool.execute({
        filePaths: ["/test/file.txt"],
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Batch upload failed: Unknown error occurred");
    });
  });

  describe("metadata tracking", () => {
    beforeEach(() => {
      mockFs.stat.mockResolvedValue({ isFile: () => true, size: 1024 });
    });

    it("should track execution time and metadata", async () => {
      const mockResult: BatchOperationResult<FileInfo> = {
        total: 1,
        successful: 1,
        failed: 0,
        successRate: 100,
        totalDuration: 200,
        averageDuration: 200,
        results: [
          {
            id: "/test/file.txt",
            success: true,
            data: {
              hash: "QmTestCID",
              name: "file.txt",
              size: 1024,
              mimeType: "text/plain",
              uploadedAt: new Date(),
              encrypted: false,
            },
            duration: 200,
            retries: 0,
          },
        ],
      };

      mockService.batchUploadFiles.mockResolvedValue(mockResult);

      const result = await tool.execute({
        filePaths: ["/test/file.txt"],
      });

      expect(result.success).toBe(true);
      expect(result.metadata?.executionTime).toBeDefined();
      expect(result.metadata?.totalFiles).toBe(1);
      expect(result.metadata?.successfulUploads).toBe(1);
      expect(result.metadata?.failedUploads).toBe(0);
      expect(result.metadata?.successRate).toBe(100);
    });
  });
});
