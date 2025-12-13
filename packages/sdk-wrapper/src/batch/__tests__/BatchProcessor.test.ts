/**
 * Tests for Batch Processor
 */

import { BatchProcessor } from "../BatchProcessor";

describe("BatchProcessor", () => {
  describe("Basic operations", () => {
    it("should process operations successfully", async () => {
      const processor = new BatchProcessor<number, number>(async (data) => data * 2, {
        concurrency: 2,
      });

      const result = await processor.add("op1", 5);

      expect(result.success).toBe(true);
      expect(result.result).toBe(10);
      expect(result.id).toBe("op1");

      processor.destroy();
    });

    it("should process multiple operations", async () => {
      const processor = new BatchProcessor<number, number>(async (data) => data * 2, {
        concurrency: 2,
      });

      const results = await Promise.all([
        processor.add("op1", 5),
        processor.add("op2", 10),
        processor.add("op3", 15),
      ]);

      expect(results).toHaveLength(3);
      expect(results[0].result).toBe(10);
      expect(results[1].result).toBe(20);
      expect(results[2].result).toBe(30);

      processor.destroy();
    });

    it("should process batch operations", async () => {
      const processor = new BatchProcessor<number, number>(async (data) => data * 2, {
        concurrency: 2,
      });

      const operations = [
        { id: "op1", data: 1 },
        { id: "op2", data: 2 },
        { id: "op3", data: 3 },
      ];

      const results = await processor.addBatch(operations);

      expect(results).toHaveLength(3);
      expect(results.map((r) => r.result)).toEqual([2, 4, 6]);

      processor.destroy();
    });
  });

  describe("Concurrency control", () => {
    it("should respect concurrency limit", async () => {
      let concurrent = 0;
      let maxConcurrent = 0;

      const processor = new BatchProcessor<number, number>(
        async (data) => {
          concurrent++;
          maxConcurrent = Math.max(maxConcurrent, concurrent);

          await new Promise((resolve) => setTimeout(resolve, 50));

          concurrent--;
          return data * 2;
        },
        { concurrency: 2 },
      );

      await Promise.all([
        processor.add("op1", 1),
        processor.add("op2", 2),
        processor.add("op3", 3),
        processor.add("op4", 4),
        processor.add("op5", 5),
      ]);

      expect(maxConcurrent).toBeLessThanOrEqual(2);

      processor.destroy();
    });
  });

  describe("Error handling", () => {
    it("should handle errors gracefully", async () => {
      const processor = new BatchProcessor<number, number>(
        async (data) => {
          if (data === 5) {
            throw new Error("Test error");
          }
          return data * 2;
        },
        { concurrency: 2, retryOnFailure: false },
      );

      const result = await processor.add("op1", 5);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe("Test error");

      processor.destroy();
    });

    it("should retry failed operations", async () => {
      let attempts = 0;

      const processor = new BatchProcessor<number, number>(
        async (data) => {
          attempts++;
          if (attempts < 3) {
            throw new Error("Temporary error");
          }
          return data * 2;
        },
        { concurrency: 1, retryOnFailure: true, maxRetries: 3 },
      );

      const result = await processor.add("op1", 5);

      expect(result.success).toBe(true);
      expect(result.result).toBe(10);
      expect(result.retries).toBeGreaterThan(0);
      expect(attempts).toBe(3);

      processor.destroy();
    });

    it("should fail after max retries", async () => {
      const processor = new BatchProcessor<number, number>(
        async () => {
          throw new Error("Persistent error");
        },
        { concurrency: 1, retryOnFailure: true, maxRetries: 2 },
      );

      const result = await processor.add("op1", 5);

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe("Persistent error");
      expect(result.retries).toBe(2);

      processor.destroy();
    });
  });

  describe("Events", () => {
    it("should emit queued event", async () => {
      const processor = new BatchProcessor<number, number>(async (data) => data * 2, {
        concurrency: 1,
      });

      const queuedEvents: unknown[] = [];
      processor.on("queued", (event) => queuedEvents.push(event));

      await processor.add("op1", 5);

      expect(queuedEvents).toHaveLength(1);

      processor.destroy();
    });

    it("should emit start and complete events", async () => {
      const processor = new BatchProcessor<number, number>(async (data) => data * 2, {
        concurrency: 1,
      });

      const startEvents: unknown[] = [];
      const completeEvents: unknown[] = [];

      processor.on("start", (event) => startEvents.push(event));
      processor.on("complete", (event) => completeEvents.push(event));

      await processor.add("op1", 5);

      expect(startEvents).toHaveLength(1);
      expect(completeEvents).toHaveLength(1);

      processor.destroy();
    });

    it("should emit error event on failure", async () => {
      const processor = new BatchProcessor<number, number>(
        async () => {
          throw new Error("Test error");
        },
        { concurrency: 1, retryOnFailure: false },
      );

      const errorEvents: unknown[] = [];
      processor.on("error", (event) => errorEvents.push(event));

      await processor.add("op1", 5);

      expect(errorEvents).toHaveLength(1);

      processor.destroy();
    });
  });

  describe("Pause and resume", () => {
    it("should pause and resume processing", async () => {
      const processor = new BatchProcessor<number, number>(
        async (data) => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return data * 2;
        },
        { concurrency: 1 },
      );

      // Pause immediately
      processor.pause();

      const promise = processor.add("op1", 5);

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Should still be queued
      expect(processor.queueSize).toBe(1);

      // Resume
      processor.resume();

      const result = await promise;

      expect(result.success).toBe(true);
      expect(result.result).toBe(10);

      processor.destroy();
    });
  });

  describe("Statistics", () => {
    it("should provide accurate statistics", async () => {
      const processor = new BatchProcessor<number, number>(
        async (data) => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return data * 2;
        },
        { concurrency: 2 },
      );

      await Promise.all([
        processor.add("op1", 1),
        processor.add("op2", 2),
        processor.add("op3", 3),
      ]);

      const stats = processor.getStats();

      expect(stats.completed).toBe(3);
      expect(stats.failed).toBe(0);
      expect(stats.totalProcessed).toBe(3);
      expect(stats.successRate).toBe(1);

      processor.destroy();
    });
  });

  describe("Drain", () => {
    it("should wait for all operations to complete", async () => {
      const processor = new BatchProcessor<number, number>(
        async (data) => {
          await new Promise((resolve) => setTimeout(resolve, 50));
          return data * 2;
        },
        { concurrency: 2 },
      );

      // Add operations without awaiting
      processor.add("op1", 1);
      processor.add("op2", 2);
      processor.add("op3", 3);

      expect(processor.isIdle()).toBe(false);

      await processor.drain();

      expect(processor.isIdle()).toBe(true);

      processor.destroy();
    });
  });

  describe("Clear", () => {
    it("should clear the queue", async () => {
      const processor = new BatchProcessor<number, number>(
        async (data) => {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          return data * 2;
        },
        { concurrency: 1 },
      );

      processor.pause();

      // Add operations
      const promises = [processor.add("op1", 1), processor.add("op2", 2), processor.add("op3", 3)];

      expect(processor.queueSize).toBe(3);

      processor.clear();

      expect(processor.queueSize).toBe(0);

      // All promises should reject
      await expect(Promise.all(promises)).rejects.toThrow("Queue cleared");

      processor.destroy();
    });
  });
});
