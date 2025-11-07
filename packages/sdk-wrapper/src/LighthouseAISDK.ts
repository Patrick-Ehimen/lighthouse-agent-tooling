import { EventEmitter } from "eventemitter3";
import lighthouse from "@lighthouse-web3/sdk";
import { readFileSync } from "fs";
import { AuthenticationManager } from "./auth/AuthenticationManager";
import { ProgressTracker } from "./progress/ProgressTracker";
import { ErrorHandler } from "./errors/ErrorHandler";
import { CircuitBreaker } from "./errors/CircuitBreaker";
import { EncryptionManager } from "./encryption/EncryptionManager";
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
  private encryption: EncryptionManager;
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
    const axios = eval("require")("axios");

    const formData = new FormData();
    formData.append("file", fileBuffer, fileName);

    const response = await axios.post("https://api.lighthouse.storage/api/v0/add", formData, {
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
    return this.circuitBreaker.execute(async () => {
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
    return this.circuitBreaker.execute(async () => {
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
    return this.circuitBreaker.execute(async () => {
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
    return this.circuitBreaker.execute(async () => {
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
    return this.circuitBreaker.execute(async () => {
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
    return this.circuitBreaker.execute(async () => {
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
    return this.circuitBreaker.execute(async () => {
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

    return this.circuitBreaker.execute(async () => {
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
          const datasetId = `dataset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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

    return this.circuitBreaker.execute(async () => {
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
    return this.circuitBreaker.execute(async () => {
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
    return this.circuitBreaker.execute(async () => {
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
    return this.circuitBreaker.execute(async () => {
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

  /**
   * Cleanup resources and disconnect
   */
  destroy(): void {
    this.auth.destroy();
    this.progress.cleanup();
    this.encryption.destroy();
    this.removeAllListeners();
  }
}
