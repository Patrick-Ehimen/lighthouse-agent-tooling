/**
 * File Cache for Offline Access
 * @fileoverview LRU cache for frequently accessed files
 */

import { EventEmitter } from "events";
import { Logger } from "../utils/logger.js";

export interface CacheEntry<T> {
  key: string;
  value: T;
  size: number;
  accessCount: number;
  lastAccessed: Date;
  createdAt: Date;
  expiresAt?: Date;
}

export interface FileCacheConfig {
  /** Maximum cache size in bytes */
  maxSize?: number;
  /** Maximum number of entries */
  maxEntries?: number;
  /** Default TTL in milliseconds */
  defaultTTL?: number;
  /** Enable access count tracking */
  enableStats?: boolean;
}

export interface CacheStats {
  size: number;
  entries: number;
  maxSize: number;
  maxEntries: number;
  hits: number;
  misses: number;
  evictions: number;
  hitRate: number;
}

/**
 * LRU File Cache with size-based eviction
 */
export class FileCache<T = unknown> extends EventEmitter {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private logger: Logger;
  private config: Required<FileCacheConfig>;
  private currentSize = 0;
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
  };

  constructor(config: FileCacheConfig = {}) {
    super();
    this.config = {
      maxSize: config.maxSize ?? 100 * 1024 * 1024, // 100MB
      maxEntries: config.maxEntries ?? 1000,
      defaultTTL: config.defaultTTL ?? 3600000, // 1 hour
      enableStats: config.enableStats ?? true,
    };

    this.logger = Logger.getInstance({
      level: "info",
      component: "FileCache",
    });
  }

  /**
   * Get value from cache
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      if (this.config.enableStats) {
        this.stats.misses++;
      }
      this.emit("miss", { key });
      return undefined;
    }

    // Check if expired
    if (entry.expiresAt && entry.expiresAt < new Date()) {
      this.delete(key);
      if (this.config.enableStats) {
        this.stats.misses++;
      }
      this.emit("expired", { key });
      return undefined;
    }

    // Update access info
    entry.accessCount++;
    entry.lastAccessed = new Date();

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);

    if (this.config.enableStats) {
      this.stats.hits++;
    }

    this.emit("hit", { key, entry });
    return entry.value;
  }

  /**
   * Set value in cache
   */
  set(key: string, value: T, size: number, ttl?: number): void {
    // Check if we need to evict
    while (
      (this.currentSize + size > this.config.maxSize ||
        this.cache.size >= this.config.maxEntries) &&
      this.cache.size > 0
    ) {
      this.evictLRU();
    }

    // If single item is too large, don't cache
    if (size > this.config.maxSize) {
      this.logger.warn("Item too large for cache", {
        key,
        size,
        maxSize: this.config.maxSize,
      });
      this.emit("rejected", { key, size });
      return;
    }

    const now = new Date();
    const expiresAt = ttl
      ? new Date(now.getTime() + ttl)
      : new Date(now.getTime() + this.config.defaultTTL);

    const entry: CacheEntry<T> = {
      key,
      value,
      size,
      accessCount: 1,
      lastAccessed: now,
      createdAt: now,
      expiresAt,
    };

    // Remove old entry if exists
    if (this.cache.has(key)) {
      const oldEntry = this.cache.get(key)!;
      this.currentSize -= oldEntry.size;
    }

    this.cache.set(key, entry);
    this.currentSize += size;

    this.logger.debug("Cache entry set", {
      key,
      size,
      totalSize: this.currentSize,
      entries: this.cache.size,
    });

    this.emit("set", { key, entry });
  }

  /**
   * Check if key exists in cache
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }

    // Check if expired
    if (entry.expiresAt && entry.expiresAt < new Date()) {
      this.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Delete entry from cache
   */
  delete(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }

    this.cache.delete(key);
    this.currentSize -= entry.size;

    this.logger.debug("Cache entry deleted", {
      key,
      size: entry.size,
    });

    this.emit("delete", { key, entry });
    return true;
  }

  /**
   * Clear all entries
   */
  clear(): void {
    const count = this.cache.size;
    this.cache.clear();
    this.currentSize = 0;

    this.logger.info("Cache cleared", { count });
    this.emit("clear", { count });
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    // Get first entry (least recently used)
    const firstKey = this.cache.keys().next().value;
    if (firstKey) {
      const entry = this.cache.get(firstKey)!;
      this.cache.delete(firstKey);
      this.currentSize -= entry.size;

      if (this.config.enableStats) {
        this.stats.evictions++;
      }

      this.logger.debug("Evicted LRU entry", {
        key: firstKey,
        size: entry.size,
        accessCount: entry.accessCount,
      });

      this.emit("evict", { key: firstKey, entry });
    }
  }

  /**
   * Clean expired entries
   */
  cleanExpired(): number {
    let cleaned = 0;
    const now = new Date();
    const keysToDelete: string[] = [];

    // Collect keys to delete
    this.cache.forEach((entry, key) => {
      if (entry.expiresAt && entry.expiresAt < now) {
        keysToDelete.push(key);
      }
    });

    // Delete collected keys
    for (const key of keysToDelete) {
      this.delete(key);
      cleaned++;
    }

    if (cleaned > 0) {
      this.logger.info("Cleaned expired entries", { count: cleaned });
      this.emit("clean", { count: cleaned });
    }

    return cleaned;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      size: this.currentSize,
      entries: this.cache.size,
      maxSize: this.config.maxSize,
      maxEntries: this.config.maxEntries,
      hits: this.stats.hits,
      misses: this.stats.misses,
      evictions: this.stats.evictions,
      hitRate: total > 0 ? this.stats.hits / total : 0,
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
    };
  }

  /**
   * Get all keys
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get cache size in bytes
   */
  getSize(): number {
    return this.currentSize;
  }

  /**
   * Get number of entries
   */
  getCount(): number {
    return this.cache.size;
  }

  /**
   * Get most frequently accessed entries
   */
  getMostAccessed(limit: number = 10): CacheEntry<T>[] {
    const entries: CacheEntry<T>[] = [];
    this.cache.forEach((entry) => {
      entries.push(entry);
    });
    return entries.sort((a, b) => b.accessCount - a.accessCount).slice(0, limit);
  }

  /**
   * Get least recently used entries
   */
  getLRU(limit: number = 10): CacheEntry<T>[] {
    const entries: CacheEntry<T>[] = [];
    this.cache.forEach((entry) => {
      entries.push(entry);
    });
    return entries
      .sort((a, b) => a.lastAccessed.getTime() - b.lastAccessed.getTime())
      .slice(0, limit);
  }

  /**
   * Dispose cache
   */
  dispose(): void {
    this.clear();
    this.removeAllListeners();
    this.logger.info("File cache disposed");
  }
}
