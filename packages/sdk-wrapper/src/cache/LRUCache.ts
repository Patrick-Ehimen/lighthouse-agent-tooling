/**
 * LRU (Least Recently Used) Cache implementation for file metadata and responses
 *
 * This cache provides O(1) get/set operations with automatic eviction
 * of least recently used items when capacity is reached.
 */

export interface CacheOptions {
  /** Maximum number of items to store in cache */
  maxSize: number;
  /** Time-to-live for cache entries in milliseconds */
  ttl?: number;
  /** Callback when an item is evicted */
  onEvict?: (key: string, value: unknown) => void;
}

interface CacheEntry<T> {
  value: T;
  timestamp: number;
  expiresAt?: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  maxSize: number;
  hitRate: number;
}

/**
 * Generic LRU Cache with TTL support
 */
export class LRUCache<T = unknown> {
  private cache: Map<string, CacheEntry<T>>;
  private readonly maxSize: number;
  private readonly ttl?: number;
  private readonly onEvict?: (key: string, value: T) => void;

  // Stats tracking
  private hits = 0;
  private misses = 0;
  private evictions = 0;

  constructor(options: CacheOptions) {
    this.maxSize = options.maxSize;
    this.ttl = options.ttl;
    this.onEvict = options.onEvict as ((key: string, value: T) => void) | undefined;
    this.cache = new Map();
  }

  /**
   * Get a value from the cache
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      this.misses++;
      return undefined;
    }

    // Check if entry has expired
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.misses++;
      return undefined;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);
    this.hits++;

    return entry.value;
  }

  /**
   * Set a value in the cache
   */
  set(key: string, value: T): void {
    // Remove existing entry if present
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Evict least recently used item (first item in map)
      const firstKey = this.cache.keys().next().value as string | undefined;

      if (firstKey) {
        const evictedEntry = this.cache.get(firstKey);

        if (evictedEntry && this.onEvict) {
          this.onEvict(firstKey, evictedEntry.value);
        }

        this.cache.delete(firstKey);
        this.evictions++;
      }
    }

    // Add new entry
    const entry: CacheEntry<T> = {
      value,
      timestamp: Date.now(),
      expiresAt: this.ttl ? Date.now() + this.ttl : undefined,
    };

    this.cache.set(key, entry);
  }

  /**
   * Check if a key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);

    if (!entry) {
      return false;
    }

    // Check expiration
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Delete a key from the cache
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all entries from the cache
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
  }

  /**
   * Get the current size of the cache
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalRequests = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: totalRequests > 0 ? this.hits / totalRequests : 0,
    };
  }

  /**
   * Clean up expired entries
   */
  cleanup(): number {
    let removed = 0;
    const now = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt && now > entry.expiresAt) {
        this.cache.delete(key);
        removed++;
      }
    }

    return removed;
  }

  /**
   * Get all keys in the cache (most to least recently used)
   */
  keys(): string[] {
    return Array.from(this.cache.keys()).reverse();
  }

  /**
   * Get all values in the cache (most to least recently used)
   */
  values(): T[] {
    return Array.from(this.cache.values())
      .reverse()
      .map((entry) => entry.value);
  }

  /**
   * Iterate over cache entries
   */
  forEach(callback: (value: T, key: string) => void): void {
    for (const [key, entry] of this.cache.entries()) {
      callback(entry.value, key);
    }
  }
}
