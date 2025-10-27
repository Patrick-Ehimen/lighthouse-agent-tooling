/**
 * Mock Lighthouse Service - Simulates Lighthouse file operations
 */

import { UploadResult, DownloadResult, AccessCondition, Dataset } from "@lighthouse-tooling/types";
import { EnhancedAccessCondition } from "@lighthouse-tooling/sdk-wrapper";
import { Logger, FileUtils } from "@lighthouse-tooling/shared";
import { CIDGenerator } from "../utils/cid-generator.js";
import { ILighthouseService, StoredFile } from "./ILighthouseService.js";

export class MockLighthouseService implements ILighthouseService {
  private fileStore: Map<string, StoredFile> = new Map();
  private datasetStore: Map<string, Dataset> = new Map();
  private logger: Logger;
  private maxStorageSize: number;
  private currentStorageSize: number = 0;

  constructor(maxStorageSize = 1024 * 1024 * 1024, logger?: Logger) {
    this.maxStorageSize = maxStorageSize; // Default 1GB
    this.logger =
      logger || Logger.getInstance({ level: "info", component: "MockLighthouseService" });
    this.logger.info("Mock Lighthouse Service initialized", { maxStorageSize });
  }

  /**
   * Mock file upload
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

      // Simulate validation delay
      await this.simulateDelay(50, 100);

      // Check if file exists and get info
      const fileExists = await FileUtils.fileExists(params.filePath);
      if (!fileExists) {
        throw new Error(`File not found: ${params.filePath}`);
      }

      let fileInfo;
      try {
        fileInfo = await FileUtils.getFileInfo(params.filePath);
      } catch (error) {
        // If FileUtils fails, create a basic file info
        const fs = await import("fs/promises");
        const stats = await fs.stat(params.filePath);
        const path = await import("path");
        fileInfo = {
          path: params.filePath,
          name: path.basename(params.filePath),
          extension: path.extname(params.filePath),
          size: stats.size,
          lastModified: stats.mtime,
        };
      }

      // Check storage limits
      if (this.currentStorageSize + fileInfo.size > this.maxStorageSize) {
        throw new Error("Storage quota exceeded");
      }

      // Generate CID
      const cid = CIDGenerator.generate(params.filePath);

      // Simulate upload delay (200-400ms for realistic feel)
      await this.simulateDelay(200, 400);

      // Store file metadata
      const storedFile: StoredFile = {
        cid,
        filePath: params.filePath,
        size: fileInfo.size,
        encrypted: params.encrypt || false,
        accessConditions: params.accessConditions,
        tags: params.tags,
        uploadedAt: new Date(),
        pinned: true,
        hash: fileInfo.hash,
      };

      this.fileStore.set(cid, storedFile);
      this.currentStorageSize += fileInfo.size;

      const result: UploadResult = {
        cid,
        size: fileInfo.size,
        encrypted: params.encrypt || false,
        accessConditions: params.accessConditions,
        tags: params.tags,
        uploadedAt: new Date(),
        originalPath: params.filePath,
        hash: fileInfo.hash,
      };

      const executionTime = Date.now() - startTime;
      this.logger.info("File uploaded successfully", {
        cid,
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
   * Mock file fetch/download
   */
  async fetchFile(params: {
    cid: string;
    outputPath?: string;
    decrypt?: boolean;
  }): Promise<DownloadResult> {
    const startTime = Date.now();

    try {
      this.logger.info("Starting file fetch", { cid: params.cid });

      // Validate CID format
      if (!CIDGenerator.isValid(params.cid)) {
        throw new Error(`Invalid CID format: ${params.cid}`);
      }

      // Check if file exists in store
      const storedFile = this.fileStore.get(params.cid);
      if (!storedFile) {
        throw new Error(`File not found: ${params.cid}`);
      }

      // Simulate download delay (50-200ms)
      await this.simulateDelay(50, 200);

      const result: DownloadResult = {
        filePath: params.outputPath || storedFile.filePath,
        cid: params.cid,
        size: storedFile.size,
        decrypted: params.decrypt || false,
        downloadedAt: new Date(),
        hash: storedFile.hash,
      };

      const executionTime = Date.now() - startTime;
      this.logger.info("File fetched successfully", {
        cid: params.cid,
        size: storedFile.size,
        executionTime,
      });

      return result;
    } catch (error) {
      this.logger.error("File fetch failed", error as Error, { cid: params.cid });
      throw error;
    }
  }

