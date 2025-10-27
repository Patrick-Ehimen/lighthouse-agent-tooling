/**
 * Extension core implementation
 * @fileoverview Main extension core class that orchestrates all extension functionality
 */

import type {
  ExtensionCore,
  CommandRegistry,
  WorkspaceContextProvider,
  AICommandHandler,
  ProgressStreamer,
  ConfigurationManager,
} from "../types/index.js";
import { CommandRegistryImpl } from "./command-registry.js";
import { ProgressStreamerImpl } from "./progress-streamer.js";
import { WorkspaceContextProviderImpl } from "../workspace/context-provider.js";
import { AICommandHandlerImpl } from "../ai/ai-command-handler.js";
import { ConfigurationManagerImpl } from "../config/configuration-manager.js";
import { ExtensionEventEmitter } from "../events/event-emitter.js";
import { Logger } from "@lighthouse-tooling/shared";

/**
 * Main extension core implementation
 */
export class ExtensionCoreImpl implements ExtensionCore {
  private _initialized = false;
  private _commandRegistry: CommandRegistry;
  private _workspaceContextProvider: WorkspaceContextProvider;
  private _aiCommandHandler: AICommandHandler;
  private _progressStreamer: ProgressStreamer;
  private _configurationManager: ConfigurationManager;
  private _eventEmitter: ExtensionEventEmitter;
  private _logger: Logger;

  constructor() {
    this._logger = new Logger({ level: "info", component: "ExtensionCore" });
    this._eventEmitter = new ExtensionEventEmitter();
    this._configurationManager = new ConfigurationManagerImpl();
    this._commandRegistry = new CommandRegistryImpl(this._eventEmitter);
    this._progressStreamer = new ProgressStreamerImpl(this._eventEmitter);
    this._workspaceContextProvider = new WorkspaceContextProviderImpl(
      this._eventEmitter,
      this._configurationManager,
    );
    this._aiCommandHandler = new AICommandHandlerImpl(
      this._workspaceContextProvider,
      this._progressStreamer,
      this._eventEmitter,
    );
  }

  /**
   * Initialize the extension core
   */
  async initialize(): Promise<void> {
    if (this._initialized) {
      this._logger.warn("Extension core is already initialized");
      return;
    }

    try {
      this._logger.info("Initializing extension core...");

      // Initialize configuration manager first
      await this._configurationManager.initialize?.();

      // Initialize workspace context provider
      await this._workspaceContextProvider.initialize?.();

      // Initialize AI command handler
      await this._aiCommandHandler.initialize?.();

      // Register core commands
      this._registerCoreCommands();

      // Set up event listeners
      this._setupEventListeners();

      this._initialized = true;
      this._logger.info("Extension core initialized successfully");

      // Emit initialization event
      this._eventEmitter.emit("core.initialized", {
        timestamp: new Date(),
        source: "ExtensionCore",
      });
    } catch (error) {
      this._logger.error("Failed to initialize extension core:", error as Error);
      throw error;
    }
  }

  /**
   * Dispose of resources
   */
  async dispose(): Promise<void> {
    if (!this._initialized) {
      return;
    }

    try {
      this._logger.info("Disposing extension core...");

      // Dispose of components in reverse order
      await this._aiCommandHandler.dispose?.();
      await this._workspaceContextProvider.dispose?.();
      await this._configurationManager.dispose?.();

      // Clear event listeners
      this._eventEmitter.removeAllListeners();

      this._initialized = false;
      this._logger.info("Extension core disposed successfully");
    } catch (error) {
      this._logger.error("Error disposing extension core:", error as Error);
      throw error;
    }
  }

  /**
   * Get the command registry
   */
  getCommandRegistry(): CommandRegistry {
    return this._commandRegistry;
  }

  /**
   * Get the workspace context provider
   */
  getWorkspaceContextProvider(): WorkspaceContextProvider {
    return this._workspaceContextProvider;
  }

  /**
   * Get the AI command handler
   */
  getAICommandHandler(): AICommandHandler {
    return this._aiCommandHandler;
  }

  /**
   * Get the progress streamer
   */
  getProgressStreamer(): ProgressStreamer {
    return this._progressStreamer;
  }

  /**
   * Get the configuration manager
   */
  getConfigurationManager(): ConfigurationManager {
    return this._configurationManager;
  }

  /**
   * Check if the extension is initialized
   */
  isInitialized(): boolean {
    return this._initialized;
  }

  /**
   * Get the event emitter (internal use)
   */
  getEventEmitter(): ExtensionEventEmitter {
    return this._eventEmitter;
  }

  /**
   * Register core commands
   */
  private _registerCoreCommands(): void {
    // Register workspace commands
    this._commandRegistry.registerCommand({
      id: "lighthouse.workspace.refresh",
      title: "Refresh Workspace Context",
      description: "Refresh the current workspace context and file information",
      category: "Workspace",
      handler: async () => {
        await this._workspaceContextProvider.refreshContext();
        return { success: true, message: "Workspace context refreshed" };
      },
    });

    // Register configuration commands
    this._commandRegistry.registerCommand({
      id: "lighthouse.config.reset",
      title: "Reset Configuration",
      description: "Reset extension configuration to defaults",
      category: "Configuration",
      handler: async () => {
        await this._configurationManager.resetConfiguration();
        return { success: true, message: "Configuration reset to defaults" };
      },
    });

    // Register diagnostic commands
    this._commandRegistry.registerCommand({
      id: "lighthouse.diagnostics.status",
      title: "Show Extension Status",
      description: "Show the current status of the extension",
      category: "Diagnostics",
      handler: async () => {
        const status = {
          initialized: this._initialized,
          activeStreams: this._progressStreamer.getActiveStreams().length,
          registeredCommands: this._commandRegistry.getCommands().length,
          workspaceContext: await this._workspaceContextProvider.getContext(),
        };
        return status;
      },
    });
  }

  /**
   * Set up event listeners
   */
  private _setupEventListeners(): void {
    // Listen for configuration changes
    this._configurationManager.watchConfiguration((config) => {
      this._eventEmitter.emit("configuration.changed", {
        type: "configuration.changed",
        data: config,
        timestamp: new Date(),
        source: "ConfigurationManager",
      });
    });

    // Listen for workspace changes
    this._workspaceContextProvider.watchWorkspace((context) => {
      this._eventEmitter.emit("workspace.changed", {
        type: "workspace.changed",
        data: context,
        timestamp: new Date(),
        source: "WorkspaceContextProvider",
      });
    });

    // Listen for command execution
    this._eventEmitter.on("command.executed", (event) => {
      this._logger.debug("Command executed:", event.data);
    });

    // Listen for progress updates
    this._eventEmitter.on("progress.updated", (event) => {
      this._logger.debug("Progress updated:", event.data);
    });

    // Listen for errors
    this._eventEmitter.on("error", (event) => {
      this._logger.error("Extension error:", event.data);
    });
  }
}

/**
 * Create a new extension core instance
 */
export function createExtensionCore(): ExtensionCore {
  return new ExtensionCoreImpl();
}
