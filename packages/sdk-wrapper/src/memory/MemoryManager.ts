/**
 * Memory Manager for tracking and controlling memory usage
 *
 * Provides memory monitoring, backpressure handling, and automatic cleanup
 */

import { EventEmitter } from "eventemitter3";

export interface MemoryManagerConfig {
  /** Maximum memory usage in bytes (default: 512MB) */
  maxMemory?: number;
  /** Memory threshold to trigger backpressure (0-1, default: 0.8) */
  backpressureThreshold?: number;
  /** Memory threshold to trigger cleanup (0-1, default: 0.9) */
  cleanupThreshold?: number;
  /** Check interval in ms */
  checkInterval?: number;
  /** Enable automatic cleanup */
  autoCleanup?: boolean;
}

export interface MemoryStats {
  used: number;
  max: number;
  percentage: number;
  underBackpressure: boolean;
  needsCleanup: boolean;
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
}

interface TrackedAllocation {
  id: string;
  size: number;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

/**
 * Manages memory usage and backpressure for the SDK
 */
export class MemoryManager extends EventEmitter {
  private allocations: Map<string, TrackedAllocation> = new Map();
  private totalAllocated = 0;

  private readonly maxMemory: number;
  private readonly backpressureThreshold: number;
  private readonly cleanupThreshold: number;
  private readonly checkInterval: number;
  private readonly autoCleanup: boolean;

  private checkTimer?: NodeJS.Timeout;
  private underBackpressure = false;

  constructor(config: MemoryManagerConfig = {}) {
    super();

    this.maxMemory = config.maxMemory ?? 512 * 1024 * 1024; // 512MB
    this.backpressureThreshold = config.backpressureThreshold ?? 0.8;
    this.cleanupThreshold = config.cleanupThreshold ?? 0.9;
    this.checkInterval = config.checkInterval ?? 5000;
    this.autoCleanup = config.autoCleanup ?? true;

    if (this.checkInterval > 0) {
      this.startMonitoring();
    }
  }

  /**
   * Track a memory allocation
   */
  track(id: string, size: number, metadata?: Record<string, unknown>): void {
    // Remove existing allocation if present
    if (this.allocations.has(id)) {
      this.untrack(id);
    }

    const allocation: TrackedAllocation = {
      id,
      size,
      timestamp: Date.now(),
      metadata,
    };

    this.allocations.set(id, allocation);
    this.totalAllocated += size;

    this.emit("track", { id, size, totalAllocated: this.totalAllocated });

    // Check if we need to apply backpressure
    this.checkMemoryPressure();
  }

  /**
   * Untrack a memory allocation
   */
  untrack(id: string): boolean {
    const allocation = this.allocations.get(id);

    if (!allocation) {
      return false;
    }

    this.allocations.delete(id);
    this.totalAllocated -= allocation.size;

    this.emit("untrack", { id, size: allocation.size, totalAllocated: this.totalAllocated });

    // Check if backpressure can be released
    this.checkMemoryPressure();

    return true;
  }

  /**
   * Check current memory pressure and emit events
   */
  private checkMemoryPressure(): void {
    const stats = this.getStats();

    // Check if we should enable backpressure
    if (!this.underBackpressure && stats.percentage >= this.backpressureThreshold) {
      this.underBackpressure = true;
      this.emit("backpressure:start", stats);
    }

    // Check if we can release backpressure
    if (this.underBackpressure && stats.percentage < this.backpressureThreshold * 0.9) {
      this.underBackpressure = false;
      this.emit("backpressure:end", stats);
    }

    // Check if cleanup is needed
    if (stats.percentage >= this.cleanupThreshold) {
      this.emit("cleanup:needed", stats);

      if (this.autoCleanup) {
        this.cleanup();
      }
    }
  }

  /**
   * Start periodic memory monitoring
   */
  private startMonitoring(): void {
    this.checkTimer = setInterval(() => {
      const stats = this.getStats();

      this.emit("stats", stats);

      // Emit warning if memory usage is high
      if (stats.percentage >= this.cleanupThreshold) {
        this.emit("memory:high", stats);
      }

      // Check memory pressure
      this.checkMemoryPressure();
    }, this.checkInterval);

    // Don't prevent Node from exiting
    if (this.checkTimer.unref) {
      this.checkTimer.unref();
    }
  }

  /**
   * Perform cleanup of old allocations
   */
  cleanup(maxAge?: number): number {
    const cutoff = Date.now() - (maxAge ?? 60000); // Default 1 minute
    let cleaned = 0;

    const toRemove: string[] = [];

    for (const [id, allocation] of this.allocations.entries()) {
      if (allocation.timestamp < cutoff) {
        toRemove.push(id);
      }
    }

    for (const id of toRemove) {
      if (this.untrack(id)) {
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.emit("cleanup:complete", { cleaned, remaining: this.allocations.size });
    }

    // Suggest garbage collection if available
    if (global.gc && cleaned > 0) {
      global.gc();
      this.emit("gc:triggered");
    }

    return cleaned;
  }

  /**
   * Wait until memory pressure is relieved
   */
  async waitForRelief(timeout?: number): Promise<void> {
    if (!this.underBackpressure) {
      return;
    }

    return new Promise((resolve, reject) => {
      const timer = timeout
        ? setTimeout(() => {
            this.off("backpressure:end", handler);
            reject(new Error("Backpressure relief timeout"));
          }, timeout)
        : null;

      const handler = () => {
        if (timer) clearTimeout(timer);
        resolve();
      };

      this.once("backpressure:end", handler);
    });
  }

  /**
   * Check if currently under memory backpressure
   */
  isUnderBackpressure(): boolean {
    return this.underBackpressure;
  }

  /**
   * Get memory statistics
   */
  getStats(): MemoryStats {
    const memUsage = process.memoryUsage();
    const percentage = this.totalAllocated / this.maxMemory;

    return {
      used: this.totalAllocated,
      max: this.maxMemory,
      percentage,
      underBackpressure: this.underBackpressure,
      needsCleanup: percentage >= this.cleanupThreshold,
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss,
    };
  }

  /**
   * Get tracked allocations
   */
  getAllocations(): TrackedAllocation[] {
    return Array.from(this.allocations.values());
  }

  /**
   * Get allocation by ID
   */
  getAllocation(id: string): TrackedAllocation | undefined {
    return this.allocations.get(id);
  }

  /**
   * Clear all tracked allocations
   */
  clear(): void {
    const count = this.allocations.size;
    this.allocations.clear();
    this.totalAllocated = 0;
    this.underBackpressure = false;

    this.emit("clear", { count });
  }

  /**
   * Get total allocated memory
   */
  get allocated(): number {
    return this.totalAllocated;
  }

  /**
   * Get number of tracked allocations
   */
  get count(): number {
    return this.allocations.size;
  }

  /**
   * Destroy the memory manager
   */
  destroy(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = undefined;
    }

    this.clear();
    this.removeAllListeners();
  }

  /**
   * Format bytes to human-readable string
   */
  static formatBytes(bytes: number): string {
    const units = ["B", "KB", "MB", "GB", "TB"];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }
}
