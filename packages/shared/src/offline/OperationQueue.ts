/**
 * Operation Queue for Offline Mode
 * @fileoverview Manages queued operations when MCP server is unavailable
 */

import { Logger } from "../utils/logger.js";
import { EventEmitter } from "events";

export enum OperationStatus {
  PENDING = "pending",
  PROCESSING = "processing",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled",
}

export enum OperationType {
  UPLOAD_FILE = "upload_file",
  FETCH_FILE = "fetch_file",
  CREATE_DATASET = "create_dataset",
  UPDATE_DATASET = "update_dataset",
}

export interface QueuedOperation {
  id: string;
  type: OperationType;
  status: OperationStatus;
  params: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  retryCount: number;
  maxRetries: number;
  error?: string;
  result?: unknown;
}

export interface OperationQueueConfig {
  maxQueueSize?: number;
  maxRetries?: number;
  retryDelay?: number;
  persistenceEnabled?: boolean;
  persistencePath?: string;
}

export interface OperationExecutor {
  execute(operation: QueuedOperation): Promise<unknown>;
  canExecute(): Promise<boolean>;
}

/**
 * Operation Queue with offline support and retry logic
 */
export class OperationQueue extends EventEmitter {
  private queue: Map<string, QueuedOperation> = new Map();
  private logger: Logger;
  private config: Required<OperationQueueConfig>;
  private isProcessing = false;
  private executor: OperationExecutor | null = null;

  constructor(config: OperationQueueConfig = {}) {
    super();
    this.config = {
      maxQueueSize: config.maxQueueSize ?? 100,
      maxRetries: config.maxRetries ?? 3,
      retryDelay: config.retryDelay ?? 5000, // 5 seconds
      persistenceEnabled: config.persistenceEnabled ?? true,
      persistencePath: config.persistencePath ?? ".lighthouse-queue",
    };

    this.logger = Logger.getInstance({
      level: "info",
      component: "OperationQueue",
    });
  }

  /**
   * Set the executor for operations
   */
  setExecutor(executor: OperationExecutor): void {
    this.executor = executor;
  }

  /**
   * Add operation to queue
   */
  async enqueue(
    type: OperationType,
    params: Record<string, unknown>,
    options: { maxRetries?: number } = {},
  ): Promise<string> {
    // Check queue size limit
    if (this.queue.size >= this.config.maxQueueSize) {
      throw new Error(
        `Queue size limit reached (${this.config.maxQueueSize}). Please wait for pending operations to complete.`,
      );
    }

    const operation: QueuedOperation = {
      id: this.generateId(),
      type,
      status: OperationStatus.PENDING,
      params,
      createdAt: new Date(),
      updatedAt: new Date(),
      retryCount: 0,
      maxRetries: options.maxRetries ?? this.config.maxRetries,
    };

    this.queue.set(operation.id, operation);
    this.logger.info("Operation enqueued", {
      id: operation.id,
      type: operation.type,
    });

    this.emit("enqueued", operation);

    // Persist queue if enabled
    if (this.config.persistenceEnabled) {
      await this.persistQueue();
    }

    // Try to process immediately
    setImmediate(() => this.processQueue());

    return operation.id;
  }

  /**
   * Get operation status
   */
  getOperation(id: string): QueuedOperation | undefined {
    return this.queue.get(id);
  }

  /**
   * Get all operations
   */
  getAllOperations(): QueuedOperation[] {
    return Array.from(this.queue.values());
  }

  /**
   * Get pending operations
   */
  getPendingOperations(): QueuedOperation[] {
    return this.getAllOperations().filter((op) => op.status === OperationStatus.PENDING);
  }

  /**
   * Get failed operations
   */
  getFailedOperations(): QueuedOperation[] {
    return this.getAllOperations().filter((op) => op.status === OperationStatus.FAILED);
  }

  /**
   * Cancel operation
   */
  async cancelOperation(id: string): Promise<boolean> {
    const operation = this.queue.get(id);
    if (!operation) {
      return false;
    }

    if (operation.status === OperationStatus.PROCESSING) {
      this.logger.warn("Cannot cancel operation in progress", { id });
      return false;
    }

    operation.status = OperationStatus.CANCELLED;
    operation.updatedAt = new Date();

    this.logger.info("Operation cancelled", { id });
    this.emit("cancelled", operation);

    if (this.config.persistenceEnabled) {
      await this.persistQueue();
    }

    return true;
  }

  /**
   * Retry failed operation
   */
  async retryOperation(id: string): Promise<boolean> {
    const operation = this.queue.get(id);
    if (!operation || operation.status !== OperationStatus.FAILED) {
      return false;
    }

    operation.status = OperationStatus.PENDING;
    operation.retryCount = 0;
    operation.error = undefined;
    operation.updatedAt = new Date();

    this.logger.info("Operation retry requested", { id });
    this.emit("retry", operation);

    if (this.config.persistenceEnabled) {
      await this.persistQueue();
    }

    // Process immediately
    setImmediate(() => this.processQueue());

    return true;
  }

