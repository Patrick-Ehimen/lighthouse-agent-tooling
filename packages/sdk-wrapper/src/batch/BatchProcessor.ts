/**
 * Batch Processor for efficient handling of multiple operations
 *
 * Provides batching, parallel processing, and backpressure handling
 * for bulk file upload/download operations
 */

import { EventEmitter } from "eventemitter3";

export interface BatchOptions {
  /** Maximum number of concurrent operations */
  concurrency?: number;
  /** Batch size before auto-processing */
  batchSize?: number;
  /** Maximum time to wait before processing incomplete batch (ms) */
  batchTimeout?: number;
  /** Enable retry on failure */
  retryOnFailure?: boolean;
  /** Maximum retries per operation */
  maxRetries?: number;
  /** Callback for progress updates */
  onProgress?: (completed: number, total: number) => void;
}

export interface BatchOperation<T, R> {
  id: string;
  data: T;
  retries?: number;
}

export interface BatchResult<R> {
  id: string;
  success: boolean;
  result?: R;
  error?: Error;
  duration: number;
  retries: number;
}

interface QueuedOperation<T, R> extends BatchOperation<T, R> {
  resolve: (result: BatchResult<R>) => void;
  reject: (error: Error) => void;
  startTime?: number;
}

export interface BatchStats {
  queued: number;
  processing: number;
  completed: number;
  failed: number;
  totalProcessed: number;
  averageDuration: number;
  successRate: number;
}

/**
 * Generic batch processor with concurrency control and backpressure handling
 */
export class BatchProcessor<T = unknown, R = unknown> extends EventEmitter {
  private queue: QueuedOperation<T, R>[] = [];
  private processing = 0;
  private readonly concurrency: number;
  private readonly batchSize: number;
  private readonly batchTimeout: number;
  private readonly retryOnFailure: boolean;
  private readonly maxRetries: number;
  private readonly onProgress?: (completed: number, total: number) => void;

  private batchTimer?: NodeJS.Timeout;
  private paused = false;

  // Stats
  private completed = 0;
  private failed = 0;
  private totalDuration = 0;

  constructor(
    private processor: (data: T) => Promise<R>,
    options: BatchOptions = {},
  ) {
    super();

    this.concurrency = options.concurrency ?? 5;
    this.batchSize = options.batchSize ?? 10;
    this.batchTimeout = options.batchTimeout ?? 5000;
    this.retryOnFailure = options.retryOnFailure ?? true;
    this.maxRetries = options.maxRetries ?? 3;
    this.onProgress = options.onProgress;
  }

  /**
   * Add an operation to the batch queue
   */
  async add(id: string, data: T): Promise<BatchResult<R>> {
    return new Promise((resolve, reject) => {
      const operation: QueuedOperation<T, R> = {
        id,
        data,
        retries: 0,
        resolve,
        reject,
      };

      this.queue.push(operation);
      this.emit("queued", { id, queueSize: this.queue.length });

      // Start processing if not paused
      if (!this.paused) {
        this.processQueue();
      }

      // Setup batch timeout if not already running
      if (!this.batchTimer && this.queue.length < this.batchSize) {
        this.setupBatchTimeout();
      }
    });
  }

  /**
   * Add multiple operations at once
   */
  async addBatch(operations: Array<{ id: string; data: T }>): Promise<BatchResult<R>[]> {
    return Promise.all(operations.map((op) => this.add(op.id, op.data)));
  }

  /**
   * Process queued operations
   */
  private async processQueue(): Promise<void> {
    if (this.paused) return;

    while (this.queue.length > 0 && this.processing < this.concurrency) {
      const operation = this.queue.shift();
      if (!operation) break;

      this.processing++;
      this.processOperation(operation);
    }

    // Clear batch timer if queue is empty
    if (this.queue.length === 0 && this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = undefined;
    }
  }

