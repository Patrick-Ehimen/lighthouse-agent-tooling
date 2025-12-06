/**
 * MCP Client with Offline Support
 * @fileoverview Enhanced MCP client with offline queue and graceful degradation
 */

import { MCPClient, MCPClientConfig, MCPToolCallResult } from "./mcp-client.js";
import {
  OperationQueue,
  OperationType,
  OperationExecutor,
  QueuedOperation,
  ConnectionMonitor,
  ConnectionState,
} from "@lighthouse-tooling/shared";
import { Logger } from "@lighthouse-tooling/shared";
import * as vscode from "vscode";
import * as fs from "fs/promises";
import * as path from "path";

export interface OfflineMCPClientConfig extends MCPClientConfig {
  /** Enable offline queue */
  enableOfflineQueue?: boolean;
  /** Maximum queue size */
  maxQueueSize?: number;
  /** Path for queue persistence */
  queuePersistencePath?: string;
  /** Enable connection monitoring */
  enableConnectionMonitoring?: boolean;
}

/**
 * MCP Client with offline queue and graceful degradation
 */
export class OfflineMCPClient extends MCPClient implements OperationExecutor {
  private offlineQueue: OperationQueue;
  private connectionMonitor: ConnectionMonitor;
  private logger: Logger;
  private offlineConfig: Required<Omit<OfflineMCPClientConfig, keyof MCPClientConfig>>;
  private statusBarItem: vscode.StatusBarItem;
  private queuePersistencePath: string;

  constructor(config: OfflineMCPClientConfig = {}, context: vscode.ExtensionContext) {
    super(config);

    this.offlineConfig = {
      enableOfflineQueue: config.enableOfflineQueue ?? true,
      maxQueueSize: config.maxQueueSize ?? 50,
      queuePersistencePath: config.queuePersistencePath ?? context.globalStorageUri.fsPath,
      enableConnectionMonitoring: config.enableConnectionMonitoring ?? true,
    };

    this.logger = Logger.getInstance({
      level: "info",
      component: "OfflineMCPClient",
    });

    this.queuePersistencePath = path.join(
      this.offlineConfig.queuePersistencePath,
      "operation-queue.json",
    );

    // Initialize offline queue
    this.offlineQueue = new OperationQueue({
      maxQueueSize: this.offlineConfig.maxQueueSize,
      maxRetries: 3,
      retryDelay: 5000,
      persistenceEnabled: true,
      persistencePath: this.queuePersistencePath,
    });

    this.offlineQueue.setExecutor(this);

    // Initialize connection monitor
    this.connectionMonitor = new ConnectionMonitor({
      healthCheckInterval: 30000, // 30 seconds
      maxReconnectAttempts: 5,
      reconnectDelay: 5000,
      exponentialBackoff: true,
    });

    this.connectionMonitor.setConnectionCheck(async () => {
      return this.isClientConnected();
    });

    this.connectionMonitor.setReconnectFunction(async () => {
      await this.connect();
    });

    // Create status bar item
    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.statusBarItem.command = "lighthouse.vscode.showQueueStatus";
    context.subscriptions.push(this.statusBarItem);

    // Set up event listeners
    this.setupEventListeners();

    // Load persisted queue
    this.loadPersistedQueue();
  }

  /**
   * Setup event listeners for queue and connection monitor
   */
  private setupEventListeners(): void {
    // Queue events
    this.offlineQueue.on("enqueued", (operation: QueuedOperation) => {
      this.updateStatusBar();
      vscode.window.showInformationMessage(`Operation queued: ${operation.type} (offline mode)`);
    });

    this.offlineQueue.on("completed", (operation: QueuedOperation) => {
      this.updateStatusBar();
      vscode.window.showInformationMessage(`Operation completed: ${operation.type}`);
    });

    this.offlineQueue.on("failed", (operation: QueuedOperation) => {
      this.updateStatusBar();
      vscode.window.showErrorMessage(`Operation failed: ${operation.type} - ${operation.error}`);
    });

    this.offlineQueue.on("persist_required", async (data: { operations: QueuedOperation[] }) => {
      await this.persistQueue(data.operations);
    });

    // Connection monitor events
    this.connectionMonitor.on("connected", () => {
      this.updateStatusBar();
      vscode.window.showInformationMessage("Lighthouse MCP server connected");
    });

    this.connectionMonitor.on("disconnected", () => {
      this.updateStatusBar();
      vscode.window.showWarningMessage(
        "Lighthouse MCP server disconnected. Operations will be queued.",
      );
    });

    this.connectionMonitor.on("reconnecting", () => {
      this.updateStatusBar();
    });

    this.connectionMonitor.on("reconnect_failed", () => {
      vscode.window.showErrorMessage(
        "Failed to reconnect to Lighthouse MCP server. Please check your configuration.",
      );
    });
  }

