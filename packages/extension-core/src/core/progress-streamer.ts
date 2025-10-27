/**
 * Progress streamer implementation
 * @fileoverview Manages progress streams for long-running operations
 */

import type { ProgressStreamer, ProgressStream, ProgressUpdate } from "../types/index.js";
import type { ExtensionEventEmitter } from "../events/event-emitter.js";
import { Logger } from "@lighthouse-tooling/shared";

/**
 * Progress stream implementation
 */
export class ProgressStreamImpl implements ProgressStream {
  private _operationId: string;
  private _title: string;
  private _currentProgress: ProgressUpdate;
  private _active = true;
  private _eventEmitter: ExtensionEventEmitter;
  private _logger: Logger;

  constructor(operationId: string, title: string, eventEmitter: ExtensionEventEmitter) {
    this._operationId = operationId;
    this._title = title;
    this._eventEmitter = eventEmitter;
    this._logger = new Logger({ level: "info", component: `ProgressStream:${operationId}` });

    this._currentProgress = {
      operationId,
      title,
      progress: 0,
      message: "Starting...",
      timestamp: new Date(),
    };

    this._logger.debug(`Progress stream started: ${title}`);
  }

  /**
   * Operation identifier
   */
  get operationId(): string {
    return this._operationId;
  }

  /**
   * Progress title
   */
  get title(): string {
    return this._title;
  }

  /**
   * Update progress
   */
  update(progress: ProgressUpdate): void {
    if (!this._active) {
      this._logger.warn("Attempted to update inactive progress stream");
      return;
    }

    this._currentProgress = {
      ...progress,
      operationId: this._operationId,
      timestamp: new Date(),
    };

    this._logger.debug(`Progress updated: ${progress.progress}% - ${progress.message}`);

    // Emit progress update event
    this._eventEmitter.emit("progress.updated", {
      type: "progress.updated",
      data: this._currentProgress,
      timestamp: new Date(),
      source: "ProgressStream",
    });
  }

  /**
   * Complete the progress
   */
  complete(result?: unknown): void {
    if (!this._active) {
      return;
    }

    this._currentProgress = {
      ...this._currentProgress,
      progress: 100,
      message: "Completed",
      completed: true,
      result,
      timestamp: new Date(),
    };

    this._active = false;
    this._logger.debug("Progress stream completed");

    // Emit completion event
    this._eventEmitter.emit("progress.completed", {
      type: "progress.completed",
      data: { ...this._currentProgress, result },
      timestamp: new Date(),
      source: "ProgressStream",
    });
  }

  /**
   * Fail the progress
   */
  fail(error: Error): void {
    if (!this._active) {
      return;
    }

    this._currentProgress = {
      ...this._currentProgress,
      message: `Failed: ${error.message}`,
      error: error.message,
      completed: true,
      timestamp: new Date(),
    };

    this._active = false;
    this._logger.error("Progress stream failed:", error as Error);

    // Emit failure event
    this._eventEmitter.emit("progress.failed", {
      type: "progress.failed",
      data: { ...this._currentProgress, error: error.message },
      timestamp: new Date(),
      source: "ProgressStream",
    });
  }

  /**
   * Cancel the progress
   */
  cancel(): void {
    if (!this._active) {
      return;
    }

    this._currentProgress = {
      ...this._currentProgress,
      message: "Cancelled",
      cancelled: true,
      completed: true,
      timestamp: new Date(),
    };

    this._active = false;
    this._logger.debug("Progress stream cancelled");

    // Emit cancellation event
    this._eventEmitter.emit("progress.cancelled", {
      type: "progress.cancelled",
      data: this._currentProgress,
      timestamp: new Date(),
      source: "ProgressStream",
    });
  }

  /**
   * Get current progress
   */
  getCurrentProgress(): ProgressUpdate {
    return { ...this._currentProgress };
  }

  /**
   * Check if the progress is active
   */
  isActive(): boolean {
    return this._active;
  }
}

/**
 * Progress streamer implementation
 */
export class ProgressStreamerImpl implements ProgressStreamer {
  private _streams = new Map<string, ProgressStream>();
  private _eventEmitter: ExtensionEventEmitter;
  private _logger: Logger;

  constructor(eventEmitter: ExtensionEventEmitter) {
    this._eventEmitter = eventEmitter;
    this._logger = new Logger({ level: "info", component: "ProgressStreamer" });

    // Clean up completed streams periodically
    setInterval(() => this._cleanupCompletedStreams(), 60000); // Every minute
  }

  /**
   * Start a progress stream
   */
  startProgress(operationId: string, title: string): ProgressStream {
    if (this._streams.has(operationId)) {
      this._logger.warn(`Progress stream ${operationId} already exists, replacing`);
      this.stopProgress(operationId);
    }

    const stream = new ProgressStreamImpl(operationId, title, this._eventEmitter);
    this._streams.set(operationId, stream);

    this._logger.debug(`Started progress stream: ${operationId} - ${title}`);

    // Emit stream started event
    this._eventEmitter.emit("progress.started", {
      type: "progress.started",
      data: { operationId, title },
      timestamp: new Date(),
      source: "ProgressStreamer",
    });

    return stream;
  }

  /**
   * Get an existing progress stream
   */
  getProgress(operationId: string): ProgressStream | undefined {
    return this._streams.get(operationId);
  }

  /**
   * Stop a progress stream
   */
  stopProgress(operationId: string): void {
    const stream = this._streams.get(operationId);
    if (!stream) {
      this._logger.warn(`Progress stream ${operationId} not found`);
      return;
    }

    if (stream.isActive()) {
      stream.cancel();
    }

    this._streams.delete(operationId);
    this._logger.debug(`Stopped progress stream: ${operationId}`);

    // Emit stream stopped event
    this._eventEmitter.emit("progress.stopped", {
      type: "progress.stopped",
      data: { operationId },
      timestamp: new Date(),
      source: "ProgressStreamer",
    });
  }

  /**
   * Get all active progress streams
   */
  getActiveStreams(): ProgressStream[] {
    return Array.from(this._streams.values()).filter((stream) => stream.isActive());
  }

  /**
   * Get all progress streams (active and inactive)
   */
  getAllStreams(): ProgressStream[] {
    return Array.from(this._streams.values());
  }

  /**
   * Clear all progress streams
   */
  clearAllStreams(): void {
    for (const [operationId, stream] of this._streams) {
      if (stream.isActive()) {
        stream.cancel();
      }
    }

    this._streams.clear();
    this._logger.debug("Cleared all progress streams");

    // Emit cleared event
    this._eventEmitter.emit("progress.cleared", {
      type: "progress.cleared",
      data: {},
      timestamp: new Date(),
      source: "ProgressStreamer",
    });
  }

  /**
   * Clean up completed streams
   */
  private _cleanupCompletedStreams(): void {
    const completedStreams: string[] = [];

    for (const [operationId, stream] of this._streams) {
      if (!stream.isActive()) {
        const progress = stream.getCurrentProgress();
        // Remove streams that completed more than 5 minutes ago
        if (progress.timestamp && Date.now() - progress.timestamp.getTime() > 300000) {
          completedStreams.push(operationId);
        }
      }
    }

    for (const operationId of completedStreams) {
      this._streams.delete(operationId);
    }

    if (completedStreams.length > 0) {
      this._logger.debug(`Cleaned up ${completedStreams.length} completed progress streams`);
    }
  }
}
