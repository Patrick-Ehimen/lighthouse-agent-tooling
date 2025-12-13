/**
 * Cache Manager for Lighthouse SDK
 *
 * Manages multiple caches for different types of data with configurable policies
 */

import { LRUCache } from "./LRUCache";
import { FileInfo, DatasetInfo } from "../types";

export interface CacheManagerConfig {
  /** Enable/disable caching globally */
  enabled?: boolean;
  /** File metadata cache size */
  fileMetadataCacheSize?: number;
  /** Dataset metadata cache size */
  datasetCacheSize?: number;
  /** Response cache size for API calls */
  responseCacheSize?: number;
  /** Default TTL for cached items (ms) */
  defaultTtl?: number;
  /** Cleanup interval for expired entries (ms) */
  cleanupInterval?: number;
}

/**
 * Manages caching for Lighthouse SDK operations
 */
export class CacheManager {
  private enabled: boolean;
  private fileMetadataCache: LRUCache<FileInfo>;
  private datasetCache: LRUCache<DatasetInfo>;
  private responseCache: LRUCache<unknown>;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(config: CacheManagerConfig = {}) {
    this.enabled = config.enabled ?? true;

    const defaultTtl = config.defaultTtl ?? 5 * 60 * 1000; // 5 minutes

    // Initialize caches
    this.fileMetadataCache = new LRUCache<FileInfo>({
      maxSize: config.fileMetadataCacheSize ?? 1000,
      ttl: defaultTtl,
      onEvict: (key) => {
        console.debug(`[Cache] Evicted file metadata: ${key}`);
      },
    });

    this.datasetCache = new LRUCache<DatasetInfo>({
      maxSize: config.datasetCacheSize ?? 500,
      ttl: defaultTtl,
      onEvict: (key) => {
        console.debug(`[Cache] Evicted dataset: ${key}`);
      },
    });

    this.responseCache = new LRUCache<unknown>({
      maxSize: config.responseCacheSize ?? 2000,
      ttl: defaultTtl,
      onEvict: (key) => {
        console.debug(`[Cache] Evicted response: ${key}`);
      },
    });

    // Setup cleanup interval
    if (config.cleanupInterval) {
      this.startCleanup(config.cleanupInterval);
    }
  }

  /**
   * Get file metadata from cache
   */
  getFileMetadata(cid: string): FileInfo | undefined {
    if (!this.enabled) return undefined;
    return this.fileMetadataCache.get(cid);
  }

  /**
   * Cache file metadata
   */
  setFileMetadata(cid: string, metadata: FileInfo): void {
    if (!this.enabled) return;
    this.fileMetadataCache.set(cid, metadata);
  }

  /**
   * Get dataset from cache
   */
  getDataset(datasetId: string): DatasetInfo | undefined {
    if (!this.enabled) return undefined;
    return this.datasetCache.get(datasetId);
  }

  /**
   * Cache dataset
   */
  setDataset(datasetId: string, dataset: DatasetInfo): void {
    if (!this.enabled) return;
    this.datasetCache.set(datasetId, dataset);
  }

  /**
   * Get cached response
   */
  getResponse<T = unknown>(key: string): T | undefined {
    if (!this.enabled) return undefined;
    return this.responseCache.get(key) as T | undefined;
  }

  /**
   * Cache response
   */
  setResponse(key: string, response: unknown): void {
    if (!this.enabled) return;
    this.responseCache.set(key, response);
  }

  /**
   * Invalidate file metadata
   */
  invalidateFile(cid: string): void {
    this.fileMetadataCache.delete(cid);
  }

  /**
   * Invalidate dataset
   */
  invalidateDataset(datasetId: string): void {
    this.datasetCache.delete(datasetId);
  }

  /**
   * Invalidate response cache entry
   */
  invalidateResponse(key: string): void {
    this.responseCache.delete(key);
  }

  /**
   * Clear all caches
   */
  clearAll(): void {
    this.fileMetadataCache.clear();
    this.datasetCache.clear();
    this.responseCache.clear();
  }

  /**
   * Enable caching
   */
  enable(): void {
    this.enabled = true;
  }

  /**
   * Disable caching
   */
  disable(): void {
    this.enabled = false;
  }

  /**
   * Check if caching is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Get combined cache statistics
   */
  getStats() {
    return {
      enabled: this.enabled,
      fileMetadata: this.fileMetadataCache.getStats(),
      datasets: this.datasetCache.getStats(),
      responses: this.responseCache.getStats(),
    };
  }

  /**
   * Start periodic cleanup of expired entries
   */
  private startCleanup(interval: number): void {
    this.cleanupTimer = setInterval(() => {
      const fileRemoved = this.fileMetadataCache.cleanup();
      const datasetRemoved = this.datasetCache.cleanup();
      const responseRemoved = this.responseCache.cleanup();

      const total = fileRemoved + datasetRemoved + responseRemoved;
      if (total > 0) {
        console.debug(`[Cache] Cleaned up ${total} expired entries`);
      }
    }, interval);

    // Don't prevent Node from exiting
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  /**
   * Stop cleanup timer and clear all caches
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    this.clearAll();
  }

  /**
   * Generate cache key for file operations
   */
  static generateFileKey(cid: string, operation?: string): string {
    return operation ? `file:${cid}:${operation}` : `file:${cid}`;
  }

  /**
   * Generate cache key for dataset operations
   */
  static generateDatasetKey(datasetId: string, operation?: string): string {
    return operation ? `dataset:${datasetId}:${operation}` : `dataset:${datasetId}`;
  }

  /**
   * Generate cache key for generic responses
   */
  static generateResponseKey(endpoint: string, params?: Record<string, unknown>): string {
    const paramStr = params ? JSON.stringify(params) : "";
    return `response:${endpoint}:${paramStr}`;
  }
}