  /**
   * Override connect to integrate with connection monitor
   */
  async connect(): Promise<void> {
    try {
      await super.connect();
      this.connectionMonitor.markConnected();
      this.updateStatusBar();
    } catch (error) {
      this.connectionMonitor.markDisconnected(
        error instanceof Error ? error.message : "Connection failed",
      );
      this.updateStatusBar();
      throw error;
    }
  }

  /**
   * Override disconnect to integrate with connection monitor
   */
  async disconnect(): Promise<void> {
    await super.disconnect();
    this.connectionMonitor.markDisconnected();
    this.updateStatusBar();
  }

  /**
   * Override callTool to support offline queuing
   */
  async callTool(toolName: string, args: Record<string, unknown>): Promise<MCPToolCallResult> {
    // If connected, call directly
    if (this.isClientConnected()) {
      try {
        const result = await super.callTool(toolName, args);
        return result;
      } catch (error) {
        // If call fails, mark as disconnected and queue
        this.connectionMonitor.markDisconnected(
          error instanceof Error ? error.message : "Tool call failed",
        );

        if (this.offlineConfig.enableOfflineQueue) {
          return await this.queueOperation(toolName, args);
        }

        throw error;
      }
    }

    // If offline and queue enabled, queue the operation
    if (this.offlineConfig.enableOfflineQueue) {
      return await this.queueOperation(toolName, args);
    }

    // Otherwise, throw error
    throw new Error(
      "MCP server not connected and offline queue is disabled. Please check your connection.",
    );
  }

