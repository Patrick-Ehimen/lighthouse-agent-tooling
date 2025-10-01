/**
 * Async utilities for promise handling and concurrency control
 */

export interface ConcurrencyConfig {
  maxConcurrent?: number;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

export class AsyncUtils {
  /**
   * Execute promises with controlled concurrency
   */
  static async withConcurrency<T, R>(
    items: T[],
    processor: (item: T, index: number) => Promise<R>,
    config: ConcurrencyConfig = {}
  ): Promise<R[]> {
    const { maxConcurrent = 3 } = config;
    const results: R[] = new Array(items.length);
    const executing: Promise<void>[] = [];

    for (let i = 0; i < items.length; i++) {
      const promise = this.processWithTimeout(
        () => processor(items[i], i),
        config.timeout
      ).then((result) => {
        results[i] = result;
      });

      executing.push(promise);

      if (executing.length >= maxConcurrent) {
        await Promise.race(executing);
        // Remove completed promises
        for (let j = executing.length - 1; j >= 0; j--) {
          if (await this.isPromiseSettled(executing[j])) {
            executing.splice(j, 1);
          }
        }
      }
    }

    // Wait for all remaining promises
    await Promise.all(executing);
    return results;
  }

  /**
   * Execute promise with timeout
   */
  static async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    timeoutMessage = "Operation timed out"
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
      ),
    ]);
  }

  /**
   * Process function with optional timeout
   */
  private static async processWithTimeout<T>(
    fn: () => Promise<T>,
    timeout?: number
  ): Promise<T> {
    const promise = fn();
    return timeout ? this.withTimeout(promise, timeout) : promise;
  }

  /**
   * Check if promise is settled (resolved or rejected)
   */
  private static async isPromiseSettled(
    promise: Promise<any>
  ): Promise<boolean> {
    try {
      await Promise.race([
        promise,
        new Promise((resolve) => setTimeout(resolve, 0)),
      ]);
      return true;
    } catch {
      return true;
    }
  }

  /**
   * Batch process items in chunks
   */
  static async processBatches<T, R>(
    items: T[],
    processor: (batch: T[]) => Promise<R[]>,
    batchSize = 10
  ): Promise<R[]> {
    const results: R[] = [];

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchResults = await processor(batch);
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Debounce function execution
   */
  static debounce<T extends (...args: any[]) => any>(
    func: T,
    waitMs: number
  ): (...args: Parameters<T>) => Promise<ReturnType<T>> {
    let timeoutId: NodeJS.Timeout;
    let resolvePromise: (value: ReturnType<T>) => void;
    let rejectPromise: (error: any) => void;

    return (...args: Parameters<T>): Promise<ReturnType<T>> => {
      return new Promise((resolve, reject) => {
        clearTimeout(timeoutId);
        resolvePromise = resolve;
        rejectPromise = reject;

        timeoutId = setTimeout(async () => {
          try {
            const result = await func(...args);
            resolvePromise(result);
          } catch (error) {
            rejectPromise(error);
          }
        }, waitMs);
      });
    };
  }

  /**
   * Throttle function execution
   */
  static throttle<T extends (...args: any[]) => any>(
    func: T,
    limitMs: number
  ): (...args: Parameters<T>) => Promise<ReturnType<T> | undefined> {
    let lastExecution = 0;
    let timeoutId: NodeJS.Timeout;

    return (...args: Parameters<T>): Promise<ReturnType<T> | undefined> => {
      return new Promise((resolve) => {
        const now = Date.now();
        const timeSinceLastExecution = now - lastExecution;

        if (timeSinceLastExecution >= limitMs) {
          lastExecution = now;
          resolve(func(...args));
        } else {
          clearTimeout(timeoutId);
          timeoutId = setTimeout(() => {
            lastExecution = Date.now();
            resolve(func(...args));
          }, limitMs - timeSinceLastExecution);
        }
      });
    };
  }

  /**
   * Sleep for specified milliseconds
   */
  static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Execute promises in sequence (one after another)
   */
  static async sequence<T, R>(
    items: T[],
    processor: (item: T, index: number) => Promise<R>
  ): Promise<R[]> {
    const results: R[] = [];

    for (let i = 0; i < items.length; i++) {
      const result = await processor(items[i], i);
      results.push(result);
    }

    return results;
  }

  /**
   * Execute promises in parallel with all-or-nothing semantics
   */
  static async parallel<T>(promises: Promise<T>[]): Promise<T[]> {
    return Promise.all(promises);
  }

  /**
   * Execute promises in parallel, collecting both successes and failures
   */
  static async parallelSettled<T>(
    promises: Promise<T>[]
  ): Promise<
    Array<{ status: "fulfilled" | "rejected"; value?: T; reason?: any }>
  > {
    const results = await Promise.allSettled(promises);
    return results.map((result) => ({
      status: result.status,
      value: result.status === "fulfilled" ? result.value : undefined,
      reason: result.status === "rejected" ? result.reason : undefined,
    }));
  }

  /**
   * Race multiple promises but with timeout
   */
  static async raceWithTimeout<T>(
    promises: Promise<T>[],
    timeoutMs: number,
    timeoutMessage = "Race operation timed out"
  ): Promise<T> {
    return this.withTimeout(Promise.race(promises), timeoutMs, timeoutMessage);
  }

  /**
   * Retry operation with exponential backoff
   */
  static async retry<T>(
    operation: () => Promise<T>,
    maxAttempts = 3,
    baseDelayMs = 1000,
    maxDelayMs = 10000,
    backoffMultiplier = 2
  ): Promise<T> {
    let lastError: Error;
    let delay = baseDelayMs;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        if (attempt === maxAttempts) {
          throw lastError;
        }

        await this.sleep(Math.min(delay, maxDelayMs));
        delay *= backoffMultiplier;
      }
    }

    throw lastError!;
  }

  /**
   * Create a promise that can be resolved/rejected externally
   */
  static createDeferred<T>(): {
    promise: Promise<T>;
    resolve: (value: T) => void;
    reject: (error: any) => void;
  } {
    let resolve: (value: T) => void;
    let reject: (error: any) => void;

    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });

    return { promise, resolve: resolve!, reject: reject! };
  }

  /**
   * Execute function with circuit breaker pattern
   */
  static createCircuitBreaker<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    options: {
      failureThreshold?: number;
      resetTimeoutMs?: number;
      monitoringPeriodMs?: number;
    } = {}
  ): T {
    const {
      failureThreshold = 5,
      resetTimeoutMs = 60000,
      monitoringPeriodMs = 10000,
    } = options;

    let failures = 0;
    let lastFailureTime = 0;
    let state: "closed" | "open" | "half-open" = "closed";

    return ((...args: Parameters<T>): Promise<ReturnType<T>> => {
      const now = Date.now();

      // Reset failure count if monitoring period has passed
      if (now - lastFailureTime > monitoringPeriodMs) {
        failures = 0;
      }

      // Check circuit breaker state
      if (state === "open") {
        if (now - lastFailureTime > resetTimeoutMs) {
          state = "half-open";
        } else {
          return Promise.reject(new Error("Circuit breaker is open"));
        }
      }

      return fn(...args)
        .then((result) => {
          // Success - reset circuit breaker
          failures = 0;
          state = "closed";
          return result;
        })
        .catch((error) => {
          // Failure - update circuit breaker
          failures++;
          lastFailureTime = now;

          if (failures >= failureThreshold) {
            state = "open";
          }

          throw error;
        });
    }) as T;
  }
}
