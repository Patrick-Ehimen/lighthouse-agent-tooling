/**
 * Connection Pool for managing HTTP/API connections
 *
 * Implements connection pooling and reuse to reduce overhead
 * of creating new connections for each request
 */

import axios, { AxiosInstance, AxiosRequestConfig } from "axios";
import { EventEmitter } from "eventemitter3";

export interface ConnectionPoolConfig {
  /** Maximum number of concurrent connections */
  maxConnections?: number;
  /** Timeout for acquiring a connection from pool (ms) */
  acquireTimeout?: number;
  /** Idle timeout before closing a connection (ms) */
  idleTimeout?: number;
  /** Request timeout (ms) */
  requestTimeout?: number;
  /** Keep-alive enabled */
  keepAlive?: boolean;
  /** Max sockets per host */
  maxSockets?: number;
}

interface PooledConnection {
  instance: AxiosInstance;
  inUse: boolean;
  lastUsed: number;
  requestCount: number;
}

interface PoolStats {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  queuedRequests: number;
  totalRequests: number;
  averageWaitTime: number;
}

/**
 * Connection pool for HTTP clients with automatic cleanup
 */
export class ConnectionPool extends EventEmitter {
  private connections: PooledConnection[] = [];
  private queue: Array<{
    resolve: (conn: PooledConnection) => void;
    reject: (error: Error) => void;
    timestamp: number;
  }> = [];

  private readonly maxConnections: number;
  private readonly acquireTimeout: number;
  private readonly idleTimeout: number;
  private readonly requestTimeout: number;
  private readonly keepAlive: boolean;
  private readonly maxSockets: number;

  private cleanupTimer?: NodeJS.Timeout;
  private totalRequests = 0;
  private totalWaitTime = 0;

  constructor(config: ConnectionPoolConfig = {}) {
    super();

    this.maxConnections = config.maxConnections ?? 10;
    this.acquireTimeout = config.acquireTimeout ?? 5000;
    this.idleTimeout = config.idleTimeout ?? 60000;
    this.requestTimeout = config.requestTimeout ?? 30000;
    this.keepAlive = config.keepAlive ?? true;
    this.maxSockets = config.maxSockets ?? 50;

    // Start cleanup timer
    this.startCleanup();
  }

  /**
   * Acquire a connection from the pool
   */
  async acquire(): Promise<AxiosInstance> {
    const startTime = Date.now();

    // Try to find an idle connection
    const idle = this.connections.find((conn) => !conn.inUse);

    if (idle) {
      idle.inUse = true;
      idle.lastUsed = Date.now();
      idle.requestCount++;

      const waitTime = Date.now() - startTime;
      this.totalWaitTime += waitTime;
      this.totalRequests++;

      this.emit("acquire", { connection: idle, waitTime });
      return idle.instance;
    }

    // Create new connection if under limit
    if (this.connections.length < this.maxConnections) {
      const connection = this.createConnection();
      connection.inUse = true;
      connection.lastUsed = Date.now();
      connection.requestCount++;

      this.connections.push(connection);

      const waitTime = Date.now() - startTime;
      this.totalWaitTime += waitTime;
      this.totalRequests++;

      this.emit("create", { connection, waitTime });
      return connection.instance;
    }

    // Wait for a connection to become available
    return new Promise<AxiosInstance>((resolve, reject) => {
      const queueItem = {
        resolve: (conn: PooledConnection) => {
          clearTimeout(timeout);
          conn.inUse = true;
          conn.lastUsed = Date.now();
          conn.requestCount++;

          const waitTime = Date.now() - startTime;
          this.totalWaitTime += waitTime;
          this.totalRequests++;

          this.emit("acquire", { connection: conn, waitTime });
          resolve(conn.instance);
        },
        reject: (error: Error) => {
          clearTimeout(timeout);
          reject(error);
        },
        timestamp: Date.now(),
      };

      const timeout = setTimeout(() => {
        const index = this.queue.findIndex((item) => item === queueItem);
        if (index !== -1) {
          this.queue.splice(index, 1);
        }
        reject(new Error("Connection acquire timeout"));
      }, this.acquireTimeout);

      this.queue.push(queueItem);

      this.emit("queue", { queueSize: this.queue.length });
    });
  }

  /**
   * Release a connection back to the pool
   */
  release(instance: AxiosInstance): void {
    const connection = this.connections.find((conn) => conn.instance === instance);

    if (!connection) {
      console.warn("[ConnectionPool] Attempted to release unknown connection");
      return;
    }

    connection.inUse = false;
    connection.lastUsed = Date.now();

    // Process queue if there are waiting requests
    if (this.queue.length > 0) {
      const waiter = this.queue.shift();
      if (waiter) {
        waiter.resolve(connection);
      }
    }

    this.emit("release", { connection });
  }

  /**
   * Execute a request using a pooled connection
   */
  async execute<T = unknown>(config: AxiosRequestConfig): Promise<T> {
    const instance = await this.acquire();

    try {
      const response = await instance.request<T>(config);
      return response.data;
    } finally {
      this.release(instance);
    }
  }

  /**
   * Create a new connection instance
   */
  private createConnection(): PooledConnection {
    const instance = axios.create({
      timeout: this.requestTimeout,
      httpAgent: this.keepAlive
        ? new (require("http").Agent)({
            keepAlive: true,
            maxSockets: this.maxSockets,
          })
        : undefined,
      httpsAgent: this.keepAlive
        ? new (require("https").Agent)({
            keepAlive: true,
            maxSockets: this.maxSockets,
          })
        : undefined,
    });

    return {
      instance,
      inUse: false,
      lastUsed: Date.now(),
      requestCount: 0,
    };
  }

  /**
   * Start periodic cleanup of idle connections
   */
  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      const before = this.connections.length;

      // Remove idle connections that have exceeded idle timeout
      this.connections = this.connections.filter((conn) => {
        if (!conn.inUse && now - conn.lastUsed > this.idleTimeout) {
          this.emit("cleanup", { connection: conn });
          return false;
        }
        return true;
      });

      const removed = before - this.connections.length;
      if (removed > 0) {
        console.debug(`[ConnectionPool] Cleaned up ${removed} idle connections`);
      }
    }, this.idleTimeout / 2);

    // Don't prevent Node from exiting
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  /**
   * Get pool statistics
   */
  getStats(): PoolStats {
    const active = this.connections.filter((c) => c.inUse).length;

    return {
      totalConnections: this.connections.length,
      activeConnections: active,
      idleConnections: this.connections.length - active,
      queuedRequests: this.queue.length,
      totalRequests: this.totalRequests,
      averageWaitTime: this.totalRequests > 0 ? this.totalWaitTime / this.totalRequests : 0,
    };
  }

  /**
   * Destroy the pool and all connections
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }

    // Reject all queued requests
    for (const waiter of this.queue) {
      waiter.reject(new Error("Connection pool destroyed"));
    }
    this.queue = [];

    // Clear all connections
    this.connections = [];

    this.emit("destroy");
  }

  /**
   * Get current pool size
   */
  get size(): number {
    return this.connections.length;
  }

  /**
   * Get number of active connections
   */
  get activeCount(): number {
    return this.connections.filter((c) => c.inUse).length;
  }

  /**
   * Get number of queued requests
   */
  get queueSize(): number {
    return this.queue.length;
  }
}
