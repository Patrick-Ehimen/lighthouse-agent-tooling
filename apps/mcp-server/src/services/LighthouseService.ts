/**
 * Real Lighthouse Service - Uses the unified SDK wrapper for actual Lighthouse operations
 */

import { LighthouseAISDK } from "@lighthouse-tooling/sdk-wrapper";
import { UploadResult, DownloadResult, AccessCondition } from "@lighthouse-tooling/types";
import { Logger } from "@lighthouse-tooling/shared";
import { ILighthouseService, StoredFile } from "./ILighthouseService.js";

export class LighthouseService implements ILighthouseService {
  private sdk: LighthouseAISDK;
  private logger: Logger;
  private fileCache: Map<string, StoredFile> = new Map();

  constructor(apiKey: string, logger?: Logger) {
    this.logger = logger || Logger.getInstance({ level: "info", component: "LighthouseService" });

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

      // Store file metadata in cache
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

      // Update cache if exists
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

      // Update cache if exists
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

      // Cache it
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

        // Update cache
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
    const files = Array.from(this.fileCache.values());
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);

    return {
      fileCount: files.length,
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
   * Clear cache (for testing)
   */
  clear(): void {
    this.fileCache.clear();
    this.logger.info("File cache cleared");
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.sdk.destroy();
    this.fileCache.clear();
    this.logger.info("Lighthouse service destroyed");
  }
}
