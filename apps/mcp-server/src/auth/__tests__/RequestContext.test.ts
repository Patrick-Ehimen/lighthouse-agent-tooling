/**
 * Tests for RequestContext
 */

import { describe, it, expect, beforeEach } from "vitest";
import { RequestContext } from "../RequestContext.js";
import { ILighthouseService } from "../../services/ILighthouseService.js";
import { MockLighthouseService } from "../../services/MockLighthouseService.js";

describe("RequestContext", () => {
  let mockService: ILighthouseService;

  beforeEach(() => {
    mockService = new MockLighthouseService();
  });

  describe("constructor", () => {
    it("should create request context with all properties", () => {
      const context = new RequestContext({
        apiKey: "test-api-key",
        keyHash: "test-hash",
        service: mockService,
        toolName: "test-tool",
      });

      expect(context.apiKey).toBe("test-api-key");
      expect(context.keyHash).toBe("test-hash");
      expect(context.service).toBe(mockService);
      expect(context.toolName).toBe("test-tool");
      expect(context.requestId).toBeDefined();
      expect(context.timestamp).toBeInstanceOf(Date);
    });

    it("should generate unique request IDs", () => {
      const context1 = new RequestContext({
        apiKey: "test-api-key",
        keyHash: "test-hash",
        service: mockService,
        toolName: "test-tool",
      });

      const context2 = new RequestContext({
        apiKey: "test-api-key",
        keyHash: "test-hash",
        service: mockService,
        toolName: "test-tool",
      });

      expect(context1.requestId).not.toBe(context2.requestId);
    });
  });

  describe("toLogContext", () => {
    it("should return sanitized log context", () => {
      const context = new RequestContext({
        apiKey: "test-api-key-secret",
        keyHash: "test-hash",
        service: mockService,
        toolName: "test-tool",
      });

      const logContext = context.toLogContext();

      expect(logContext.requestId).toBe(context.requestId);
      expect(logContext.keyHash).toBe("test-hash");
      expect(logContext.toolName).toBe("test-tool");
      expect(logContext.timestamp).toBe(context.timestamp.toISOString());
      expect(logContext).not.toHaveProperty("apiKey");
    });
  });

  describe("getAge", () => {
    it("should return request age in milliseconds", async () => {
      const context = new RequestContext({
        apiKey: "test-api-key",
        keyHash: "test-hash",
        service: mockService,
        toolName: "test-tool",
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const age = context.getAge();
      expect(age).toBeGreaterThanOrEqual(50);
    });
  });

  describe("isExpired", () => {
    it("should return false for non-expired requests", () => {
      const context = new RequestContext({
        apiKey: "test-api-key",
        keyHash: "test-hash",
        service: mockService,
        toolName: "test-tool",
      });

      const isExpired = context.isExpired(10000); // 10 seconds
      expect(isExpired).toBe(false);
    });

    it("should return true for expired requests", async () => {
      const context = new RequestContext({
        apiKey: "test-api-key",
        keyHash: "test-hash",
        service: mockService,
        toolName: "test-tool",
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      const isExpired = context.isExpired(50); // 50ms timeout
      expect(isExpired).toBe(true);
    });
  });
});
