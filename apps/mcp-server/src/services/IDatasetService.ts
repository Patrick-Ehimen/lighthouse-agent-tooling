/**
 * Interface for Dataset Service
 * Defines the contract for dataset management operations including versioning,
 * batch uploads, and retrieval functionality
 */

import {
  Dataset,
  DatasetConfig,
  DatasetUpdate,
  DatasetFilter,
  DatasetStats,
  DatasetVersion,
  VersionChanges,
  VersionDiff,
  BatchUploadResult,
} from "@lighthouse-tooling/types";

/**
 * Core interface for dataset management operations
 */
export interface IDatasetService {
  /**
   * Create a new dataset with multiple files uploaded in parallel
   * @param config - Dataset configuration including name, description, and metadata
   * @param files - Array of file paths to upload
   * @param options - Upload options (concurrency, encryption, etc.)
   * @returns Promise resolving to the created dataset
   */
  createDataset(
    config: DatasetConfig,
    files: string[],
    options?: DatasetCreateOptions,
  ): Promise<Dataset>;

  /**
   * Get a dataset by ID, optionally at a specific version
   * @param datasetId - Unique identifier of the dataset
   * @param version - Optional version string (e.g., "1.0.0")
   * @returns Promise resolving to the dataset
   */
  getDataset(datasetId: string, version?: string): Promise<Dataset>;

  /**
   * Update an existing dataset
   * @param datasetId - Unique identifier of the dataset
   * @param updates - Update parameters (description, metadata, files to add/remove)
   * @returns Promise resolving to the updated dataset
   */
  updateDataset(datasetId: string, updates: DatasetUpdate): Promise<Dataset>;

  /**
   * List datasets with optional filtering and pagination
   * @param filter - Optional filter criteria
   * @returns Promise resolving to array of matching datasets
   */
  listDatasets(filter?: DatasetFilter): Promise<Dataset[]>;

  /**
   * Delete a dataset and all its versions
   * @param datasetId - Unique identifier of the dataset
   * @returns Promise resolving to true if deleted successfully
   */
  deleteDataset(datasetId: string): Promise<boolean>;

  /**
   * Create a new version of a dataset with tracked changes
   * @param datasetId - Unique identifier of the dataset
   * @param changes - Changes being made in this version
   * @returns Promise resolving to the new version
   */
  createVersion(datasetId: string, changes: VersionChanges): Promise<DatasetVersion>;

  /**
   * List all versions of a dataset
   * @param datasetId - Unique identifier of the dataset
   * @returns Promise resolving to array of versions, newest first
   */
  listVersions(datasetId: string): Promise<DatasetVersion[]>;

  /**
   * Rollback a dataset to a previous version
   * @param datasetId - Unique identifier of the dataset
   * @param version - Version string to rollback to (e.g., "1.0.0")
   * @returns Promise resolving to the dataset at the specified version
   */
  rollbackToVersion(datasetId: string, version: string): Promise<Dataset>;

  /**
   * Compare two versions of a dataset
   * @param datasetId - Unique identifier of the dataset
   * @param fromVersion - Starting version for comparison
   * @param toVersion - Ending version for comparison
   * @returns Promise resolving to the differences between versions
   */
  compareVersions(datasetId: string, fromVersion: string, toVersion: string): Promise<VersionDiff>;

  /**
   * Add files to an existing dataset
   * @param datasetId - Unique identifier of the dataset
   * @param files - Array of file paths to add
   * @param options - Upload options
   * @returns Promise resolving to batch upload result
   */
  addFilesToDataset(
    datasetId: string,
    files: string[],
    options?: BatchUploadOptions,
  ): Promise<BatchUploadResult>;

  /**
   * Remove files from a dataset by CID
   * @param datasetId - Unique identifier of the dataset
   * @param cids - Array of CIDs to remove
   * @returns Promise resolving to the updated dataset
   */
  removeFilesFromDataset(datasetId: string, cids: string[]): Promise<Dataset>;

  /**
   * Get statistics for a dataset
   * @param datasetId - Unique identifier of the dataset
   * @returns Promise resolving to dataset statistics
   */
  getDatasetStats(datasetId: string): Promise<DatasetStats>;

  /**
   * Get overall statistics for all datasets
   * @returns Object containing aggregate statistics
   */
  getAllStats(): DatasetServiceStats;

  /**
   * Clear all datasets (primarily for testing)
   */
  clear(): void;
}

/**
 * Options for creating a dataset
 */
export interface DatasetCreateOptions {
  /** Number of parallel uploads (default: 5, max: 20) */
  concurrency?: number;
  /** Timeout per file upload in milliseconds (default: 30000) */
  timeout?: number;
  /** Maximum retry attempts per file (default: 3) */
  maxRetries?: number;
  /** Callback for progress updates */
  onProgress?: (progress: DatasetProgress) => void;
  /** Whether to continue on individual file failures (default: true) */
  continueOnError?: boolean;
}

/**
 * Options for batch upload operations
 */
export interface BatchUploadOptions {
  /** Number of parallel uploads (default: 5, max: 20) */
  concurrency?: number;
  /** Timeout per file upload in milliseconds (default: 30000) */
  timeout?: number;
  /** Maximum retry attempts per file (default: 3) */
  maxRetries?: number;
  /** Callback for progress updates */
  onProgress?: (progress: DatasetProgress) => void;
  /** Whether to create a new version after adding files (default: true) */
  createVersion?: boolean;
  /** Whether to continue on individual file failures (default: true) */
  continueOnError?: boolean;
}

/**
 * Progress information for dataset operations
 */
export interface DatasetProgress {
  /** Type of operation */
  operation: "create" | "update" | "upload" | "delete";
  /** Total files to process */
  total: number;
  /** Files completed */
  completed: number;
  /** Files failed */
  failed: number;
  /** Current file being processed */
  currentFile?: string;
  /** Progress percentage (0-100) */
  percentage: number;
  /** Estimated time remaining in milliseconds */
  estimatedTimeRemaining?: number;
  /** Current processing rate (files per second) */
  rate?: number;
  /** Timestamp of update */
  timestamp: Date;
}

/**
 * Overall statistics for the dataset service
 */
export interface DatasetServiceStats {
  /** Total number of datasets */
  totalDatasets: number;
  /** Total number of files across all datasets */
  totalFiles: number;
  /** Total size of all files in bytes */
  totalSize: number;
  /** Number of encrypted datasets */
  encryptedDatasets: number;
  /** Number of total versions across all datasets */
  totalVersions: number;
  /** Average files per dataset */
  averageFilesPerDataset: number;
  /** Average dataset size in bytes */
  averageDatasetSize: number;
}
