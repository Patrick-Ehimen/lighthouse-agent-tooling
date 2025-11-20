/**
 * AI Agent Hooks Tests
 * @fileoverview Tests for AI Agent Hooks implementation
 */

import { AIAgentHooksImpl } from "../ai/ai-agent-hooks";
import { createExtensionCore, type ExtensionCore } from "@lighthouse-tooling/extension-core";

describe("AIAgentHooksImpl", () => {
  let extensionCore: ExtensionCore;
  let aiHooks: AIAgentHooksImpl;

  beforeEach(() => {
    // Set API key for ExtensionCore's AI command handler
    process.env.LIGHTHOUSE_API_KEY = "test-api-key";

    // Create real extension core
    extensionCore = createExtensionCore();
    aiHooks = new AIAgentHooksImpl(extensionCore);
  });

  afterEach(async () => {
    // Clean up
    if (aiHooks) {
      aiHooks.dispose();
    }
    if (extensionCore && extensionCore.isInitialized()) {
      await extensionCore.dispose();
    }
  });

  describe("initialization", () => {
    it("should create AI hooks instance", () => {
      expect(aiHooks).toBeDefined();
      expect(aiHooks).toBeInstanceOf(AIAgentHooksImpl);
    });
  });

  describe("getWorkspaceContext", () => {
    it("should get workspace context", async () => {
      // Initialize extension core first
      await extensionCore.initialize();

      const context = await aiHooks.getWorkspaceContext();

      expect(context).toBeDefined();
      expect(context).toHaveProperty("projectPath");
      expect(context).toHaveProperty("files");
      expect(context).toHaveProperty("datasets");
    });
  });

  describe("onAICommand", () => {
    beforeEach(async () => {
      await extensionCore.initialize();
    });

    it("should handle workspace context command", async () => {
      const result = await aiHooks.onAICommand("lighthouse.workspace.context", {});

      expect(result).toBeDefined();
      expect(result).toHaveProperty("projectPath");
    });

    it("should handle invalid command gracefully", async () => {
      await expect(aiHooks.onAICommand("invalid.command", {})).rejects.toThrow();
    });
  });

  describe("registerAIFunction", () => {
    beforeEach(async () => {
      await extensionCore.initialize();
    });

    it("should register custom AI function", async () => {
      const handler = jest.fn().mockResolvedValue({
        success: true,
        data: { result: "test" },
      });

      aiHooks.registerAIFunction("custom.test", handler);

      const result = await aiHooks.onAICommand("custom.test", { test: "value" });

      expect(handler).toHaveBeenCalled();
      expect(result).toEqual({ result: "test" });
    });
  });

  describe("onProgress", () => {
    beforeEach(async () => {
      await extensionCore.initialize();
    });

    it("should subscribe to progress updates", () => {
      const callback = jest.fn();
      const unsubscribe = aiHooks.onProgress(callback);

      expect(typeof unsubscribe).toBe("function");

      // Unsubscribe
      unsubscribe();
    });

    it("should allow multiple progress callbacks", () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      const unsubscribe1 = aiHooks.onProgress(callback1);
      const unsubscribe2 = aiHooks.onProgress(callback2);

      expect(typeof unsubscribe1).toBe("function");
      expect(typeof unsubscribe2).toBe("function");

      unsubscribe1();
      unsubscribe2();
    });
  });

  describe("dispose", () => {
    it("should dispose resources", () => {
      const callback = jest.fn();
      aiHooks.onProgress(callback);

      expect(() => aiHooks.dispose()).not.toThrow();
    });
  });
});
