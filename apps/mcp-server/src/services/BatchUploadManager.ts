/**
 * Batch Upload Manager
 * Handles parallel file uploads with concurrency control, progress tracking,
 * and partial success handling
 */

import { EventEmitter } from "eventemitter3";
import {
  BatchUploadResult,
  UploadResult,
  FailedUpload,
  AccessCondition,
} from "@lighthouse-tooling/types";
import { Logger, AsyncUtils } from "@lighthouse-tooling/shared";
import { ILighthouseService } from "./ILighthouseService.js";
import { BatchUploadOptions, DatasetProgress } from "./IDatasetService.js";

/**
 * Manages batch upload operations with concurrency control and progress tracking
 */
export class BatchUploadManager extends EventEmitter {
  private logger: Logger;
  private lighthouseService: ILighthouseService;

  // Constants for performance and safety
  private readonly DEFAULT_CONCURRENCY = 5;
  private readonly MAX_CONCURRENCY = 20;
  private readonly DEFAULT_TIMEOUT = 30000; // 30 seconds per file
  private readonly MEMORY_CHECK_INTERVAL = 100; // Check memory every 100 files

  constructor(lighthouseService: ILighthouseService, logger?: Logger) {
    super();
    this.lighthouseService = lighthouseService;
    this.logger = logger || Logger.getInstance({ level: "info", component: "BatchUploadManager" });
    this.logger.info("Batch Upload Manager initialized");
  }

  /**
   * Upload multiple files in parallel with progress tracking
   */
  async uploadFiles(
    files: string[],
    uploadConfig: {
      encrypt?: boolean;
      accessConditions?: AccessCondition[];
      tags?: string[];
    },
    options: BatchUploadOptions = {},
  ): Promise<BatchUploadResult> {
    const startTime = Date.now();

    try {
      this.logger.info("Starting batch upload", {
        fileCount: files.length,
        concurrency: options.concurrency || this.DEFAULT_CONCURRENCY,
      });

      // Validate and prepare options
      const concurrency = Math.min(
        options.concurrency || this.DEFAULT_CONCURRENCY,
        this.MAX_CONCURRENCY,
      );
      const timeout = options.timeout || this.DEFAULT_TIMEOUT;
      const continueOnError = true; // Always continue on individual file failures

      // Initialize progress tracking
      const progress: DatasetProgress = {
        operation: "upload",
        total: files.length,
        completed: 0,
        failed: 0,
        percentage: 0,
        timestamp: new Date(),
      };

      // Arrays to collect results
      const successfulUploads: UploadResult[] = [];
      const failedUploads: FailedUpload[] = [];

      // Process files with concurrency control
      await this.processFilesWithConcurrency(
        files,
        uploadConfig,
        {
          concurrency,
          timeout,
          continueOnError,
        },
        progress,
        successfulUploads,
        failedUploads,
        options.onProgress,
      );

      // Calculate final stats
      const duration = Date.now() - startTime;
      const totalBytes = successfulUploads.reduce((sum, upload) => sum + upload.size, 0);
      const averageSpeed = duration > 0 ? (totalBytes / duration) * 1000 : 0;

      const result: BatchUploadResult = {
        total: files.length,
        successful: successfulUploads.length,
        failed: failedUploads.length,
        successfulUploads,
        failedUploads,
        duration,
        averageSpeed,
      };

      this.logger.info("Batch upload completed", {
        total: result.total,
        successful: result.successful,
        failed: result.failed,
        duration,
        averageSpeedMBps: (averageSpeed / 1024 / 1024).toFixed(2),
      });

      return result;
    } catch (error) {
      this.logger.error("Batch upload failed", error as Error, {
        fileCount: files.length,
      });
      throw error;
    }
  }

