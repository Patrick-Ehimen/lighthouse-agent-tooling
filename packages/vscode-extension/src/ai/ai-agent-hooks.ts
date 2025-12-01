/**
 * AI Agent Hooks Implementation
 * @fileoverview Interface for AI agents to interact with the extension
 */

import { randomUUID } from "crypto";
import type {
  ExtensionCore,
  WorkspaceContext,
  ProgressUpdate,
  AICommand,
  AICommandResult,
  AICommandHandlerFunction,
  AIContext,
} from "@lighthouse-tooling/extension-core";
import { AgentType, KeyStorageMethod, EncryptionStrength } from "@lighthouse-tooling/types";
import type { MCPClient } from "../mcp/mcp-client";

/**
 * AI Agent Hooks interface
 * Allows AI agents to interact with the extension programmatically
 */
export interface AIAgentHooks {
  /**
   * Execute an AI command
   * @param command - Command name/type
   * @param params - Command parameters
   * @returns Command result
   */
  onAICommand(command: string, params: Record<string, unknown>): Promise<unknown>;

  /**
   * Get current workspace context
   * @returns Workspace context information
   */
  getWorkspaceContext(): Promise<WorkspaceContext>;

  /**
   * Register a custom AI-accessible function
   * @param name - Function name
   * @param handler - Function handler
   */
  registerAIFunction(name: string, handler: AICommandHandlerFunction): void;

  /**
   * Subscribe to progress updates
   * @param callback - Progress update callback
   * @returns Unsubscribe function
   */
  onProgress(callback: (progress: ProgressUpdate) => void): () => void;
}

/**
 * AI Agent Hooks implementation
 * Bridges AI agent requests to ExtensionCore components
 */
export class AIAgentHooksImpl implements AIAgentHooks {
  private progressCallbacks: Set<(progress: ProgressUpdate) => void> = new Set();
  private customHandlers: Map<string, AICommandHandlerFunction> = new Map();
  private progressCheckInterval: NodeJS.Timeout | null = null;
  private mcpClient: MCPClient | null = null;

  constructor(
    private extensionCore: ExtensionCore,
    mcpClient?: MCPClient | null,
  ) {
    this.mcpClient = mcpClient || null;
    this.setupProgressListener();
  }

  /**
   * Set MCP client for tool calling
   */
  setMCPClient(client: MCPClient | null): void {
    this.mcpClient = client;
  }

  /**
   * Execute an AI command
   */
  async onAICommand(command: string, params: Record<string, unknown>): Promise<unknown> {
    // Check for custom registered handler first
    const customHandler = this.customHandlers.get(command);
    if (customHandler) {
      const aiCommand: AICommand = {
        type: command,
        parameters: params,
        context: await this.getAIContext(),
      };

      const result = await customHandler(aiCommand);
      return result.data || result;
    }

    // Try MCP client first if available and command matches MCP tool pattern
    if (this.mcpClient && this.mcpClient.isClientConnected()) {
      const mcpToolName = this.mapCommandToMCPTool(command);
      if (mcpToolName) {
        try {
          const result = await this.mcpClient.callTool(mcpToolName, params);
          if (result.success) {
            return result.data;
          }
          // Fall through to ExtensionCore if MCP call fails
        } catch (error) {
          // Fall through to ExtensionCore if MCP call fails
          console.warn("MCP tool call failed, falling back to ExtensionCore:", error);
        }
      }
    }

    // Use ExtensionCore's AI command handler
    const aiCommandHandler = this.extensionCore.getAICommandHandler();

    // Convert command string to AICommand format
    const aiCommand: AICommand = {
      type: command,
      parameters: params,
      context: await this.getAIContext(),
    };

    const result: AICommandResult = await aiCommandHandler.handleCommand(aiCommand);

    if (!result.success) {
      throw new Error(result.error || "Command execution failed");
    }

    return result.data;
  }

