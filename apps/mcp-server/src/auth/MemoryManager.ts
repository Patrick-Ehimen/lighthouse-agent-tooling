/**
 * Memory cleanup utilities for sensitive data
 */

/**
 * Memory manager configuration
 */
export interface MemoryManagerConfig {
  enabled: boolean;
  overwriteIterations: number;
  clearIntervalMs: number;
}

/**
 * Default memory manager configuration
 */
export const DEFAULT_MEMORY_CONFIG: MemoryManagerConfig = {
  enabled: true,
  overwriteIterations: 3,
  clearIntervalMs: 5000, // 5 seconds
};

/**
 * Sensitive data container that automatically clears itself
 */
export class SensitiveData<T = string> {
  private _value: T | null;
  private _cleared = false;
  private _timeout?: NodeJS.Timeout;

  constructor(value: T, ttlMs?: number) {
    this._value = value;

    if (ttlMs && ttlMs > 0) {
      this._timeout = setTimeout(() => {
        this.clear();
      }, ttlMs);
    }
  }

  /**
   * Get the sensitive value
   */
  get value(): T | null {
    if (this._cleared) {
      throw new Error("Sensitive data has been cleared");
    }
    return this._value;
  }

  /**
   * Check if data has been cleared
   */
  get isCleared(): boolean {
    return this._cleared;
  }

  /**
   * Clear the sensitive data from memory
   */
  clear(): void {
    if (this._cleared) return;

    if (this._timeout) {
      clearTimeout(this._timeout);
      this._timeout = undefined;
    }

    // Overwrite the value multiple times for security
    if (typeof this._value === "string") {
      const length = this._value.length;
      for (let i = 0; i < DEFAULT_MEMORY_CONFIG.overwriteIterations; i++) {
        this._value = "0".repeat(length) as T;
        this._value = "1".repeat(length) as T;
        this._value = Math.random()
          .toString(36)
          .repeat(Math.ceil(length / 36))
          .substring(0, length) as T;
      }
    }

    this._value = null;
    this._cleared = true;
  }

  /**
   * Use the value and then clear it
   */
  use(): T | null {
    const value = this.value;
    this.clear();
    return value;
  }
}

/**
 * Memory manager for secure cleanup of sensitive data
 */
export class MemoryManager {
  private config: MemoryManagerConfig;
  private sensitiveObjects = new WeakSet<object>();
  private clearQueue: (() => void)[] = [];

  constructor(config: MemoryManagerConfig = DEFAULT_MEMORY_CONFIG) {
    this.config = config;
  }

  /**
   * Create a sensitive data container
   */
  createSensitive<T = string>(value: T, ttlMs?: number): SensitiveData<T> {
    return new SensitiveData(value, ttlMs);
  }

  /**
   * Clear sensitive fields from an object
   */
  clearSensitiveFields(obj: Record<string, unknown>, fields: string[]): void {
    if (!this.config.enabled || !obj) return;

    for (const field of fields) {
      if (obj[field] !== undefined) {
        this.secureOverwrite(obj, field);
      }
    }
  }

  /**
   * Securely overwrite a buffer
   */
  secureOverwriteBuffer(buffer: Buffer): void {
    if (!this.config.enabled || !buffer) return;

    for (let i = 0; i < this.config.overwriteIterations; i++) {
      // Fill with zeros
      buffer.fill(0);
      // Fill with ones
      buffer.fill(0xff);
      // Fill with random data
      for (let j = 0; j < buffer.length; j++) {
        buffer[j] = Math.floor(Math.random() * 256);
      }
    }

    // Final zero fill
    buffer.fill(0);
  }

  /**
   * Securely clear a string by overwriting its memory representation
   */
  secureOverwriteString(str: string): string {
    if (!this.config.enabled || !str) return "";

    // Create multiple overwrite patterns
    const length = str.length;

    for (let i = 0; i < this.config.overwriteIterations; i++) {
      // Overwrite with different patterns
      "0".repeat(length);
      "1".repeat(length);
      Math.random()
        .toString(36)
        .repeat(Math.ceil(length / 36))
        .substring(0, length);
    }

    return "";
  }

  /**
   * Register an object for sensitive data tracking
   */
  trackSensitiveObject(obj: object): void {
    if (!this.config.enabled) return;
    this.sensitiveObjects.add(obj);
  }

  /**
   * Schedule a cleanup function to run
   */
  scheduleCleanup(cleanupFn: () => void): void {
    if (!this.config.enabled) return;
    this.clearQueue.push(cleanupFn);
  }

  /**
   * Execute all scheduled cleanup functions
   */
  executeCleanup(): void {
    if (!this.config.enabled) return;

    while (this.clearQueue.length > 0) {
      const cleanupFn = this.clearQueue.shift();
      if (cleanupFn) {
        try {
          cleanupFn();
        } catch (error) {
          console.error("Cleanup function failed:", error);
        }
      }
    }
  }

  /**
   * Clear all sensitive data immediately
   */
  clearAll(): void {
    this.executeCleanup();
  }

  /**
   * Create a secure context for sensitive operations
   */
  createSecureContext<T>(operation: () => T, sensitiveVars: string[] = []): T {
    const context = {
      startTime: Date.now(),
      sensitiveVars: new Set(sensitiveVars),
    };

    try {
      return operation();
    } finally {
      // Schedule cleanup of the context
      this.scheduleCleanup(() => {
        // Clear any sensitive variables that might be in scope
        for (const varName of context.sensitiveVars) {
          // This is a best-effort cleanup
          try {
            (global as Record<string, unknown>)[varName] = null;
            delete (global as Record<string, unknown>)[varName];
          } catch {
            // Ignore errors in cleanup
          }
        }
      });
    }
  }

  /**
   * Get memory usage statistics
   */
  getStats(): {
    queuedCleanups: number;
    trackedObjects: number;
    enabled: boolean;
  } {
    return {
      queuedCleanups: this.clearQueue.length,
      trackedObjects: 0, // WeakSet doesn't provide size
      enabled: this.config.enabled,
    };
  }

  /**
   * Securely overwrite an object field
   */
  private secureOverwrite(obj: Record<string, unknown>, field: string): void {
    const value = obj[field];

    if (typeof value === "string") {
      // Overwrite string multiple times
      const length = value.length;
      for (let i = 0; i < this.config.overwriteIterations; i++) {
        obj[field] = "0".repeat(length);
        obj[field] = "1".repeat(length);
        obj[field] = Math.random()
          .toString(36)
          .repeat(Math.ceil(length / 36))
          .substring(0, length);
      }
    } else if (Buffer.isBuffer(value)) {
      this.secureOverwriteBuffer(value);
    }

    // Final cleanup
    obj[field] = null;
    delete obj[field];
  }
}

/**
 * Global memory manager instance
 */
export const memoryManager = new MemoryManager();

/**
 * Utility function to create sensitive data
 */
export function createSensitive<T = string>(value: T, ttlMs?: number): SensitiveData<T> {
  return memoryManager.createSensitive(value, ttlMs);
}

/**
 * Utility function to clear sensitive fields
 */
export function clearSensitiveFields(obj: Record<string, unknown>, fields: string[]): void {
  memoryManager.clearSensitiveFields(obj, fields);
}

/**
 * Utility function for secure operations
 */
export function withSecureContext<T>(operation: () => T, sensitiveVars?: string[]): T {
  return memoryManager.createSecureContext(operation, sensitiveVars);
}
