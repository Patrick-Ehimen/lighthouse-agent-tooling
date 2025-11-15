/**
 * Tests for KeyValidationCache
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { KeyValidationCache } from "../KeyValidationCache.js";
import { CacheConfig, ValidationResult } from "../types.js";

describe("KeyValidationCache", () => {
  let cache: KeyValidationCache;
  let config: CacheConfig;

  beforeEach(() => {
    config = {
      enabled: true,
      maxSize: 10,
      ttlSeconds: 60,
      cleanupIntervalSeconds: 0, // Disable auto-cleanup for tests
    };
    cache = new KeyValidationCache(config);
  });

  afterEach(() => {
    cache.destroy();
  });

  describe("get and set", () => {
    it("should store and retrieve validation results", () => {
      const keyHash = "test-hash-123";
      const result: ValidationResult = {
        isValid: true,
        keyHash,
      };

      cache.set(keyHash, result);
      const retrieved = cache.get(keyHash);

      expect(retrieved).toEqual(result);
    });

    it("should return null for non-existent keys", () => {
      const retrieved = cache.get("non-existent");

      expect(retrieved).toBeNull();
    });

    it("should return null when cache is disabled", () => {
      const disabledCache = new KeyValidationCache({ ...config, enabled: false });
      const keyHash = "test-hash";
      const result: ValidationResult = { isValid: true, keyHash };

      disabledCache.set(keyHash, result);
      const retrieved = disabledCache.get(keyHash);

      expect(retrieved).toBeNull();
      disabledCache.destroy();
    });
  });

  describe("TTL expiration", () => {
    it("should expire entries after TTL", async () => {
      const shortTTLConfig: CacheConfig = {
        ...config,
        ttlSeconds: 0.1, // 100ms
      };
      const shortCache = new KeyValidationCache(shortTTLConfig);

      const keyHash = "test-hash";
      const result: ValidationResult = { isValid: true, keyHash };

      shortCache.set(keyHash, result);

      // Should be available immediately
      expect(shortCache.get(keyHash)).toEqual(result);

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Should be expired
      expect(shortCache.get(keyHash)).toBeNull();

      shortCache.destroy();
    });
  });

  describe("LRU eviction", () => {
    it("should evict least recently used entry when cache is full", () => {
      const smallCache = new KeyValidationCache({ ...config, maxSize: 3 });

      // Fill cache
      smallCache.set("key1", { isValid: true, keyHash: "key1" });
      smallCache.set("key2", { isValid: true, keyHash: "key2" });
      smallCache.set("key3", { isValid: true, keyHash: "key3" });

      // Access key2 to make it more recently used
      smallCache.get("key2");

      // Add new entry, should evict key1 (least recently used)
      smallCache.set("key4", { isValid: true, keyHash: "key4" });

      expect(smallCache.get("key1")).toBeNull();
      expect(smallCache.get("key2")).not.toBeNull();
      expect(smallCache.get("key3")).not.toBeNull();
      expect(smallCache.get("key4")).not.toBeNull();

      smallCache.destroy();
    });
  });

  describe("invalidate", () => {
    it("should remove specific key from cache", () => {
      const keyHash = "test-hash";
      const result: ValidationResult = { isValid: true, keyHash };

      cache.set(keyHash, result);
      expect(cache.get(keyHash)).toEqual(result);

      cache.invalidate(keyHash);
      expect(cache.get(keyHash)).toBeNull();
    });
  });

  describe("clear", () => {
    it("should remove all entries from cache", () => {
      cache.set("key1", { isValid: true, keyHash: "key1" });
      cache.set("key2", { isValid: true, keyHash: "key2" });

      cache.clear();

      expect(cache.get("key1")).toBeNull();
      expect(cache.get("key2")).toBeNull();
    });
  });

  describe("getStats", () => {
    it("should return cache statistics", () => {
      cache.set("key1", { isValid: true, keyHash: "key1" });
      cache.set("key2", { isValid: true, keyHash: "key2" });

      const stats = cache.getStats();

      expect(stats.size).toBe(2);
      expect(stats.maxSize).toBe(10);
    });
  });
});
