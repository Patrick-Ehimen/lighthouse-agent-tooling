import { EventEmitter } from "eventemitter3";
import { ProgressInfo, SDKEvent, SDKEventType } from "../types";

/**
 * Tracks progress for file operations and emits events for UI integration
 */
export class ProgressTracker extends EventEmitter {
  private operations = new Map<string, OperationProgress>();

  /**
   * Start tracking a new operation
   */
  startOperation(operationId: string, type: "upload" | "download", totalSize?: number): void {
    const operation: OperationProgress = {
      id: operationId,
      type,
      startTime: Date.now(),
      totalSize,
      loaded: 0,
      phase: "preparing",
      rate: 0,
      lastUpdate: Date.now(),
    };

    this.operations.set(operationId, operation);
    this.emitEvent(`${type}:start` as SDKEventType, operationId, { totalSize });
  }

  /**
   * Update progress for an operation
   */
  updateProgress(operationId: string, loaded: number, phase?: ProgressInfo["phase"]): void {
    const operation = this.operations.get(operationId);
    if (!operation) {
      return;
    }

    const now = Date.now();
    const timeDelta = now - operation.lastUpdate;
    const bytesDelta = loaded - operation.loaded;

    // Calculate transfer rate (bytes per second)
    if (timeDelta > 0) {
      operation.rate = (bytesDelta / timeDelta) * 1000;
    }

    operation.loaded = loaded;
    operation.lastUpdate = now;

    if (phase) {
      operation.phase = phase;
    }

    const progressInfo = this.calculateProgressInfo(operation);

    this.emitEvent(`${operation.type}:progress` as SDKEventType, operationId, progressInfo);
  }

  /**
   * Complete an operation
   */
  completeOperation(operationId: string, result?: any): void {
    const operation = this.operations.get(operationId);
    if (!operation) {
      return;
    }

    operation.phase = "complete";
    const progressInfo = this.calculateProgressInfo(operation);

    this.emitEvent(`${operation.type}:complete` as SDKEventType, operationId, {
      ...progressInfo,
      result,
    });

    this.operations.delete(operationId);
  }

  /**
   * Mark an operation as failed
   */
  failOperation(operationId: string, error: Error): void {
    const operation = this.operations.get(operationId);
    if (!operation) {
      return;
    }

    this.emitEvent(`${operation.type}:error` as SDKEventType, operationId, undefined, error);

    this.operations.delete(operationId);
  }

  /**
   * Get current progress for an operation
   */
  getProgress(operationId: string): ProgressInfo | null {
    const operation = this.operations.get(operationId);
    if (!operation) {
      return null;
    }

    return this.calculateProgressInfo(operation);
  }

  /**
   * Get all active operations
   */
  getActiveOperations(): string[] {
    return Array.from(this.operations.keys());
  }

  /**
   * Cancel an operation
   */
  cancelOperation(operationId: string): void {
    const operation = this.operations.get(operationId);
    if (!operation) {
      return;
    }

    this.emitEvent(
      `${operation.type}:error` as SDKEventType,
      operationId,
      undefined,
      new Error("Operation cancelled"),
    );

    this.operations.delete(operationId);
  }

  /**
   * Calculate progress information from operation data
   */
  private calculateProgressInfo(operation: OperationProgress): ProgressInfo {
    const percentage = operation.totalSize
      ? Math.min(100, (operation.loaded / operation.totalSize) * 100)
      : 0;

    let eta: number | undefined;
    if (operation.totalSize && operation.rate > 0) {
      const remaining = operation.totalSize - operation.loaded;
      eta = remaining / operation.rate;
    }

    return {
      loaded: operation.loaded,
      total: operation.totalSize,
      percentage,
      rate: operation.rate,
      eta,
      phase: operation.phase,
    };
  }

  /**
   * Emit SDK event
   */
  private emitEvent(type: SDKEventType, operationId: string, data?: any, error?: Error): void {
    const event: SDKEvent = {
      type,
      operationId,
      data,
      error,
      timestamp: new Date(),
    };

    this.emit(type, event);
    this.emit("event", event);
  }

  /**
   * Create a progress callback function for an operation
   */
  createProgressCallback(operationId: string): (loaded: number, total?: number) => void {
    return (loaded: number, total?: number) => {
      const operation = this.operations.get(operationId);
      if (operation && total && !operation.totalSize) {
        operation.totalSize = total;
      }
      this.updateProgress(operationId, loaded);
    };
  }

  /**
   * Cleanup all operations
   */
  cleanup(): void {
    this.operations.clear();
    this.removeAllListeners();
  }
}

/**
 * Internal operation progress tracking
 */
interface OperationProgress {
  id: string;
  type: "upload" | "download";
  startTime: number;
  totalSize?: number;
  loaded: number;
  phase: ProgressInfo["phase"];
  rate: number;
  lastUpdate: number;
}
