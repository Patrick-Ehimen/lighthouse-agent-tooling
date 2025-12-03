/**
 * Real Lighthouse Service - Uses the unified SDK wrapper for actual Lighthouse operations
 */

import { LighthouseAISDK, EnhancedAccessCondition } from "@lighthouse-tooling/sdk-wrapper";
import { UploadResult, DownloadResult, AccessCondition, Dataset } from "@lighthouse-tooling/types";
import { Logger } from "@lighthouse-tooling/shared";
import { ILighthouseService, StoredFile } from "./ILighthouseService.js";
import { DatabaseService } from "../storage/DatabaseService.js";

export class LighthouseService implements ILighthouseService {
  private sdk: LighthouseAISDK;
  private logger: Logger;
  private database: DatabaseService;
  // Keep in-memory cache for performance (LRU cache can be added later)
  private fileCache: Map<string, StoredFile> = new Map();
  private datasetCache: Map<string, Dataset> = new Map();

  constructor(apiKey: string, logger?: Logger, dbPath?: string) {
    this.logger = logger || Logger.getInstance({ level: "info", component: "LighthouseService" });

    // Initialize database service
    this.database = new DatabaseService({ dbPath });

    this.sdk = new LighthouseAISDK({
      apiKey,
      timeout: 30000,
      maxRetries: 3,
      debug: false,
    });

    // Set up event listeners for progress tracking
    this.setupEventListeners();

    this.logger.info("Real Lighthouse Service initialized", {
      apiKey: apiKey.substring(0, 8) + "...",
    });
  }

  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    try {
      await this.sdk.initialize();
      this.logger.info("Lighthouse SDK initialized successfully");
    } catch (error) {
      this.logger.error("Failed to initialize Lighthouse SDK", error as Error);
      throw error;
    }
  }

  /**
   * Set up event listeners for SDK events
   */
  private setupEventListeners(): void {
    this.sdk.on("upload:start", (event) => {
      this.logger.info("Upload started", { operationId: event.operationId });
    });

    this.sdk.on("upload:progress", (event) => {
      this.logger.debug("Upload progress", {
        operationId: event.operationId,
        progress: event.data.percentage,
      });
    });

    this.sdk.on("upload:complete", (event) => {
      this.logger.info("Upload completed", { operationId: event.operationId });
    });

    this.sdk.on("upload:error", (event) => {
      this.logger.error("Upload failed", event.error!, { operationId: event.operationId });
    });

    this.sdk.on("download:start", (event) => {
      this.logger.info("Download started", { operationId: event.operationId });
    });

    this.sdk.on("download:progress", (event) => {
      this.logger.debug("Download progress", {
        operationId: event.operationId,
        progress: event.data.percentage,
      });
    });

    this.sdk.on("download:complete", (event) => {
      this.logger.info("Download completed", { operationId: event.operationId });
    });

    this.sdk.on("download:error", (event) => {
      this.logger.error("Download failed", event.error!, { operationId: event.operationId });
    });

    this.sdk.on("auth:error", (error) => {
      this.logger.error("Authentication error", error);
    });

    this.sdk.on("auth:refresh", () => {
      this.logger.info("Authentication token refreshed");
    });
  }

  /**
   * Upload file using real Lighthouse SDK
   */
  async uploadFile(params: {
    filePath: string;
    encrypt?: boolean;
    accessConditions?: AccessCondition[];
    tags?: string[];
  }): Promise<UploadResult> {
    const startTime = Date.now();

    try {
      this.logger.info("Starting file upload", { filePath: params.filePath });

      // Upload file using SDK wrapper
      const fileInfo = await this.sdk.uploadFile(params.filePath, {
        fileName: params.filePath.split("/").pop(),
        encrypt: params.encrypt || false,
        metadata: {
          tags: params.tags,
          accessConditions: params.accessConditions,
        },
      });

      // Store file metadata in cache and database
      const storedFile: StoredFile = {
        cid: fileInfo.hash,
        filePath: params.filePath,
        size: fileInfo.size,
        encrypted: params.encrypt || false,
        accessConditions: params.accessConditions,
        tags: params.tags,
        uploadedAt: fileInfo.uploadedAt,
        pinned: true,
        hash: fileInfo.hash,
      };

      // Persist to database
      this.database.saveFile(storedFile);
      // Update cache
      this.fileCache.set(fileInfo.hash, storedFile);

      const result: UploadResult = {
        cid: fileInfo.hash,
        size: fileInfo.size,
        encrypted: params.encrypt || false,
        accessConditions: params.accessConditions,
        tags: params.tags,
        uploadedAt: fileInfo.uploadedAt,
        originalPath: params.filePath,
        hash: fileInfo.hash,
      };

      const executionTime = Date.now() - startTime;
      this.logger.info("File uploaded successfully", {
        cid: fileInfo.hash,
        size: fileInfo.size,
        executionTime,
      });

      return result;
    } catch (error) {
      this.logger.error("File upload failed", error as Error, {
        filePath: params.filePath,
      });
      throw error;
    }
  }

  /**
   * Fetch/download file using real Lighthouse SDK
   */
  async fetchFile(params: {
    cid: string;
    outputPath?: string;
    decrypt?: boolean;
  }): Promise<DownloadResult> {
    const startTime = Date.now();

    try {
      this.logger.info("Starting file fetch", { cid: params.cid });

      // Get file info first
      const fileInfo = await this.sdk.getFileInfo(params.cid);

      // Download file using SDK wrapper
      const outputPath = params.outputPath || `./downloaded_${params.cid}`;
      const downloadedPath = await this.sdk.downloadFile(params.cid, outputPath);

      const result: DownloadResult = {
        filePath: downloadedPath,
        cid: params.cid,
        size: fileInfo.size,
        decrypted: params.decrypt || false,
        downloadedAt: new Date(),
        hash: fileInfo.hash,
      };

      const executionTime = Date.now() - startTime;
      this.logger.info("File fetched successfully", {
        cid: params.cid,
        size: fileInfo.size,
        executionTime,
      });

      return result;
    } catch (error) {
      this.logger.error("File fetch failed", error as Error, { cid: params.cid });
      throw error;
    }
  }

  /**
   * Pin file (Lighthouse handles this automatically)
   */
  async pinFile(cid: string): Promise<{ success: boolean; cid: string; pinned: boolean }> {
    try {
      this.logger.info("Pinning file", { cid });

      // Get file info to verify it exists
      await this.sdk.getFileInfo(cid);

      // Update database and cache
      this.database.updateFilePinned(cid, true);
      const cachedFile = this.fileCache.get(cid);
      if (cachedFile) {
        cachedFile.pinned = true;
      }

      this.logger.info("File pinned successfully", { cid });

      return {
        success: true,
        cid,
        pinned: true,
      };
    } catch (error) {
      this.logger.error("Pin file failed", error as Error, { cid });
      throw error;
    }
  }

  /**
   * Unpin file (not directly supported by Lighthouse)
   */
  async unpinFile(cid: string): Promise<{ success: boolean; cid: string; pinned: boolean }> {
    try {
      this.logger.info("Unpinning file", { cid });

      // Update database and cache
      this.database.updateFilePinned(cid, false);
      const cachedFile = this.fileCache.get(cid);
      if (cachedFile) {
        cachedFile.pinned = false;
      }

      this.logger.info("File unpinned successfully", { cid });

      return {
        success: true,
        cid,
        pinned: false,
      };
    } catch (error) {
      this.logger.error("Unpin file failed", error as Error, { cid });
      throw error;
    }
  }

  /**
   * Get file info by CID
   */
  async getFileInfo(cid: string): Promise<StoredFile | undefined> {
    try {
      // Try cache first
      const cachedFile = this.fileCache.get(cid);
      if (cachedFile) {
        return cachedFile;
      }

      // Try database
      const dbFile = this.database.getFile(cid);
      if (dbFile) {
        this.fileCache.set(cid, dbFile);
        return dbFile;
      }

      // Get from Lighthouse
      const fileInfo = await this.sdk.getFileInfo(cid);

      const storedFile: StoredFile = {
        cid: fileInfo.hash,
        filePath: fileInfo.name,
        size: fileInfo.size,
        encrypted: fileInfo.encrypted,
        uploadedAt: fileInfo.uploadedAt,
        pinned: true,
        hash: fileInfo.hash,
      };

      // Persist to database and cache
      this.database.saveFile(storedFile);
      this.fileCache.set(cid, storedFile);

      return storedFile;
    } catch (error) {
      this.logger.error("Failed to get file info", error as Error, { cid });
      return undefined;
    }
  }

  /**
   * List all uploaded files
   */
  async listFiles(): Promise<StoredFile[]> {
    try {
      // Try to get from database first (faster)
      const dbFiles = this.database.listFiles();
      if (dbFiles.length > 0) {
        // Update cache
        dbFiles.forEach((file) => {
          this.fileCache.set(file.cid, file);
        });
        return dbFiles;
      }

      // Fallback to SDK if database is empty
      const response = await this.sdk.listFiles(100, 0); // Get up to 100 files

      const files: StoredFile[] = response.files.map((fileInfo) => {
        const storedFile: StoredFile = {
          cid: fileInfo.hash,
          filePath: fileInfo.name,
          size: fileInfo.size,
          encrypted: fileInfo.encrypted,
          uploadedAt: fileInfo.uploadedAt,
          pinned: true,
          hash: fileInfo.hash,
        };

        // Persist to database and update cache
        this.database.saveFile(storedFile);
        this.fileCache.set(fileInfo.hash, storedFile);

        return storedFile;
      });

      return files;
    } catch (error) {
      this.logger.error("Failed to list files", error as Error);
      return [];
    }
  }

  /**
   * Get storage stats
   */
  getStorageStats(): {
    fileCount: number;
    totalSize: number;
    maxSize: number;
    utilization: number;
  } {
    // Get stats from database (more accurate)
    const fileCount = this.database.getFileCount();
    const totalSize = this.database.getTotalSize();

    return {
      fileCount,
      totalSize,
      maxSize: Number.MAX_SAFE_INTEGER, // Lighthouse doesn't have a fixed limit
      utilization: 0, // Can't calculate without knowing the limit
    };
  }

  /**
   * Get SDK metrics
   */
  getSDKMetrics() {
    return {
      auth: this.sdk.getAuthState(),
      activeOperations: this.sdk.getActiveOperations(),
      errorMetrics: this.sdk.getErrorMetrics(),
      circuitBreaker: this.sdk.getCircuitBreakerStatus(),
    };
  }

  /**
   * Generate encryption key with threshold cryptography
   */
  async generateEncryptionKey(
    threshold: number = 3,
    keyCount: number = 5,
  ): Promise<{
    success: boolean;
    data?: { masterKey: string; keyShards: Array<{ key: string; index: string }> };
    error?: string;
  }> {
    try {
      this.logger.info("Generating encryption key", { threshold, keyCount });

      // Check if encryption is available
      if (!this.sdk.isEncryptionAvailable()) {
        const error = "Encryption features not available - Kavach SDK not found";
        this.logger.warn(error);
        return {
          success: false,
          error,
        };
      }

      const result = await this.sdk.generateEncryptionKey(threshold, keyCount);

      this.logger.info("Encryption key generated successfully", {
        keyShardCount: result.keyShards.length,
      });

      return {
        success: true,
        data: {
          masterKey: result.masterKey || "",
          keyShards: result.keyShards,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      this.logger.error("Failed to generate encryption key", error as Error, {
        threshold,
        keyCount,
      });

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Setup access control for encrypted files
   */
  async setupAccessControl(
    config: {
      address: string;
      cid: string;
      conditions: EnhancedAccessCondition[];
      aggregator?: string;
      chainType?: "evm" | "solana";
      keyShards?: Array<{ key: string; index: string }>;
    },
    authToken: string,
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      this.logger.info("Setting up access control", {
        address: config.address,
        cid: config.cid,
        conditionCount: config.conditions.length,
      });

      // Check if encryption is available
      if (!this.sdk.isEncryptionAvailable()) {
        const error = "Encryption features not available - Kavach SDK not found";
        this.logger.warn(error);
        return {
          success: false,
          error,
        };
      }

      const result = await this.sdk.setupAccessControl(
        {
          address: config.address,
          cid: config.cid,
          conditions: config.conditions,
          aggregator: config.aggregator,
          chainType: config.chainType || "evm",
          keyShards: config.keyShards,
        },
        authToken,
      );

      if (!result.isSuccess) {
        this.logger.error(
          "Access control setup failed",
          new Error(result.error || "Unknown error"),
        );
        return {
          success: false,
          error: result.error || "Unknown error",
        };
      }

      this.logger.info("Access control set up successfully", {
        address: config.address,
        cid: config.cid,
      });

      return {
        success: true,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      this.logger.error("Failed to setup access control", error as Error, {
        address: config.address,
        cid: config.cid,
      });

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Clear cache (for testing)
   */
  clear(): void {
    this.fileCache.clear();
    this.datasetCache.clear();
    this.database.clear();
    this.logger.info("Cache and database cleared");
  }

  /**
   * Create a new dataset
   */
  async createDataset(params: {
    name: string;
    description?: string;
    filePaths: string[];
    encrypt?: boolean;
    accessConditions?: AccessCondition[];
    tags?: string[];
    metadata?: Record<string, unknown>;
  }): Promise<Dataset> {
    try {
      this.logger.info("Creating dataset", {
        name: params.name,
        fileCount: params.filePaths.length,
      });

      // Use SDK wrapper to create dataset
      const datasetInfo = await this.sdk.createDataset(params.filePaths, {
        name: params.name,
        description: params.description,
        encrypt: params.encrypt,
        metadata: params.metadata,
        tags: params.tags,
      });

      // Convert SDK DatasetInfo to Dataset type
      const dataset: Dataset = {
        id: datasetInfo.id,
        name: datasetInfo.name,
        description: datasetInfo.description || "",
        files: datasetInfo.files.map((hash) => ({
          cid: hash,
          size: 0, // Would need to fetch individual file info
          encrypted: datasetInfo.encrypted,
          accessConditions: params.accessConditions,
          tags: params.tags,
          uploadedAt: datasetInfo.createdAt,
          originalPath: "",
          hash: hash,
        })),
        metadata: {
          author: "AI Agent",
          license: "Custom",
          category: "AI Generated",
          keywords: params.tags,
          custom: params.metadata,
        },
        version: datasetInfo.version,
        createdAt: datasetInfo.createdAt,
        updatedAt: datasetInfo.updatedAt,
        encrypted: datasetInfo.encrypted,
        accessConditions: params.accessConditions,
      };

      // Persist to database and cache
      this.database.saveDataset(dataset);
      this.datasetCache.set(dataset.id, dataset);

      this.logger.info("Dataset created successfully", {
        id: dataset.id,
        name: dataset.name,
        fileCount: dataset.files.length,
      });

      return dataset;
    } catch (error) {
      this.logger.error("Dataset creation failed", error as Error, { name: params.name });
      throw error;
    }
  }

  /**
   * Update an existing dataset
   */
  async updateDataset(params: {
    datasetId: string;
    addFiles?: string[];
    removeFiles?: string[];
    description?: string;
    metadata?: Record<string, unknown>;
    tags?: string[];
  }): Promise<Dataset> {
    try {
      this.logger.info("Updating dataset", { datasetId: params.datasetId });

      // Use SDK wrapper to update dataset
      const datasetInfo = await this.sdk.updateDataset(params.datasetId, {
        addFiles: params.addFiles,
        removeFiles: params.removeFiles,
        description: params.description,
        metadata: params.metadata,
        tags: params.tags,
      });

      // Convert SDK DatasetInfo to Dataset type
      const dataset: Dataset = {
        id: datasetInfo.id,
        name: datasetInfo.name,
        description: datasetInfo.description || "",
        files: datasetInfo.files.map((hash) => ({
          cid: hash,
          size: 0, // Would need to fetch individual file info
          encrypted: datasetInfo.encrypted,
          tags: params.tags,
          uploadedAt: datasetInfo.updatedAt,
          originalPath: "",
          hash: hash,
        })),
        metadata: {
          author: "AI Agent",
          license: "Custom",
          category: "AI Generated",
          keywords: params.tags,
          custom: params.metadata,
        },
        version: datasetInfo.version,
        createdAt: datasetInfo.createdAt,
        updatedAt: datasetInfo.updatedAt,
        encrypted: datasetInfo.encrypted,
      };

      // Persist to database and update cache
      this.database.saveDataset(dataset);
      this.datasetCache.set(dataset.id, dataset);

      this.logger.info("Dataset updated successfully", {
        id: dataset.id,
        name: dataset.name,
        fileCount: dataset.files.length,
      });

      return dataset;
    } catch (error) {
      this.logger.error("Dataset update failed", error as Error, { datasetId: params.datasetId });
      throw error;
    }
  }

  /**
   * Get dataset by ID
   */
  async getDataset(datasetId: string): Promise<Dataset | undefined> {
    try {
      // Try cache first
      const cachedDataset = this.datasetCache.get(datasetId);
      if (cachedDataset) {
        return cachedDataset;
      }

      // Try database
      const dbDataset = this.database.getDataset(datasetId);
      if (dbDataset) {
        this.datasetCache.set(datasetId, dbDataset);
        return dbDataset;
      }

      // Use SDK wrapper to get dataset
      const datasetInfo = await this.sdk.getDataset(datasetId);

      // Convert SDK DatasetInfo to Dataset type
      const dataset: Dataset = {
        id: datasetInfo.id,
        name: datasetInfo.name,
        description: datasetInfo.description || "",
        files: datasetInfo.files.map((hash) => ({
          cid: hash,
          size: 0, // Would need to fetch individual file info
          encrypted: datasetInfo.encrypted,
          uploadedAt: datasetInfo.createdAt,
          originalPath: "",
          hash: hash,
        })),
        metadata: {
          author: "AI Agent",
          license: "Custom",
          category: "AI Generated",
          keywords: datasetInfo.tags,
          custom: datasetInfo.metadata,
        },
        version: datasetInfo.version,
        createdAt: datasetInfo.createdAt,
        updatedAt: datasetInfo.updatedAt,
        encrypted: datasetInfo.encrypted,
      };

      // Persist to database and cache
      this.database.saveDataset(dataset);
      this.datasetCache.set(dataset.id, dataset);

      return dataset;
    } catch (error) {
      this.logger.error("Failed to get dataset", error as Error, { datasetId });
      return undefined;
    }
  }

  /**
   * List all datasets
   */
  async listDatasets(params?: { limit?: number; offset?: number }): Promise<{
    datasets: Dataset[];
    total: number;
    hasMore: boolean;
  }> {
    try {
      const limit = params?.limit || 10;
      const offset = params?.offset || 0;

      // Try to get from database first (faster and more accurate)
      const dbResult = this.database.listDatasets(limit, offset);
      if (dbResult.total > 0) {
        // Update cache
        dbResult.datasets.forEach((dataset) => {
          this.datasetCache.set(dataset.id, dataset);
        });
        return {
          datasets: dbResult.datasets,
          total: dbResult.total,
          hasMore: offset + limit < dbResult.total,
        };
      }

      // Fallback to SDK if database is empty
      const response = await this.sdk.listDatasets(limit, offset);

      const datasets: Dataset[] = response.datasets.map((datasetInfo) => {
        const dataset: Dataset = {
          id: datasetInfo.id,
          name: datasetInfo.name,
          description: datasetInfo.description || "",
          files: datasetInfo.files.map((hash) => ({
            cid: hash,
            size: 0, // Would need to fetch individual file info
            encrypted: datasetInfo.encrypted,
            uploadedAt: datasetInfo.createdAt,
            originalPath: "",
            hash: hash,
          })),
          metadata: {
            author: "AI Agent",
            license: "Custom",
            category: "AI Generated",
            keywords: datasetInfo.tags,
            custom: datasetInfo.metadata,
          },
          version: datasetInfo.version,
          createdAt: datasetInfo.createdAt,
          updatedAt: datasetInfo.updatedAt,
          encrypted: datasetInfo.encrypted,
        };

        // Persist to database and cache
        this.database.saveDataset(dataset);
        this.datasetCache.set(dataset.id, dataset);

        return dataset;
      });

      return {
        datasets,
        total: response.total,
        hasMore: response.hasMore,
      };
    } catch (error) {
      this.logger.error("Failed to list datasets", error as Error);
      return {
        datasets: [],
        total: 0,
        hasMore: false,
      };
    }
  }

  /**
   * Delete a dataset
   */
  async deleteDataset(datasetId: string, deleteFiles?: boolean): Promise<void> {
    try {
      this.logger.info("Deleting dataset", { datasetId, deleteFiles });

      // Use SDK wrapper to delete dataset
      await this.sdk.deleteDataset(datasetId, deleteFiles);

      // Remove from database and cache
      this.database.deleteDataset(datasetId, deleteFiles);
      this.datasetCache.delete(datasetId);

      this.logger.info("Dataset deleted successfully", { datasetId });
    } catch (error) {
      this.logger.error("Dataset deletion failed", error as Error, { datasetId });
      throw error;
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.sdk.destroy();
    this.fileCache.clear();
    this.datasetCache.clear();
    this.database.close();
    this.logger.info("Lighthouse service destroyed");
  }
}
