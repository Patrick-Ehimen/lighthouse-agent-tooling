/**
 * VSCode Progress Streamer
 * @fileoverview VSCode-specific implementation of progress streaming
 */

import * as vscode from "vscode";
import type { ProgressStreamer, ProgressStream, ProgressUpdate } from "../types/mock-types";

/**
 * VSCode progress stream implementation
 */
class VSCodeProgressStream implements ProgressStream {
  private isStreamActive = true;
  private currentProgress: ProgressUpdate;

  constructor(
    public readonly operationId: string,
    public readonly title: string,
    private progress: vscode.Progress<{ message?: string; increment?: number }>,
    private token: vscode.CancellationToken,
    private resolve: (value?: unknown) => void,
    private reject: (reason?: unknown) => void,
  ) {
    // Initialize current progress
    this.currentProgress = {
      operationId: this.operationId,
      title: this.title,
      progress: 0,
      message: "",
      completed: false,
      cancelled: false,
      timestamp: new Date(),
    };

    // Handle cancellation
    token.onCancellationRequested(() => {
      this.cancel();
    });
  }

  /**
   * Update progress
   */
  update(progressUpdate: ProgressUpdate): void {
    if (!this.isStreamActive) {
      return;
    }

    const previousProgress = this.currentProgress.progress || 0;
    const newProgress = progressUpdate.progress || 0;
    const increment = Math.max(0, newProgress - previousProgress);

    this.progress.report({
      message: progressUpdate.message || this.currentProgress.message,
      increment,
    });

    this.currentProgress = {
      ...this.currentProgress,
      ...progressUpdate,
      timestamp: new Date(),
    };
  }

  /**
   * Complete the progress
   */
  complete(result?: unknown): void {
    if (!this.isStreamActive) {
      return;
    }

    this.currentProgress = {
      ...this.currentProgress,
      completed: true,
      progress: 100,
      result,
      timestamp: new Date(),
    };

    this.isStreamActive = false;
    this.resolve(result);
  }

  /**
   * Fail the progress
   */
  fail(error: Error): void {
    if (!this.isStreamActive) {
      return;
    }

    this.currentProgress = {
      ...this.currentProgress,
      completed: true,
      error: error.message,
      timestamp: new Date(),
    };

    this.isStreamActive = false;
    this.reject(error);
  }

  /**
   * Cancel the progress
   */
  cancel(): void {
    if (!this.isStreamActive) {
      return;
    }

    this.currentProgress = {
      ...this.currentProgress,
      cancelled: true,
      timestamp: new Date(),
    };

    this.isStreamActive = false;
    this.reject(new Error("Operation was cancelled"));
  }

  /**
   * Get current progress
   */
  getCurrentProgress(): ProgressUpdate {
    return { ...this.currentProgress };
  }

  /**
   * Check if the progress is active
   */
  isActive(): boolean {
    return this.isStreamActive;
  }
}

/**
 * VSCode progress streamer implementation
 */
export class VSCodeProgressStreamer implements ProgressStreamer {
  private activeStreams = new Map<string, VSCodeProgressStream>();

  /**
   * Start a progress stream
   */
  startProgress(operationId: string, title: string): ProgressStream {
    if (this.activeStreams.has(operationId)) {
      throw new Error(`Progress stream ${operationId} is already active`);
    }

    return new Promise<unknown>((resolve, reject) => {
      vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title,
          cancellable: true,
        },
        (progress, token) => {
          const stream = new VSCodeProgressStream(
            operationId,
            title,
            progress,
            token,
            resolve,
            reject,
          );
          this.activeStreams.set(operationId, stream);

          // Clean up when completed
          const cleanup = () => {
            this.activeStreams.delete(operationId);
          };

          return new Promise<unknown>((streamResolve, streamReject) => {
            const originalResolve = stream["resolve"];
            const originalReject = stream["reject"];

            stream["resolve"] = (value?: unknown) => {
              cleanup();
              originalResolve(value);
              streamResolve(value);
            };

            stream["reject"] = (reason?: unknown) => {
              cleanup();
              originalReject(reason);
              streamReject(reason);
            };
          });
        },
      );
    }) as unknown as ProgressStream;
  }

  /**
   * Get an existing progress stream
   */
  getProgress(operationId: string): ProgressStream | undefined {
    return this.activeStreams.get(operationId);
  }

  /**
   * Stop a progress stream
   */
  stopProgress(operationId: string): void {
    const stream = this.activeStreams.get(operationId);
    if (stream) {
      stream.cancel();
      this.activeStreams.delete(operationId);
    }
  }

  /**
   * Get all active progress streams
   */
  getActiveStreams(): ProgressStream[] {
    return Array.from(this.activeStreams.values());
  }
}
