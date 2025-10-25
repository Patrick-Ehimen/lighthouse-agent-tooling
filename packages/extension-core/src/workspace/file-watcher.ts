/**
 * File watcher implementation
 * @fileoverview Watches for file system changes in the workspace
 */

import { Logger } from "@lighthouse-tooling/shared";
import * as fs from "fs";
import * as path from "path";

/**
 * File change event
 */
export interface FileChangeEvent {
  /** Event type */
  type: "created" | "modified" | "deleted" | "renamed";
  /** File path */
  path: string;
  /** Previous path (for rename events) */
  previousPath?: string;
  /** Timestamp */
  timestamp: Date;
}

/**
 * File change callback
 */
export type FileChangeCallback = (event: FileChangeEvent) => void;

/**
 * File watcher implementation
 */
export class FileWatcherImpl {
  private _workspacePath: string;
  private _watchers = new Map<string, fs.FSWatcher>();
  private _callbacks = new Set<FileChangeCallback>();
  private _logger: Logger;
  private _debounceMap = new Map<string, NodeJS.Timeout>();
  private _debounceDelay = 300; // 300ms debounce

  constructor(workspacePath: string) {
    this._workspacePath = workspacePath;
    this._logger = new Logger({ level: "info", component: "FileWatcher" });
  }

  /**
   * Initialize the file watcher
   */
  async initialize(): Promise<void> {
    try {
      this._logger.info(`Initializing file watcher for: ${this._workspacePath}`);

      // Start watching the workspace directory
      await this._watchDirectory(this._workspacePath);

      this._logger.info("File watcher initialized successfully");
    } catch (error) {
      this._logger.error("Failed to initialize file watcher:", error as Error);
      throw error;
    }
  }

  /**
   * Dispose of the file watcher
   */
  dispose(): void {
    try {
      // Clear all debounce timers
      for (const timer of this._debounceMap.values()) {
        clearTimeout(timer);
      }
      this._debounceMap.clear();

      // Close all watchers
      for (const watcher of this._watchers.values()) {
        watcher.close();
      }
      this._watchers.clear();

      // Clear callbacks
      this._callbacks.clear();

      this._logger.info("File watcher disposed");
    } catch (error) {
      this._logger.error("Error disposing file watcher:", error as Error);
    }
  }

  /**
   * Add a file change callback
   */
  onFileChanged(callback: FileChangeCallback): void {
    this._callbacks.add(callback);
  }

  /**
   * Remove a file change callback
   */
  offFileChanged(callback: FileChangeCallback): void {
    this._callbacks.delete(callback);
  }

  /**
   * Watch a directory
   */
  private async _watchDirectory(dirPath: string): Promise<void> {
    try {
      const watcher = fs.watch(dirPath, { recursive: true }, (eventType, filename) => {
        if (!filename) {
          return;
        }

        const fullPath = path.join(dirPath, filename);
        const relativePath = path.relative(this._workspacePath, fullPath);

        // Skip ignored files
        if (this._shouldIgnoreFile(filename, relativePath)) {
          return;
        }

        // Debounce the event
        this._debounceFileEvent(eventType, fullPath, relativePath);
      });

      watcher.on("error", (error) => {
        this._logger.error(`File watcher error for ${dirPath}:`, error as Error);
      });

      this._watchers.set(dirPath, watcher);
      this._logger.debug(`Started watching directory: ${dirPath}`);
    } catch (error) {
      this._logger.error(`Failed to watch directory ${dirPath}:`, error as Error);
    }
  }

  /**
   * Debounce file events to avoid excessive notifications
   */
  private _debounceFileEvent(eventType: string, fullPath: string, relativePath: string): void {
    const key = `${eventType}:${fullPath}`;

    // Clear existing timer
    const existingTimer = this._debounceMap.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new timer
    const timer = setTimeout(() => {
      this._debounceMap.delete(key);
      this._handleFileEvent(eventType, fullPath, relativePath);
    }, this._debounceDelay);

    this._debounceMap.set(key, timer);
  }

  /**
   * Handle file events
   */
  private async _handleFileEvent(
    eventType: string,
    fullPath: string,
    relativePath: string,
  ): Promise<void> {
    try {
      let changeType: FileChangeEvent["type"];

      // Determine the change type
      try {
        const stats = await fs.promises.stat(fullPath);
        if (eventType === "rename") {
          changeType = "created";
        } else {
          changeType = "modified";
        }
      } catch {
        // File doesn't exist, it was deleted
        changeType = "deleted";
      }

      const event: FileChangeEvent = {
        type: changeType,
        path: relativePath,
        timestamp: new Date(),
      };

      this._logger.debug(`File ${changeType}: ${relativePath}`);

      // Notify all callbacks
      for (const callback of this._callbacks) {
        try {
          callback(event);
        } catch (error) {
          this._logger.error("Error in file change callback:", error as Error);
        }
      }
    } catch (error) {
      this._logger.error(`Error handling file event for ${fullPath}:`, error as Error);
    }
  }

  /**
   * Check if file should be ignored
   */
  private _shouldIgnoreFile(filename: string, relativePath: string): boolean {
    const ignorePatterns = [
      /^\./, // Hidden files
      /node_modules/,
      /\.git/,
      /dist/,
      /build/,
      /coverage/,
      /\.turbo/,
      /\.next/,
      /\.nuxt/,
      /\.vscode/,
      /\.idea/,
      /\.DS_Store/,
      /Thumbs\.db/,
      /\.tmp/,
      /\.temp/,
      /\.log$/,
      /\.lock$/,
    ];

    return ignorePatterns.some((pattern) => pattern.test(filename) || pattern.test(relativePath));
  }
}
