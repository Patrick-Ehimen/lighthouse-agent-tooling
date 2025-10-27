/**
 * EnvLoader unit tests
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { EnvLoader } from "../../config/env-loader.js";

describe("EnvLoader", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe("parseConfig", () => {
    it("should parse SERVER_NAME from environment", () => {
      process.env.SERVER_NAME = "custom-server";
      const config = EnvLoader.parseConfig();

      expect(config.name).toBe("custom-server");
    });

    it("should parse SERVER_VERSION from environment", () => {
      process.env.SERVER_VERSION = "2.0.0";
      const config = EnvLoader.parseConfig();

      expect(config.version).toBe("2.0.0");
    });

    it("should parse LOG_LEVEL from environment", () => {
      process.env.LOG_LEVEL = "debug";
      const config = EnvLoader.parseConfig();

      expect(config.logLevel).toBe("debug");
    });

    it("should ignore invalid LOG_LEVEL", () => {
      process.env.LOG_LEVEL = "invalid";
      const config = EnvLoader.parseConfig();

      expect(config.logLevel).toBeUndefined();
    });

    it("should parse MAX_STORAGE_SIZE from environment", () => {
      process.env.MAX_STORAGE_SIZE = "2147483648";
      const config = EnvLoader.parseConfig();

      expect(config.maxStorageSize).toBe(2147483648);
    });

    it("should ignore invalid MAX_STORAGE_SIZE", () => {
      process.env.MAX_STORAGE_SIZE = "not-a-number";
      const config = EnvLoader.parseConfig();

      expect(config.maxStorageSize).toBeUndefined();
    });

    it("should parse ENABLE_METRICS from environment", () => {
      process.env.ENABLE_METRICS = "false";
      const config = EnvLoader.parseConfig();

      expect(config.enableMetrics).toBe(false);
    });

    it("should parse METRICS_INTERVAL from environment", () => {
      process.env.METRICS_INTERVAL = "30000";
      const config = EnvLoader.parseConfig();

      expect(config.metricsInterval).toBe(30000);
    });

    it("should return empty config when no env vars set", () => {
      // Clear all relevant env vars
      delete process.env.SERVER_NAME;
      delete process.env.LOG_LEVEL;
      delete process.env.MAX_STORAGE_SIZE;

      const config = EnvLoader.parseConfig();

      expect(config).toEqual({});
    });
  });

  describe("get", () => {
    it("should get environment variable", () => {
      process.env.TEST_VAR = "test-value";
      const value = EnvLoader.get("TEST_VAR");

      expect(value).toBe("test-value");
    });

    it("should return default when variable not set", () => {
      const value = EnvLoader.get("NONEXISTENT_VAR", "default");

      expect(value).toBe("default");
    });

    it("should return undefined when no default provided", () => {
      const value = EnvLoader.get("NONEXISTENT_VAR");

      expect(value).toBeUndefined();
    });
  });

  describe("getBoolean", () => {
    it("should parse true value", () => {
      process.env.BOOL_VAR = "true";
      const value = EnvLoader.getBoolean("BOOL_VAR");

      expect(value).toBe(true);
    });

    it("should parse false value", () => {
      process.env.BOOL_VAR = "false";
      const value = EnvLoader.getBoolean("BOOL_VAR");

      expect(value).toBe(false);
    });

    it("should return default when not set", () => {
      const value = EnvLoader.getBoolean("NONEXISTENT_BOOL", true);

      expect(value).toBe(true);
    });

    it("should be case insensitive", () => {
      process.env.BOOL_VAR = "TRUE";
      const value = EnvLoader.getBoolean("BOOL_VAR");

      expect(value).toBe(true);
    });
  });

  describe("getNumber", () => {
    it("should parse number value", () => {
      process.env.NUM_VAR = "42";
      const value = EnvLoader.getNumber("NUM_VAR");

      expect(value).toBe(42);
    });

    it("should return default when not set", () => {
      const value = EnvLoader.getNumber("NONEXISTENT_NUM", 100);

      expect(value).toBe(100);
    });

    it("should return default for invalid number", () => {
      process.env.NUM_VAR = "not-a-number";
      const value = EnvLoader.getNumber("NUM_VAR", 50);

      expect(value).toBe(50);
    });
  });

  describe("validateRequired", () => {
    it("should pass when all required vars are set", () => {
      process.env.REQUIRED_VAR_1 = "value1";
      process.env.REQUIRED_VAR_2 = "value2";

      expect(() => {
        EnvLoader.validateRequired(["REQUIRED_VAR_1", "REQUIRED_VAR_2"]);
      }).not.toThrow();
    });

    it("should throw when required vars are missing", () => {
      delete process.env.REQUIRED_VAR_1;

      expect(() => {
        EnvLoader.validateRequired(["REQUIRED_VAR_1"]);
      }).toThrow("Missing required environment variables");
    });
  });
});
