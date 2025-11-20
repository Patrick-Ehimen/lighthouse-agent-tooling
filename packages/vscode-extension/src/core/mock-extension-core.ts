/**
 * Mock Extension Core
 * @fileoverview DEPRECATED: This mock implementation has been replaced by the real
 * ExtensionCore from @lighthouse-tooling/extension-core package.
 * This file is kept for reference but is no longer used.
 * @deprecated Use @lighthouse-tooling/extension-core instead
 */

import type { LighthouseAISDK } from "@lighthouse-tooling/sdk-wrapper";

export interface ExtensionCoreConfig {
  commandRegistry: any;
  progressStreamer: any;
  workspaceContextProvider: any;
  sdk: LighthouseAISDK;
}

/**
 * Mock extension core for VSCode extension
 */
export class ExtensionCore {
  private initialized = false;

  constructor(private config: ExtensionCoreConfig) {}

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Initialize SDK
    await this.config.sdk.initialize();

    this.initialized = true;
  }

  async dispose(): Promise<void> {
    this.initialized = false;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getCommandRegistry() {
    return this.config.commandRegistry;
  }

  getProgressStreamer() {
    return this.config.progressStreamer;
  }

  getWorkspaceContextProvider() {
    return this.config.workspaceContextProvider;
  }

  getAICommandHandler() {
    return null; // Not implemented in mock
  }

  getConfigurationManager() {
    return null; // Not implemented in mock
  }
}
