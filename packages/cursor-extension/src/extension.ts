/**
 * Lighthouse Cursor Extension
 * @fileoverview Cursor IDE extension implementation with MCP support
 */

import * as vscode from "vscode";
import {
  createExtensionCore,
  type ExtensionCore,
  type WorkspaceContext,
  type ProgressUpdate,
  type AICommandHandlerFunction,
} from "@lighthouse-tooling/extension-core";
import { LighthouseAISDK } from "@lighthouse-tooling/sdk-wrapper";
import { MCPClient } from "./mcp/mcp-client";

interface AIAgentHooks {
  onAICommand(command: string, params: Record<string, unknown>): Promise<unknown>;
  getWorkspaceContext(): Promise<WorkspaceContext>;
  registerAIFunction(name: string, handler: AICommandHandlerFunction): void;
  onProgress(callback: (progress: ProgressUpdate) => void): () => void;
}

class AIAgentHooksImpl implements AIAgentHooks {
  private mcpClient: MCPClient | null = null;
  private customHandlers: Map<string, AICommandHandlerFunction> = new Map();

  constructor(private extensionCore: ExtensionCore) {}

  setMCPClient(client: MCPClient | null): void {
    this.mcpClient = client;
  }

  async onAICommand(command: string, params: Record<string, unknown>): Promise<unknown> {
    if (this.mcpClient && this.mcpClient.isClientConnected()) {
      const mcpToolName = this.mapCommandToMCPTool(command);
      if (mcpToolName) {
        try {
          const result = await this.mcpClient.callTool(mcpToolName, params);
          if (result.success) {
            return result.data;
          }
        } catch (error) {
          console.warn("MCP tool call failed:", error);
        }
      }
    }
    throw new Error(`Command not supported: ${command}`);
  }

  async getWorkspaceContext(): Promise<WorkspaceContext> {
    const workspaceProvider = this.extensionCore.getWorkspaceContextProvider();
    return await workspaceProvider.getContext();
  }

  registerAIFunction(name: string, handler: AICommandHandlerFunction): void {
    this.customHandlers.set(name, handler);
  }

  onProgress(callback: (progress: ProgressUpdate) => void): () => void {
    // Simple implementation - in production, integrate with progress streamer
    return () => {};
  }

  private mapCommandToMCPTool(command: string): string | null {
    const commandMap: Record<string, string> = {
      upload_file: "lighthouse_upload_file",
      uploadFile: "lighthouse_upload_file",
      fetch_file: "lighthouse_fetch_file",
      create_dataset: "lighthouse_create_dataset",
    };
    return commandMap[command] || null;
  }

  dispose(): void {
    this.customHandlers.clear();
  }
}

/**
 * Main Cursor extension class
 */
export class LighthouseCursorExtension {
  private extensionCore: ExtensionCore;
  private sdk: LighthouseAISDK;
  private aiHooks: AIAgentHooks;
  private mcpClient: MCPClient | null = null;
  private isActivated = false;

  constructor(private context: vscode.ExtensionContext) {
    // Initialize core components
    const config = vscode.workspace.getConfiguration("lighthouse.cursor");
    const apiKey = config.get<string>("apiKey") || "";

    this.sdk = new LighthouseAISDK({
      apiKey,
      maxRetries: 5,
      timeout: 180000,
    });

    // Initialize real extension core
    this.extensionCore = createExtensionCore();

    // Initialize AI Agent Hooks (simple implementation for Cursor)
    this.aiHooks = new AIAgentHooksImpl(this.extensionCore);
  }