  /**
   * Queue operation for later execution
   */
  private async queueOperation(
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<MCPToolCallResult> {
    try {
      const operationType = this.mapToolToOperationType(toolName);
      const operationId = await this.offlineQueue.enqueue(operationType, {
        toolName,
        args,
      });

      this.logger.info("Operation queued", {
        id: operationId,
        toolName,
      });

      return {
        success: true,
        data: {
          queued: true,
          operationId,
          message: "Operation queued for execution when connection is restored",
        },
      };
    } catch (error) {
      this.logger.error("Failed to queue operation", error as Error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to queue operation",
      };
    }
  }

  /**
   * Map MCP tool name to operation type
   */
  private mapToolToOperationType(toolName: string): OperationType {
    const mapping: Record<string, OperationType> = {
      lighthouse_upload_file: OperationType.UPLOAD_FILE,
      lighthouse_fetch_file: OperationType.FETCH_FILE,
      lighthouse_create_dataset: OperationType.CREATE_DATASET,
      lighthouse_update_dataset: OperationType.UPDATE_DATASET,
    };

    return mapping[toolName] || OperationType.UPLOAD_FILE;
  }

  /**
   * Execute queued operation (OperationExecutor interface)
   */
  async execute(operation: QueuedOperation): Promise<unknown> {
    const { toolName, args } = operation.params as {
      toolName: string;
      args: Record<string, unknown>;
    };

    this.logger.info("Executing queued operation", {
      id: operation.id,
      toolName,
    });

    const result = await super.callTool(toolName, args);

    if (!result.success) {
      throw new Error(result.error || "Operation failed");
    }

    return result.data;
  }

  /**
   * Check if executor can execute (OperationExecutor interface)
   */
  async canExecute(): Promise<boolean> {
    return this.isClientConnected();
  }

  /**
   * Start connection monitoring
   */
  startMonitoring(): void {
    if (this.offlineConfig.enableConnectionMonitoring) {
      this.connectionMonitor.start();
      this.updateStatusBar();
    }
  }

  /**
   * Stop connection monitoring
   */
  stopMonitoring(): void {
    this.connectionMonitor.stop();
  }

  /**
   * Get queue statistics
   */
  getQueueStats() {
    return this.offlineQueue.getStats();
  }

  /**
   * Get all queued operations
   */
  getAllQueuedOperations(): QueuedOperation[] {
    return this.offlineQueue.getAllOperations();
  }

  /**
   * Retry failed operation
   */
  async retryOperation(operationId: string): Promise<boolean> {
    return await this.offlineQueue.retryOperation(operationId);
  }

  /**
   * Cancel operation
   */
  async cancelOperation(operationId: string): Promise<boolean> {
    return await this.offlineQueue.cancelOperation(operationId);
  }

  /**
   * Clear completed operations
   */
  async clearCompleted(): Promise<number> {
    return await this.offlineQueue.clearCompleted();
  }

  /**
   * Get connection state
   */
  getConnectionState(): ConnectionState {
    return this.connectionMonitor.getState();
  }

  /**
   * Update status bar
   */
  private updateStatusBar(): void {
    const state = this.connectionMonitor.getState();
    const stats = this.offlineQueue.getStats();

    let icon: string;
    let text: string;
    let tooltip: string;

    switch (state) {
      case ConnectionState.CONNECTED:
        icon = "$(cloud)";
        text = "Lighthouse";
        tooltip = "Lighthouse MCP Server: Connected";
        break;
      case ConnectionState.CONNECTING:
      case ConnectionState.RECONNECTING:
        icon = "$(sync~spin)";
        text = "Lighthouse";
        tooltip = "Lighthouse MCP Server: Connecting...";
        break;
      case ConnectionState.DISCONNECTED:
        icon = "$(cloud-offline)";
        text = "Lighthouse (Offline)";
        tooltip = "Lighthouse MCP Server: Offline";
        break;
      case ConnectionState.ERROR:
        icon = "$(error)";
        text = "Lighthouse (Error)";
        tooltip = "Lighthouse MCP Server: Error";
        break;
    }

    if (stats.pending > 0 || stats.processing > 0) {
      text += ` (${stats.pending + stats.processing} queued)`;
      tooltip += `\n${stats.pending} pending, ${stats.processing} processing`;
    }

    if (stats.failed > 0) {
      text += ` [${stats.failed} failed]`;
      tooltip += `\n${stats.failed} failed operations`;
    }

    this.statusBarItem.text = `${icon} ${text}`;
    this.statusBarItem.tooltip = tooltip;
    this.statusBarItem.show();
  }

  /**
   * Persist queue to storage
   */
  private async persistQueue(operations: QueuedOperation[]): Promise<void> {
    try {
      const dir = path.dirname(this.queuePersistencePath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(this.queuePersistencePath, JSON.stringify(operations, null, 2));
      this.logger.debug("Queue persisted", { count: operations.length });
    } catch (error) {
      this.logger.error("Failed to persist queue", error as Error);
    }
  }

  /**
   * Load persisted queue
   */
  private async loadPersistedQueue(): Promise<void> {
    try {
      const data = await fs.readFile(this.queuePersistencePath, "utf-8");
      const operations = JSON.parse(data) as QueuedOperation[];
      await this.offlineQueue.loadQueue(operations);
      this.updateStatusBar();
      this.logger.info("Queue loaded from persistence", {
        count: operations.length,
      });
    } catch (error) {
      // File might not exist on first run
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        this.logger.error("Failed to load persisted queue", error as Error);
      }
    }
  }

  /**
   * Dispose client
   */
  async dispose(): Promise<void> {
    this.stopMonitoring();
    await this.offlineQueue.dispose();
    this.connectionMonitor.dispose();
    this.statusBarItem.dispose();
    await super.disconnect();
  }
}
