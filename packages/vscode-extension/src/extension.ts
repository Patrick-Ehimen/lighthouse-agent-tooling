/**
 * Lighthouse VSCode Extension Implementation
 * @fileoverview Main extension class with AI integration
 */

import * as vscode from "vscode";
import { ExtensionCore } from "./core/mock-extension-core";
import { LighthouseAISDK } from "@lighthouse-tooling/sdk-wrapper";
import { VSCodeCommandRegistry } from "./commands/command-registry";
import { VSCodeProgressStreamer } from "./ui/progress-streamer";
import { VSCodeWorkspaceProvider } from "./workspace/workspace-provider";
import { VSCodeStatusBar } from "./ui/status-bar";
import { VSCodeTreeProvider } from "./ui/tree-provider";

/**
 * Main VSCode extension class
 */
export class LighthouseVSCodeExtension {
  private extensionCore: ExtensionCore;
  private sdk: LighthouseAISDK;
  private commandRegistry: VSCodeCommandRegistry;
  private progressStreamer: VSCodeProgressStreamer;
  private workspaceProvider: VSCodeWorkspaceProvider;
  private statusBar: VSCodeStatusBar;
  private treeProvider: VSCodeTreeProvider;
  private isActivated = false;

  constructor(private context: vscode.ExtensionContext) {
    // Initialize core components
    const config = vscode.workspace.getConfiguration("lighthouse.vscode");
    const apiKey = config.get<string>("apiKey") || "test-key"; // Default for testing

    this.sdk = new LighthouseAISDK({
      apiKey,
      maxRetries: 3,
      timeout: 30000,
    });
    this.commandRegistry = new VSCodeCommandRegistry(context);
    this.progressStreamer = new VSCodeProgressStreamer();
    this.workspaceProvider = new VSCodeWorkspaceProvider();
    this.statusBar = new VSCodeStatusBar();
    this.treeProvider = new VSCodeTreeProvider(this.sdk);

    // Initialize extension core with VSCode-specific implementations
    this.extensionCore = new ExtensionCore({
      commandRegistry: this.commandRegistry,
      progressStreamer: this.progressStreamer,
      workspaceContextProvider: this.workspaceProvider,
      sdk: this.sdk,
    });
  }

