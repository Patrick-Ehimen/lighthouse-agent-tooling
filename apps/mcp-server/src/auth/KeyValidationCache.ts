/**
 * Key validation cache with LRU eviction and TTL management
 */

import { CacheConfig, CacheEntry, ValidationResult } from "./types.js";

export class KeyValidationCache {
  private cache = new Map<string, CacheEntry>();
  private config: CacheConfig;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(config: CacheConfig) {
    this.config = config;

    if (this.config.enabled && this.config.cleanupIntervalSeconds > 0) {
      // Cleanup expired entries periodically
      this.cleanupInterval = setInterval(
        () => this.cleanup(),
        config.cleanupIntervalSeconds * 1000,
      );
    }
  }

  /**
   * Get cached validation result
   */
  get(keyHash: string): ValidationResult | null {
    if (!this.config.enabled) return null;

    const entry = this.cache.get(keyHash);
    if (!entry) return null;

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(keyHash);
      return null;
    }

    // Update access time for LRU
    entry.lastAccessed = Date.now();
    return entry.result;
  }

  /**
   * Set validation result in cache
   */
  set(keyHash: string, result: ValidationResult): void {
    if (!this.config.enabled) return;

    // Manage cache size
    if (this.cache.size >= this.config.maxSize) {
      this.evictLRU();
    }

    const entry: CacheEntry = {
      result,
      expiresAt: Date.now() + this.config.ttlSeconds * 1000,
      lastAccessed: Date.now(),
    };

    this.cache.set(keyHash, entry);
  }

  /**
   * Invalidate a specific key
   */
  invalidate(keyHash: string): void {
    this.cache.delete(keyHash);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
  } {
    return {
      size: this.cache.size,
      maxSize: this.config.maxSize,
      hitRate: 0, // Would need to track hits/misses for accurate rate
    };
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    if (this.cache.size === 0) return;

    let oldestKey = "";
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach((key) => this.cache.delete(key));
  }

  /**
   * Destroy the cache and cleanup resources
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
    this.clear();
  }
}
