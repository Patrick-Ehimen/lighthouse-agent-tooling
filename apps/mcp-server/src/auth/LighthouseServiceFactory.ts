/**
 * Lighthouse service factory with service pooling and API key isolation
 */

import crypto from "crypto";
import { ILighthouseService } from "../services/ILighthouseService.js";
import { LighthouseService } from "../services/LighthouseService.js";
import { PerformanceConfig, ServiceEntry } from "./types.js";

export class LighthouseServiceFactory {
  private services = new Map<string, ServiceEntry>();
  private config: PerformanceConfig;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(config: PerformanceConfig) {
    this.config = config;

    // Cleanup expired service instances every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  /**
   * Create a new service instance with specific API key
   */
  async createService(apiKey: string): Promise<ILighthouseService> {
    const service = new LighthouseService(apiKey);

    // Initialize if the service has an initialize method
    if (service.initialize) {
      await service.initialize();
    }

    return service;
  }

  /**
   * Get or create cached service instance
   */
  async getService(apiKey: string): Promise<ILighthouseService> {
    const keyHash = this.hashApiKey(apiKey);

    // Check if service already exists and is not expired
    const existing = this.services.get(keyHash);
    if (existing && !this.isExpired(existing)) {
      existing.lastUsed = Date.now();
      return existing.service;
    }

    // Create new service instance
    const service = await this.createService(apiKey);
    const entry: ServiceEntry = {
      service,
      created: Date.now(),
      lastUsed: Date.now(),
      keyHash,
    };

    // Manage pool size
    if (this.services.size >= this.config.servicePoolSize) {
      this.evictOldest();
    }

    this.services.set(keyHash, entry);
    return service;
  }

  /**
   * Remove a service from the pool
   */
  removeService(apiKey: string): void {
    const keyHash = this.hashApiKey(apiKey);
    this.services.delete(keyHash);
  }

  /**
   * Clear all services from the pool
   */
  clear(): void {
    this.services.clear();
  }

  /**
   * Get pool statistics
   */
  getStats(): {
    size: number;
    maxSize: number;
    oldestServiceAge: number;
  } {
    let oldestAge = 0;
    const now = Date.now();

    for (const entry of this.services.values()) {
      const age = now - entry.created;
      if (age > oldestAge) {
        oldestAge = age;
      }
    }

    return {
      size: this.services.size,
      maxSize: this.config.servicePoolSize,
      oldestServiceAge: oldestAge,
    };
  }

  /**
   * Hash API key for service pooling
   */
  private hashApiKey(apiKey: string): string {
    return crypto.createHash("sha256").update(apiKey).digest("hex").substring(0, 16);
  }

  /**
   * Check if service entry is expired
   */
  private isExpired(entry: ServiceEntry): boolean {
    const timeoutMs = this.config.serviceTimeoutMinutes * 60 * 1000;
    const age = Date.now() - entry.lastUsed;
    return age > timeoutMs;
  }

  /**
   * Evict oldest service from pool
   */
  private evictOldest(): void {
    let oldestKey = "";
    let oldestTime = Date.now();

    for (const [key, entry] of this.services.entries()) {
      if (entry.lastUsed < oldestTime) {
        oldestTime = entry.lastUsed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.services.delete(oldestKey);
    }
  }

  /**
   * Clean up expired service instances
   */
  private cleanup(): void {
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.services.entries()) {
      if (this.isExpired(entry)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach((key) => this.services.delete(key));
  }

  /**
   * Destroy the factory and cleanup resources
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
    this.clear();
  }
}
