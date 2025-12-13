/**
 * Performance benchmarks for caching and performance optimizations
 */

import { LRUCache } from "../cache/LRUCache";
import { CacheManager } from "../cache/CacheManager";
import { BatchProcessor } from "../batch/BatchProcessor";
import { MemoryManager } from "../memory/MemoryManager";
import { FileInfo } from "../types";

describe("Performance Benchmarks", () => {
  describe("LRU Cache Performance", () => {
    it("should handle high-volume cache operations", () => {
      const cache = new LRUCache<string>({ maxSize: 10000 });
      const startTime = Date.now();

      // Perform 10,000 operations
      for (let i = 0; i < 10000; i++) {
        cache.set(`key${i}`, `value${i}`);
      }

      const setTime = Date.now() - startTime;

      const getStartTime = Date.now();
      for (let i = 0; i < 10000; i++) {
        cache.get(`key${i}`);
      }

      const getTime = Date.now() - getStartTime;

      console.log(`LRU Cache - 10k SET operations: ${setTime}ms`);
      console.log(`LRU Cache - 10k GET operations: ${getTime}ms`);

      expect(setTime).toBeLessThan(1000); // Should complete in < 1s
      expect(getTime).toBeLessThan(500); // Gets should be faster

      cache.clear();
    });

    it("should efficiently handle evictions", () => {
      const cache = new LRUCache<string>({ maxSize: 1000 });
      const startTime = Date.now();

      // Add 5000 items (causing 4000 evictions)
      for (let i = 0; i < 5000; i++) {
        cache.set(`key${i}`, `value${i}`);
      }

      const duration = Date.now() - startTime;
      const stats = cache.getStats();

      console.log(`LRU Cache - Eviction test: ${duration}ms`);
      console.log(`Evictions: ${stats.evictions}`);

      expect(duration).toBeLessThan(2000);
      expect(stats.evictions).toBe(4000);

      cache.clear();
    });
  });

  describe("Cache Manager Performance", () => {
    it("should handle concurrent cache operations", async () => {
      const cacheManager = new CacheManager({
        fileMetadataCacheSize: 5000,
        datasetCacheSize: 5000,
      });

      const startTime = Date.now();

      // Simulate concurrent file metadata caching
      const operations = [];
      for (let i = 0; i < 1000; i++) {
        const fileInfo: FileInfo = {
          hash: `QmHash${i}`,
          name: `file${i}.txt`,
          size: 1024 * i,
          mimeType: "text/plain",
          uploadedAt: new Date(),
          encrypted: false,
        };

        operations.push(Promise.resolve(cacheManager.setFileMetadata(`QmHash${i}`, fileInfo)));
      }

      await Promise.all(operations);

      const duration = Date.now() - startTime;
      const stats = cacheManager.getStats();

      console.log(`Cache Manager - 1000 concurrent operations: ${duration}ms`);
      console.log(`Cache stats:`, stats);

      expect(duration).toBeLessThan(1000);

      cacheManager.destroy();
    });
  });

  describe("Batch Processor Performance", () => {
    it("should efficiently process large batches", async () => {
      const processor = new BatchProcessor<number, number>(
        async (data) => {
          // Simulate work
          await new Promise((resolve) => setTimeout(resolve, 1));
          return data * 2;
        },
        {
          concurrency: 50,
          batchSize: 100,
        },
      );

      const startTime = Date.now();

      const operations = [];
      for (let i = 0; i < 1000; i++) {
        operations.push(processor.add(`op${i}`, i));
      }

      const results = await Promise.all(operations);

      const duration = Date.now() - startTime;
      const stats = processor.getStats();

      console.log(`Batch Processor - 1000 operations: ${duration}ms`);
      console.log(`Stats:`, stats);
      console.log(`Avg duration per operation: ${stats.averageDuration.toFixed(2)}ms`);

      expect(results).toHaveLength(1000);
      expect(stats.successRate).toBe(1);

      processor.destroy();
    });

    it("should compare serial vs parallel processing", async () => {
      // Serial processing
      const serialStart = Date.now();
      const serialResults = [];

      for (let i = 0; i < 100; i++) {
        await new Promise((resolve) => setTimeout(resolve, 10));
        serialResults.push(i * 2);
      }

      const serialDuration = Date.now() - serialStart;

      // Parallel processing
      const parallelProcessor = new BatchProcessor<number, number>(
        async (data) => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return data * 2;
        },
        { concurrency: 10 },
      );

      const parallelStart = Date.now();
      const parallelOperations = [];

      for (let i = 0; i < 100; i++) {
        parallelOperations.push(parallelProcessor.add(`op${i}`, i));
      }

      await Promise.all(parallelOperations);
      const parallelDuration = Date.now() - parallelStart;

      console.log(`Serial processing (100 ops): ${serialDuration}ms`);
      console.log(`Parallel processing (100 ops, concurrency=10): ${parallelDuration}ms`);
      console.log(`Speedup: ${(serialDuration / parallelDuration).toFixed(2)}x`);

      expect(parallelDuration).toBeLessThan(serialDuration);

      parallelProcessor.destroy();
    });
  });

  describe("Memory Manager Performance", () => {
    it("should efficiently track thousands of allocations", () => {
      const memoryManager = new MemoryManager({
        maxMemory: 1024 * 1024 * 1024, // 1GB
        checkInterval: 0,
      });

      const startTime = Date.now();

      // Track 10,000 allocations
      for (let i = 0; i < 10000; i++) {
        memoryManager.track(`alloc${i}`, 1024);
      }

      const trackDuration = Date.now() - startTime;

      const untrackStart = Date.now();

      // Untrack half of them
      for (let i = 0; i < 5000; i++) {
        memoryManager.untrack(`alloc${i}`);
      }

      const untrackDuration = Date.now() - untrackStart;

      console.log(`Memory Manager - Track 10k allocations: ${trackDuration}ms`);
      console.log(`Memory Manager - Untrack 5k allocations: ${untrackDuration}ms`);

      expect(trackDuration).toBeLessThan(1000);
      expect(untrackDuration).toBeLessThan(500);

      memoryManager.destroy();
    });
  });

  describe("Integrated Performance", () => {
    it("should measure overhead of performance optimizations", async () => {
      const cacheManager = new CacheManager();
      const memoryManager = new MemoryManager({ checkInterval: 0 });

      const processor = new BatchProcessor<FileInfo, FileInfo>(
        async (fileInfo) => {
          // Track memory
          memoryManager.track(fileInfo.hash, fileInfo.size);

          // Cache file metadata
          cacheManager.setFileMetadata(fileInfo.hash, fileInfo);

          // Simulate processing
          await new Promise((resolve) => setTimeout(resolve, 5));

          // Untrack memory
          memoryManager.untrack(fileInfo.hash);

          return fileInfo;
        },
        { concurrency: 20 },
      );

      const startTime = Date.now();

      const operations = [];
      for (let i = 0; i < 500; i++) {
        const fileInfo: FileInfo = {
          hash: `QmHash${i}`,
          name: `file${i}.txt`,
          size: 1024 * (i + 1),
          mimeType: "text/plain",
          uploadedAt: new Date(),
          encrypted: false,
        };

        operations.push(processor.add(`op${i}`, fileInfo));
      }

      await Promise.all(operations);

      const duration = Date.now() - startTime;

      console.log(`Integrated test - 500 files with all optimizations: ${duration}ms`);
      console.log(`Cache stats:`, cacheManager.getStats());
      console.log(`Memory stats:`, memoryManager.getStats());
      console.log(`Batch stats:`, processor.getStats());

      expect(duration).toBeLessThan(10000); // Should complete in < 10s

      processor.destroy();
      cacheManager.destroy();
      memoryManager.destroy();
    });

    it("should demonstrate cache hit rate improvement", async () => {
      const cacheManager = new CacheManager({
        defaultTtl: 10000, // 10 seconds
      });

      // Simulate repeated file lookups
      const fileInfo: FileInfo = {
        hash: "QmTestHash",
        name: "test.txt",
        size: 1024,
        mimeType: "text/plain",
        uploadedAt: new Date(),
        encrypted: false,
      };

      // First access - cache miss
      let cached = cacheManager.getFileMetadata("QmTestHash");
      expect(cached).toBeUndefined();

      // Store in cache
      cacheManager.setFileMetadata("QmTestHash", fileInfo);

      // Subsequent accesses - cache hits
      const startTime = Date.now();
      for (let i = 0; i < 10000; i++) {
        cached = cacheManager.getFileMetadata("QmTestHash");
      }
      const duration = Date.now() - startTime;

      const stats = cacheManager.getStats();

      console.log(`Cache - 10k lookups: ${duration}ms`);
      console.log(`Hit rate: ${(stats.fileMetadata.hitRate * 100).toFixed(2)}%`);

      expect(stats.fileMetadata.hitRate).toBeGreaterThan(0.99);

      cacheManager.destroy();
    });
  });
});
