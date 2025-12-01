/**
 * Tests for File Cache
 */

import { FileCache } from "../FileCache";

describe("FileCache", () => {
  let cache: FileCache<string>;

  beforeEach(() => {
    cache = new FileCache<string>({
      maxSize: 1000,
      maxEntries: 5,
      defaultTTL: 1000,
      enableStats: true,
    });
  });

  afterEach(() => {
    cache.dispose();
  });

  describe("set and get", () => {
    it("should store and retrieve values", () => {
      cache.set("key1", "value1", 10);
      const value = cache.get("key1");
      expect(value).toBe("value1");
    });

    it("should return undefined for missing keys", () => {
      const value = cache.get("nonexistent");
      expect(value).toBeUndefined();
    });

    it("should update access count on get", () => {
      cache.set("key1", "value1", 10);
      cache.get("key1");
      cache.get("key1");

      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
    });
  });

  describe("LRU eviction", () => {
    it("should evict least recently used entry when size limit reached", () => {
      cache.set("key1", "value1", 100);
      cache.set("key2", "value2", 100);
      cache.set("key3", "value3", 100);
      cache.set("key4", "value4", 100);
      cache.set("key5", "value5", 100);

      // This should trigger eviction of key1
      cache.set("key6", "value6", 100);

      expect(cache.has("key1")).toBe(false);
      expect(cache.has("key6")).toBe(true);
    });

    it("should evict least recently used entry when count limit reached", () => {
      cache.set("key1", "value1", 10);
      cache.set("key2", "value2", 10);
      cache.set("key3", "value3", 10);
      cache.set("key4", "value4", 10);
      cache.set("key5", "value5", 10);

      // This should trigger eviction of key1
      cache.set("key6", "value6", 10);

      expect(cache.has("key1")).toBe(false);
      expect(cache.has("key6")).toBe(true);
    });

    it("should promote accessed entries to end of LRU", () => {
      cache.set("key1", "value1", 10);
      cache.set("key2", "value2", 10);
      cache.set("key3", "value3", 10);
      cache.set("key4", "value4", 10);
      cache.set("key5", "value5", 10);

      // Access key1 to move it to end
      cache.get("key1");

      // This should evict key2 instead of key1
      cache.set("key6", "value6", 10);

      expect(cache.has("key1")).toBe(true);
      expect(cache.has("key2")).toBe(false);
    });
  });

  describe("size management", () => {
    it("should track total cache size", () => {
      cache.set("key1", "value1", 100);
      cache.set("key2", "value2", 200);

      expect(cache.getSize()).toBe(300);
    });

    it("should update size when replacing entry", () => {
      cache.set("key1", "value1", 100);
      cache.set("key1", "value2", 200);

      expect(cache.getSize()).toBe(200);
    });

    it("should not cache items larger than max size", () => {
      const listener = jest.fn();
      cache.on("rejected", listener);

      cache.set("huge", "value", 2000);

      expect(cache.has("huge")).toBe(false);
      expect(listener).toHaveBeenCalled();
    });
  });

  describe("TTL expiration", () => {
    it("should expire entries after TTL", async () => {
      cache.set("key1", "value1", 10, 100); // 100ms TTL

      expect(cache.has("key1")).toBe(true);

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(cache.has("key1")).toBe(false);
    });

    it("should return undefined for expired entries on get", async () => {
      cache.set("key1", "value1", 10, 100);

      await new Promise((resolve) => setTimeout(resolve, 150));

      const value = cache.get("key1");
      expect(value).toBeUndefined();
    });

    it("should use default TTL when not specified", () => {
      cache.set("key1", "value1", 10);

      const keys = cache.keys();
      expect(keys).toContain("key1");
    });
  });

  describe("cleanExpired", () => {
    it("should remove expired entries", async () => {
      cache.set("key1", "value1", 10, 100);
      cache.set("key2", "value2", 10, 100);
      cache.set("key3", "value3", 10, 5000); // Won't expire

      await new Promise((resolve) => setTimeout(resolve, 150));

      const cleaned = cache.cleanExpired();

      expect(cleaned).toBe(2);
      expect(cache.has("key1")).toBe(false);
      expect(cache.has("key2")).toBe(false);
      expect(cache.has("key3")).toBe(true);
    });
  });

  describe("delete", () => {
    it("should delete entry", () => {
      cache.set("key1", "value1", 10);
      const deleted = cache.delete("key1");

      expect(deleted).toBe(true);
      expect(cache.has("key1")).toBe(false);
    });

    it("should update size when deleting", () => {
      cache.set("key1", "value1", 100);
      cache.delete("key1");

      expect(cache.getSize()).toBe(0);
    });

    it("should return false for non-existent key", () => {
      const deleted = cache.delete("nonexistent");
      expect(deleted).toBe(false);
    });
  });

  describe("clear", () => {
    it("should remove all entries", () => {
      cache.set("key1", "value1", 10);
      cache.set("key2", "value2", 10);

      cache.clear();

      expect(cache.getCount()).toBe(0);
      expect(cache.getSize()).toBe(0);
    });
  });

  describe("statistics", () => {
    it("should track hits and misses", () => {
      cache.set("key1", "value1", 10);

      cache.get("key1"); // hit
      cache.get("key2"); // miss

      const stats = cache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(0.5);
    });

    it("should track evictions", () => {
      cache.set("key1", "value1", 100);
      cache.set("key2", "value2", 100);
      cache.set("key3", "value3", 100);
      cache.set("key4", "value4", 100);
      cache.set("key5", "value5", 100);
      cache.set("key6", "value6", 100); // Triggers eviction

      const stats = cache.getStats();
      expect(stats.evictions).toBe(1);
    });

    it("should reset statistics", () => {
      cache.set("key1", "value1", 10);
      cache.get("key1");
      cache.get("key2");

      cache.resetStats();

      const stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });

  describe("getMostAccessed", () => {
    it("should return most frequently accessed entries", () => {
      cache.set("key1", "value1", 10);
      cache.set("key2", "value2", 10);
      cache.set("key3", "value3", 10);

      cache.get("key1");
      cache.get("key1");
      cache.get("key2");

      const mostAccessed = cache.getMostAccessed(2);
      expect(mostAccessed.length).toBe(2);
      expect(mostAccessed[0].key).toBe("key1");
      expect(mostAccessed[0].accessCount).toBe(3); // 1 from set + 2 from gets
    });
  });

  describe("getLRU", () => {
    it("should return least recently used entries", () => {
      cache.set("key1", "value1", 10);
      cache.set("key2", "value2", 10);
      cache.set("key3", "value3", 10);

      // Access key3 to make it most recently used
      cache.get("key3");

      const lru = cache.getLRU(2);
      expect(lru.length).toBe(2);
      expect(lru[0].key).toBe("key1");
    });
  });

  describe("events", () => {
    it("should emit set event", () => {
      const listener = jest.fn();
      cache.on("set", listener);

      cache.set("key1", "value1", 10);

      expect(listener).toHaveBeenCalled();
    });

    it("should emit evict event", () => {
      const listener = jest.fn();
      cache.on("evict", listener);

      // Fill cache to trigger eviction
      cache.set("key1", "value1", 100);
      cache.set("key2", "value2", 100);
      cache.set("key3", "value3", 100);
      cache.set("key4", "value4", 100);
      cache.set("key5", "value5", 100);
      cache.set("key6", "value6", 100);

      expect(listener).toHaveBeenCalled();
    });

    it("should emit delete event", () => {
      const listener = jest.fn();
      cache.on("delete", listener);

      cache.set("key1", "value1", 10);
      cache.delete("key1");

      expect(listener).toHaveBeenCalled();
    });
  });
});
