/**
 * Tests for AuthManager
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { AuthManager } from "../AuthManager.js";
import { AuthConfig } from "../types.js";

describe("AuthManager", () => {
  let authManager: AuthManager;
  let config: AuthConfig;

  beforeEach(() => {
    config = {
      defaultApiKey: "default-api-key-12345",
      enablePerRequestAuth: true,
      requireAuthentication: true,
      keyValidationCache: {
        enabled: true,
        maxSize: 100,
        ttlSeconds: 300,
        cleanupIntervalSeconds: 0,
      },
      rateLimiting: {
        enabled: true,
        requestsPerMinute: 60,
        burstLimit: 10,
        keyBasedLimiting: true,
      },
    };
    authManager = new AuthManager(config);
  });

  afterEach(() => {
    authManager.destroy();
  });

  describe("validateApiKey", () => {
    it("should validate API key with correct format", async () => {
      const apiKey = "test-api-key-12345";
      const result = await authManager.validateApiKey(apiKey);

      expect(result.isValid).toBe(true);
      expect(result.keyHash).toBeDefined();
      expect(result.errorMessage).toBeUndefined();
    });

    it("should reject API key with invalid format", async () => {
      const apiKey = "short";
      const result = await authManager.validateApiKey(apiKey);

      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toBe("Invalid API key format");
    });

    it("should cache validation results", async () => {
      const apiKey = "test-api-key-12345";

      const result1 = await authManager.validateApiKey(apiKey);
      const result2 = await authManager.validateApiKey(apiKey);

      expect(result1).toEqual(result2);
    });

    it("should enforce rate limiting", async () => {
      const limitedConfig: AuthConfig = {
        ...config,
        keyValidationCache: {
          enabled: false, // Disable cache to test rate limiting
          maxSize: 100,
          ttlSeconds: 300,
          cleanupIntervalSeconds: 0,
        },
        rateLimiting: {
          enabled: true,
          requestsPerMinute: 2,
          burstLimit: 2,
          keyBasedLimiting: true,
        },
      };
      const limitedManager = new AuthManager(limitedConfig);

      const apiKey = "test-api-key-12345";

      // First two requests should succeed
      const result1 = await limitedManager.validateApiKey(apiKey);
      expect(result1.isValid).toBe(true);

      const result2 = await limitedManager.validateApiKey(apiKey);
      expect(result2.isValid).toBe(true);

      // Third request should be rate limited
      const result3 = await limitedManager.validateApiKey(apiKey);
      expect(result3.isValid).toBe(false);
      expect(result3.errorMessage).toBe("Rate limit exceeded");

      limitedManager.destroy();
    });
  });

  describe("getEffectiveApiKey", () => {
    it("should return request key when provided", async () => {
      const requestKey = "request-api-key-12345";
      const effectiveKey = await authManager.getEffectiveApiKey(requestKey);

      expect(effectiveKey).toBe(requestKey);
    });

    it("should return default key when no request key provided", async () => {
      const effectiveKey = await authManager.getEffectiveApiKey();

      expect(effectiveKey).toBe("default-api-key-12345");
    });

    it("should throw error when no key available and authentication required", async () => {
      const noDefaultConfig: AuthConfig = {
        ...config,
        defaultApiKey: undefined,
      };
      const noDefaultManager = new AuthManager(noDefaultConfig);

      await expect(noDefaultManager.getEffectiveApiKey()).rejects.toThrow("API key is required");

      noDefaultManager.destroy();
    });
  });

  describe("authenticate", () => {
    it("should authenticate with valid request key", async () => {
      const requestKey = "test-api-key-12345";
      const result = await authManager.authenticate(requestKey);

      expect(result.success).toBe(true);
      expect(result.usedFallback).toBe(false);
      expect(result.keyHash).toBeDefined();
      expect(result.authTime).toBeGreaterThanOrEqual(0);
    });

    it("should authenticate with fallback key", async () => {
      const result = await authManager.authenticate();

      expect(result.success).toBe(true);
      expect(result.usedFallback).toBe(true);
      expect(result.keyHash).toBeDefined();
    });

    it("should fail authentication with invalid key", async () => {
      const invalidKey = "bad";
      const result = await authManager.authenticate(invalidKey);

      expect(result.success).toBe(false);
      expect(result.errorMessage).toBeDefined();
    });

    it("should track authentication time", async () => {
      const result = await authManager.authenticate("test-api-key-12345");

      expect(result.authTime).toBeGreaterThanOrEqual(0);
      expect(result.authTime).toBeLessThan(1000); // Should be fast
    });
  });

  describe("sanitizeApiKey", () => {
    it("should sanitize API key for logging", () => {
      const apiKey = "test-api-key-12345678";
      const sanitized = authManager.sanitizeApiKey(apiKey);

      expect(sanitized).toBe("test...5678");
      expect(sanitized).not.toContain("api-key");
    });
  });

  describe("isRateLimited", () => {
    it("should check if key is rate limited", async () => {
      const apiKey = "test-api-key-12345";

      const isLimited = authManager.isRateLimited(apiKey);
      expect(isLimited).toBe(false);
    });
  });

  describe("invalidateKey", () => {
    it("should invalidate cached key", async () => {
      const apiKey = "test-api-key-12345";

      // Validate and cache
      await authManager.validateApiKey(apiKey);

      // Invalidate
      authManager.invalidateKey(apiKey);

      // Should validate again (not from cache)
      const result = await authManager.validateApiKey(apiKey);
      expect(result.isValid).toBe(true);
    });
  });

  describe("getCacheStats", () => {
    it("should return cache statistics", async () => {
      await authManager.validateApiKey("test-api-key-1-12345");
      await authManager.validateApiKey("test-api-key-2-12345");

      const stats = authManager.getCacheStats();

      expect(stats.size).toBeGreaterThanOrEqual(0);
      expect(stats.maxSize).toBe(100);
    });
  });

  describe("getRateLimitStatus", () => {
    it("should return rate limit status for key", () => {
      const apiKey = "test-api-key-12345";
      const status = authManager.getRateLimitStatus(apiKey);

      expect(status.allowed).toBe(true);
      expect(status.remaining).toBeGreaterThan(0);
      expect(status.resetTime).toBeInstanceOf(Date);
    });
  });
});
