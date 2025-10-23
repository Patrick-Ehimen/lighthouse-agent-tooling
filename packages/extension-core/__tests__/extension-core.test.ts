/**
 * Extension core tests
 * @fileoverview Tests for the main extension core functionality
 */

import { ExtensionCoreImpl, createExtensionCore } from "../src/core/extension-core";

describe("ExtensionCore", () => {
  let extensionCore: ExtensionCoreImpl;

  beforeEach(() => {
    extensionCore = new ExtensionCoreImpl();
  });

  afterEach(async () => {
    if (extensionCore.isInitialized()) {
      await extensionCore.dispose();
    }
  });

  describe("initialization", () => {
    it("should initialize successfully", async () => {
      expect(extensionCore.isInitialized()).toBe(false);

      await extensionCore.initialize();

      expect(extensionCore.isInitialized()).toBe(true);
    });

    it("should not initialize twice", async () => {
      await extensionCore.initialize();

      // Second initialization should not throw
      await expect(extensionCore.initialize()).resolves.toBeUndefined();
      expect(extensionCore.isInitialized()).toBe(true);
    });

    it("should provide access to all components", async () => {
      await extensionCore.initialize();

      expect(extensionCore.getCommandRegistry()).toBeDefined();
      expect(extensionCore.getWorkspaceContextProvider()).toBeDefined();
      expect(extensionCore.getAICommandHandler()).toBeDefined();
      expect(extensionCore.getProgressStreamer()).toBeDefined();
      expect(extensionCore.getConfigurationManager()).toBeDefined();
    });
  });

  describe("disposal", () => {
    it("should dispose successfully", async () => {
      await extensionCore.initialize();
      expect(extensionCore.isInitialized()).toBe(true);

      await extensionCore.dispose();
      expect(extensionCore.isInitialized()).toBe(false);
    });

    it("should handle disposal when not initialized", async () => {
      expect(extensionCore.isInitialized()).toBe(false);

      await expect(extensionCore.dispose()).resolves.toBeUndefined();
    });
  });

  describe("factory function", () => {
    it("should create extension core instance", () => {
      const core = createExtensionCore();
      expect(core).toBeInstanceOf(ExtensionCoreImpl);
      expect(core.isInitialized()).toBe(false);
    });
  });
});
