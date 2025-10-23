import { EventEmitter } from "eventemitter3";
import { CircuitBreakerConfig } from "./types";

/**
 * Circuit breaker states
 */
export enum CircuitState {
  CLOSED = "closed",
  OPEN = "open",
  HALF_OPEN = "half-open",
}

/**
 * Circuit breaker implementation to prevent cascading failures
 */
export class CircuitBreaker extends EventEmitter {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime = 0;
  private config: CircuitBreakerConfig;

  constructor(config?: Partial<CircuitBreakerConfig>) {
    super();

    this.config = {
      failureThreshold: 5,
      successThreshold: 3,
      timeout: 60000, // 1 minute
      monitoringWindow: 300000, // 5 minutes
      ...config,
    };
  }

  /**
   * Execute operation through circuit breaker
   */
  async execute<T>(operation: () => Promise<T>, operationName?: string): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitState.HALF_OPEN;
        this.emit("state:half-open", { operationName });
      } else {
        const error = new Error(`Circuit breaker is OPEN for ${operationName || "operation"}`);
        this.emit("circuit:blocked", { operationName, error });
        throw error;
      }
    }

    try {
      const result = await operation();
      this.onSuccess(operationName);
      return result;
    } catch (error) {
      this.onFailure(error as Error, operationName);
      throw error;
    }
  }

  /**
   * Get current circuit breaker state
   */
  getState(): string {
    return this.state;
  }

  /**
   * Get circuit breaker metrics
   */
  getMetrics() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
    };
  }

  /**
   * Reset circuit breaker to closed state
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
    this.emit("state:reset");
  }

  /**
   * Handle successful operation
   */
  private onSuccess(operationName?: string): void {
    this.failureCount = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;

      if (this.successCount >= this.config.successThreshold) {
        this.state = CircuitState.CLOSED;
        this.successCount = 0;
        this.emit("state:closed", { operationName });
      }
    }
  }

  /**
   * Handle failed operation
   */
  private onFailure(error: Error, operationName?: string): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.OPEN;
      this.successCount = 0;
      this.emit("state:open", { operationName, error });
    } else if (this.state === CircuitState.CLOSED) {
      if (this.failureCount >= this.config.failureThreshold) {
        this.state = CircuitState.OPEN;
        this.emit("state:open", { operationName, error });
      }
    }
  }

  /**
   * Check if circuit breaker should attempt to reset
   */
  private shouldAttemptReset(): boolean {
    return Date.now() - this.lastFailureTime >= this.config.timeout;
  }
}
