/**
 * Tests for LighthouseServiceFactory
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { LighthouseServiceFactory } from "../LighthouseServiceFactory.js";
import { PerformanceConfig } from "../types.js";

describe("LighthouseServiceFactory", () => {
  let factory: LighthouseServiceFactory;
  let config: PerformanceConfig;

  beforeEach(() => {
    config = {
      servicePoolSize: 5,
      serviceTimeoutMinutes: 30,
      concurrentRequestLimit: 10,
    };
    factory = new LighthouseServiceFactory(config);
  });

  afterEach(() => {
    factory.destroy();
  });

  describe("createService", () => {
    it("should create a new service instance", async () => {
      const apiKey = "test-api-key-123";
      const service = await factory.createService(apiKey);

      expect(service).toBeDefined();
      expect(service.uploadFile).toBeDefined();
      expect(service.fetchFile).toBeDefined();
    });
  });

  describe("getService", () => {
    it("should return cached service for same API key", async () => {
      const apiKey = "test-api-key-123";

      const service1 = await factory.getService(apiKey);
      const service2 = await factory.getService(apiKey);

      expect(service1).toBe(service2);
    });

    it("should create different services for different API keys", async () => {
      const key1 = "test-api-key-1";
      const key2 = "test-api-key-2";

      const service1 = await factory.getService(key1);
      const service2 = await factory.getService(key2);

      expect(service1).not.toBe(service2);
    });

    it("should evict oldest service when pool is full", async () => {
      const smallFactory = new LighthouseServiceFactory({
        ...config,
        servicePoolSize: 2,
      });

      const key1 = "key-1";
      const key2 = "key-2";
      const key3 = "key-3";

      const service1 = await smallFactory.getService(key1);
      await smallFactory.getService(key2);

      // Adding third service should evict first
      await smallFactory.getService(key3);

      // Getting key1 again should create new instance
      const service1Again = await smallFactory.getService(key1);
      expect(service1Again).not.toBe(service1);

      smallFactory.destroy();
    });
  });

  describe("removeService", () => {
    it("should remove service from pool", async () => {
      const apiKey = "test-api-key";

      const service1 = await factory.getService(apiKey);
      factory.removeService(apiKey);

      const service2 = await factory.getService(apiKey);
      expect(service2).not.toBe(service1);
    });
  });

  describe("clear", () => {
    it("should clear all services from pool", async () => {
      await factory.getService("key1");
      await factory.getService("key2");

      const statsBefore = factory.getStats();
      expect(statsBefore.size).toBe(2);

      factory.clear();

      const statsAfter = factory.getStats();
      expect(statsAfter.size).toBe(0);
    });
  });

  describe("getStats", () => {
    it("should return pool statistics", async () => {
      await factory.getService("key1");
      await factory.getService("key2");

      const stats = factory.getStats();

      expect(stats.size).toBe(2);
      expect(stats.maxSize).toBe(5);
      expect(stats.oldestServiceAge).toBeGreaterThanOrEqual(0);
    });

    it("should track oldest service age", async () => {
      await factory.getService("key1");
      await new Promise((resolve) => setTimeout(resolve, 50));
      await factory.getService("key2");

      const stats = factory.getStats();
      expect(stats.oldestServiceAge).toBeGreaterThanOrEqual(50);
    });
  });
});
