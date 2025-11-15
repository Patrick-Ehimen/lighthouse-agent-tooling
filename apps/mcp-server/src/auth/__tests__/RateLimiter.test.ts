/**
 * Tests for RateLimiter
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { RateLimiter } from "../RateLimiter.js";
import { RateLimitConfig } from "../types.js";

describe("RateLimiter", () => {
  let rateLimiter: RateLimiter;
  let config: RateLimitConfig;

  beforeEach(() => {
    config = {
      enabled: true,
      requestsPerMinute: 10,
      burstLimit: 5,
      keyBasedLimiting: true,
    };
    rateLimiter = new RateLimiter(config);
  });

  afterEach(() => {
    rateLimiter.destroy();
  });

  describe("isAllowed", () => {
    it("should allow requests within rate limit", () => {
      const keyHash = "test-key-hash";

      for (let i = 0; i < 5; i++) {
        const result = rateLimiter.isAllowed(keyHash);
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBeGreaterThan(0);
      }
    });

    it("should block requests exceeding rate limit", () => {
      const keyHash = "test-key-hash";

      // Make requests up to the limit
      for (let i = 0; i < 10; i++) {
        rateLimiter.isAllowed(keyHash);
      }

      // Next request should be blocked
      const result = rateLimiter.isAllowed(keyHash);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it("should allow unlimited requests when disabled", () => {
      const disabledLimiter = new RateLimiter({ ...config, enabled: false });
      const keyHash = "test-key-hash";

      for (let i = 0; i < 100; i++) {
        const result = disabledLimiter.isAllowed(keyHash);
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(Infinity);
      }

      disabledLimiter.destroy();
    });

    it("should track different keys independently", () => {
      const key1 = "key-hash-1";
      const key2 = "key-hash-2";

      // Use up key1's limit
      for (let i = 0; i < 10; i++) {
        rateLimiter.isAllowed(key1);
      }

      // key1 should be blocked
      expect(rateLimiter.isAllowed(key1).allowed).toBe(false);

      // key2 should still be allowed
      expect(rateLimiter.isAllowed(key2).allowed).toBe(true);
    });
  });

  describe("recordRequest", () => {
    it("should record requests for a key", () => {
      const keyHash = "test-key-hash";

      rateLimiter.recordRequest(keyHash);
      rateLimiter.recordRequest(keyHash);

      const status = rateLimiter.getStatus(keyHash);
      expect(status.remaining).toBe(8); // 10 - 2
    });
  });

  describe("getStatus", () => {
    it("should return current rate limit status", () => {
      const keyHash = "test-key-hash";

      rateLimiter.recordRequest(keyHash);
      rateLimiter.recordRequest(keyHash);

      const status = rateLimiter.getStatus(keyHash);

      expect(status.allowed).toBe(true);
      expect(status.remaining).toBe(8);
      expect(status.resetTime).toBeInstanceOf(Date);
    });

    it("should return full limit for new keys", () => {
      const keyHash = "new-key-hash";
      const status = rateLimiter.getStatus(keyHash);

      expect(status.allowed).toBe(true);
      expect(status.remaining).toBe(10);
    });
  });

  describe("reset", () => {
    it("should reset rate limit for a specific key", () => {
      const keyHash = "test-key-hash";

      // Use up some requests
      for (let i = 0; i < 5; i++) {
        rateLimiter.recordRequest(keyHash);
      }

      expect(rateLimiter.getStatus(keyHash).remaining).toBe(5);

      // Reset
      rateLimiter.reset(keyHash);

      expect(rateLimiter.getStatus(keyHash).remaining).toBe(10);
    });
  });

  describe("clear", () => {
    it("should clear all rate limit data", () => {
      rateLimiter.recordRequest("key1");
      rateLimiter.recordRequest("key2");

      rateLimiter.clear();

      expect(rateLimiter.getStatus("key1").remaining).toBe(10);
      expect(rateLimiter.getStatus("key2").remaining).toBe(10);
    });
  });

  describe("sliding window", () => {
    it("should provide retry information when rate limited", async () => {
      const keyHash = "test-key-hash";

      // Use up the limit
      for (let i = 0; i < 10; i++) {
        rateLimiter.isAllowed(keyHash);
      }

      const result = rateLimiter.isAllowed(keyHash);
      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBeDefined();
      expect(result.retryAfter).toBeGreaterThan(0);
    });
  });
});
