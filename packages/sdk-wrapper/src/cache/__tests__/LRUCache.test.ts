/**
 * Tests for LRU Cache implementation
 */

import { LRUCache } from "../LRUCache";

describe("LRUCache", () => {
  describe("Basic operations", () => {
    it("should store and retrieve values", () => {
      const cache = new LRUCache<string>({ maxSize: 3 });

      cache.set("key1", "value1");
      cache.set("key2", "value2");

      expect(cache.get("key1")).toBe("value1");
      expect(cache.get("key2")).toBe("value2");
      expect(cache.size).toBe(2);
    });

    it("should return undefined for missing keys", () => {
      const cache = new LRUCache<string>({ maxSize: 3 });

      expect(cache.get("nonexistent")).toBeUndefined();
    });

    it("should check if key exists", () => {
      const cache = new LRUCache<string>({ maxSize: 3 });

      cache.set("key1", "value1");

      expect(cache.has("key1")).toBe(true);
      expect(cache.has("key2")).toBe(false);
    });

    it("should delete keys", () => {
      const cache = new LRUCache<string>({ maxSize: 3 });

      cache.set("key1", "value1");
      expect(cache.has("key1")).toBe(true);

      cache.delete("key1");
      expect(cache.has("key1")).toBe(false);
      expect(cache.size).toBe(0);
    });

    it("should clear all entries", () => {
      const cache = new LRUCache<string>({ maxSize: 3 });

      cache.set("key1", "value1");
      cache.set("key2", "value2");
      cache.set("key3", "value3");

      expect(cache.size).toBe(3);

      cache.clear();

      expect(cache.size).toBe(0);
      expect(cache.get("key1")).toBeUndefined();
    });
  });

  describe("LRU eviction", () => {
    it("should evict least recently used item when max size reached", () => {
      const cache = new LRUCache<string>({ maxSize: 3 });

      cache.set("key1", "value1");
      cache.set("key2", "value2");
      cache.set("key3", "value3");

      // All should be present
      expect(cache.size).toBe(3);

      // Adding a 4th item should evict key1
      cache.set("key4", "value4");

      expect(cache.size).toBe(3);
      expect(cache.get("key1")).toBeUndefined();
      expect(cache.get("key2")).toBe("value2");
      expect(cache.get("key3")).toBe("value3");
      expect(cache.get("key4")).toBe("value4");
    });

    it("should update LRU order on get", () => {
      const cache = new LRUCache<string>({ maxSize: 3 });

      cache.set("key1", "value1");
      cache.set("key2", "value2");
      cache.set("key3", "value3");

      // Access key1, making it most recently used
      cache.get("key1");

      // Add key4, should evict key2 (least recently used)
      cache.set("key4", "value4");

      expect(cache.get("key1")).toBe("value1");
      expect(cache.get("key2")).toBeUndefined();
      expect(cache.get("key3")).toBe("value3");
      expect(cache.get("key4")).toBe("value4");
    });

    it("should call onEvict callback", () => {
      const evicted: Array<{ key: string; value: string }> = [];
      const cache = new LRUCache<string>({
        maxSize: 2,
        onEvict: (key, value) => {
          evicted.push({ key, value });
        },
      });

      cache.set("key1", "value1");
      cache.set("key2", "value2");
      cache.set("key3", "value3");

      expect(evicted).toHaveLength(1);
      expect(evicted[0]).toEqual({ key: "key1", value: "value1" });
    });
  });

  describe("TTL (Time To Live)", () => {
    it("should expire entries after TTL", async () => {
      const cache = new LRUCache<string>({
        maxSize: 3,
        ttl: 100, // 100ms
      });

      cache.set("key1", "value1");

      expect(cache.get("key1")).toBe("value1");

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(cache.get("key1")).toBeUndefined();
    });

    it("should clean up expired entries", async () => {
      const cache = new LRUCache<string>({
        maxSize: 5,
        ttl: 50,
      });

      cache.set("key1", "value1");
      cache.set("key2", "value2");
      cache.set("key3", "value3");

      expect(cache.size).toBe(3);

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 100));

      const removed = cache.cleanup();

      expect(removed).toBe(3);
      expect(cache.size).toBe(0);
    });
  });

  describe("Statistics", () => {
    it("should track hits and misses", () => {
      const cache = new LRUCache<string>({ maxSize: 3 });

      cache.set("key1", "value1");

      cache.get("key1"); // hit
      cache.get("key1"); // hit
      cache.get("key2"); // miss
      cache.get("key3"); // miss

      const stats = cache.getStats();

      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(2);
      expect(stats.hitRate).toBe(0.5);
    });

    it("should track evictions", () => {
      const cache = new LRUCache<string>({ maxSize: 2 });

      cache.set("key1", "value1");
      cache.set("key2", "value2");
      cache.set("key3", "value3"); // evicts key1
      cache.set("key4", "value4"); // evicts key2

      const stats = cache.getStats();

      expect(stats.evictions).toBe(2);
      expect(stats.size).toBe(2);
      expect(stats.maxSize).toBe(2);
    });
  });

  describe("Iteration", () => {
    it("should return all keys", () => {
      const cache = new LRUCache<string>({ maxSize: 5 });

      cache.set("key1", "value1");
      cache.set("key2", "value2");
      cache.set("key3", "value3");

      const keys = cache.keys();

      expect(keys).toHaveLength(3);
      expect(keys).toContain("key1");
      expect(keys).toContain("key2");
      expect(keys).toContain("key3");
    });

    it("should return all values", () => {
      const cache = new LRUCache<string>({ maxSize: 5 });

      cache.set("key1", "value1");
      cache.set("key2", "value2");
      cache.set("key3", "value3");

      const values = cache.values();

      expect(values).toHaveLength(3);
      expect(values).toContain("value1");
      expect(values).toContain("value2");
      expect(values).toContain("value3");
    });

    it("should iterate with forEach", () => {
      const cache = new LRUCache<string>({ maxSize: 5 });

      cache.set("key1", "value1");
      cache.set("key2", "value2");

      const entries: Array<{ key: string; value: string }> = [];

      cache.forEach((value, key) => {
        entries.push({ key, value });
      });

      expect(entries).toHaveLength(2);
      expect(entries).toContainEqual({ key: "key1", value: "value1" });
      expect(entries).toContainEqual({ key: "key2", value: "value2" });
    });
  });

  describe("Edge cases", () => {
    it("should handle maxSize of 1", () => {
      const cache = new LRUCache<string>({ maxSize: 1 });

      cache.set("key1", "value1");
      expect(cache.get("key1")).toBe("value1");

      cache.set("key2", "value2");
      expect(cache.get("key1")).toBeUndefined();
      expect(cache.get("key2")).toBe("value2");
    });

    it("should handle updating existing keys", () => {
      const cache = new LRUCache<string>({ maxSize: 3 });

      cache.set("key1", "value1");
      cache.set("key1", "value2");

      expect(cache.get("key1")).toBe("value2");
      expect(cache.size).toBe(1);
    });

    it("should handle complex objects", () => {
      interface TestObject {
        id: number;
        data: string;
      }

      const cache = new LRUCache<TestObject>({ maxSize: 3 });

      const obj1 = { id: 1, data: "test1" };
      const obj2 = { id: 2, data: "test2" };

      cache.set("obj1", obj1);
      cache.set("obj2", obj2);

      expect(cache.get("obj1")).toEqual(obj1);
      expect(cache.get("obj2")).toEqual(obj2);
    });
  });
});
