/**
 * AI command handler implementation
 * @fileoverview Handles AI commands and integrates with Lighthouse services
 */

import type {
  AICommandHandler,
  AICommand,
  AICommandResult,
  AICommandHandlerFunction,
  AICommandDefinition,
  WorkspaceContextProvider,
  ProgressStreamer,
} from "../types/index.js";
import type { ExtensionEventEmitter } from "../events/event-emitter.js";
import { LighthouseAISDK } from "@lighthouse-tooling/sdk-wrapper";
import { Logger } from "@lighthouse-tooling/shared";

/**
 * AI command handler implementation
 */
export class AICommandHandlerImpl implements AICommandHandler {
  private _handlers = new Map<string, AICommandHandlerFunction>();
  private _workspaceContextProvider: WorkspaceContextProvider;
  private _progressStreamer: ProgressStreamer;
  private _eventEmitter: ExtensionEventEmitter;
  private _lighthouseSDK: LighthouseAISDK;
  private _logger: Logger;

  constructor(
    workspaceContextProvider: WorkspaceContextProvider,
    progressStreamer: ProgressStreamer,
    eventEmitter: ExtensionEventEmitter,
  ) {
    this._workspaceContextProvider = workspaceContextProvider;
    this._progressStreamer = progressStreamer;
    this._eventEmitter = eventEmitter;
    this._logger = new Logger({ level: "info", component: "AICommandHandler" });
    this._lighthouseSDK = new LighthouseAISDK({ apiKey: process.env.LIGHTHOUSE_API_KEY || "" });
  }

  /**
   * Initialize the AI command handler
   */
  async initialize(): Promise<void> {
    try {
      this._logger.info("Initializing AI command handler...");

      // Register built-in AI commands
      this._registerBuiltInCommands();

      this._logger.info("AI command handler initialized successfully");
    } catch (error) {
      this._logger.error("Failed to initialize AI command handler:", error as unknown as Error);
      throw error;
    }
  }

  /**
   * Dispose of the AI command handler
   */
  async dispose(): Promise<void> {
    try {
      this._handlers.clear();
      this._logger.info("AI command handler disposed");
    } catch (error) {
      this._logger.error("Error disposing AI command handler:", error as Error);
    }
  }