  /**
   * Clear completed and cancelled operations
   */
  async clearCompleted(): Promise<number> {
    let cleared = 0;
    const idsToDelete: string[] = [];

    // Collect IDs to delete
    this.queue.forEach((operation, id) => {
      if (
        operation.status === OperationStatus.COMPLETED ||
        operation.status === OperationStatus.CANCELLED
      ) {
        idsToDelete.push(id);
      }
    });

    // Delete collected IDs
    for (const id of idsToDelete) {
      this.queue.delete(id);
      cleared++;
    }

    this.logger.info("Cleared completed operations", { count: cleared });

    if (this.config.persistenceEnabled && cleared > 0) {
      await this.persistQueue();
    }

    return cleared;
  }

  /**
   * Process queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || !this.executor) {
      return;
    }

    this.isProcessing = true;

    try {
      // Check if executor can execute
      const canExecute = await this.executor.canExecute();
      if (!canExecute) {
        this.logger.debug("Executor not ready, will retry later");
        return;
      }

      // Get pending operations
      const pending = this.getPendingOperations();
      if (pending.length === 0) {
        return;
      }

      // Process operations sequentially
      for (const operation of pending) {
        await this.processOperation(operation);
      }
    } catch (error) {
      this.logger.error("Error processing queue", error as Error);
    } finally {
      this.isProcessing = false;

      // Check if there are still pending operations
      if (this.getPendingOperations().length > 0) {
        // Schedule next processing
        setTimeout(() => this.processQueue(), this.config.retryDelay);
      }
    }
  }

  /**
   * Process single operation
   */
  private async processOperation(operation: QueuedOperation): Promise<void> {
    if (!this.executor) {
      return;
    }

    operation.status = OperationStatus.PROCESSING;
    operation.updatedAt = new Date();
    this.emit("processing", operation);

    try {
      const result = await this.executor.execute(operation);

      operation.status = OperationStatus.COMPLETED;
      operation.result = result;
      operation.updatedAt = new Date();

      this.logger.info("Operation completed", {
        id: operation.id,
        type: operation.type,
      });

      this.emit("completed", operation);

      if (this.config.persistenceEnabled) {
        await this.persistQueue();
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      operation.retryCount++;
      operation.error = errorMessage;
      operation.updatedAt = new Date();

      if (operation.retryCount >= operation.maxRetries) {
        operation.status = OperationStatus.FAILED;
        this.logger.error("Operation failed (max retries reached)", error as Error, {
          id: operation.id,
          type: operation.type,
          retries: operation.retryCount,
        });
        this.emit("failed", operation);
      } else {
        operation.status = OperationStatus.PENDING;
        this.logger.warn("Operation failed, will retry", {
          id: operation.id,
          type: operation.type,
          retries: operation.retryCount,
          maxRetries: operation.maxRetries,
        });
        this.emit("retry_scheduled", operation);
      }

      if (this.config.persistenceEnabled) {
        await this.persistQueue();
      }
    }
  }

  /**
   * Generate unique operation ID
   */
  private generateId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Persist queue to storage
   */
  private async persistQueue(): Promise<void> {
    // This will be implemented based on the environment (Node.js fs or browser storage)
    // For now, just emit an event that can be handled by the extension
    this.emit("persist_required", {
      operations: this.getAllOperations(),
      path: this.config.persistencePath,
    });
  }

  /**
   * Load queue from storage
   */
  async loadQueue(operations: QueuedOperation[]): Promise<void> {
    this.queue.clear();

    for (const operation of operations) {
      // Restore dates
      operation.createdAt = new Date(operation.createdAt);
      operation.updatedAt = new Date(operation.updatedAt);

      // Only restore pending and failed operations
      if (
        operation.status === OperationStatus.PENDING ||
        operation.status === OperationStatus.FAILED
      ) {
        this.queue.set(operation.id, operation);
      }
    }

    this.logger.info("Queue loaded from storage", {
      count: this.queue.size,
    });

    this.emit("loaded", { count: this.queue.size });

    // Start processing
    if (this.queue.size > 0) {
      setImmediate(() => this.processQueue());
    }
  }

  /**
   * Get queue statistics
   */
  getStats(): {
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    cancelled: number;
  } {
    const operations = this.getAllOperations();
    return {
      total: operations.length,
      pending: operations.filter((op) => op.status === OperationStatus.PENDING).length,
      processing: operations.filter((op) => op.status === OperationStatus.PROCESSING).length,
      completed: operations.filter((op) => op.status === OperationStatus.COMPLETED).length,
      failed: operations.filter((op) => op.status === OperationStatus.FAILED).length,
      cancelled: operations.filter((op) => op.status === OperationStatus.CANCELLED).length,
    };
  }

  /**
   * Dispose queue
   */
  async dispose(): Promise<void> {
    this.isProcessing = false;
    this.executor = null;

    if (this.config.persistenceEnabled) {
      await this.persistQueue();
    }

    this.queue.clear();
    this.removeAllListeners();

    this.logger.info("Operation queue disposed");
  }
}