  /**
   * Mock pin file
   */
  async pinFile(cid: string): Promise<{ success: boolean; cid: string; pinned: boolean }> {
    try {
      this.logger.info("Pinning file", { cid });

      // Validate CID
      if (!CIDGenerator.isValid(cid)) {
        throw new Error(`Invalid CID format: ${cid}`);
      }

      const storedFile = this.fileStore.get(cid);
      if (!storedFile) {
        throw new Error(`File not found: ${cid}`);
      }

      // Simulate pin delay
      await this.simulateDelay(50, 100);

      storedFile.pinned = true;

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
   * Mock unpin file
   */
  async unpinFile(cid: string): Promise<{ success: boolean; cid: string; pinned: boolean }> {
    try {
      this.logger.info("Unpinning file", { cid });

      const storedFile = this.fileStore.get(cid);
      if (!storedFile) {
        throw new Error(`File not found: ${cid}`);
      }

      // Simulate unpin delay
      await this.simulateDelay(50, 100);

      storedFile.pinned = false;

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
  getFileInfo(cid: string): StoredFile | undefined {
    return this.fileStore.get(cid);
  }

  /**
   * List all uploaded files
   */
  listFiles(): StoredFile[] {
    return Array.from(this.fileStore.values());
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
    return {
      fileCount: this.fileStore.size,
      totalSize: this.currentStorageSize,
      maxSize: this.maxStorageSize,
      utilization: (this.currentStorageSize / this.maxStorageSize) * 100,
    };
  }

  /**
   * Mock encryption key generation
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
      this.logger.info("Generating mock encryption key", { threshold, keyCount });

      // Simulate key generation delay
      await this.simulateDelay(100, 200);

      // Generate mock key shards
      const keyShards = Array.from({ length: keyCount }, (_, i) => ({
        key: `mock-shard-${i + 1}-${Math.random().toString(36).slice(2, 10)}`,
        index: `index-${i + 1}-${Math.random().toString(36).slice(2, 8)}`,
      }));

      const masterKey = `mock-master-key-${Math.random().toString(36).slice(2, 12)}`;

      this.logger.info("Mock encryption key generated", { keyShardCount: keyShards.length });

      return {
        success: true,
        data: {
          masterKey,
          keyShards,
        },
      };
    } catch (error) {
      this.logger.error("Mock key generation failed", error as Error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Mock access control setup
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
      this.logger.info("Setting up mock access control", {
        address: config.address,
        cid: config.cid,
        conditionCount: config.conditions.length,
      });

      // Simulate access control setup delay
      await this.simulateDelay(150, 300);

      // Check if file exists
      const storedFile = this.fileStore.get(config.cid);
      if (!storedFile) {
        return {
          success: false,
          error: `File not found: ${config.cid}`,
        };
      }

      // Update file with access conditions
      // Convert enhanced conditions to basic AccessCondition format for storage
      storedFile.accessConditions = config.conditions.map((condition: any) => ({
        type: "smart_contract" as any,
        condition: condition.method || "unknown",
        value: condition.returnValueTest?.value?.toString() || "0",
        parameters: { ...condition },
      }));
      storedFile.encrypted = true;

      this.logger.info("Mock access control set up successfully", {
        address: config.address,
        cid: config.cid,
      });

      return {
        success: true,
      };
    } catch (error) {
      this.logger.error("Mock access control setup failed", error as Error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Clear all stored files (for testing)
   */
  clear(): void {
    this.fileStore.clear();
    this.datasetStore.clear();
    this.currentStorageSize = 0;
    this.logger.info("Mock storage cleared");
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
    const startTime = Date.now();

    try {
      this.logger.info("Creating dataset", {
        name: params.name,
        fileCount: params.filePaths.length,
      });

      // Upload all files first
      const uploadedFiles: UploadResult[] = [];
      for (const filePath of params.filePaths) {
        const uploadResult = await this.uploadFile({
          filePath,
          encrypt: params.encrypt,
          accessConditions: params.accessConditions,
          tags: params.tags,
        });
        uploadedFiles.push(uploadResult);
      }

      // Create dataset
      const datasetId = `dataset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const now = new Date();

      const dataset: Dataset = {
        id: datasetId,
        name: params.name,
        description: params.description || "",
        files: uploadedFiles,
        metadata: {
          author: "Mock Service",
          license: "Custom",
          category: "Test",
          keywords: params.tags,
          custom: params.metadata,
        },
        version: "1.0.0",
        createdAt: now,
        updatedAt: now,
        encrypted: params.encrypt || false,
        accessConditions: params.accessConditions,
      };

      this.datasetStore.set(datasetId, dataset);

      const executionTime = Date.now() - startTime;
      this.logger.info("Dataset created successfully", {
        id: datasetId,
        name: params.name,
        fileCount: uploadedFiles.length,
        executionTime,
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

      const dataset = this.datasetStore.get(params.datasetId);
      if (!dataset) {
        throw new Error(`Dataset not found: ${params.datasetId}`);
      }

      // Add new files if specified
      if (params.addFiles && params.addFiles.length > 0) {
        for (const filePath of params.addFiles) {
          const uploadResult = await this.uploadFile({ filePath });
          dataset.files.push(uploadResult);
        }
      }

      // Remove files if specified
      if (params.removeFiles && params.removeFiles.length > 0) {
        dataset.files = dataset.files.filter((file) => !params.removeFiles!.includes(file.cid));
      }

      // Update metadata
      if (params.description !== undefined) {
        dataset.description = params.description;
      }

      if (params.metadata) {
        dataset.metadata.custom = { ...dataset.metadata.custom, ...params.metadata };
      }

      if (params.tags) {
        dataset.metadata.keywords = params.tags;
      }

      // Update version and timestamp
      const versionParts = dataset.version.split(".");
      if (versionParts.length >= 2 && versionParts[1]) {
        versionParts[1] = String(parseInt(versionParts[1]) + 1);
        dataset.version = versionParts.join(".");
      } else {
        dataset.version = "1.1.0";
      }
      dataset.updatedAt = new Date();

      this.datasetStore.set(params.datasetId, dataset);

      this.logger.info("Dataset updated successfully", {
        id: params.datasetId,
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
      this.logger.info("Retrieving dataset", { datasetId });

      const dataset = this.datasetStore.get(datasetId);
      if (!dataset) {
        this.logger.warn("Dataset not found", { datasetId });
        return undefined;
      }

      return dataset;
    } catch (error) {
      this.logger.error("Failed to get dataset", error as Error, { datasetId });
      throw error;
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

      this.logger.info("Listing datasets", { limit, offset });

      const allDatasets = Array.from(this.datasetStore.values());
      const total = allDatasets.length;
      const paginatedDatasets = allDatasets.slice(offset, offset + limit);

      return {
        datasets: paginatedDatasets,
        total,
        hasMore: offset + limit < total,
      };
    } catch (error) {
      this.logger.error("Failed to list datasets", error as Error);
      throw error;
    }
  }

  /**
   * Delete a dataset
   */
  async deleteDataset(datasetId: string, deleteFiles?: boolean): Promise<void> {
    try {
      this.logger.info("Deleting dataset", { datasetId, deleteFiles });

      const dataset = this.datasetStore.get(datasetId);
      if (!dataset) {
        throw new Error(`Dataset not found: ${datasetId}`);
      }

      // Optionally delete associated files
      if (deleteFiles) {
        for (const file of dataset.files) {
          this.fileStore.delete(file.cid);
          this.currentStorageSize -= file.size;
        }
      }

      this.datasetStore.delete(datasetId);

      this.logger.info("Dataset deleted successfully", { datasetId });
    } catch (error) {
      this.logger.error("Dataset deletion failed", error as Error, { datasetId });
      throw error;
    }
  }

  /**
   * Simulate network delay for realistic behavior
   */
  private async simulateDelay(minMs: number, maxMs: number): Promise<void> {
    const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}