  /**
   * Process files with concurrency control
   */
  private async processFilesWithConcurrency(
    files: string[],
    uploadConfig: {
      encrypt?: boolean;
      accessConditions?: AccessCondition[];
      tags?: string[];
    },
    options: {
      concurrency: number;
      timeout: number;
      continueOnError: boolean;
    },
    progress: DatasetProgress,
    successfulUploads: UploadResult[],
    failedUploads: FailedUpload[],
    onProgress?: (progress: DatasetProgress) => void,
  ): Promise<void> {
    // Use AsyncUtils for concurrency control
    await AsyncUtils.withConcurrency(
      files,
      async (filePath, index) => {
        // Update current file in progress
        progress.currentFile = filePath;
        progress.timestamp = new Date();

        try {
          // Upload file with timeout
          const result = await this.uploadFileWithTimeout(filePath, uploadConfig, options.timeout);

          // Success - add to successful uploads
          successfulUploads.push(result);
          progress.completed++;

          this.logger.debug("File uploaded successfully", {
            filePath,
            cid: result.cid,
            size: result.size,
            progress: `${progress.completed}/${progress.total}`,
          });
        } catch (error) {
          // Failure - add to failed uploads
          const failedUpload: FailedUpload = {
            filePath,
            error: (error as Error).message,
            retryAttempts: 0,
            failedAt: new Date(),
          };

          failedUploads.push(failedUpload);
          progress.failed++;

          this.logger.warn("File upload failed", {
            filePath,
            error: (error as Error).message,
            progress: `${progress.completed}/${progress.total}`,
          });

          // Continue to next file (don't throw)
        }

        // Update progress percentage and rate
        progress.percentage = ((progress.completed + progress.failed) / progress.total) * 100;
        progress.rate = this.calculateRate(progress);
        progress.estimatedTimeRemaining = this.calculateETA(progress);

        // Emit progress update
        if (onProgress) {
          onProgress({ ...progress });
        }

        this.emit("progress", { ...progress });

        // Memory check periodically
        if ((index + 1) % this.MEMORY_CHECK_INTERVAL === 0) {
          this.checkMemoryUsage();
        }

        // Return void - results are tracked in arrays
        return;
      },
      { maxConcurrent: options.concurrency, timeout: options.timeout },
    );
  }

  /**
   * Upload a single file with timeout
   */
  private async uploadFileWithTimeout(
    filePath: string,
    uploadConfig: {
      encrypt?: boolean;
      accessConditions?: AccessCondition[];
      tags?: string[];
    },
    timeout: number,
  ): Promise<UploadResult> {
    return AsyncUtils.withTimeout(
      this.lighthouseService.uploadFile({
        filePath,
        encrypt: uploadConfig.encrypt,
        accessConditions: uploadConfig.accessConditions,
        tags: uploadConfig.tags,
      }),
      timeout,
      `Upload timeout for file: ${filePath}`,
    );
  }

  /**
   * Calculate current upload rate (files per second)
   */
  private calculateRate(progress: DatasetProgress): number {
    if (!progress.timestamp) return 0;

    // Simple estimation based on completed files
    const elapsed = Date.now() - progress.timestamp.getTime();
    if (elapsed === 0) return 0;

    return (progress.completed / elapsed) * 1000;
  }

  /**
   * Calculate estimated time remaining
   */
  private calculateETA(progress: DatasetProgress): number | undefined {
    if (!progress.rate || progress.rate === 0) return undefined;

    const remaining = progress.total - progress.completed - progress.failed;
    return (remaining / progress.rate) * 1000; // milliseconds
  }

