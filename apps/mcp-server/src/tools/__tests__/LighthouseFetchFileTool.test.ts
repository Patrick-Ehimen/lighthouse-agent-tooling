/**
 * Tests for LighthouseFetchFileTool
 */

import fs from "fs/promises";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { Logger } from "@lighthouse-tooling/shared";
import { DownloadResult } from "@lighthouse-tooling/types";
import { ILighthouseService, StoredFile } from "../../services/ILighthouseService.js";
import { LighthouseFetchFileTool } from "../LighthouseFetchFileTool.js";

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

describe("LighthouseFetchFileTool", () => {
  let tool: LighthouseFetchFileTool;
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

    tool = new LighthouseFetchFileTool(mockService, mockLogger);
  });

  describe("getDefinition", () => {
    it("should return correct tool definition", () => {
      const definition = LighthouseFetchFileTool.getDefinition();

      expect(definition.name).toBe("lighthouse_fetch_file");
      expect(definition.description).toContain("Download and optionally decrypt");
      expect(definition.requiresAuth).toBe(true);
      expect(definition.supportsBatch).toBe(false);
      expect(definition.executionTime).toBe("medium");

      // Check required fields
      expect(definition.inputSchema.required).toContain("cid");
      expect(definition.inputSchema.properties.cid).toBeDefined();
      expect(definition.inputSchema.properties.outputPath).toBeDefined();
      expect(definition.inputSchema.properties.decrypt).toBeDefined();
    });
  });

  describe("execute - success cases", () => {
    const mockStoredFile: StoredFile = {
      cid: "QmTestCID123456789012345678901234567890123456",
      filePath: "test-file.txt",
      size: 1024,
      encrypted: false,
      uploadedAt: new Date("2023-01-01T00:00:00.000Z"),
      pinned: true,
      hash: "QmTestCID123456789012345678901234567890123456",
    };

    beforeEach(() => {
      mockService.getFileInfo.mockResolvedValue(mockStoredFile);
      mockFs.stat.mockResolvedValue({
        size: 1024,
      });
    });

    it("should download file successfully with minimal parameters", async () => {
      const mockResult: DownloadResult = {
        filePath: "./downloaded_QmTestCID123456789012345678901234567890123456",
        cid: "QmTestCID123456789012345678901234567890123456",
        size: 1024,
        decrypted: false,
        downloadedAt: new Date("2023-01-01T00:00:00.000Z"),
        hash: "QmTestCID123456789012345678901234567890123456",
      };

      mockService.fetchFile.mockResolvedValue(mockResult);

      const result = await tool.execute({
        cid: "QmTestCID123456789012345678901234567890123456",
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect((result.data as any).cid).toBe("QmTestCID123456789012345678901234567890123456");
      expect((result.data as any).fileName).toBe(
        "downloaded_QmTestCID123456789012345678901234567890123456",
      );
      expect(mockService.fetchFile).toHaveBeenCalledWith({
        cid: "QmTestCID123456789012345678901234567890123456",
        outputPath: "./downloaded_QmTestCID123456789012345678901234567890123456",
        decrypt: undefined,
      });
    });

    it("should download file with custom output path", async () => {
      const mockResult: DownloadResult = {
        filePath: "/custom/path/file.txt",
        cid: "QmTestCID456789012345678901234567890456789",
        size: 2048,
        decrypted: false,
        downloadedAt: new Date("2023-01-01T00:00:00.000Z"),
        hash: "QmTestCID456789012345678901234567890456789",
      };

      mockService.fetchFile.mockResolvedValue(mockResult);

      // Mock fs.access to simulate:
      // 1. Directory check (should succeed)
      // 2. File existence check (should fail - file doesn't exist yet)
      mockFs.access.mockImplementation((path: string) => {
        if (path === "/custom/path") {
          return Promise.resolve(); // Directory is writable
        }
        if (path === "/custom/path/file.txt") {
          return Promise.reject(new Error("File doesn't exist")); // File doesn't exist (good)
        }
        return Promise.resolve();
      });

      const result = await tool.execute({
        cid: "QmTestCID456789012345678901234567890456789",
        outputPath: "/custom/path/file.txt",
      });

      expect(result.success).toBe(true);
      expect((result.data as any).filePath).toBe("/custom/path/file.txt");
      expect(mockService.fetchFile).toHaveBeenCalledWith({
        cid: "QmTestCID456789012345678901234567890456789",
        outputPath: "/custom/path/file.txt",
        decrypt: undefined,
      });
    });

    it("should download and decrypt encrypted file", async () => {
      const encryptedFile: StoredFile = {
        ...mockStoredFile,
        encrypted: true,
      };

      mockService.getFileInfo.mockResolvedValue(encryptedFile);

      const mockResult: DownloadResult = {
        filePath: "./decrypted_file.txt",
        cid: "QmTestCID789012345678901234567890789012",
        size: 1024,
        decrypted: true,
        downloadedAt: new Date("2023-01-01T00:00:00.000Z"),
        hash: "QmTestCID789012345678901234567890789012",
      };

      mockService.fetchFile.mockResolvedValue(mockResult);

      // Mock fs.access to simulate:
      // 1. Directory check (should succeed)
      // 2. File existence check (should fail - file doesn't exist yet)
      mockFs.access.mockImplementation((path: string) => {
        if (path === ".") {
          return Promise.resolve(); // Current directory is writable
        }
        if (path === "./decrypted_file.txt") {
          return Promise.reject(new Error("File doesn't exist")); // File doesn't exist (good)
        }
        return Promise.resolve();
      });

      const result = await tool.execute({
        cid: "QmTestCID789012345678901234567890789012",
        outputPath: "./decrypted_file.txt",
        decrypt: true,
      });

      expect(result.success).toBe(true);
      expect((result.data as any).decrypted).toBe(true);
      expect(mockService.fetchFile).toHaveBeenCalledWith({
        cid: "QmTestCID789012345678901234567890789012",
        outputPath: "./decrypted_file.txt",
        decrypt: true,
      });
    });
  });

  describe("execute - validation errors", () => {
    it("should fail when cid is missing", async () => {
      const result = await tool.execute({});

      expect(result.success).toBe(false);
      expect(result.error).toContain("cid is required");
    });

    it("should fail when cid is not a string", async () => {
      const result = await tool.execute({
        cid: 123,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("cid is required and must be a string");
    });

    it("should fail when cid format is invalid", async () => {
      const result = await tool.execute({
        cid: "invalid-cid",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid CID format");
    });

    it("should fail when outputPath is not a string", async () => {
      const result = await tool.execute({
        cid: "QmTestCID123456789012345678901234567890123456",
        outputPath: 123,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("outputPath must be a string");
    });

    it("should fail when output directory is not writable", async () => {
      mockFs.access.mockRejectedValue(new Error("Permission denied"));
      mockFs.mkdir.mockRejectedValue(new Error("Cannot create directory"));

      const result = await tool.execute({
        cid: "QmTestCID123456789012345678901234567890123456",
        outputPath: "/readonly/path/file.txt",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Cannot write to output directory");
    });

    it("should fail when output file already exists", async () => {
      mockFs.access.mockImplementation((path) => {
        if (path.includes("file.txt")) {
          return Promise.resolve(); // File exists
        }
        return Promise.resolve(); // Directory exists
      });

      const result = await tool.execute({
        cid: "QmTestCID123456789012345678901234567890123456",
        outputPath: "/test/existing-file.txt",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Output file already exists");
    });

    it("should fail when decrypt is not boolean", async () => {
      const result = await tool.execute({
        cid: "QmTestCID123456789012345678901234567890123456",
        decrypt: "yes",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("decrypt must be a boolean");
    });

    it("should accept valid CID v0 format", async () => {
      mockService.getFileInfo.mockResolvedValue(null); // File not found

      const result = await tool.execute({
        cid: "QmTestCID123456789012345678901234567890123456",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("File not found for CID");
      // Should not fail on CID validation
    });

    it("should accept valid CID v1 format", async () => {
      mockService.getFileInfo.mockResolvedValue(null); // File not found

      const result = await tool.execute({
        cid: "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("File not found for CID");
      // Should not fail on CID validation
    });
  });

  describe("execute - service errors", () => {
    const mockStoredFile: StoredFile = {
      cid: "QmTestCID123456789012345678901234567890abcdef",
      filePath: "test-file.txt",
      size: 1024,
      encrypted: false,
      uploadedAt: new Date("2023-01-01T00:00:00.000Z"),
      pinned: true,
      hash: "QmTestCID123456789012345678901234567890abcdef",
    };

    it("should fail when file is not found", async () => {
      mockService.getFileInfo.mockResolvedValue(null);

      const result = await tool.execute({
        cid: "QmNonExist12345678901234567890123456789012",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("File not found for CID");
    });

    it("should handle service fetch errors", async () => {
      mockService.getFileInfo.mockResolvedValue(mockStoredFile);
      mockService.fetchFile.mockRejectedValue(new Error("Download service unavailable"));

      const result = await tool.execute({
        cid: "QmTestCID123456789012345678901234567890123456",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Download failed: Download service unavailable");
      expect(result.metadata?.executionTime).toBeDefined();
    });

    it("should handle unknown errors", async () => {
      mockService.getFileInfo.mockResolvedValue(mockStoredFile);
      mockService.fetchFile.mockRejectedValue("Unknown error");

      const result = await tool.execute({
        cid: "QmTestCID123456789012345678901234567890123456",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Download failed: Unknown error occurred");
    });
  });

  describe("metadata tracking", () => {
    const mockStoredFile: StoredFile = {
      cid: "QmTestCID123456789012345678901234567890abcdef",
      filePath: "test-file.txt",
      size: 1024,
      encrypted: false,
      uploadedAt: new Date("2023-01-01T00:00:00.000Z"),
      pinned: true,
      hash: "QmTestCID123456789012345678901234567890abcdef",
    };

    beforeEach(() => {
      mockService.getFileInfo.mockResolvedValue(mockStoredFile);
      mockFs.stat.mockResolvedValue({
        size: 1024,
      });
    });

    it("should track execution time and metadata", async () => {
      const mockResult: DownloadResult = {
        filePath: "./downloaded_file.txt",
        cid: "QmTestCID123456789012345678901234567890123456",
        size: 1024,
        decrypted: false,
        downloadedAt: new Date(),
        hash: "QmTestCID123456789012345678901234567890123456",
      };

      mockService.fetchFile.mockResolvedValue(mockResult);

      const result = await tool.execute({
        cid: "QmTestCID123456789012345678901234567890123456",
      });

      expect(result.success).toBe(true);
      expect(result.metadata?.executionTime).toBeDefined();
      expect(result.metadata?.fileSize).toBe(1024);
      expect(result.metadata?.decrypted).toBe(false);
      expect(result.metadata?.outputPath).toBe("./downloaded_file.txt");
    });

    it("should handle file stats errors gracefully", async () => {
      const mockResult: DownloadResult = {
        filePath: "./downloaded_file.txt",
        cid: "QmTestCID123456789012345678901234567890123456",
        size: 1024,
        decrypted: false,
        downloadedAt: new Date(),
        hash: "QmTestCID123456789012345678901234567890123456",
      };

      mockService.fetchFile.mockResolvedValue(mockResult);
      mockFs.stat.mockRejectedValue(new Error("File not accessible"));

      const result = await tool.execute({
        cid: "QmTestCID123456789012345678901234567890123456",
      });

      expect(result.success).toBe(true);
      expect((result.data as any).fileExists).toBe(false);
      expect((result.data as unknown).actualFileSize).toBeUndefined();
    });
  });
});