  /**
   * Map AI command to MCP tool name
   */
  private mapCommandToMCPTool(command: string): string | null {
    const commandMap: Record<string, string> = {
      upload_file: "lighthouse_upload_file",
      uploadFile: "lighthouse_upload_file",
      fetch_file: "lighthouse_fetch_file",
      fetchFile: "lighthouse_fetch_file",
      download_file: "lighthouse_fetch_file",
      downloadFile: "lighthouse_fetch_file",
      create_dataset: "lighthouse_create_dataset",
      createDataset: "lighthouse_create_dataset",
      list_datasets: "lighthouse_list_datasets",
      listDatasets: "lighthouse_list_datasets",
      get_dataset: "lighthouse_get_dataset",
      getDataset: "lighthouse_get_dataset",
      update_dataset: "lighthouse_update_dataset",
      updateDataset: "lighthouse_update_dataset",
      generate_key: "lighthouse_generate_key",
      generateKey: "lighthouse_generate_key",
      setup_access_control: "lighthouse_setup_access_control",
      setupAccessControl: "lighthouse_setup_access_control",
    };

    return commandMap[command] || null;
  }

  /**
   * Get current workspace context
   */
  async getWorkspaceContext(): Promise<WorkspaceContext> {
    const workspaceProvider = this.extensionCore.getWorkspaceContextProvider();
    return await workspaceProvider.getContext();
  }

  /**
   * Register a custom AI-accessible function
   */
  registerAIFunction(name: string, handler: AICommandHandlerFunction): void {
    // Prevent overwriting existing handler
    if (this.customHandlers.has(name)) {
      console.warn(
        `[AI Agent] Handler with name "${name}" already exists. Registration skipped to prevent overwriting.`,
      );
      return;
    }

    // Store custom handler
    this.customHandlers.set(name, handler);

    // Also register with ExtensionCore's AI command handler for consistency
    const aiCommandHandler = this.extensionCore.getAICommandHandler();
    aiCommandHandler.registerHandler(name, handler);
  }

  /**
   * Subscribe to progress updates
   */
  onProgress(callback: (progress: ProgressUpdate) => void): () => void {
    this.progressCallbacks.add(callback);

    // Return unsubscribe function
    return () => {
      this.progressCallbacks.delete(callback);
    };
  }

  /**
   * Setup progress listener from ExtensionCore's progress streamer
   */
  private setupProgressListener(): void {
    // Poll active progress streams and notify callbacks
    // Note: This is a fallback approach since we can't directly access the event emitter
    // In a production environment, you might want to expose events through the ExtensionCore interface
    if (this.progressCheckInterval) {
      clearInterval(this.progressCheckInterval);
    }

    this.progressCheckInterval = setInterval(() => {
      if (this.progressCallbacks.size === 0) {
        return;
      }

      try {
        const progressStreamer = this.extensionCore.getProgressStreamer();
        const activeStreams = progressStreamer.getActiveStreams();

        activeStreams.forEach((stream) => {
          const progress = stream.getCurrentProgress();
          if (progress) {
            this.progressCallbacks.forEach((callback) => {
              try {
                callback(progress);
              } catch (error) {
                console.error("Error in progress callback:", error);
              }
            });
          }
        });
      } catch {
        // Ignore errors in progress polling
      }
    }, 500); // Check every 500ms
  }

  /**
   * Get AI context for commands
   */
  private async getAIContext(): Promise<AIContext> {
    const now = new Date();
    return {
      agentId: `agent-${randomUUID()}`,
      agentType: AgentType.CUSTOM,
      session: {
        sessionId: `session-${randomUUID()}`,
        startTime: now,
        lastActivity: now,
        duration: 0,
        interactionCount: 0,
        context: {},
      },
      history: [],
      capabilities: [],
      preferences: {
        preferredFileTypes: [],
        preferredOperations: [],
        autoSync: false,
        encryption: {
          encryptByDefault: false,
          strength: EncryptionStrength.STANDARD,
          keyManagement: {
            storageMethod: KeyStorageMethod.LOCAL,
            rotationFrequency: 90,
            backup: {
              enabled: false,
              frequency: 7,
              keepCount: 5,
              location: "",
            },
          },
        },
        notifications: {
          operations: true,
          errors: true,
          progress: true,
          completion: true,
        },
      },
    };
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    if (this.progressCheckInterval) {
      clearInterval(this.progressCheckInterval);
      this.progressCheckInterval = null;
    }
    this.progressCallbacks.clear();
    this.customHandlers.clear();
  }
}
