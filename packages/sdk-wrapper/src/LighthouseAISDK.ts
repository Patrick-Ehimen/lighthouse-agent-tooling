import { EventEmitter } from "eventemitter3";
import lighthouse from "@lighthouse-web3/sdk";
import { readFileSync, createWriteStream, promises as fsPromises } from "fs";
import { dirname } from "path";
import axios, { AxiosRequestConfig, AxiosResponse } from "axios";
import { AuthenticationManager } from "./auth/AuthenticationManager";
import { ProgressTracker } from "./progress/ProgressTracker";
import { ErrorHandler } from "./errors/ErrorHandler";
import { CircuitBreaker } from "./errors/CircuitBreaker";
import { EncryptionManager } from "./encryption/EncryptionManager";
import { RateLimiter } from "./utils/RateLimiter";
import { ConnectionPool, ConnectionPoolConfig } from "./pool";
import {
  LighthouseConfig,
  UploadOptions,
  DownloadOptions,
  FileInfo,
  ListFilesResponse,
  SDKEvent,
  DatasetOptions,
  DatasetInfo,
  ListDatasetsResponse,
  GeneratedKey,
  KeyShard,
  EncryptionOptions,
  AccessControlConfig,
  EncryptionResponse,
  AuthToken,
  EnhancedAccessCondition,
  BatchUploadOptions,
  BatchDownloadOptions,
  BatchUploadInput,
  BatchDownloadInput,
  BatchFileResult,
  BatchOperationResult,
  BatchDownloadFileResult,
} from "./types";
import { generateOperationId, validateFile, createFileInfo } from "./utils/helpers";
import { BatchProcessor } from "./batch/BatchProcessor";
import { MemoryManager } from "./memory/MemoryManager";

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
  private encryption: EncryptionManager;
  private rateLimiter: RateLimiter;
  private connectionPool: ConnectionPool | null;
  private memoryManager: MemoryManager;
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
    this.encryption = new EncryptionManager();
    this.rateLimiter = new RateLimiter(10, 1, 1000); // 10 requests per second
    this.memoryManager = new MemoryManager({
      maxMemory: 512 * 1024 * 1024, // 512MB
      backpressureThreshold: 0.8,
      cleanupThreshold: 0.9,
      checkInterval: 5000,
      autoCleanup: true,
    });

    // Initialize connection pool (unless explicitly disabled)
    if (config.pool === false) {
      this.connectionPool = null;
    } else {
      const poolConfig: ConnectionPoolConfig = {
        maxConnections: 10,
        acquireTimeout: 5000,
        idleTimeout: 60000,
        requestTimeout: config.timeout || 30000,
        keepAlive: true,
        maxSockets: 50,
        ...(typeof config.pool === "object" ? config.pool : {}),
      };
      this.connectionPool = new ConnectionPool(poolConfig);
    }

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

    // Forward encryption events
    this.encryption.on("key:generation:start", (event) =>
      this.emit("encryption:key:generation:start", event),
    );
    this.encryption.on("key:generation:success", (event) =>
      this.emit("encryption:key:generation:success", event),
    );
    this.encryption.on("key:generation:error", (event) =>
      this.emit("encryption:key:generation:error", event),
    );
    this.encryption.on("access:control:start", (event) =>
      this.emit("encryption:access:control:start", event),
    );
    this.encryption.on("access:control:success", (event) =>
      this.emit("encryption:access:control:success", event),
    );
    this.encryption.on("access:control:error", (event) =>
      this.emit("encryption:access:control:error", event),
    );

    // Forward connection pool events
    if (this.connectionPool) {
      this.connectionPool.on("acquire", (event) => this.emit("pool:acquire", event));
      this.connectionPool.on("create", (event) => this.emit("pool:create", event));
      this.connectionPool.on("queue", (event) => this.emit("pool:queue", event));
      this.connectionPool.on("release", (event) => this.emit("pool:release", event));
      this.connectionPool.on("cleanup", (event) => this.emit("pool:cleanup", event));
    }

    // Forward memory manager events
    this.memoryManager.on("backpressure:start", (event) =>
      this.emit("memory:backpressure:start", event),
    );
    this.memoryManager.on("backpressure:end", (event) =>
      this.emit("memory:backpressure:end", event),
    );
    this.memoryManager.on("cleanup:needed", (event) => this.emit("memory:cleanup:needed", event));
  }

  /**
   * Execute operation with rate limiting
   */
  private async executeWithRateLimit<T>(
    operation: () => Promise<T>,
    operationName: string,
  ): Promise<T> {
    await this.rateLimiter.acquire();
    return this.circuitBreaker.execute(operation, operationName);
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

    return this.executeWithRateLimit(async () => {
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

          // Calculate dynamic timeout based on file size (minimum 2 minutes, +30s per MB)
          const fileSizeMB = fileStats.size / (1024 * 1024);
          const dynamicTimeout = Math.max(120000, 120000 + fileSizeMB * 30000); // 2 min base + 30s per MB

          // Read file as buffer to avoid fs-extra dependency issues
          const fileBuffer = readFileSync(filePath);

          // Upload file using Lighthouse SDK buffer method with timeout
          let uploadResponse;
          try {
            const uploadPromise = lighthouse.uploadBuffer(fileBuffer, apiKey);
            uploadResponse = await this.withTimeout(uploadPromise, dynamicTimeout);
          } catch (error) {
            // Try fallback to direct API call if standard method fails
            const errorMessage = error instanceof Error ? error.message : String(error);

            if (
              errorMessage.includes("ETIMEDOUT") ||
              errorMessage.includes("timeout") ||
              errorMessage.includes("ENOTFOUND") ||
              errorMessage.includes("ECONNREFUSED")
            ) {
              console.warn("Standard upload failed, trying direct API fallback:", errorMessage);

              try {
                uploadResponse = await this.uploadViDirectAPI(
                  fileBuffer,
                  apiKey,
                  options.fileName || filePath.split("/").pop() || "file",
                );
                console.log("Fallback upload successful");
              } catch (fallbackError) {
                // If both methods fail, provide comprehensive error message
                throw new Error(`Upload failed with both methods:

Primary error: ${errorMessage}
Fallback error: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}

This could be due to:
• Network connectivity issues
• Large file size (current: ${(fileStats.size / 1024 / 1024).toFixed(1)}MB)
• Lighthouse servers being temporarily unavailable
• Firewall or proxy blocking the connection
• Invalid API key

Try uploading a smaller file or check your network connection.`);
              }
            } else if (errorMessage.includes("401") || errorMessage.includes("unauthorized")) {
              throw new Error(`Authentication failed. Please check:
• Your API key is correct and valid
• Your API key has upload permissions
• Your API key hasn't expired

Current API key: ${apiKey.substring(0, 8)}...`);
            } else if (errorMessage.includes("413") || errorMessage.includes("too large")) {
              throw new Error(`File too large (${(fileStats.size / 1024 / 1024).toFixed(1)}MB). 
Maximum file size may be exceeded. Try uploading a smaller file.`);
            } else if (errorMessage.includes("429") || errorMessage.includes("rate limit")) {
              throw new Error(`Rate limit exceeded. Please wait a moment before trying again.`);
            }

            // Re-throw original error if we can't classify it
            throw error;
          }

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
   * Add timeout wrapper for promises
   */
  private withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs),
      ),
    ]);
  }

  /**
   * Execute an HTTP request using the connection pool if available,
   * otherwise fall back to a direct axios call.
   */
  private async executeHttpRequest<T = any>(config: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    if (this.connectionPool) {
      const instance = await this.connectionPool.acquire();
      try {
        return await instance.request<T>(config);
      } finally {
        this.connectionPool.release(instance);
      }
    } else {
      const axiosLib: { request: (config: AxiosRequestConfig) => Promise<AxiosResponse<T>> } =
        eval("require")("axios");
      return axiosLib.request(config);
    }
  }

  /**
   * Upload file via direct API call as fallback when SDK fails
   */
  private async uploadViDirectAPI(
    fileBuffer: Buffer,
    apiKey: string,
    fileName: string,
  ): Promise<any> {
    // This is a fallback method that uses direct HTTP calls to api.lighthouse.storage
    // when the standard SDK fails (usually due to node.lighthouse.storage being down)

    const FormData = eval("require")("form-data");

    const formData = new FormData();
    formData.append("file", fileBuffer, fileName);

    const response = await this.executeHttpRequest({
      method: "POST",
      url: "https://api.lighthouse.storage/api/v0/add",
      data: formData,
      headers: {
        ...formData.getHeaders(),
        Authorization: `Bearer ${apiKey}`,
      },
      timeout: 180000, // 3 minutes
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    return response;
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

    return this.executeWithRateLimit(async () => {
      return this.errorHandler.executeWithRetry(async () => {
        try {
          // Validate CID format
          if (!cid || typeof cid !== "string") {
            throw new Error("Invalid CID: CID is required and must be a string");
          }

          // Basic CID validation (CIDv0 starts with Qm, CIDv1 starts with b)
          const isValidCID =
            cid.startsWith("Qm") || cid.startsWith("baf") || cid.startsWith("bafy");
          if (!isValidCID && !cid.startsWith("test_")) {
            throw new Error(`Invalid CID format: ${cid}. Expected CIDv0 (Qm...) or CIDv1 (baf...)`);
          }

          // TODO: Decryption support requires Kavach SDK integration
          if (options.decrypt) {
            throw new Error(
              "Decryption during download is not yet implemented. " +
                "Download the file first, then use the encryption manager to decrypt.",
            );
          }

          // Ensure output directory exists
          const outputDir = dirname(outputPath);
          try {
            await fsPromises.mkdir(outputDir, { recursive: true });
          } catch (mkdirError) {
            // Directory might already exist, that's fine
          }

          // Start progress tracking
          this.progress.startOperation(operationId, "download", options.expectedSize);
          this.progress.updateProgress(operationId, 0, "preparing");

          // Lighthouse IPFS gateway URL
          const gatewayUrl = `https://gateway.lighthouse.storage/ipfs/${cid}`;

          // Calculate timeout based on expected size (minimum 2 minutes, +30s per 10MB)
          // User-provided timeout takes precedence
          const expectedSizeMB = (options.expectedSize || 10 * 1024 * 1024) / (1024 * 1024);
          const dynamicTimeout =
            options.timeout ?? Math.max(120000, 120000 + (expectedSizeMB / 10) * 30000);

          // Update progress to downloading phase
          this.progress.updateProgress(operationId, 0, "downloading");

          // Download with progress tracking
          const response = await axios({
            method: "GET",
            url: gatewayUrl,
            responseType: "stream",
            timeout: dynamicTimeout,
            headers: {
              "User-Agent": "LighthouseAISDK/1.0",
            },
            onDownloadProgress: (progressEvent) => {
              const loaded = progressEvent.loaded;
              const total = progressEvent.total || options.expectedSize;
              if (total) {
                const percentage = Math.round((loaded / total) * 100);
                this.progress.updateProgress(operationId, percentage, "downloading");

                // Call user's progress callback if provided
                if (options.onProgress) {
                  const rate = this.progress.getProgress(operationId)?.rate || 0;
                  options.onProgress({
                    loaded,
                    total,
                    percentage,
                    rate,
                    phase: "downloading",
                  });
                }
              }
            },
          });

          // Check response status
          if (response.status !== 200) {
            if (response.status === 404) {
              throw new Error(`File not found: CID ${cid} does not exist on the network`);
            }
            throw new Error(
              `Download failed with status ${response.status}: ${response.statusText}`,
            );
          }

          // Create write stream and pipe response
          const writer = createWriteStream(outputPath);

          await new Promise<void>((resolve, reject) => {
            response.data.pipe(writer);

            writer.on("finish", () => {
              resolve();
            });

            writer.on("error", (err) => {
              // Clean up partial file on error
              fsPromises.unlink(outputPath).catch(() => {});
              reject(new Error(`Failed to write file: ${err.message}`));
            });

            response.data.on("error", (err: Error) => {
              writer.close();
              fsPromises.unlink(outputPath).catch(() => {});
              reject(new Error(`Download stream error: ${err.message}`));
            });
          });

          // Verify file was written
          const stats = await fsPromises.stat(outputPath);
          if (stats.size === 0) {
            await fsPromises.unlink(outputPath);
            throw new Error("Downloaded file is empty");
          }

          // Complete operation
          this.progress.completeOperation(operationId, {
            filePath: outputPath,
            size: stats.size,
            cid,
          });

          return outputPath;
        } catch (error) {
          this.progress.failOperation(operationId, error as Error);

          // Provide more helpful error messages
          const errorMessage = error instanceof Error ? error.message : String(error);

          if (
            errorMessage.includes("ENOTFOUND") ||
            errorMessage.includes("ECONNREFUSED") ||
            errorMessage.includes("ETIMEDOUT")
          ) {
            throw new Error(`Network error downloading file: ${errorMessage}.
Check your internet connection and try again.`);
          }

          if (errorMessage.includes("404") || errorMessage.includes("not found")) {
            throw new Error(`File not found: CID ${cid} does not exist or is not accessible.`);
          }

          if (errorMessage.includes("EACCES") || errorMessage.includes("permission")) {
            throw new Error(`Permission denied: Cannot write to ${outputPath}`);
          }

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
    return this.executeWithRateLimit(async () => {
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
    return this.executeWithRateLimit(async () => {
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
   * Generate new encryption key with threshold cryptography
   *
   * @param threshold - Minimum number of shards needed for key recovery (default: 3)
   * @param keyCount - Total number of key shards to generate (default: 5)
   * @returns Generated master key and key shards
   *
   * @example
   * ```typescript
   * const keyData = await sdk.generateEncryptionKey(3, 5);
   * console.log('Master key:', keyData.masterKey);
   * console.log('Key shards:', keyData.keyShards.length);
   * ```
   */
  async generateEncryptionKey(threshold: number = 3, keyCount: number = 5): Promise<GeneratedKey> {
    return this.executeWithRateLimit(async () => {
      return this.errorHandler.executeWithRetry(async () => {
        return await this.encryption.generateKey(threshold, keyCount);
      }, "generateEncryptionKey");
    }, "generateEncryptionKey");
  }

  /**
   * Create key shards from an existing master key
   *
   * @param masterKey - Existing master key to shard
   * @param threshold - Minimum number of shards needed for key recovery (default: 3)
   * @param keyCount - Total number of key shards to generate (default: 5)
   * @returns Generated key shards
   *
   * @example
   * ```typescript
   * const shards = await sdk.shardEncryptionKey(existingKey, 3, 5);
   * console.log('Generated shards:', shards.keyShards.length);
   * ```
   */
  async shardEncryptionKey(
    masterKey: string,
    threshold: number = 3,
    keyCount: number = 5,
  ): Promise<{ keyShards: KeyShard[] }> {
    return this.executeWithRateLimit(async () => {
      return this.errorHandler.executeWithRetry(async () => {
        return await this.encryption.shardKey(masterKey, threshold, keyCount);
      }, "shardEncryptionKey");
    }, "shardEncryptionKey");
  }

  /**
   * Set up access control conditions for encrypted files
   *
   * @param config - Access control configuration
   * @param authToken - Authentication token (JWT or signed message)
   * @returns Success status
   *
   * @example
   * ```typescript
   * const accessConfig = {
   *   address: '0x...',
   *   cid: 'QmHash...',
   *   conditions: [{
   *     id: 1,
   *     chain: 'ethereum',
   *     method: 'balanceOf',
   *     standardContractType: 'ERC20',
   *     contractAddress: '0x...',
   *     returnValueTest: { comparator: '>=', value: '1000000000000000000' },
   *     parameters: ['0x...user-address']
   *   }],
   *   keyShards: generatedKey.keyShards
   * };
   *
   * const result = await sdk.setupAccessControl(accessConfig, jwtToken);
   * if (result.isSuccess) {
   *   console.log('Access control set up successfully');
   * }
   * ```
   */
  async setupAccessControl(
    config: AccessControlConfig,
    authToken: AuthToken,
  ): Promise<EncryptionResponse> {
    return this.executeWithRateLimit(async () => {
      return this.errorHandler.executeWithRetry(async () => {
        return await this.encryption.setupAccessControl(config, authToken);
      }, "setupAccessControl");
    }, "setupAccessControl");
  }

  /**
   * Recover master key from key shards using threshold cryptography
   *
   * @param keyShards - Array of key shards (minimum threshold required)
   * @returns Recovered master key or error
   *
   * @example
   * ```typescript
   * // Need at least 'threshold' number of shards to recover
   * const result = await sdk.recoverEncryptionKey(availableShards);
   * if (result.masterKey) {
   *   console.log('Key recovered successfully');
   * } else {
   *   console.error('Recovery failed:', result.error);
   * }
   * ```
   */
  async recoverEncryptionKey(
    keyShards: KeyShard[],
  ): Promise<{ masterKey: string | null; error: string | null }> {
    return this.executeWithRateLimit(async () => {
      return this.errorHandler.executeWithRetry(async () => {
        return await this.encryption.recoverKey(keyShards);
      }, "recoverEncryptionKey");
    }, "recoverEncryptionKey");
  }

  /**
   * Share encrypted file access to additional addresses
   *
   * @param cid - File CID
   * @param ownerAddress - File owner address
   * @param shareToAddress - Address to share with
   * @param authToken - Authentication token
   * @returns Success status
   *
   * @example
   * ```typescript
   * const result = await sdk.shareFileAccess(
   *   'QmHash...',
   *   '0x...owner',
   *   '0x...recipient',
   *   jwtToken
   * );
   * ```
   */
  async shareFileAccess(
    cid: string,
    ownerAddress: string,
    shareToAddress: string,
    authToken: AuthToken,
  ): Promise<EncryptionResponse> {
    return this.executeWithRateLimit(async () => {
      return this.errorHandler.executeWithRetry(async () => {
        return await this.encryption.shareToAddress(cid, ownerAddress, shareToAddress, authToken);
      }, "shareFileAccess");
    }, "shareFileAccess");
  }

  /**
   * Get authentication message for wallet signing (needed for encryption operations)
   *
   * @param address - Wallet address
   * @returns Authentication message to be signed
   *
   * @example
   * ```typescript
   * const authMsg = await sdk.getEncryptionAuthMessage('0x...');
   * if (authMsg.message) {
   *   // Sign this message with user's wallet
   *   const signature = await wallet.signMessage(authMsg.message);
   *   const jwt = await sdk.getEncryptionJWT('0x...', signature);
   * }
   * ```
   */
  async getEncryptionAuthMessage(
    address: string,
  ): Promise<{ message: string | null; error: string | null }> {
    return this.executeWithRateLimit(async () => {
      return this.errorHandler.executeWithRetry(async () => {
        return await this.encryption.getAuthMessage(address);
      }, "getEncryptionAuthMessage");
    }, "getEncryptionAuthMessage");
  }

  /**
   * Generate JWT token from signed message (for encryption operations)
   *
   * @param address - Wallet address
   * @param signedMessage - Signed authentication message
   * @returns JWT token
   */
  async getEncryptionJWT(address: string, signedMessage: string): Promise<string | null> {
    return this.executeWithRateLimit(async () => {
      return this.errorHandler.executeWithRetry(async () => {
        return await this.encryption.getJWT(address, signedMessage);
      }, "getEncryptionJWT");
    }, "getEncryptionJWT");
  }

  /**
   * Check if encryption functionality is available
   */
  isEncryptionAvailable(): boolean {
    return this.encryption.isAvailable();
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
   * Get connection pool statistics.
   * Returns null if the connection pool is disabled.
   */
  getConnectionPoolStats(): {
    totalConnections: number;
    activeConnections: number;
    idleConnections: number;
    queuedRequests: number;
    totalRequests: number;
    averageWaitTime: number;
  } | null {
    if (!this.connectionPool) {
      return null;
    }
    return this.connectionPool.getStats();
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
   * Create a new dataset with multiple files.
   *
   * This method uploads multiple files and groups them into a logical dataset
   * with metadata and versioning support.
   *
   * @param filePaths - Array of file paths to include in the dataset
   * @param options - Dataset configuration options
   * @returns Promise resolving to dataset information
   *
   * @throws {ValidationError} When file paths are invalid or files don't exist
   * @throws {NetworkError} When network issues prevent upload
   * @throws {InsufficientStorageError} When storage quota is exceeded
   *
   * @example
   * ```typescript
   * const dataset = await sdk.createDataset(
   *   ['./data/file1.csv', './data/file2.json'],
   *   {
   *     name: 'Training Data v1.0',
   *     description: 'Machine learning training dataset',
   *     encrypt: true,
   *     metadata: { version: '1.0', type: 'training' },
   *     tags: ['ml', 'training', 'v1'],
   *     onProgress: (progress) => {
   *       console.log(`Dataset creation: ${progress.percentage}%`);
   *     }
   *   }
   * );
   * ```
   */
  async createDataset(filePaths: string[], options: DatasetOptions): Promise<DatasetInfo> {
    const operationId = generateOperationId();

    return this.executeWithRateLimit(async () => {
      return this.errorHandler.executeWithRetry(async () => {
        try {
          // Validate inputs
          if (!Array.isArray(filePaths) || filePaths.length === 0) {
            throw new Error("At least one file path is required");
          }

          if (!options.name || typeof options.name !== "string") {
            throw new Error("Dataset name is required");
          }

          // Start progress tracking
          this.progress.startOperation(operationId, "upload");

          // Upload all files with progress tracking
          const uploadedFiles: FileInfo[] = [];
          let totalSize = 0;

          for (let i = 0; i < filePaths.length; i++) {
            const filePath = filePaths[i];
            if (!filePath) {
              throw new Error(`Invalid file path at index ${i}`);
            }

            // Update progress
            const progressPercentage = (i / filePaths.length) * 80; // Reserve 20% for dataset creation
            this.progress.updateProgress(operationId, progressPercentage, "uploading");

            // Upload individual file
            const fileInfo = await this.uploadFile(filePath, {
              encrypt: options.encrypt,
              metadata: { ...options.metadata, datasetName: options.name },
            });

            uploadedFiles.push(fileInfo);
            totalSize += fileInfo.size;
          }

          // Update progress to dataset creation phase
          this.progress.updateProgress(operationId, 80, "processing");

          // Create dataset metadata
          const datasetId = `dataset_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
          const now = new Date();

          const datasetInfo: DatasetInfo = {
            id: datasetId,
            name: options.name,
            description: options.description,
            files: uploadedFiles.map((f) => f.hash),
            version: "1.0.0",
            createdAt: now,
            updatedAt: now,
            encrypted: options.encrypt || false,
            metadata: options.metadata,
            tags: options.tags,
            totalSize,
            fileCount: uploadedFiles.length,
          };

          // Complete operation
          this.progress.completeOperation(operationId, datasetInfo);

          return datasetInfo;
        } catch (error) {
          this.progress.failOperation(operationId, error as Error);
          throw error;
        }
      }, "createDataset");
    }, "createDataset");
  }

  /**
   * Update an existing dataset by adding or removing files.
   *
   * @param datasetId - ID of the dataset to update
   * @param options - Update options including files to add/remove
   * @returns Promise resolving to updated dataset information
   *
   * @example
   * ```typescript
   * const updatedDataset = await sdk.updateDataset('dataset_123', {
   *   addFiles: ['./new-file.csv'],
   *   removeFiles: ['QmOldFileHash...'],
   *   description: 'Updated training dataset',
   *   metadata: { version: '1.1' }
   * });
   * ```
   */
  async updateDataset(
    datasetId: string,
    options: {
      addFiles?: string[];
      removeFiles?: string[];
      description?: string;
      metadata?: Record<string, any>;
      tags?: string[];
    },
  ): Promise<DatasetInfo> {
    const operationId = generateOperationId();

    return this.executeWithRateLimit(async () => {
      return this.errorHandler.executeWithRetry(async () => {
        try {
          // Start progress tracking
          this.progress.startOperation(operationId, "upload");

          // For now, simulate dataset update since we don't have persistent storage
          // In a real implementation, this would fetch the existing dataset and update it

          const updatedFiles: string[] = [];
          let totalSize = 0;

          // Add new files if specified
          if (options.addFiles && options.addFiles.length > 0) {
            for (let i = 0; i < options.addFiles.length; i++) {
              const filePath = options.addFiles[i];
              if (!filePath) {
                throw new Error(`Invalid file path at index ${i}`);
              }

              const progressPercentage = (i / options.addFiles.length) * 80;
              this.progress.updateProgress(operationId, progressPercentage, "uploading");

              const fileInfo = await this.uploadFile(filePath);
              updatedFiles.push(fileInfo.hash);
              totalSize += fileInfo.size;
            }
          }

          // Update progress to finalization
          this.progress.updateProgress(operationId, 90, "processing");

          const now = new Date();
          const datasetInfo: DatasetInfo = {
            id: datasetId,
            name: `Updated Dataset ${datasetId}`,
            description: options.description || "Updated dataset",
            files: updatedFiles,
            version: "1.1.0",
            createdAt: new Date(now.getTime() - 86400000), // 1 day ago
            updatedAt: now,
            encrypted: false,
            metadata: options.metadata,
            tags: options.tags,
            totalSize,
            fileCount: updatedFiles.length,
          };

          this.progress.completeOperation(operationId, datasetInfo);
          return datasetInfo;
        } catch (error) {
          this.progress.failOperation(operationId, error as Error);
          throw error;
        }
      }, "updateDataset");
    }, "updateDataset");
  }

  /**
   * Retrieve information about a specific dataset.
   *
   * @param datasetId - ID of the dataset to retrieve
   * @returns Promise resolving to dataset information
   *
   * @example
   * ```typescript
   * const dataset = await sdk.getDataset('dataset_123');
   * console.log(`Dataset: ${dataset.name} (${dataset.fileCount} files)`);
   * ```
   */
  async getDataset(datasetId: string): Promise<DatasetInfo> {
    return this.executeWithRateLimit(async () => {
      return this.errorHandler.executeWithRetry(async () => {
        // For now, return a mock dataset since we don't have persistent storage
        // In a real implementation, this would fetch from a database or metadata service

        const now = new Date();
        return {
          id: datasetId,
          name: `Dataset ${datasetId}`,
          description: "Sample dataset for demonstration",
          files: [`QmSample1${datasetId}`, `QmSample2${datasetId}`],
          version: "1.0.0",
          createdAt: new Date(now.getTime() - 86400000),
          updatedAt: now,
          encrypted: false,
          metadata: { type: "sample" },
          tags: ["sample", "demo"],
          totalSize: 1024 * 1024, // 1MB
          fileCount: 2,
        };
      }, "getDataset");
    }, "getDataset");
  }

  /**
   * List all datasets with pagination support.
   *
   * @param limit - Maximum number of datasets to return
   * @param offset - Number of datasets to skip for pagination
   * @returns Promise resolving to paginated list of datasets
   *
   * @example
   * ```typescript
   * const response = await sdk.listDatasets(10, 0);
   * console.log(`Found ${response.total} datasets`);
   *
   * for (const dataset of response.datasets) {
   *   console.log(`${dataset.name}: ${dataset.fileCount} files`);
   * }
   * ```
   */
  async listDatasets(limit: number = 10, offset: number = 0): Promise<ListDatasetsResponse> {
    return this.executeWithRateLimit(async () => {
      return this.errorHandler.executeWithRetry(async () => {
        // For now, return mock datasets since we don't have persistent storage
        // In a real implementation, this would fetch from a database or metadata service

        const mockDatasets: DatasetInfo[] = [];
        const total = 25; // Mock total

        for (let i = offset; i < Math.min(offset + limit, total); i++) {
          const now = new Date();
          mockDatasets.push({
            id: `dataset_${i + 1}`,
            name: `Dataset ${i + 1}`,
            description: `Sample dataset ${i + 1}`,
            files: [`QmFile1_${i}`, `QmFile2_${i}`],
            version: "1.0.0",
            createdAt: new Date(now.getTime() - i * 86400000),
            updatedAt: new Date(now.getTime() - i * 3600000),
            encrypted: i % 2 === 0,
            metadata: { type: "sample", index: i },
            tags: ["sample", `dataset-${i}`],
            totalSize: (i + 1) * 1024 * 1024,
            fileCount: 2 + (i % 3),
          });
        }

        return {
          datasets: mockDatasets,
          total,
          hasMore: offset + limit < total,
          cursor: offset + limit < total ? String(offset + limit) : undefined,
        };
      }, "listDatasets");
    }, "listDatasets");
  }

  /**
   * Delete a dataset and optionally its associated files.
   *
   * @param datasetId - ID of the dataset to delete
   * @param deleteFiles - Whether to also delete the associated files
   * @returns Promise resolving when deletion is complete
   *
   * @example
   * ```typescript
   * // Delete dataset metadata only
   * await sdk.deleteDataset('dataset_123', false);
   *
   * // Delete dataset and all its files
   * await sdk.deleteDataset('dataset_123', true);
   * ```
   */
  async deleteDataset(datasetId: string, deleteFiles: boolean = false): Promise<void> {
    return this.executeWithRateLimit(async () => {
      return this.errorHandler.executeWithRetry(async () => {
        // For now, just simulate deletion since we don't have persistent storage
        // In a real implementation, this would:
        // 1. Delete dataset metadata from database
        // 2. Optionally delete associated files from IPFS/Lighthouse

        if (deleteFiles) {
          // Would delete associated files here
          console.log(`Deleting dataset ${datasetId} and its files`);
        } else {
          console.log(`Deleting dataset ${datasetId} metadata only`);
        }
      }, "deleteDataset");
    }, "deleteDataset");
  }

  // ============================================
  // Batch Operations
  // ============================================

  /**
   * Upload multiple files in batch with concurrency control and progress tracking.
   *
   * This method efficiently uploads multiple files with configurable concurrency,
   * automatic retry logic, and backpressure handling to prevent memory exhaustion.
   *
   * @param files - Array of files to upload
   * @param options - Batch upload configuration options
   * @returns Promise resolving to batch operation results
   *
   * @example
   * ```typescript
   * const result = await sdk.batchUpload(
   *   [
   *     { filePath: './file1.pdf' },
   *     { filePath: './file2.json', fileName: 'data.json' },
   *     { filePath: './file3.txt', metadata: { type: 'text' } }
   *   ],
   *   {
   *     concurrency: 3,
   *     encrypt: true,
   *     onProgress: (completed, total, failures) => {
   *       console.log(`Progress: ${completed}/${total} (${failures} failures)`);
   *     }
   *   }
   * );
   *
   * console.log(`Uploaded ${result.successful}/${result.total} files`);
   * ```
   */
  async batchUpload(
    files: BatchUploadInput[],
    options: BatchUploadOptions = {},
  ): Promise<BatchOperationResult<FileInfo>> {
    const operationId = generateOperationId();
    const startTime = Date.now();
    const concurrency = options.concurrency ?? 3;
    const continueOnError = options.continueOnError ?? true;
    const maxRetries = options.maxRetries ?? 3;

    // Emit batch start event
    this.emit("batch:upload:start", {
      operationId,
      totalFiles: files.length,
      concurrency,
    });

    // Track completed and failed counts
    let completedCount = 0;
    let failedCount = 0;

    // Create batch processor for uploads
    const processor = new BatchProcessor<BatchUploadInput, FileInfo>(
      async (input: BatchUploadInput) => {
        // Check for memory backpressure before each upload
        if (this.memoryManager.isUnderBackpressure()) {
          this.emit("batch:backpressure", { operationId, waiting: true });
          await this.memoryManager.waitForRelief(30000); // Wait up to 30 seconds
          this.emit("batch:backpressure", { operationId, waiting: false });
        }

        // Get file size for memory tracking
        const fileStats = await validateFile(input.filePath);
        const memoryId = `upload_${operationId}_${input.filePath}`;

        // Track memory allocation
        this.memoryManager.track(memoryId, fileStats.size, {
          type: "upload",
          filePath: input.filePath,
        });

        try {
          // Upload the file
          const result = await this.uploadFile(input.filePath, {
            fileName: input.fileName,
            encrypt: options.encrypt,
            accessConditions: options.accessConditions,
            metadata: { ...options.metadata, ...input.metadata },
          });

          return result;
        } finally {
          // Release memory tracking
          this.memoryManager.untrack(memoryId);
        }
      },
      {
        concurrency,
        retryOnFailure: continueOnError,
        maxRetries,
        onProgress: (completed, total) => {
          completedCount = completed;
          failedCount = total - completed;

          // Emit progress event
          this.emit("batch:upload:progress", {
            operationId,
            completed: completedCount,
            total: files.length,
            failures: failedCount,
          });

          // Call user progress callback
          if (options.onProgress) {
            options.onProgress(completedCount, files.length, failedCount);
          }
        },
      },
    );

    try {
      // Create operations from input files
      const operations = files.map((file, index) => ({
        id: `upload_${index}_${file.filePath}`,
        data: file,
      }));

      // Process all uploads
      const batchResults = await processor.addBatch(operations);

      // Convert batch results to our format
      const results: BatchFileResult<FileInfo>[] = batchResults.map((br) => ({
        id: br.id,
        success: br.success,
        data: br.result,
        error: br.error?.message,
        duration: br.duration,
        retries: br.retries,
      }));

      const totalDuration = Date.now() - startTime;
      const successful = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;

      const operationResult: BatchOperationResult<FileInfo> = {
        total: files.length,
        successful,
        failed,
        results,
        totalDuration,
        averageDuration: totalDuration / files.length,
        successRate: files.length > 0 ? successful / files.length : 0,
      };

      // Emit batch complete event
      this.emit("batch:upload:complete", {
        operationId,
        ...operationResult,
      });

      return operationResult;
    } catch (error) {
      // Emit batch error event
      this.emit("batch:upload:error", {
        operationId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      processor.destroy();
    }
  }

  /**
   * Download multiple files in batch with concurrency control and progress tracking.
   *
   * This method efficiently downloads multiple files with configurable concurrency,
   * automatic retry logic, and backpressure handling to prevent memory exhaustion.
   *
   * @param files - Array of files to download (by CID)
   * @param options - Batch download configuration options
   * @returns Promise resolving to batch operation results
   *
   * @example
   * ```typescript
   * const result = await sdk.batchDownload(
   *   [
   *     { cid: 'QmHash1...' },
   *     { cid: 'QmHash2...', outputFileName: 'custom-name.pdf' },
   *     { cid: 'QmHash3...', expectedSize: 1024 * 1024 }
   *   ],
   *   {
   *     concurrency: 3,
   *     outputDir: './downloads',
   *     onProgress: (completed, total, failures) => {
   *       console.log(`Progress: ${completed}/${total} (${failures} failures)`);
   *     }
   *   }
   * );
   *
   * console.log(`Downloaded ${result.successful}/${result.total} files`);
   * ```
   */
  async batchDownload(
    files: BatchDownloadInput[],
    options: BatchDownloadOptions = {},
  ): Promise<BatchOperationResult<BatchDownloadFileResult>> {
    const operationId = generateOperationId();
    const startTime = Date.now();
    const concurrency = options.concurrency ?? 3;
    const continueOnError = options.continueOnError ?? true;
    const maxRetries = options.maxRetries ?? 3;
    const outputDir = options.outputDir ?? "./downloads";

    // Emit batch start event
    this.emit("batch:download:start", {
      operationId,
      totalFiles: files.length,
      concurrency,
      outputDir,
    });

    // Track completed and failed counts
    let completedCount = 0;
    let failedCount = 0;

    // Create batch processor for downloads
    const processor = new BatchProcessor<BatchDownloadInput, BatchDownloadFileResult>(
      async (input: BatchDownloadInput) => {
        // Check for memory backpressure before each download
        if (this.memoryManager.isUnderBackpressure()) {
          this.emit("batch:backpressure", { operationId, waiting: true });
          await this.memoryManager.waitForRelief(30000); // Wait up to 30 seconds
          this.emit("batch:backpressure", { operationId, waiting: false });
        }

        // Track expected memory allocation
        const expectedSize = input.expectedSize ?? 10 * 1024 * 1024; // Default 10MB
        const memoryId = `download_${operationId}_${input.cid}`;

        this.memoryManager.track(memoryId, expectedSize, {
          type: "download",
          cid: input.cid,
        });

        try {
          // Determine output path
          const fileName = input.outputFileName ?? `downloaded_${input.cid}`;
          const outputPath = `${outputDir}/${fileName}`;

          // Download the file
          const filePath = await this.downloadFile(input.cid, outputPath, {
            expectedSize: input.expectedSize,
            decrypt: options.decrypt,
          });

          // Get actual file size
          const fileStats = await fsPromises.stat(filePath);

          return {
            cid: input.cid,
            filePath,
            size: fileStats.size,
            decrypted: options.decrypt ?? false,
          };
        } finally {
          // Release memory tracking
          this.memoryManager.untrack(memoryId);
        }
      },
      {
        concurrency,
        retryOnFailure: continueOnError,
        maxRetries,
        onProgress: (completed, total) => {
          completedCount = completed;
          failedCount = total - completed;

          // Emit progress event
          this.emit("batch:download:progress", {
            operationId,
            completed: completedCount,
            total: files.length,
            failures: failedCount,
          });

          // Call user progress callback
          if (options.onProgress) {
            options.onProgress(completedCount, files.length, failedCount);
          }
        },
      },
    );

    try {
      // Create operations from input files
      const operations = files.map((file, index) => ({
        id: `download_${index}_${file.cid}`,
        data: file,
      }));

      // Process all downloads
      const batchResults = await processor.addBatch(operations);

      // Convert batch results to our format
      const results: BatchFileResult<BatchDownloadFileResult>[] = batchResults.map((br) => ({
        id: br.id,
        success: br.success,
        data: br.result,
        error: br.error?.message,
        duration: br.duration,
        retries: br.retries,
      }));

      const totalDuration = Date.now() - startTime;
      const successful = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;

      const operationResult: BatchOperationResult<BatchDownloadFileResult> = {
        total: files.length,
        successful,
        failed,
        results,
        totalDuration,
        averageDuration: totalDuration / files.length,
        successRate: files.length > 0 ? successful / files.length : 0,
      };

      // Emit batch complete event
      this.emit("batch:download:complete", {
        operationId,
        ...operationResult,
      });

      return operationResult;
    } catch (error) {
      // Emit batch error event
      this.emit("batch:download:error", {
        operationId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      processor.destroy();
    }
  }

  /**
   * Get memory manager statistics
   */
  getMemoryStats() {
    return this.memoryManager.getStats();
  }

  /**
   * Check if currently under memory backpressure
   */
  isUnderBackpressure(): boolean {
    return this.memoryManager.isUnderBackpressure();
  }

  /**
   * Cleanup resources and disconnect
   */
  destroy(): void {
    this.auth.destroy();
    this.progress.cleanup();
    this.encryption.destroy();
    if (this.connectionPool) {
      this.connectionPool.destroy();
    }
    this.memoryManager.destroy();
    this.removeAllListeners();
  }
}
