/**
 * Mock Lighthouse Service - Simulates Lighthouse file operations
 */

import { UploadResult, DownloadResult, AccessCondition } from "@lighthouse-tooling/types";
import { EnhancedAccessCondition } from "@lighthouse-tooling/sdk-wrapper";
import { Logger, FileUtils } from "@lighthouse-tooling/shared";
import { CIDGenerator } from "../utils/cid-generator.js";
import { ILighthouseService, StoredFile } from "./ILighthouseService.js";

export class MockLighthouseService implements ILighthouseService {
  private fileStore: Map<string, StoredFile> = new Map();
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
    this.currentStorageSize = 0;
    this.logger.info("Mock storage cleared");
  }

  /**
   * Simulate network delay for realistic behavior
   */
  private async simulateDelay(minMs: number, maxMs: number): Promise<void> {
    const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}