  /**
   * Activate the extension
   */
  async activate(): Promise<void> {
    if (this.isActivated) {
      return;
    }

    try {
      // Validate API key is set
      const config = vscode.workspace.getConfiguration("lighthouse.cursor");
      const apiKey = config.get<string>("apiKey");

      if (!apiKey || apiKey.trim() === "") {
        vscode.window
          .showWarningMessage(
            "Lighthouse API key not set. Please configure your API key in settings.",
            "Set API Key",
          )
          .then((selection) => {
            if (selection === "Set API Key") {
              vscode.commands.executeCommand(
                "workbench.action.openSettings",
                "lighthouse.cursor.apiKey",
              );
            }
          });
      }

      // Initialize SDK
      await this.sdk.initialize();

      // Set environment variable for ExtensionCore's AI command handler if API key is available
      if (apiKey && apiKey.trim() !== "") {
        process.env.LIGHTHOUSE_API_KEY = apiKey;
      }

      // Initialize extension core
      await this.extensionCore.initialize();

      // Initialize MCP client if API key is available and auto-start is enabled
      const autoStartMCP = config.get<boolean>("autoStartMCP") ?? true;
      if (apiKey && apiKey.trim() !== "" && autoStartMCP) {
        await this.initializeMCPClient(apiKey);
        // Update AI hooks with MCP client
        if (this.mcpClient && this.aiHooks instanceof AIAgentHooksImpl) {
          this.aiHooks.setMCPClient(this.mcpClient);
        }
      }

      // Register commands
      this.registerCommands();

      this.isActivated = true;
      console.log("Lighthouse Cursor Extension activated successfully");
    } catch (error) {
      console.error("Failed to activate Lighthouse Cursor Extension:", error);
      vscode.window.showErrorMessage(
        `Failed to activate Lighthouse extension: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Deactivate the extension
   */
  async deactivate(): Promise<void> {
    if (!this.isActivated) {
      return;
    }

    try {
      // Dispose AI hooks
      if (this.aiHooks && typeof (this.aiHooks as AIAgentHooksImpl).dispose === "function") {
        (this.aiHooks as AIAgentHooksImpl).dispose();
      }

      // Disconnect MCP client
      if (this.mcpClient) {
        await this.mcpClient.disconnect();
        this.mcpClient = null;
      }

      await this.extensionCore.dispose();
      this.isActivated = false;
      console.log("Lighthouse Cursor Extension deactivated");
    } catch (error) {
      console.error("Error during extension deactivation:", error);
    }
  }

  /**
   * Get AI Agent Hooks interface
   */
  getAIAgentHooks(): AIAgentHooks {
    return this.aiHooks;
  }

  /**
   * Get MCP client instance
   */
  getMCPClient(): MCPClient | null {
    return this.mcpClient;
  }

  /**
   * Register Cursor commands
   */
  private registerCommands(): void {
    const commands = [
      {
        id: "lighthouse.cursor.uploadFile",
        handler: this.handleUploadFile.bind(this),
      },
      {
        id: "lighthouse.cursor.createDataset",
        handler: this.handleCreateDataset.bind(this),
      },
      {
        id: "lighthouse.cursor.connectMCP",
        handler: this.handleConnectMCP.bind(this),
      },
    ];

    commands.forEach(({ id, handler }) => {
      const disposable = vscode.commands.registerCommand(id, handler);
      this.context.subscriptions.push(disposable);
    });
  }

  /**
   * Handle upload file command
   */
  private async handleUploadFile(): Promise<void> {
    try {
      const config = vscode.workspace.getConfiguration("lighthouse.cursor");
      const apiKey = config.get<string>("apiKey");

      if (!apiKey || apiKey.trim() === "") {
        vscode.window.showErrorMessage(
          "Lighthouse API key is required. Please configure your API key first.",
        );
        return;
      }

      // Use MCP client if available, otherwise use SDK directly
      if (this.mcpClient && this.mcpClient.isClientConnected()) {
        const fileUri = await vscode.window.showOpenDialog({
          canSelectFiles: true,
          canSelectFolders: false,
          canSelectMany: false,
        });

        if (!fileUri || fileUri.length === 0) {
          return;
        }

        const file = fileUri[0];
        if (!file) {
          return;
        }
        const result = await this.mcpClient.callTool("lighthouse_upload_file", {
          filePath: file.fsPath,
          apiKey,
        });

        if (result.success) {
          vscode.window.showInformationMessage(
            `File uploaded successfully! CID: ${JSON.stringify(result.data)}`,
          );
        } else {
          vscode.window.showErrorMessage(`Upload failed: ${result.error}`);
        }
      } else {
        vscode.window.showWarningMessage(
          "MCP client not connected. Please connect to MCP server first.",
        );
      }
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to upload file: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Handle create dataset command
   */
  private async handleCreateDataset(): Promise<void> {
    try {
      const config = vscode.workspace.getConfiguration("lighthouse.cursor");
      const apiKey = config.get<string>("apiKey");

      if (!apiKey || apiKey.trim() === "") {
        vscode.window.showErrorMessage(
          "Lighthouse API key is required. Please configure your API key first.",
        );
        return;
      }

      const name = await vscode.window.showInputBox({
        prompt: "Enter dataset name",
        placeHolder: "my-ai-dataset",
      });

      if (!name) {
        return;
      }

      // Use MCP client if available
      if (this.mcpClient && this.mcpClient.isClientConnected()) {
        const result = await this.mcpClient.callTool("lighthouse_create_dataset", {
          name: name.trim(),
          files: [],
          apiKey,
        });

        if (result.success) {
          vscode.window.showInformationMessage(`Dataset "${name}" created successfully!`);
        } else {
          vscode.window.showErrorMessage(`Dataset creation failed: ${result.error}`);
        }
      } else {
        vscode.window.showWarningMessage(
          "MCP client not connected. Please connect to MCP server first.",
        );
      }
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to create dataset: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Handle connect MCP command
   */
  private async handleConnectMCP(): Promise<void> {
    try {
      const config = vscode.workspace.getConfiguration("lighthouse.cursor");
      const apiKey = config.get<string>("apiKey");

      if (!apiKey || apiKey.trim() === "") {
        vscode.window.showErrorMessage("Lighthouse API key is required to connect to MCP Server.");
        return;
      }

      // Disconnect existing client if any
      if (this.mcpClient) {
        await this.mcpClient.disconnect();
      }

      // Create and connect new client
      this.mcpClient = new MCPClient({
        apiKey,
        autoConnect: true,
      });

      await this.mcpClient.connect();

      // List available tools
      const tools = this.mcpClient.getAvailableTools();

      // Update AI hooks with MCP client
      if (this.aiHooks instanceof AIAgentHooksImpl) {
        this.aiHooks.setMCPClient(this.mcpClient);
      }

      vscode.window.showInformationMessage(
        `Successfully connected to MCP Server! ${tools.length} tools available.`,
      );
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to connect to MCP Server: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Initialize MCP client
   */
  private async initializeMCPClient(apiKey: string): Promise<void> {
    try {
      this.mcpClient = new MCPClient({
        apiKey,
        autoConnect: true,
      });

      await this.mcpClient.connect();
    } catch (error) {
      // Don't show error to user, just log it
      // MCP connection is optional for basic functionality
      console.error("Failed to initialize MCP client:", error);
    }
  }
}

let extension: LighthouseCursorExtension | undefined;

/**
 * Extension activation
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  try {
    extension = new LighthouseCursorExtension(context);
    await extension.activate();
  } catch (error) {
    console.error("Failed to activate Lighthouse Cursor Extension:", error);
    vscode.window.showErrorMessage(
      `Failed to activate Lighthouse extension: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Extension deactivation
 */
export async function deactivate(): Promise<void> {
  try {
    if (extension) {
      await extension.deactivate();
      extension = undefined;
    }
  } catch (error) {
    console.error("Error during extension deactivation:", error);
  }
}

// Export extension name and version
export const extensionName = "lighthouse-cursor-extension";
export const version = "0.1.0";
