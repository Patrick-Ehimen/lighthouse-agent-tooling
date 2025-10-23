/**
 * Tests for LighthouseUploadFileTool
 */

import fs from "fs/promises";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { Logger } from "@lighthouse-tooling/shared";
import { AccessCondition, UploadResult } from "@lighthouse-tooling/types";
import { ILighthouseService } from "../../services/ILighthouseService.js";
import { LighthouseUploadFileTool } from "../LighthouseUploadFileTool.js";

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

describe("LighthouseUploadFileTool", () => {
  let tool: LighthouseUploadFileTool;
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
    };

    tool = new LighthouseUploadFileTool(mockService, mockLogger);
  });

  describe("getDefinition", () => {
    it("should return correct tool definition", () => {
      const definition = LighthouseUploadFileTool.getDefinition();

      expect(definition.name).toBe("lighthouse_upload_file");
      expect(definition.description).toContain("Upload a file to IPFS");
      expect(definition.requiresAuth).toBe(true);
      expect(definition.supportsBatch).toBe(false);
      expect(definition.executionTime).toBe("medium");

      // Check required fields
      expect(definition.inputSchema.required).toContain("filePath");
      expect(definition.inputSchema.properties.filePath).toBeDefined();
      expect(definition.inputSchema.properties.encrypt).toBeDefined();
      expect(definition.inputSchema.properties.accessConditions).toBeDefined();
      expect(definition.inputSchema.properties.tags).toBeDefined();
    });
  });

  describe("execute - success cases", () => {
    beforeEach(() => {
      // Mock file stats
      mockFs.stat.mockResolvedValue({
        isFile: () => true,
        size: 1024,
      } as any);
    });

    it("should upload file successfully with minimal parameters", async () => {
      const mockResult: UploadResult = {
        cid: "QmTestCID123",
        size: 1024,
        encrypted: false,
        uploadedAt: new Date("2023-01-01T00:00:00.000Z"),
        originalPath: "/test/file.txt",
        hash: "QmTestCID123",
      };

      mockService.uploadFile.mockResolvedValue(mockResult);

      const result = await tool.execute({
        filePath: "/test/file.txt",
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect((result.data as any).cid).toBe("QmTestCID123");
      expect((result.data as any).fileName).toBe("file.txt");
      expect(mockService.uploadFile).toHaveBeenCalledWith({
        filePath: "/test/file.txt",
        encrypt: undefined,
        accessConditions: undefined,
        tags: undefined,
      });
    });

    it("should upload encrypted file with access conditions", async () => {
      const accessConditions: AccessCondition[] = [
        {
          type: "token_balance" as any,
          condition: ">=",
          value: "1000",
        },
      ];

      const mockResult: UploadResult = {
        cid: "QmTestCID456",
        size: 2048,
        encrypted: true,
        accessConditions,
        tags: ["secret", "important"],
        uploadedAt: new Date("2023-01-01T00:00:00.000Z"),
        originalPath: "/test/secret.txt",
        hash: "QmTestCID456",
      };

      mockService.uploadFile.mockResolvedValue(mockResult);

      const result = await tool.execute({
        filePath: "/test/secret.txt",
        encrypt: true,
        accessConditions,
        tags: ["secret", "important"],
      });

      expect(result.success).toBe(true);
      expect((result.data as any).encrypted).toBe(true);
      expect((result.data as any).accessConditions).toEqual(accessConditions);
      expect((result.data as any).tags).toEqual(["secret", "important"]);
    });
  });

  describe("execute - validation errors", () => {
    it("should fail when filePath is missing", async () => {
      const result = await tool.execute({});

      expect(result.success).toBe(false);
      expect(result.error).toContain("filePath is required");
    });

    it("should fail when filePath is not a string", async () => {
      const result = await tool.execute({
        filePath: 123,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("filePath is required and must be a string");
    });

    it("should fail when file doesn't exist", async () => {
      mockFs.stat.mockRejectedValue(new Error("ENOENT: no such file or directory"));

      const result = await tool.execute({
        filePath: "/nonexistent/file.txt",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Cannot access file");
    });

    it("should fail when path is not a file", async () => {
      mockFs.stat.mockResolvedValue({
        isFile: () => false,
        size: 0,
      } as any);

      const result = await tool.execute({
        filePath: "/test/directory",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Path is not a file");
    });

    it("should fail when file is too large", async () => {
      mockFs.stat.mockResolvedValue({
        isFile: () => true,
        size: 200 * 1024 * 1024, // 200MB
      } as any);

      const result = await tool.execute({
        filePath: "/test/huge-file.txt",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("File too large");
    });

    it("should fail when encrypt is not boolean", async () => {
      mockFs.stat.mockResolvedValue({
        isFile: () => true,
        size: 1024,
      } as any);

      const result = await tool.execute({
        filePath: "/test/file.txt",
        encrypt: "yes",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("encrypt must be a boolean");
    });

    it("should fail when access conditions are provided without encryption", async () => {
      mockFs.stat.mockResolvedValue({
        isFile: () => true,
        size: 1024,
      } as any);

      const result = await tool.execute({
        filePath: "/test/file.txt",
        encrypt: false,
        accessConditions: [
          {
            type: "token_balance",
            condition: ">=",
            value: "1000",
          },
        ],
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Access conditions require encryption");
    });

    it("should fail when access conditions are malformed", async () => {
      mockFs.stat.mockResolvedValue({
        isFile: () => true,
        size: 1024,
      } as any);

      const result = await tool.execute({
        filePath: "/test/file.txt",
        encrypt: true,
        accessConditions: [
          {
            type: "token_balance",
            // missing condition and value
          },
        ],
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("accessConditions[0].condition is required");
    });

    it("should fail when tags are not strings", async () => {
      mockFs.stat.mockResolvedValue({
        isFile: () => true,
        size: 1024,
      } as any);

      const result = await tool.execute({
        filePath: "/test/file.txt",
        tags: ["valid", 123, "also-valid"],
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("tags[1] must be a string");
    });
  });

  describe("execute - service errors", () => {
    beforeEach(() => {
      mockFs.stat.mockResolvedValue({
        isFile: () => true,
        size: 1024,
      } as any);
    });

    it("should handle service upload errors", async () => {
      mockService.uploadFile.mockRejectedValue(new Error("Upload service unavailable"));

      const result = await tool.execute({
        filePath: "/test/file.txt",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Upload failed: Upload service unavailable");
      expect(result.metadata?.executionTime).toBeDefined();
    });

    it("should handle unknown errors", async () => {
      mockService.uploadFile.mockRejectedValue("Unknown error");

      const result = await tool.execute({
        filePath: "/test/file.txt",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Upload failed: Unknown error occurred");
    });
  });

  describe("metadata tracking", () => {
    beforeEach(() => {
      mockFs.stat.mockResolvedValue({
        isFile: () => true,
        size: 1024,
      } as any);
    });

    it("should track execution time and metadata", async () => {
      const mockResult: UploadResult = {
        cid: "QmTestCID789",
        size: 1024,
        encrypted: false,
        uploadedAt: new Date(),
        originalPath: "/test/file.txt",
        hash: "QmTestCID789",
      };

      mockService.uploadFile.mockResolvedValue(mockResult);

      const result = await tool.execute({
        filePath: "/test/file.txt",
      });

      expect(result.success).toBe(true);
      expect(result.metadata?.executionTime).toBeDefined();
      expect(result.metadata?.fileSize).toBe(1024);
      expect(result.metadata?.encrypted).toBe(false);
    });
  });
});
