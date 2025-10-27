/**
 * Common interface for Lighthouse services
 */

import { UploadResult, DownloadResult, AccessCondition, Dataset } from "@lighthouse-tooling/types";
import { EnhancedAccessCondition } from "@lighthouse-tooling/sdk-wrapper";

export interface StoredFile {
  cid: string;
  filePath: string;
  size: number;
  encrypted: boolean;
  accessConditions?: AccessCondition[];
  tags?: string[];
  uploadedAt: Date;
  pinned: boolean;
  hash?: string;
}

export interface ILighthouseService {
  /**
   * Initialize the service
   */
  initialize?(): Promise<void>;

  /**
   * Upload file
   */
  uploadFile(params: {
    filePath: string;
    encrypt?: boolean;
    accessConditions?: AccessCondition[];
    tags?: string[];
  }): Promise<UploadResult>;

  /**
   * Fetch/download file
   */
  fetchFile(params: {
    cid: string;
    outputPath?: string;
    decrypt?: boolean;
  }): Promise<DownloadResult>;

  /**
   * Pin file
   */
  pinFile(cid: string): Promise<{ success: boolean; cid: string; pinned: boolean }>;

  /**
   * Unpin file
   */
  unpinFile(cid: string): Promise<{ success: boolean; cid: string; pinned: boolean }>;

  /**
   * Get file info by CID
   */
  getFileInfo(cid: string): StoredFile | undefined | Promise<StoredFile | undefined>;

  /**
   * List all uploaded files
   */
  listFiles(): StoredFile[] | Promise<StoredFile[]>;

  /**
   * Get storage stats
   */
  getStorageStats(): {
    fileCount: number;
    totalSize: number;
    maxSize: number;
    utilization: number;
  };

  /**
   * Clear cache (for testing)
   */
  clear(): void;

  /**
   * Create a new dataset
   */
  createDataset(params: {
    name: string;
    description?: string;
    filePaths: string[];
    encrypt?: boolean;
    accessConditions?: AccessCondition[];
    tags?: string[];
    metadata?: Record<string, unknown>;
  }): Promise<Dataset>;

  /**
   * Update an existing dataset
   */
  updateDataset(params: {
    datasetId: string;
    addFiles?: string[];
    removeFiles?: string[];
    description?: string;
    metadata?: Record<string, unknown>;
    tags?: string[];
  }): Promise<Dataset>;

  /**
   * Get dataset by ID
   */
  getDataset(datasetId: string): Promise<Dataset | undefined>;

  /**
   * List all datasets
   */
  listDatasets(params?: { limit?: number; offset?: number }): Promise<{
    datasets: Dataset[];
    total: number;
    hasMore: boolean;
  }>;

  /**
   * Delete a dataset
   */
  deleteDataset(datasetId: string, deleteFiles?: boolean): Promise<void>;

  /**
   * Generate encryption key with threshold cryptography
   */
  generateEncryptionKey?(
    threshold?: number,
    keyCount?: number,
  ): Promise<{
    success: boolean;
    data?: { masterKey: string; keyShards: Array<{ key: string; index: string }> };
    error?: string;
  }>;

  /**
   * Setup access control for encrypted files
   */
  setupAccessControl?(
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
  }>;
}
