/**
 * Tests for Cache Manager
 */

import { CacheManager } from "../CacheManager";
import { FileInfo, DatasetInfo } from "../../types";

describe("CacheManager", () => {
  let cacheManager: CacheManager;

  beforeEach(() => {
    cacheManager = new CacheManager({
      enabled: true,
      fileMetadataCacheSize: 100,
      datasetCacheSize: 50,
      responseCacheSize: 200,
      defaultTtl: 1000,
    });
  });

  afterEach(() => {
    cacheManager.destroy();
  });

  describe("File metadata caching", () => {
    it("should cache and retrieve file metadata", () => {
      const fileInfo: FileInfo = {
        hash: "QmTest123",
        name: "test.txt",
        size: 1024,
        uploadedAt: new Date(),
      };

      cacheManager.setFileMetadata("QmTest123", fileInfo);
      const cached = cacheManager.getFileMetadata("QmTest123");

      expect(cached).toEqual(fileInfo);
    });

    it("should invalidate file metadata", () => {
      const fileInfo: FileInfo = {
        hash: "QmTest123",
        name: "test.txt",
        size: 1024,
        uploadedAt: new Date(),
      };

      cacheManager.setFileMetadata("QmTest123", fileInfo);
      expect(cacheManager.getFileMetadata("QmTest123")).toEqual(fileInfo);

      cacheManager.invalidateFile("QmTest123");
      expect(cacheManager.getFileMetadata("QmTest123")).toBeUndefined();
    });
  });

  describe("Dataset caching", () => {
    it("should cache and retrieve datasets", () => {
      const dataset: DatasetInfo = {
        id: "dataset-1",
        name: "My Dataset",
        description: "Test dataset",
        files: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      cacheManager.setDataset("dataset-1", dataset);
      const cached = cacheManager.getDataset("dataset-1");

      expect(cached).toEqual(dataset);
    });

    it("should invalidate datasets", () => {
      const dataset: DatasetInfo = {
        id: "dataset-1",
        name: "My Dataset",
        description: "Test dataset",
        files: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      cacheManager.setDataset("dataset-1", dataset);
      expect(cacheManager.getDataset("dataset-1")).toEqual(dataset);

      cacheManager.invalidateDataset("dataset-1");
      expect(cacheManager.getDataset("dataset-1")).toBeUndefined();
    });
  });

  describe("Response caching", () => {
    it("should cache and retrieve responses", () => {
      const response = { data: "test", status: 200 };

      cacheManager.setResponse("api-call-1", response);
      const cached = cacheManager.getResponse("api-call-1");

      expect(cached).toEqual(response);
    });

    it("should invalidate responses", () => {
      const response = { data: "test" };

      cacheManager.setResponse("api-call-1", response);
      expect(cacheManager.getResponse("api-call-1")).toEqual(response);

      cacheManager.invalidateResponse("api-call-1");
      expect(cacheManager.getResponse("api-call-1")).toBeUndefined();
    });
  });

  describe("Cache control", () => {
    it("should enable and disable caching", () => {
      const fileInfo: FileInfo = {
        hash: "QmTest123",
        name: "test.txt",
        size: 1024,
        uploadedAt: new Date(),
      };

      // Disable caching
      cacheManager.disable();
      expect(cacheManager.isEnabled()).toBe(false);

      // Set should be ignored
      cacheManager.setFileMetadata("QmTest123", fileInfo);
      expect(cacheManager.getFileMetadata("QmTest123")).toBeUndefined();

      // Enable caching
      cacheManager.enable();
      expect(cacheManager.isEnabled()).toBe(true);

      // Now it should work
      cacheManager.setFileMetadata("QmTest123", fileInfo);
      expect(cacheManager.getFileMetadata("QmTest123")).toEqual(fileInfo);
    });

    it("should clear all caches", () => {
      const fileInfo: FileInfo = {
        hash: "QmTest123",
        name: "test.txt",
        size: 1024,
        uploadedAt: new Date(),
      };

      const dataset: DatasetInfo = {
        id: "dataset-1",
        name: "My Dataset",
        description: "Test dataset",
        files: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      cacheManager.setFileMetadata("QmTest123", fileInfo);
      cacheManager.setDataset("dataset-1", dataset);
      cacheManager.setResponse("api-call-1", { data: "test" });

      cacheManager.clearAll();

      expect(cacheManager.getFileMetadata("QmTest123")).toBeUndefined();
      expect(cacheManager.getDataset("dataset-1")).toBeUndefined();
      expect(cacheManager.getResponse("api-call-1")).toBeUndefined();
    });
  });

  describe("Statistics", () => {
    it("should provide cache statistics", () => {
      const fileInfo: FileInfo = {
        hash: "QmTest123",
        name: "test.txt",
        size: 1024,
        uploadedAt: new Date(),
      };

      cacheManager.setFileMetadata("QmTest123", fileInfo);
      cacheManager.getFileMetadata("QmTest123"); // hit
      cacheManager.getFileMetadata("QmNotFound"); // miss

      const stats = cacheManager.getStats();

      expect(stats.enabled).toBe(true);
      expect(stats.fileMetadata.size).toBe(1);
      expect(stats.fileMetadata.hits).toBe(1);
      expect(stats.fileMetadata.misses).toBe(1);
    });
  });

  describe("Key generation helpers", () => {
    it("should generate file cache keys", () => {
      const key1 = CacheManager.generateFileKey("QmTest123");
      const key2 = CacheManager.generateFileKey("QmTest123", "download");

      expect(key1).toBe("file:QmTest123");
      expect(key2).toBe("file:QmTest123:download");
    });

    it("should generate dataset cache keys", () => {
      const key1 = CacheManager.generateDatasetKey("dataset-1");
      const key2 = CacheManager.generateDatasetKey("dataset-1", "list-files");

      expect(key1).toBe("dataset:dataset-1");
      expect(key2).toBe("dataset:dataset-1:list-files");
    });

    it("should generate response cache keys", () => {
      const key1 = CacheManager.generateResponseKey("/api/files");
      const key2 = CacheManager.generateResponseKey("/api/files", { limit: 10 });

      expect(key1).toBe("response:/api/files:");
      expect(key2).toBe('response:/api/files:{"limit":10}');
    });
  });
});