  /**
   * Check memory usage and warn if too high
   */
  private checkMemoryUsage(): void {
    const usage = process.memoryUsage();
    const heapUsedMB = usage.heapUsed / 1024 / 1024;
    const heapTotalMB = usage.heapTotal / 1024 / 1024;

    // Warn if heap usage exceeds 500MB
    if (heapUsedMB > 500) {
      this.logger.warn("High memory usage detected", {
        heapUsedMB: heapUsedMB.toFixed(2),
        heapTotalMB: heapTotalMB.toFixed(2),
        utilizationPercent: ((heapUsedMB / heapTotalMB) * 100).toFixed(2),
      });
    }

    // Log memory stats at debug level
    this.logger.debug("Memory usage", {
      heapUsedMB: heapUsedMB.toFixed(2),
      heapTotalMB: heapTotalMB.toFixed(2),
      rss: (usage.rss / 1024 / 1024).toFixed(2),
    });
  }

  /**
   * Upload files in batches to manage memory
   * Useful for very large datasets (1000+ files)
   */
  async uploadFilesInBatches(
    files: string[],
    uploadConfig: {
      encrypt?: boolean;
      accessConditions?: AccessCondition[];
      tags?: string[];
    },
    options: BatchUploadOptions & { batchSize?: number } = {},
  ): Promise<BatchUploadResult> {
    const batchSize = options.batchSize || 50; // Process 50 files per batch
    const startTime = Date.now();

    this.logger.info("Starting batched upload", {
      totalFiles: files.length,
      batchSize,
      batches: Math.ceil(files.length / batchSize),
    });

    const allSuccessful: UploadResult[] = [];
    const allFailed: FailedUpload[] = [];

    // Process in batches
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;

      this.logger.info("Processing batch", {
        batch: batchNumber,
        files: batch.length,
        progress: `${Math.min(i + batchSize, files.length)}/${files.length}`,
      });

      // Upload batch
      const batchResult = await this.uploadFiles(batch, uploadConfig, {
        ...options,
        onProgress: (progress) => {
          // Adjust progress to account for overall progress
          const overallProgress: DatasetProgress = {
            ...progress,
            total: files.length,
            completed: allSuccessful.length + progress.completed,
            failed: allFailed.length + progress.failed,
            percentage: ((allSuccessful.length + progress.completed) / files.length) * 100,
          };

          if (options.onProgress) {
            options.onProgress(overallProgress);
          }

          this.emit("progress", overallProgress);
        },
      });

      // Collect results
      allSuccessful.push(...batchResult.successfulUploads);
      allFailed.push(...batchResult.failedUploads);

      // Allow GC to clean up batch results
      batchResult.successfulUploads.length = 0;
      batchResult.failedUploads.length = 0;

      // Check memory after each batch
      this.checkMemoryUsage();
    }

    const duration = Date.now() - startTime;
    const totalBytes = allSuccessful.reduce((sum, upload) => sum + upload.size, 0);
    const averageSpeed = duration > 0 ? (totalBytes / duration) * 1000 : 0;

    const result: BatchUploadResult = {
      total: files.length,
      successful: allSuccessful.length,
      failed: allFailed.length,
      successfulUploads: allSuccessful,
      failedUploads: allFailed,
      duration,
      averageSpeed,
    };

    this.logger.info("Batched upload completed", {
      total: result.total,
      successful: result.successful,
      failed: result.failed,
      duration,
      durationMinutes: (duration / 1000 / 60).toFixed(2),
      averageSpeedMBps: (averageSpeed / 1024 / 1024).toFixed(2),
    });

    return result;
  }

  /**
   * Get optimal batch configuration based on file count
   */
  getOptimalBatchConfig(fileCount: number): {
    useBatching: boolean;
    batchSize: number;
    concurrency: number;
  } {
    // For large datasets (1000+), use batching
    if (fileCount >= 1000) {
      return {
        useBatching: true,
        batchSize: 50,
        concurrency: 5,
      };
    }

    // For medium datasets (100-999), use standard parallel upload
    if (fileCount >= 100) {
      return {
        useBatching: false,
        batchSize: fileCount,
        concurrency: 10,
      };
    }

    // For small datasets (<100), use default concurrency
    return {
      useBatching: false,
      batchSize: fileCount,
      concurrency: 5,
    };
  }
}
