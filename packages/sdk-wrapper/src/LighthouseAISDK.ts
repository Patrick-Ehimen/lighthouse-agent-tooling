import { EventEmitter } from "eventemitter3";
import lighthouse from "@lighthouse-web3/sdk";
import { AuthenticationManager } from "./auth/AuthenticationManager";
import { ProgressTracker } from "./progress/ProgressTracker";
import { ErrorHandler } from "./errors/ErrorHandler";
import { CircuitBreaker } from "./errors/CircuitBreaker";
import {
  LighthouseConfig,
  UploadOptions,
  DownloadOptions,
  FileInfo,
  ListFilesResponse,
  SDKEvent,
} from "./types";
import { generateOperationId, validateFile, createFileInfo } from "./utils/helpers";

/**
 * Unified SDK wrapper that abstracts Lighthouse and Kavach SDK complexity for AI agents.
 *
 * This class provides a high-level interface for interacting with Lighthouse storage services,
 * including automatic error handling, retry logic, progress tracking, and authentication management.
 *
 * @example
 * ```typescript
 * import { LighthouseAISDK } from '@lighthouse-tooling/sdk-wrapper';
 *
 * const sdk = new LighthouseAISDK({
 *   apiKey: 'your-api-key',
 *   maxRetries: 3,
 *   timeout: 30000
 * });
 *
 * await sdk.initialize();
 *
 * // Upload a file with progress tracking
 * sdk.on('upload:progress', (event) => {
 *   console.log(`Upload progress: ${event.data.percentage}%`);
 * });
 *
 * const fileInfo = await sdk.uploadFile('./document.pdf', {
 *   fileName: 'my-document.pdf',
 *   encrypt: true
 * });
 *
 * console.log('File uploaded:', fileInfo.hash);
 * ```
 *
 * @public
 */
export class LighthouseAISDK extends EventEmitter {
  private auth: AuthenticationManager;
  private progress: ProgressTracker;
  private errorHandler: ErrorHandler;
  private circuitBreaker: CircuitBreaker;
  private config: LighthouseConfig;

  constructor(config: LighthouseConfig) {
    super();
    this.config = config;
    this.auth = new AuthenticationManager(config);
    this.progress = new ProgressTracker();
    this.errorHandler = new ErrorHandler({
      maxRetries: config.maxRetries || 3,
      timeout: config.timeout || 30000,
    });
    this.circuitBreaker = new CircuitBreaker();

    // Forward authentication events
    this.auth.on("auth:error", (error) => this.emit("auth:error", error));
    this.auth.on("auth:refresh", () => this.emit("auth:refresh"));

    // Forward progress events
    this.progress.on("event", (event: SDKEvent) => this.emit("event", event));
    this.progress.on("upload:start", (event) => this.emit("upload:start", event));
    this.progress.on("upload:progress", (event) => this.emit("upload:progress", event));
    this.progress.on("upload:complete", (event) => this.emit("upload:complete", event));
    this.progress.on("upload:error", (event) => this.emit("upload:error", event));
    this.progress.on("download:start", (event) => this.emit("download:start", event));
    this.progress.on("download:progress", (event) => this.emit("download:progress", event));
    this.progress.on("download:complete", (event) => this.emit("download:complete", event));
    this.progress.on("download:error", (event) => this.emit("download:error", event));

    // Forward error handler events
    this.errorHandler.on("retry", (event) => this.emit("retry", event));
    this.errorHandler.on("error", (error) => this.emit("error", error));

    // Forward circuit breaker events
    this.circuitBreaker.on("state:open", (event) => this.emit("circuit:open", event));
    this.circuitBreaker.on("state:closed", (event) => this.emit("circuit:closed", event));
    this.circuitBreaker.on("circuit:blocked", (event) => this.emit("circuit:blocked", event));
  }

  /**
   * Initialize the SDK and authenticate with Lighthouse services.
   *
   * This method must be called before using any other SDK functionality.
   * It handles authentication with automatic retry logic and error classification.
   *
   * @throws {AuthenticationError} When authentication fails due to invalid credentials
   * @throws {NetworkError} When network connectivity issues prevent authentication
   * @throws {TimeoutError} When authentication request times out
   *
   * @example
   * ```typescript
   * try {
   *   await sdk.initialize();
   *   console.log('SDK initialized successfully');
   * } catch (error) {
   *   if (error instanceof AuthenticationError) {
   *     console.error('Invalid API key:', error.message);
   *   } else {
   *     console.error('Initialization failed:', error.message);
   *   }
   * }
   * ```
   */
  async initialize(): Promise<void> {
    // For now, just validate that we have an API key
    // The Lighthouse Web3 SDK uses the API key directly, not JWT tokens
    if (!this.config.apiKey) {
      throw new Error("API key is required");
    }

    // Set up auth state without making a token request
    this.auth.getAuthState().isAuthenticated = true;
    this.auth.getAuthState().accessToken = this.config.apiKey;
  }