  /**
   * Process a single operation
   */
  private async processOperation(operation: QueuedOperation<T, R>): Promise<void> {
    const startTime = Date.now();
    operation.startTime = startTime;

    try {
      this.emit("start", { id: operation.id });

      const result = await this.processor(operation.data);
      const duration = Date.now() - startTime;

      this.completed++;
      this.totalDuration += duration;

      const batchResult: BatchResult<R> = {
        id: operation.id,
        success: true,
        result,
        duration,
        retries: operation.retries ?? 0,
      };

      operation.resolve(batchResult);
      this.emit("complete", batchResult);

      if (this.onProgress) {
        this.onProgress(this.completed, this.completed + this.failed);
      }
    } catch (error) {
      const duration = Date.now() - startTime;

      // Retry logic
      if (this.retryOnFailure && (operation.retries ?? 0) < this.maxRetries) {
        operation.retries = (operation.retries ?? 0) + 1;
        this.queue.push(operation); // Re-queue for retry

        this.emit("retry", {
          id: operation.id,
          attempt: operation.retries,
          maxRetries: this.maxRetries,
          error,
        });
      } else {
        this.failed++;

        const batchResult: BatchResult<R> = {
          id: operation.id,
          success: false,
          error: error as Error,
          duration,
          retries: operation.retries ?? 0,
        };

        operation.resolve(batchResult); // Resolve with error result
        this.emit("error", { ...batchResult, error });

        if (this.onProgress) {
          this.onProgress(this.completed, this.completed + this.failed);
        }
      }
    } finally {
      this.processing--;
      this.processQueue(); // Continue processing
    }
  }

  /**
   * Setup batch timeout for auto-processing
   */
  private setupBatchTimeout(): void {
    this.batchTimer = setTimeout(() => {
      if (this.queue.length > 0) {
        this.emit("batch-timeout", { queueSize: this.queue.length });
        this.processQueue();
      }
      this.batchTimer = undefined;
    }, this.batchTimeout);

    // Don't prevent Node from exiting
    if (this.batchTimer.unref) {
      this.batchTimer.unref();
    }
  }

  /**
   * Pause processing
   */
  pause(): void {
    this.paused = true;
    this.emit("paused");
  }

  /**
   * Resume processing
   */
  resume(): void {
    this.paused = false;
    this.emit("resumed");
    this.processQueue();
  }

  /**
   * Wait for all operations to complete
   */
  async drain(): Promise<void> {
    return new Promise((resolve) => {
      const check = () => {
        if (this.queue.length === 0 && this.processing === 0) {
          resolve();
        } else {
          setTimeout(check, 100);
        }
      };
      check();
    });
  }

  /**
   * Clear the queue
   */
  clear(): void {
    const cleared = this.queue.length;
    for (const operation of this.queue) {
      operation.reject(new Error("Queue cleared"));
    }
    this.queue = [];
    this.emit("cleared", { count: cleared });
  }

  /**
   * Get batch processor statistics
   */
  getStats(): BatchStats {
    const totalProcessed = this.completed + this.failed;
    return {
      queued: this.queue.length,
      processing: this.processing,
      completed: this.completed,
      failed: this.failed,
      totalProcessed,
      averageDuration: totalProcessed > 0 ? this.totalDuration / totalProcessed : 0,
      successRate: totalProcessed > 0 ? this.completed / totalProcessed : 0,
    };
  }

  /**
   * Check if processor is idle
   */
  isIdle(): boolean {
    return this.queue.length === 0 && this.processing === 0;
  }

  /**
   * Check if processor is paused
   */
  isPaused(): boolean {
    return this.paused;
  }

  /**
   * Get current queue size
   */
  get queueSize(): number {
    return this.queue.length;
  }

  /**
   * Get number of operations currently processing
   */
  get activeCount(): number {
    return this.processing;
  }

  /**
   * Destroy the processor
   */
  destroy(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = undefined;
    }
    this.clear();
    this.removeAllListeners();
  }
}
