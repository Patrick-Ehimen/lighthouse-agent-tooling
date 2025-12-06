/**
 * Connection Monitor for MCP Server
 * @fileoverview Monitors connection status and handles reconnection logic
 */

import { EventEmitter } from "events";
import { Logger } from "../utils/logger.js";

export enum ConnectionState {
  CONNECTED = "connected",
  DISCONNECTED = "disconnected",
  CONNECTING = "connecting",
  RECONNECTING = "reconnecting",
  ERROR = "error",
}

export interface ConnectionMonitorConfig {
  /** Interval for health checks in milliseconds */
  healthCheckInterval?: number;
  /** Maximum reconnection attempts */
  maxReconnectAttempts?: number;
  /** Base delay for reconnection attempts in milliseconds */
  reconnectDelay?: number;
  /** Maximum delay between reconnection attempts */
  maxReconnectDelay?: number;
  /** Whether to use exponential backoff for reconnection */
  exponentialBackoff?: boolean;
}

export interface ConnectionHealth {
  state: ConnectionState;
  lastConnected?: Date;
  lastDisconnected?: Date;
  reconnectAttempts: number;
  uptime?: number;
  error?: string;
}

/**
 * Connection Monitor for tracking and managing MCP server connection
 */
export class ConnectionMonitor extends EventEmitter {
  private state: ConnectionState = ConnectionState.DISCONNECTED;
  private logger: Logger;
  private config: Required<ConnectionMonitorConfig>;
  private healthCheckTimer?: NodeJS.Timeout;
  private reconnectTimer?: NodeJS.Timeout;
  private reconnectAttempts = 0;
  private lastConnected?: Date;
  private lastDisconnected?: Date;
  private connectionCheckFn?: () => Promise<boolean>;
  private reconnectFn?: () => Promise<void>;

  constructor(config: ConnectionMonitorConfig = {}) {
    super();
    this.config = {
      healthCheckInterval: config.healthCheckInterval ?? 30000, // 30 seconds
      maxReconnectAttempts: config.maxReconnectAttempts ?? 5,
      reconnectDelay: config.reconnectDelay ?? 5000, // 5 seconds
      maxReconnectDelay: config.maxReconnectDelay ?? 60000, // 1 minute
      exponentialBackoff: config.exponentialBackoff ?? true,
    };

    this.logger = Logger.getInstance({
      level: "info",
      component: "ConnectionMonitor",
    });
  }

  /**
   * Set connection check function
   */
  setConnectionCheck(fn: () => Promise<boolean>): void {
    this.connectionCheckFn = fn;
  }

  /**
   * Set reconnect function
   */
  setReconnectFunction(fn: () => Promise<void>): void {
    this.reconnectFn = fn;
  }

  /**
   * Start monitoring
   */
  start(): void {
    this.logger.info("Starting connection monitor");

    // Start health check timer
    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck();
    }, this.config.healthCheckInterval);

    // Initial health check
    setImmediate(() => this.performHealthCheck());
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    this.logger.info("Stopping connection monitor");

    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
  }

  /**
   * Manually mark as connected
   */
  markConnected(): void {
    const previousState = this.state;
    this.state = ConnectionState.CONNECTED;
    this.lastConnected = new Date();
    this.reconnectAttempts = 0;

    if (previousState !== ConnectionState.CONNECTED) {
      this.logger.info("Connection established");
      this.emit("connected", this.getHealth());
    }

    // Cancel any pending reconnection
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
  }

  /**
   * Manually mark as disconnected
   */
  markDisconnected(error?: string): void {
    const previousState = this.state;
    this.state = ConnectionState.DISCONNECTED;
    this.lastDisconnected = new Date();

    if (previousState !== ConnectionState.DISCONNECTED) {
      this.logger.warn("Connection lost", { error });
      this.emit("disconnected", this.getHealth());
    }

    // Schedule reconnection if not already attempting
    if (!this.reconnectTimer && this.reconnectAttempts < this.config.maxReconnectAttempts) {
      this.scheduleReconnect();
    }
  }

  /**
   * Manually mark as error
   */
  markError(error: string): void {
    this.state = ConnectionState.ERROR;
    this.logger.error("Connection error", new Error(error));
    this.emit("error", { ...this.getHealth(), error });
  }

  /**
   * Perform health check
   */
  private async performHealthCheck(): Promise<void> {
    if (!this.connectionCheckFn) {
      return;
    }

    try {
      const isConnected = await this.connectionCheckFn();

      if (isConnected) {
        this.markConnected();
      } else {
        this.markDisconnected("Health check failed");
      }
    } catch (error) {
      this.markDisconnected(error instanceof Error ? error.message : "Health check error");
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      this.logger.error("Max reconnection attempts reached", undefined, {
        attempts: this.reconnectAttempts,
      });
      this.emit("reconnect_failed", this.getHealth());
      return;
    }

    const delay = this.calculateReconnectDelay();
    this.reconnectAttempts++;

    this.logger.info("Scheduling reconnection", {
      attempt: this.reconnectAttempts,
      maxAttempts: this.config.maxReconnectAttempts,
      delay,
    });

    this.reconnectTimer = setTimeout(() => {
      this.attemptReconnect();
    }, delay);
  }

  /**
   * Calculate reconnection delay with exponential backoff
   */
  private calculateReconnectDelay(): number {
    if (!this.config.exponentialBackoff) {
      return this.config.reconnectDelay;
    }

    const exponentialDelay = this.config.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    return Math.min(exponentialDelay, this.config.maxReconnectDelay);
  }

  /**
   * Attempt to reconnect
   */
  private async attemptReconnect(): Promise<void> {
    if (!this.reconnectFn) {
      this.logger.warn("No reconnect function set");
      return;
    }

    this.state = ConnectionState.RECONNECTING;
    this.logger.info("Attempting to reconnect", {
      attempt: this.reconnectAttempts,
    });
    this.emit("reconnecting", this.getHealth());

    try {
      await this.reconnectFn();
      this.markConnected();
      this.logger.info("Reconnection successful");
    } catch (error) {
      this.logger.error("Reconnection failed", error as Error, {
        attempt: this.reconnectAttempts,
      });

      this.markDisconnected(error instanceof Error ? error.message : "Reconnection failed");

      // Schedule next attempt if not maxed out
      if (this.reconnectAttempts < this.config.maxReconnectAttempts) {
        this.scheduleReconnect();
      } else {
        this.emit("reconnect_failed", this.getHealth());
      }
    }
  }

  /**
   * Get current connection health
   */
  getHealth(): ConnectionHealth {
    return {
      state: this.state,
      lastConnected: this.lastConnected,
      lastDisconnected: this.lastDisconnected,
      reconnectAttempts: this.reconnectAttempts,
      uptime: this.lastConnected ? Date.now() - this.lastConnected.getTime() : undefined,
    };
  }

  /**
   * Get current state
   */
  getState(): ConnectionState {
    return this.state;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.state === ConnectionState.CONNECTED;
  }

  /**
   * Reset reconnection attempts
   */
  resetReconnectAttempts(): void {
    this.reconnectAttempts = 0;
  }

  /**
   * Dispose monitor
   */
  dispose(): void {
    this.stop();
    this.removeAllListeners();
    this.connectionCheckFn = undefined;
    this.reconnectFn = undefined;
    this.logger.info("Connection monitor disposed");
  }
}