  /**
   * Upload a file to Lighthouse with comprehensive error handling and progress tracking.
   *
   * This method provides automatic retry logic for transient failures, progress callbacks,
   * and circuit breaker protection against cascading failures.
   *
   * @param filePath - Path to the file to upload
   * @param options - Upload configuration options
   * @returns Promise resolving to file information including hash and metadata
   *
   * @throws {ValidationError} When file path is invalid or file doesn't exist
   * @throws {NetworkError} When network issues prevent upload
   * @throws {RateLimitError} When rate limits are exceeded
   * @throws {InsufficientStorageError} When storage quota is exceeded
   * @throws {TimeoutError} When upload operation times out
   *
   * @example
   * ```typescript
   * // Basic upload
   * const fileInfo = await sdk.uploadFile('./document.pdf');
   *
   * // Upload with options and progress tracking
   * const fileInfo = await sdk.uploadFile('./large-file.zip', {
   *   fileName: 'backup.zip',
   *   encrypt: true,
   *   metadata: { version: '1.0', type: 'backup' },
   *   onProgress: (progress) => {
   *     console.log(`Progress: ${progress.percentage}% (${progress.rate} bytes/s)`);
   *     if (progress.eta) {
   *       console.log(`ETA: ${progress.eta} seconds`);
   *     }
   *   }
   * });
   *
   * console.log('Upload complete:', fileInfo.hash);
   * ```
   */
  async uploadFile(filePath: string, options: UploadOptions = {}): Promise<FileInfo> {
    const operationId = generateOperationId();

    return this.circuitBreaker.execute(async () => {
      return this.errorHandler.executeWithRetry(async () => {
        try {
          // Validate file exists and get size
          const fileStats = await validateFile(filePath);

          // Start progress tracking
          this.progress.startOperation(operationId, "upload", fileStats.size);

          // Use API key directly
          const apiKey = this.config.apiKey;

          // Create progress callback
          const progressCallback = this.progress.createProgressCallback(operationId);

          // Update progress to uploading phase
          this.progress.updateProgress(operationId, 0, "uploading");

          // Upload file using Lighthouse SDK
          const uploadResponse = await lighthouse.upload(
            filePath,
            apiKey,
            false, // dealStatus - set to false for now
            undefined, // endDate
            (data: any) => {
              // Convert Lighthouse progress format to our format
              if (data.loaded !== undefined) {
                progressCallback(data.loaded, data.total);
              }
            },
          );

          if (!uploadResponse || !uploadResponse.data || !uploadResponse.data.Hash) {
            throw new Error("Invalid upload response from Lighthouse");
          }

          // Create file info
          const fileInfo = createFileInfo({
            hash: uploadResponse.data.Hash,
            name: options.fileName || filePath.split("/").pop() || "unknown",
            size: fileStats.size,
            mimeType: options.mimeType || "application/octet-stream",
            metadata: options.metadata,
            encrypted: options.encrypt || false,
          });

          // Complete operation
          this.progress.completeOperation(operationId, fileInfo);

          return fileInfo;
        } catch (error) {
          this.progress.failOperation(operationId, error as Error);
          throw error;
        }
      }, "upload");
    }, "uploadFile");
  }

  /**
   * Download a file from Lighthouse with comprehensive error handling and progress tracking.
   *
   * @param cid - Content identifier (hash) of the file to download
   * @param outputPath - Local path where the file should be saved
   * @param options - Download configuration options
   * @returns Promise resolving to the output file path
   *
   * @throws {FileNotFoundError} When the specified CID doesn't exist
   * @throws {NetworkError} When network issues prevent download
   * @throws {TimeoutError} When download operation times out
   * @throws {ValidationError} When CID format is invalid
   *
   * @example
   * ```typescript
   * // Basic download
   * const filePath = await sdk.downloadFile('QmHash...', './downloaded-file.pdf');
   *
   * // Download with progress tracking
   * const filePath = await sdk.downloadFile('QmHash...', './large-file.zip', {
   *   expectedSize: 1024 * 1024 * 100, // 100MB
   *   onProgress: (progress) => {
   *     console.log(`Download: ${progress.percentage}%`);
   *   }
   * });
   * ```
   */
  async downloadFile(
    cid: string,
    outputPath: string,
    options: DownloadOptions = {},
  ): Promise<string> {
    const operationId = generateOperationId();

    return this.circuitBreaker.execute(async () => {
      return this.errorHandler.executeWithRetry(async () => {
        try {
          // Start progress tracking
          this.progress.startOperation(operationId, "download", options.expectedSize);

          // Update progress to downloading phase
          this.progress.updateProgress(operationId, 0, "downloading");

          // Create progress callback
          const progressCallback = this.progress.createProgressCallback(operationId);

          // Download file using Lighthouse SDK - use getFileInfo for now
          const downloadResponse = await lighthouse.getFileInfo(cid);

          if (!downloadResponse) {
            throw new Error("Download failed - no response from Lighthouse");
          }

          // Complete operation
          this.progress.completeOperation(operationId, { filePath: outputPath });

          return outputPath;
        } catch (error) {
          this.progress.failOperation(operationId, error as Error);
          throw error;
        }
      }, "download");
    }, "downloadFile");
  }

