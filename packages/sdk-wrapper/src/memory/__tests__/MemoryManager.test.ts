/**
 * Tests for Memory Manager
 */

import { MemoryManager } from "../MemoryManager";

describe("MemoryManager", () => {
  let memoryManager: MemoryManager;

  beforeEach(() => {
    memoryManager = new MemoryManager({
      maxMemory: 1024 * 1024, // 1MB
      backpressureThreshold: 0.8,
      cleanupThreshold: 0.9,
      checkInterval: 0, // Disable automatic checks
      autoCleanup: false, // Manual cleanup for testing
    });
  });

  afterEach(() => {
    memoryManager.destroy();
  });

  describe("Tracking allocations", () => {
    it("should track memory allocations", () => {
      memoryManager.track("alloc1", 1024, { type: "file" });

      expect(memoryManager.allocated).toBe(1024);
      expect(memoryManager.count).toBe(1);

      const allocation = memoryManager.getAllocation("alloc1");
      expect(allocation).toBeDefined();
      expect(allocation?.size).toBe(1024);
      expect(allocation?.metadata).toEqual({ type: "file" });
    });

    it("should untrack memory allocations", () => {
      memoryManager.track("alloc1", 1024);
      memoryManager.track("alloc2", 2048);

      expect(memoryManager.allocated).toBe(3072);

      memoryManager.untrack("alloc1");

      expect(memoryManager.allocated).toBe(2048);
      expect(memoryManager.count).toBe(1);
    });

    it("should replace existing allocations", () => {
      memoryManager.track("alloc1", 1024);
      memoryManager.track("alloc1", 2048);

      expect(memoryManager.allocated).toBe(2048);
      expect(memoryManager.count).toBe(1);
    });

    it("should get all allocations", () => {
      memoryManager.track("alloc1", 1024);
      memoryManager.track("alloc2", 2048);

      const allocations = memoryManager.getAllocations();

      expect(allocations).toHaveLength(2);
      expect(allocations.map((a) => a.id)).toContain("alloc1");
      expect(allocations.map((a) => a.id)).toContain("alloc2");
    });
  });

  describe("Memory statistics", () => {
    it("should provide memory statistics", () => {
      memoryManager.track("alloc1", 512 * 1024); // 0.5MB

      const stats = memoryManager.getStats();

      expect(stats.used).toBe(512 * 1024);
      expect(stats.max).toBe(1024 * 1024);
      expect(stats.percentage).toBe(0.5);
      expect(stats.underBackpressure).toBe(false);
      expect(stats.needsCleanup).toBe(false);
    });

    it("should detect backpressure condition", () => {
      memoryManager.track("alloc1", 850 * 1024); // 0.83MB (> 0.8 threshold)

      const stats = memoryManager.getStats();

      expect(stats.percentage).toBeGreaterThan(0.8);
      expect(stats.underBackpressure).toBe(true);
    });

    it("should detect cleanup needed", () => {
      memoryManager.track("alloc1", 950 * 1024); // 0.93MB (> 0.9 threshold)

      const stats = memoryManager.getStats();

      expect(stats.percentage).toBeGreaterThan(0.9);
      expect(stats.needsCleanup).toBe(true);
    });
  });

  describe("Backpressure handling", () => {
    it("should emit backpressure start event", (done) => {
      memoryManager.on("backpressure:start", () => {
        done();
      });

      memoryManager.track("alloc1", 850 * 1024); // Exceed threshold
    });

    it("should emit backpressure end event", (done) => {
      memoryManager.track("alloc1", 850 * 1024); // Start backpressure

      memoryManager.on("backpressure:end", () => {
        done();
      });

      memoryManager.untrack("alloc1"); // Release memory
    });

    it("should check if under backpressure", () => {
      expect(memoryManager.isUnderBackpressure()).toBe(false);

      memoryManager.track("alloc1", 850 * 1024);

      expect(memoryManager.isUnderBackpressure()).toBe(true);

      memoryManager.untrack("alloc1");

      expect(memoryManager.isUnderBackpressure()).toBe(false);
    });

    it("should wait for backpressure relief", async () => {
      memoryManager.track("alloc1", 850 * 1024); // Start backpressure

      const waitPromise = memoryManager.waitForRelief(1000);

      // Release after a short delay
      setTimeout(() => {
        memoryManager.untrack("alloc1");
      }, 100);

      await expect(waitPromise).resolves.toBeUndefined();
    });

    it("should timeout waiting for relief", async () => {
      memoryManager.track("alloc1", 850 * 1024); // Start backpressure

      await expect(memoryManager.waitForRelief(100)).rejects.toThrow("Backpressure relief timeout");
    });
  });

  describe("Cleanup", () => {
    it("should clean up old allocations", async () => {
      memoryManager.track("alloc1", 1024);
      memoryManager.track("alloc2", 2048);

      // Wait for allocations to age
      await new Promise((resolve) => setTimeout(resolve, 150));

      const cleaned = memoryManager.cleanup(100); // Remove items older than 100ms

      expect(cleaned).toBe(2);
      expect(memoryManager.count).toBe(0);
      expect(memoryManager.allocated).toBe(0);
    });

    it("should not clean up recent allocations", async () => {
      memoryManager.track("alloc1", 1024);

      await new Promise((resolve) => setTimeout(resolve, 50));

      const cleaned = memoryManager.cleanup(100); // Only remove items older than 100ms

      expect(cleaned).toBe(0);
      expect(memoryManager.count).toBe(1);
    });

    it("should emit cleanup event", (done) => {
      memoryManager.on("cleanup:needed", () => {
        done();
      });

      memoryManager.track("alloc1", 950 * 1024); // Exceed cleanup threshold
    });
  });

  describe("Clear", () => {
    it("should clear all allocations", () => {
      memoryManager.track("alloc1", 1024);
      memoryManager.track("alloc2", 2048);
      memoryManager.track("alloc3", 4096);

      expect(memoryManager.count).toBe(3);

      memoryManager.clear();

      expect(memoryManager.count).toBe(0);
      expect(memoryManager.allocated).toBe(0);
    });

    it("should emit clear event", (done) => {
      memoryManager.track("alloc1", 1024);
      memoryManager.track("alloc2", 2048);

      memoryManager.on("clear", (event) => {
        expect(event.count).toBe(2);
        done();
      });

      memoryManager.clear();
    });
  });

  describe("Utility methods", () => {
    it("should format bytes to human-readable string", () => {
      expect(MemoryManager.formatBytes(100)).toBe("100.00 B");
      expect(MemoryManager.formatBytes(1024)).toBe("1.00 KB");
      expect(MemoryManager.formatBytes(1024 * 1024)).toBe("1.00 MB");
      expect(MemoryManager.formatBytes(1024 * 1024 * 1024)).toBe("1.00 GB");
      expect(MemoryManager.formatBytes(1024 * 1024 * 1024 * 1024)).toBe("1.00 TB");
    });

    it("should format partial bytes correctly", () => {
      expect(MemoryManager.formatBytes(1536)).toBe("1.50 KB");
      expect(MemoryManager.formatBytes(2.5 * 1024 * 1024)).toBe("2.50 MB");
    });
  });

  describe("Events", () => {
    it("should emit track event", (done) => {
      memoryManager.on("track", (event) => {
        expect(event.id).toBe("alloc1");
        expect(event.size).toBe(1024);
        done();
      });

      memoryManager.track("alloc1", 1024);
    });

    it("should emit untrack event", (done) => {
      memoryManager.track("alloc1", 1024);

      memoryManager.on("untrack", (event) => {
        expect(event.id).toBe("alloc1");
        expect(event.size).toBe(1024);
        done();
      });

      memoryManager.untrack("alloc1");
    });
  });

  describe("Edge cases", () => {
    it("should handle untracking non-existent allocation", () => {
      const result = memoryManager.untrack("nonexistent");

      expect(result).toBe(false);
      expect(memoryManager.count).toBe(0);
    });

    it("should handle zero-size allocations", () => {
      memoryManager.track("alloc1", 0);

      expect(memoryManager.allocated).toBe(0);
      expect(memoryManager.count).toBe(1);
    });

    it("should handle negative sizes gracefully", () => {
      memoryManager.track("alloc1", -100);

      // Should still track it (even if unusual)
      expect(memoryManager.count).toBe(1);
    });
  });
});
