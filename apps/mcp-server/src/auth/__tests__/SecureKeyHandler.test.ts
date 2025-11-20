/**
 * Tests for SecureKeyHandler
 */

import { describe, it, expect } from "vitest";
import { SecureKeyHandler } from "../SecureKeyHandler.js";

describe("SecureKeyHandler", () => {
  describe("hashKey", () => {
    it("should hash API key consistently", () => {
      const apiKey = "test-api-key-12345";
      const hash1 = SecureKeyHandler.hashKey(apiKey);
      const hash2 = SecureKeyHandler.hashKey(apiKey);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(16);
    });

    it("should produce different hashes for different keys", () => {
      const key1 = "test-api-key-1";
      const key2 = "test-api-key-2";

      const hash1 = SecureKeyHandler.hashKey(key1);
      const hash2 = SecureKeyHandler.hashKey(key2);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe("sanitizeForLogs", () => {
    it("should sanitize long API keys", () => {
      const apiKey = "test-api-key-12345678";
      const sanitized = SecureKeyHandler.sanitizeForLogs(apiKey);

      expect(sanitized).toBe("test...5678");
      expect(sanitized).not.toContain("api-key");
    });

    it("should redact short API keys", () => {
      const apiKey = "short";
      const sanitized = SecureKeyHandler.sanitizeForLogs(apiKey);

      expect(sanitized).toBe("[REDACTED]");
    });

    it("should handle empty strings", () => {
      const sanitized = SecureKeyHandler.sanitizeForLogs("");

      expect(sanitized).toBe("[REDACTED]");
    });
  });

  describe("secureCompare", () => {
    it("should return true for identical strings", () => {
      const str = "test-string";
      const result = SecureKeyHandler.secureCompare(str, str);

      expect(result).toBe(true);
    });

    it("should return false for different strings", () => {
      const str1 = "test-string-1";
      const str2 = "test-string-2";
      const result = SecureKeyHandler.secureCompare(str1, str2);

      expect(result).toBe(false);
    });

    it("should return false for strings of different lengths", () => {
      const str1 = "short";
      const str2 = "longer-string";
      const result = SecureKeyHandler.secureCompare(str1, str2);

      expect(result).toBe(false);
    });

    it("should handle empty strings", () => {
      const result = SecureKeyHandler.secureCompare("", "");

      expect(result).toBe(false);
    });
  });

  describe("clearFromMemory", () => {
    it("should clear specified keys from object", () => {
      const obj = {
        apiKey: "secret-key",
        username: "user",
        password: "pass",
      };

      SecureKeyHandler.clearFromMemory(obj, ["apiKey", "password"]);

      expect(obj.apiKey).toBeUndefined();
      expect(obj.password).toBeUndefined();
      expect(obj.username).toBe("user");
    });

    it("should handle non-existent keys gracefully", () => {
      const obj = { username: "user" };

      expect(() => {
        SecureKeyHandler.clearFromMemory(obj, ["apiKey", "password"]);
      }).not.toThrow();
    });
  });

  describe("isValidFormat", () => {
    it("should accept valid API keys", () => {
      const validKey = "valid-api-key-12345";
      const result = SecureKeyHandler.isValidFormat(validKey);

      expect(result).toBe(true);
    });

    it("should reject keys that are too short", () => {
      const shortKey = "short";
      const result = SecureKeyHandler.isValidFormat(shortKey);

      expect(result).toBe(false);
    });

    it("should reject keys that are too long", () => {
      const longKey = "a".repeat(300);
      const result = SecureKeyHandler.isValidFormat(longKey);

      expect(result).toBe(false);
    });

    it("should reject empty strings", () => {
      const result = SecureKeyHandler.isValidFormat("");

      expect(result).toBe(false);
    });

    it("should reject non-string values", () => {
      const result = SecureKeyHandler.isValidFormat(null as any);

      expect(result).toBe(false);
    });
  });
});