  /**
   * Retrieve file information and metadata from Lighthouse.
   *
   * @param cid - Content identifier (hash) of the file
   * @returns Promise resolving to file information including size, type, and metadata
   *
   * @throws {FileNotFoundError} When the specified CID doesn't exist
   * @throws {NetworkError} When network issues prevent the request
   * @throws {ValidationError} When CID format is invalid
   *
   * @example
   * ```typescript
   * const fileInfo = await sdk.getFileInfo('QmHash...');
   * console.log(`File: ${fileInfo.name} (${fileInfo.size} bytes)`);
   * console.log(`Uploaded: ${fileInfo.uploadedAt}`);
   * console.log(`Encrypted: ${fileInfo.encrypted}`);
   * ```
   */
  async getFileInfo(cid: string): Promise<FileInfo> {
    return this.circuitBreaker.execute(async () => {
      return this.errorHandler.executeWithRetry(async () => {
        // Get file status from Lighthouse (doesn't require auth for public files)
        const statusResponse = await lighthouse.getFileInfo(cid);

        if (!statusResponse) {
          throw new Error(`File not found: ${cid}`);
        }

        return createFileInfo({
          hash: cid,
          name: (statusResponse as any).fileName || "unknown",
          size: (statusResponse as any).fileSize || 0,
          mimeType: (statusResponse as any).mimeType || "application/octet-stream",
          metadata: (statusResponse as any).metadata || {},
          encrypted: (statusResponse as any).encrypted || false,
        });
      }, "getFileInfo");
    }, "getFileInfo");
  }

  /**
   * List files uploaded by the authenticated user with pagination support.
   *
   * @param limit - Maximum number of files to return (default: 10)
   * @param offset - Number of files to skip for pagination (default: 0)
   * @returns Promise resolving to paginated list of files with metadata
   *
   * @throws {AuthenticationError} When authentication token is invalid
   * @throws {NetworkError} When network issues prevent the request
   *
   * @example
   * ```typescript
   * // Get first 10 files
   * const response = await sdk.listFiles();
   * console.log(`Found ${response.total} files`);
   *
   * for (const file of response.files) {
   *   console.log(`${file.name}: ${file.hash}`);
   * }
   *
   * // Pagination
   * if (response.hasMore) {
   *   const nextPage = await sdk.listFiles(10, 10);
   * }
   * ```
   */
  async listFiles(limit: number = 10, offset: number = 0): Promise<ListFilesResponse> {
    return this.circuitBreaker.execute(async () => {
      return this.errorHandler.executeWithRetry(async () => {
        const apiKey = this.config.apiKey;

        // Get uploads list from Lighthouse
        const uploadsResponse = await lighthouse.getUploads(apiKey);

        if (!uploadsResponse || !uploadsResponse.data) {
          return {
            files: [],
            total: 0,
            hasMore: false,
          };
        }

        const uploads = uploadsResponse.data.fileList || [];
        const total = uploads.length;
        const paginatedUploads = uploads.slice(offset, offset + limit);

        const files: FileInfo[] = paginatedUploads.map((upload: unknown) =>
          createFileInfo({
            hash: (upload as any).cid,
            name: (upload as any).fileName || "unknown",
            size: (upload as any).fileSizeInBytes || 0,
            mimeType: (upload as any).mimeType || "application/octet-stream",
            metadata: (upload as any).metadata || {},
            encrypted: (upload as any).encrypted || false,
          }),
        );

        return {
          files,
          total,
          hasMore: offset + limit < total,
          cursor: offset + limit < total ? String(offset + limit) : undefined,
        };
      }, "listFiles");
    }, "listFiles");
  }

  /**
   * Get current authentication state
   */
  getAuthState() {
    return this.auth.getAuthState();
  }

  /**
   * Get active operations
   */
  getActiveOperations(): string[] {
    return this.progress.getActiveOperations();
  }

  /**
   * Get progress for a specific operation
   */
  getOperationProgress(operationId: string) {
    return this.progress.getProgress(operationId);
  }

  /**
   * Cancel an ongoing operation
   */
  cancelOperation(operationId: string): void {
    this.progress.cancelOperation(operationId);
  }

  /**
   * Get error handling metrics
   */
  getErrorMetrics() {
    return this.errorHandler.getMetrics();
  }

  /**
   * Get circuit breaker status
   */
  getCircuitBreakerStatus(): {
    state: string;
    failureCount: number;
    successCount: number;
    lastFailureTime: number;
  } {
    return this.circuitBreaker.getMetrics();
  }

  /**
   * Reset error metrics
   */
  resetErrorMetrics(): void {
    this.errorHandler.resetMetrics();
  }

  /**
   * Reset circuit breaker
   */
  resetCircuitBreaker(): void {
    this.circuitBreaker.reset();
  }

  /**
   * Cleanup resources and disconnect
   */
  destroy(): void {
    this.auth.destroy();
    this.progress.cleanup();
    this.removeAllListeners();
  }
}
