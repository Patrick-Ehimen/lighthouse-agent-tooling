/**
 * Integration test for real Lighthouse service with MCP server
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { LighthouseMCPServer } from "../server.js";
import { Logger } from "@lighthouse-tooling/shared";

describe("Lighthouse MCP Server Integration", () => {
  let server: LighthouseMCPServer;
  let logger: Logger;

  beforeEach(() => {
    logger = Logger.getInstance({ level: "error", component: "IntegrationTest" });

    // Use mock API key for testing
    const config = {
      lighthouseApiKey: "test-api-key-12345",
      logLevel: "error" as const,
    };

    server = new LighthouseMCPServer(config);
  });

  afterEach(async () => {
    if (server) {
      await server.stop();
    }
  });

  it("should create server with real Lighthouse service", () => {
    expect(server).toBeDefined();
    expect(server.getLighthouseService()).toBeDefined();
    expect(server.getDatasetService()).toBeDefined();
  });

  it("should register all MCP tools", async () => {
    await server.registerTools();

    const registry = server.getRegistry();
    const tools = registry.listTools();

    expect(tools).toHaveLength(5);
    expect(tools.map((t) => t.name)).toContain("lighthouse_upload_file");
    expect(tools.map((t) => t.name)).toContain("lighthouse_create_dataset");
    expect(tools.map((t) => t.name)).toContain("lighthouse_fetch_file");
    expect(tools.map((t) => t.name)).toContain("lighthouse_generate_key");
    expect(tools.map((t) => t.name)).toContain("lighthouse_setup_access_control");
  });

  it("should get server stats", async () => {
    await server.registerTools();

    const stats = server.getStats();

    expect(stats).toHaveProperty("registry");
    expect(stats).toHaveProperty("storage");
    expect(stats).toHaveProperty("datasets");
    expect(stats.registry.totalTools).toBe(5);
  });

  it("should handle missing API key", () => {
    expect(() => {
      new LighthouseMCPServer({ lighthouseApiKey: undefined });
    }).toThrow("LIGHTHOUSE_API_KEY environment variable is required");
  });
});
