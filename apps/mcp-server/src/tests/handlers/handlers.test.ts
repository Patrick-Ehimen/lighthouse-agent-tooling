/**
 * Handler unit tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import { ToolRegistry } from "../../registry/ToolRegistry.js";
import { MockLighthouseService } from "../../services/MockLighthouseService.js";
import { MockDatasetService } from "../../services/MockDatasetService.js";
import { ListToolsHandler } from "../../handlers/ListToolsHandler.js";
import { CallToolHandler } from "../../handlers/CallToolHandler.js";
import { ListResourcesHandler } from "../../handlers/ListResourcesHandler.js";
import { InitializeHandler } from "../../handlers/InitializeHandler.js";
import { LIGHTHOUSE_MCP_TOOLS, ExecutionTimeCategory } from "@lighthouse-tooling/types";

describe("Handlers", () => {
  let registry: ToolRegistry;
  let lighthouseService: MockLighthouseService;
  let datasetService: MockDatasetService;

  beforeEach(() => {
    registry = new ToolRegistry();
    lighthouseService = new MockLighthouseService();
    datasetService = new MockDatasetService(lighthouseService);

    // Register a test tool
    registry.register(
      {
        name: "test_tool",
        description: "Test tool",
        inputSchema: {
          type: "object",
          properties: {
            param: { type: "string", description: "Test parameter" },
          },
          required: ["param"],
        },
        executionTime: ExecutionTimeCategory.FAST,
      },
      async (args) => ({
        success: true,
        data: { result: `Test: ${args.param}` },
        executionTime: 0,
      }),
    );
  });

  describe("ListToolsHandler", () => {
    it("should return list of tools", async () => {
      const handler = new ListToolsHandler(registry);
      const response = await handler.handle("test-req-1");

      expect(response.jsonrpc).toBe("2.0");
      expect(response.id).toBe("test-req-1");
      expect(response.result).toBeDefined();
      expect(response.result?.tools).toHaveLength(1);
      expect(response.result?.tools?.[0].name).toBe("test_tool");
    });

    it("should handle errors gracefully", async () => {
      const badRegistry = null as any;
      const handler = new ListToolsHandler(badRegistry);
      const response = await handler.handle("test-req-2");

      expect(response.error).toBeDefined();
    });
  });

  describe("CallToolHandler", () => {
    it("should execute tool successfully", async () => {
      const handler = new CallToolHandler(registry);
      const response = await handler.handle("test-req-1", "test_tool", { param: "value" });

      expect(response.jsonrpc).toBe("2.0");
      expect(response.id).toBe("test-req-1");
      expect(response.result).toBeDefined();
    });

    it("should return error for non-existent tool", async () => {
      const handler = new CallToolHandler(registry);
      const response = await handler.handle("test-req-2", "nonexistent_tool", {});

      expect(response.jsonrpc).toBe("2.0");
      expect(response.error).toBeDefined();
      expect(response.error?.message).toContain("not found");
    });

    it("should validate tool arguments", async () => {
      const handler = new CallToolHandler(registry);
      const response = await handler.handle("test-req-3", "test_tool", {}); // Missing required param

      expect(response.error).toBeDefined();
      expect(response.error?.message).toContain("Invalid tool arguments");
    });
  });

  describe("ListResourcesHandler", () => {
    it("should return empty resources initially", async () => {
      const handler = new ListResourcesHandler(lighthouseService, datasetService);
      const response = await handler.handle("test-req-1");

      expect(response.jsonrpc).toBe("2.0");
      expect(response.result).toBeDefined();
    });

    it("should handle errors gracefully", async () => {
      const badService = null as any;
      const handler = new ListResourcesHandler(badService, datasetService);
      const response = await handler.handle("test-req-2");

      expect(response.error).toBeDefined();
    });
  });

  describe("InitializeHandler", () => {
    it("should return server capabilities", async () => {
      const handler = new InitializeHandler({
        name: "test-server",
        version: "1.0.0",
      });

      const response = await handler.handle("test-req-1", {});

      expect(response.jsonrpc).toBe("2.0");
      expect(response.id).toBe("test-req-1");
      expect(response.result).toBeDefined();
    });

    it("should include server info in response", async () => {
      const handler = new InitializeHandler({
        name: "test-server",
        version: "2.0.0",
      });

      const response = await handler.handle("test-req-2");

      expect(response.result).toBeDefined();
      const result = response.result as any;
      expect(result.text).toContain("test-server");
      expect(result.text).toContain("2.0.0");
    });
  });
});