  /**
   * Handle an AI command
   */
  async handleCommand(command: AICommand): Promise<AICommandResult> {
    const handler = this._handlers.get(command.type);
    if (!handler) {
      const error = `Unknown AI command type: ${command.type}`;
      this._logger.error(error);
      return {
        success: false,
        error,
      };
    }

    try {
      this._logger.debug(`Handling AI command: ${command.type}`, command.parameters);

      // Emit command started event
      this._eventEmitter.emit("ai.command.started", {
        type: "ai.command.started",
        data: command,
        timestamp: new Date(),
        source: "AICommandHandler",
      });

      const result = await handler(command);

      // Emit command completed event
      this._eventEmitter.emit("ai.command.completed", {
        type: "ai.command.completed",
        data: { command, result },
        timestamp: new Date(),
        source: "AICommandHandler",
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error as Error);
      this._logger.error(`AI command ${command.type} failed:`, error as Error);

      // Emit command failed event
      this._eventEmitter.emit("ai.command.failed", {
        type: "ai.command.failed",
        data: { command, error: errorMessage },
        timestamp: new Date(),
        source: "AICommandHandler",
      });

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Register an AI command handler
   */
  registerHandler(commandType: string, handler: AICommandHandlerFunction): void {
    this._handlers.set(commandType, handler);
    this._logger.debug(`Registered AI command handler: ${commandType}`);
  }

  /**
   * Unregister an AI command handler
   */
  unregisterHandler(commandType: string): void {
    this._handlers.delete(commandType);
    this._logger.debug(`Unregistered AI command handler: ${commandType}`);
  }

  /**
   * Get available AI commands
   */
  getAvailableCommands(): AICommandDefinition[] {
    return [
      {
        type: "lighthouse.upload.file",
        name: "Upload File to Lighthouse",
        description: "Upload a file to Lighthouse with optional encryption",
        parameters: [
          {
            name: "filePath",
            type: "string",
            description: "Path to the file to upload",
            required: true,
          },
          {
            name: "encrypt",
            type: "boolean",
            description: "Whether to encrypt the file",
            required: false,
          },
          {
            name: "accessConditions",
            type: "array",
            description: "Access conditions for the file",
            required: false,
          },
        ],
        examples: [
          {
            description: "Upload a file with encryption",
            parameters: {
              filePath: "./data/model.pkl",
              encrypt: true,
            },
          },
        ],
      },
      // Add more command definitions...
    ];
  }

  /**
   * Register built-in AI commands
   */
  private _registerBuiltInCommands(): void {
    // Upload file command
    this.registerHandler("lighthouse.upload.file", async (command) => {
      const { filePath, encrypt = false, accessConditions } = command.parameters;

      if (!filePath || typeof filePath !== "string") {
        return {
          success: false,
          error: "filePath parameter is required and must be a string",
        };
      }

      const operationId = `upload-${Date.now()}`;
      const progress = this._progressStreamer.startProgress(operationId, `Uploading ${filePath}`);

      try {
        const result = await this._lighthouseSDK.uploadFile(filePath as string);

        progress.complete(result);
        return {
          success: true,
          data: result,
        };
      } catch (error) {
        progress.fail(error as Error);
        throw error;
      }
    });

    // Download file command
    this.registerHandler("lighthouse.download.file", async (command) => {
      const { cid, outputPath } = command.parameters;

      if (!cid || typeof cid !== "string") {
        return {
          success: false,
          error: "cid parameter is required and must be a string",
        };
      }

      const operationId = `download-${Date.now()}`;
      const progress = this._progressStreamer.startProgress(operationId, `Downloading ${cid}`);

      try {
        const result = await this._lighthouseSDK.downloadFile(cid, outputPath as string);

        progress.complete(result);
        return {
          success: true,
          data: result,
        };
      } catch (error) {
        progress.fail(error as Error);
        throw error;
      }
    });

    // Create dataset command
    this.registerHandler("lighthouse.create.dataset", async (command) => {
      const { name, description, files, encrypt = false } = command.parameters;

      if (!name || typeof name !== "string") {
        return {
          success: false,
          error: "name parameter is required and must be a string",
        };
      }

      if (!files || !Array.isArray(files)) {
        return {
          success: false,
          error: "files parameter is required and must be an array",
        };
      }

      const operationId = `create-dataset-${Date.now()}`;
      const progress = this._progressStreamer.startProgress(
        operationId,
        `Creating dataset ${name}`,
      );

      try {
        // TODO: Implement dataset creation
        const result = { id: name, message: "Dataset creation not yet implemented" };

        progress.complete(result);
        return {
          success: true,
          data: result,
        };
      } catch (error) {
        progress.fail(error as Error);
        throw error;
      }
    });

    // Get workspace context command
    this.registerHandler("lighthouse.workspace.context", async (command) => {
      try {
        const context = await this._workspaceContextProvider.getContext();
        return {
          success: true,
          data: context,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    });

    // List datasets command
    this.registerHandler("lighthouse.list.datasets", async (command) => {
      try {
        const datasets = await this._workspaceContextProvider.getActiveDatasets();
        return {
          success: true,
          data: datasets,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    });

    // Refresh workspace command
    this.registerHandler("lighthouse.workspace.refresh", async (command) => {
      const operationId = `refresh-workspace-${Date.now()}`;
      const progress = this._progressStreamer.startProgress(
        operationId,
        "Refreshing workspace context",
      );

      try {
        progress.update({ progress: 50, message: "Scanning workspace..." });
        await this._workspaceContextProvider.refreshContext();

        progress.complete();
        return {
          success: true,
          data: { message: "Workspace context refreshed successfully" },
        };
      } catch (error) {
        progress.fail(error as Error);
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    });
  }
}