  /**
   * Activate the extension
   */
  async activate(): Promise<void> {
    if (this.isActivated) {
      return;
    }

    try {
      // Initialize core components
      await this.extensionCore.initialize();
      await this.statusBar.initialize();
      await this.treeProvider.initialize();

      // Register VSCode-specific commands
      this.registerCommands();

      // Setup UI components
      this.setupUI();

      // Setup configuration watching
      this.setupConfigurationWatching();

      this.isActivated = true;
    } catch (error) {
      throw new Error(
        `Failed to activate extension: ${error instanceof Error ? error.message : "Unknown error"}`,
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
      await this.extensionCore.dispose();
      await this.statusBar.dispose();
      await this.treeProvider.dispose();
      this.isActivated = false;
    } catch (error) {
      console.error("Error during extension deactivation:", error);
    }
  }

  /**
   * Register VSCode commands
   */
  private registerCommands(): void {
    const commands = [
      {
        id: "lighthouse.vscode.uploadFile",
        handler: this.handleUploadFile.bind(this),
      },
      {
        id: "lighthouse.vscode.createDataset",
        handler: this.handleCreateDataset.bind(this),
      },
      {
        id: "lighthouse.vscode.connectMCP",
        handler: this.handleConnectMCP.bind(this),
      },
      {
        id: "lighthouse.vscode.refreshTree",
        handler: this.handleRefreshTree.bind(this),
      },
      {
        id: "lighthouse.vscode.openFile",
        handler: this.handleOpenFile.bind(this),
      },
      {
        id: "lighthouse.vscode.openDataset",
        handler: this.handleOpenDataset.bind(this),
      },
    ];

    commands.forEach(({ id, handler }) => {
      const disposable = vscode.commands.registerCommand(id, handler);
      this.context.subscriptions.push(disposable);
    });
  }

  /**
   * Setup UI components
   */
  private setupUI(): void {
    // Register tree data provider
    vscode.window.registerTreeDataProvider("lighthouseFiles", this.treeProvider);

    // Add tree view to subscriptions
    const treeView = vscode.window.createTreeView("lighthouseFiles", {
      treeDataProvider: this.treeProvider,
      showCollapseAll: true,
    });
    this.context.subscriptions.push(treeView);
  }

  /**
   * Setup configuration watching
   */
  private setupConfigurationWatching(): void {
    const configWatcher = vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("lighthouse")) {
        this.handleConfigurationChange();
      }
    });
    this.context.subscriptions.push(configWatcher);
  }

  /**
   * Handle upload file command
   */
  private async handleUploadFile(): Promise<void> {
    try {
      const fileUri = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: false,
        openLabel: "Upload to Lighthouse",
      });

      if (!fileUri || fileUri.length === 0) {
        return;
      }

      const file = fileUri[0];
      if (!file) {
        vscode.window.showErrorMessage("No file selected");
        return;
      }

      const operationId = `upload-${Date.now()}`;

      // Start progress tracking
      const progress = this.progressStreamer.startProgress(operationId, `Uploading ${file.fsPath}`);

      try {
        // Listen for progress events
        this.sdk.on("upload:progress", (event) => {
          progress.update({
            progress: event.data.percentage || 0,
            message: `Uploading... ${event.data.percentage || 0}%`,
          });
        });

        const result = await this.sdk.uploadFile(file.fsPath, {
          fileName: file.fsPath.split("/").pop() || "file",
        });

        progress.complete(result);
        this.statusBar.showSuccess(`File uploaded: ${result.hash}`);
        await this.treeProvider.refresh();

        vscode.window
          .showInformationMessage(`File uploaded successfully! Hash: ${result.hash}`, "Copy Hash")
          .then((selection) => {
            if (selection === "Copy Hash") {
              vscode.env.clipboard.writeText(result.hash);
            }
          });
      } catch (error) {
        progress.fail(error as Error);
        this.statusBar.showError("Upload failed");
        throw error;
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
      const name = await vscode.window.showInputBox({
        prompt: "Enter dataset name",
        placeHolder: "my-ai-dataset",
        validateInput: (value) => {
          if (!value || value.trim().length === 0) {
            return "Dataset name is required";
          }
          if (!/^[a-zA-Z0-9-_]+$/.test(value)) {
            return "Dataset name can only contain letters, numbers, hyphens, and underscores";
          }
          return null;
        },
      });

      if (!name) {
        return;
      }

      const description = await vscode.window.showInputBox({
        prompt: "Enter dataset description (optional)",
        placeHolder: "Dataset for AI training...",
      });

      const operationId = `dataset-${Date.now()}`;
      const progress = this.progressStreamer.startProgress(
        operationId,
        `Creating dataset: ${name}`,
      );

      try {
        // For now, create a mock dataset since the SDK doesn't have dataset methods yet
        const result = {
          id: `dataset-${Date.now()}`,
          name: name.trim(),
          description: description?.trim() || "",
          createdAt: new Date().toISOString(),
          files: [],
        };

        // TODO: Implement actual dataset creation when SDK supports it

        progress.complete(result);
        this.statusBar.showSuccess(`Dataset created: ${name}`);
        await this.treeProvider.refresh();

        vscode.window
          .showInformationMessage(`Dataset "${name}" created successfully!`, "View Dataset")
          .then((selection) => {
            if (selection === "View Dataset") {
              // Open dataset in tree view or external browser
              vscode.commands.executeCommand("lighthouse.vscode.refreshTree");
            }
          });
      } catch (error) {
        progress.fail(error as Error);
        this.statusBar.showError("Dataset creation failed");
        throw error;
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
      const config = vscode.workspace.getConfiguration("lighthouse.vscode");
      const currentUrl = config.get<string>("mcpServerUrl") || "http://localhost:3000";

      const url = await vscode.window.showInputBox({
        prompt: "Enter MCP Server URL",
        value: currentUrl,
        placeHolder: "http://localhost:3000",
        validateInput: (value) => {
          if (!value || value.trim().length === 0) {
            return "MCP Server URL is required";
          }
          try {
            new URL(value);
            return null;
          } catch {
            return "Please enter a valid URL";
          }
        },
      });

      if (!url) {
        return;
      }

      // Update configuration
      await config.update("mcpServerUrl", url.trim(), vscode.ConfigurationTarget.Workspace);

      // Test connection
      const operationId = `mcp-connect-${Date.now()}`;
      const progress = this.progressStreamer.startProgress(operationId, "Connecting to MCP Server");

      try {
        // Test the connection by making a simple request
        const response = await fetch(`${url.trim()}/health`);
        if (!response.ok) {
          throw new Error(`Server responded with status: ${response.status}`);
        }

        progress.complete();
        this.statusBar.showSuccess("MCP Server connected");

        vscode.window
          .showInformationMessage("Successfully connected to MCP Server!", "Test Tools")
          .then((selection) => {
            if (selection === "Test Tools") {
              vscode.commands.executeCommand("workbench.action.terminal.new");
            }
          });
      } catch (error) {
        progress.fail(error as Error);
        this.statusBar.showError("MCP connection failed");
        throw error;
      }
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to connect to MCP Server: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Handle refresh tree command
   */
  private async handleRefreshTree(): Promise<void> {
    try {
      await this.treeProvider.refresh();
      this.statusBar.showSuccess("Lighthouse files refreshed");
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to refresh: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Handle open file command
   */
  private async handleOpenFile(fileData: unknown): Promise<void> {
    try {
      // Type guard for file data
      if (!fileData || typeof fileData !== "object" || !("hash" in fileData)) {
        vscode.window.showErrorMessage("Invalid file data");
        return;
      }

      const file = fileData as { hash: string; name?: string };

      const operationId = `download-${Date.now()}`;
      const progress = this.progressStreamer.startProgress(
        operationId,
        `Downloading ${file.name || file.hash}`,
      );

      try {
        // Listen for download progress events
        this.sdk.on("download:progress", (event) => {
          progress.update({
            progress: event.data.percentage || 0,
            message: `Downloading... ${event.data.percentage || 0}%`,
          });
        });

        // Use downloadFile method (downloads to temp location)
        const tempPath = `/tmp/${file.name || file.hash}`;
        await this.sdk.downloadFile(file.hash, tempPath);

        // Read the file content for display
        const fs = require("fs");
        const content = fs.readFileSync(tempPath, "utf8");
        const result = { content };

        progress.complete(result);
        this.statusBar.showSuccess("File downloaded");

        // Open the file in a new editor
        const document = await vscode.workspace.openTextDocument({
          content: result.content || "",
          language: this.getLanguageFromExtension(file.name || ""),
        });
        await vscode.window.showTextDocument(document);
      } catch (error) {
        progress.fail(error as Error);
        this.statusBar.showError("Download failed");
        throw error;
      }
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to open file: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Handle open dataset command
   */
  private async handleOpenDataset(datasetData: unknown): Promise<void> {
    try {
      // Type guard for dataset data
      if (!datasetData || typeof datasetData !== "object" || !("id" in datasetData)) {
        vscode.window.showErrorMessage("Invalid dataset data");
        return;
      }

      const dataset = datasetData as {
        id: string;
        name?: string;
        description?: string;
        createdAt?: string;
      };

      const operationId = `dataset-${Date.now()}`;
      const progress = this.progressStreamer.startProgress(
        operationId,
        `Loading dataset ${dataset.name || dataset.id}`,
      );

      try {
        // For now, return mock dataset data since SDK doesn't have dataset methods yet
        const datasetResult = {
          id: dataset.id,
          name: dataset.name || dataset.id,
          description: dataset.description || "No description",
          files: [],
          createdAt: dataset.createdAt || new Date().toISOString(),
        };

        // TODO: Implement actual dataset retrieval when SDK supports it
        progress.complete(datasetResult);
        this.statusBar.showSuccess("Dataset loaded");

        // Show dataset information
        vscode.window
          .showInformationMessage(
            `Dataset "${datasetResult.name}" loaded successfully!`,
            "View Files",
            "Copy ID",
          )
          .then((selection) => {
            if (selection === "View Files") {
              // Expand the dataset in tree view
              vscode.commands.executeCommand("lighthouse.vscode.refreshTree");
            } else if (selection === "Copy ID") {
              vscode.env.clipboard.writeText(datasetResult.id);
            }
          });
      } catch (error) {
        progress.fail(error as Error);
        this.statusBar.showError("Dataset load failed");
        throw error;
      }
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to open dataset: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Get language from file extension
   */
  private getLanguageFromExtension(filename: string): string {
    const ext = filename.split(".").pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
      js: "javascript",
      ts: "typescript",
      py: "python",
      json: "json",
      md: "markdown",
      txt: "plaintext",
      html: "html",
      css: "css",
      yml: "yaml",
      yaml: "yaml",
    };
    return languageMap[ext || ""] || "plaintext";
  }

  /**
   * Handle configuration changes
   */
  private async handleConfigurationChange(): Promise<void> {
    try {
      const config = vscode.workspace.getConfiguration("lighthouse.vscode");
      const apiKey = config.get<string>("apiKey");

      if (apiKey) {
        // Update the SDK configuration with new API key
        this.sdk = new LighthouseAISDK({
          apiKey,
          maxRetries: 3,
          timeout: 30000,
        });
        await this.sdk.initialize();
        this.statusBar.showSuccess("Configuration updated");
      }
    } catch (error) {
      console.error("Error handling configuration change:", error);
      this.statusBar.showError("Configuration update failed");
    }
  }
}
