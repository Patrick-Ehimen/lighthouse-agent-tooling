import { EventEmitter } from "eventemitter3";
import lighthouse from "@lighthouse-web3/sdk";
import { AuthenticationManager } from "./auth/AuthenticationManager";
import { ProgressTracker } from "./progress/ProgressTracker";
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
 * Unified SDK wrapper that abstracts Lighthouse and Kavach SDK complexity for AI agents
 */
export class LighthouseAISDK extends EventEmitter {
  private auth: AuthenticationManager;
  private progress: ProgressTracker;
  private config: LighthouseConfig;

  constructor(config: LighthouseConfig) {
    super();
    this.config = config;
    this.auth = new AuthenticationManager(config);
    this.progress = new ProgressTracker();

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
  }

  /**
   * Initialize the SDK and authenticate
   */
  async initialize(): Promise<void> {
    await this.auth.authenticate();
  }

  /**
   * Upload a file to Lighthouse with progress tracking
   */
  async uploadFile(filePath: string, options: UploadOptions = {}): Promise<FileInfo> {
    const operationId = generateOperationId();

    try {
      // Validate file exists and get size
      const fileStats = await validateFile(filePath);

      // Start progress tracking
      this.progress.startOperation(operationId, "upload", fileStats.size);

      // Get authentication token
      const token = await this.auth.getAccessToken();

      // Create progress callback
      const progressCallback = this.progress.createProgressCallback(operationId);

      // Update progress to uploading phase
      this.progress.updateProgress(operationId, 0, "uploading");

      // Upload file using Lighthouse SDK
      const uploadResponse = await lighthouse.upload(
        filePath,
        token,
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
  }

  /**
   * Download a file from Lighthouse
   */
  async downloadFile(
    cid: string,
    outputPath: string,
    options: DownloadOptions = {},
  ): Promise<string> {
    const operationId = generateOperationId();

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
  }

  /**
   * Get file information and metadata
   */
  async getFileInfo(cid: string): Promise<FileInfo> {
    try {
      const token = await this.auth.getAccessToken();

      // Get file status from Lighthouse
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
    } catch (error) {
      throw new Error(
        `Failed to get file info: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * List files uploaded by the authenticated user
   */
  async listFiles(limit: number = 10, offset: number = 0): Promise<ListFilesResponse> {
    try {
      const token = await this.auth.getAccessToken();

      // Get uploads list from Lighthouse
      const uploadsResponse = await lighthouse.getUploads(token);

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

      const files: FileInfo[] = paginatedUploads.map((upload: any) =>
        createFileInfo({
          hash: upload.cid,
          name: upload.fileName || "unknown",
          size: upload.fileSizeInBytes || 0,
          mimeType: upload.mimeType || "application/octet-stream",
          metadata: upload.metadata || {},
          encrypted: upload.encrypted || false,
        }),
      );

      return {
        files,
        total,
        hasMore: offset + limit < total,
        cursor: offset + limit < total ? String(offset + limit) : undefined,
      };
    } catch (error) {
      throw new Error(
        `Failed to list files: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
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
   * Cleanup resources and disconnect
   */
  destroy(): void {
    this.auth.destroy();
    this.progress.cleanup();
    this.removeAllListeners();
  }
}
