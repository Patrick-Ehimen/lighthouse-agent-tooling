/**
 * Core interfaces and data models for Lighthouse AI integration system
 * @fileoverview Defines the fundamental types used across all components
 */

/**
 * Result of a file upload operation to Lighthouse/IPFS
 */
export interface UploadResult {
  /** IPFS Content Identifier (CID) of the uploaded file */
  cid: string;
  /** Size of the uploaded file in bytes */
  size: number;
  /** Whether the file was encrypted before upload */
  encrypted: boolean;
  /** Access control conditions applied to the file */
  accessConditions?: AccessCondition[];
  /** Tags associated with the file for organization */
  tags?: string[];
  /** Timestamp when the upload was completed */
  uploadedAt: Date;
  /** Original file path or name */
  originalPath?: string;
  /** Hash of the file content for integrity verification */
  hash?: string;
}

/**
 * Represents a managed dataset collection with metadata
 */
export interface Dataset {
  /** Unique identifier for the dataset */
  id: string;
  /** Human-readable name of the dataset */
  name: string;
  /** Description of the dataset contents and purpose */
  description: string;
  /** Array of file upload results included in the dataset */
  files: UploadResult[];
  /** Additional metadata about the dataset */
  metadata: DatasetMetadata;
  /** Version of the dataset */
  version: string;
  /** Timestamp when the dataset was created */
  createdAt: Date;
  /** Timestamp when the dataset was last updated */
  updatedAt: Date;
  /** Whether the entire dataset is encrypted */
  encrypted: boolean;
  /** Access control conditions for the dataset */
  accessConditions?: AccessCondition[];
}

/**
 * Metadata associated with a dataset
 */
export interface DatasetMetadata {
  /** Author or creator of the dataset */
  author?: string;
  /** License information for the dataset */
  license?: string;
  /** Category or domain of the dataset */
  category?: string;
  /** Keywords for search and discovery */
  keywords?: string[];
  /** Custom properties specific to the dataset */
  custom?: Record<string, unknown>;
}

/**
 * Access control condition for files and datasets
 */
export interface AccessCondition {
  /** Type of access condition */
  type: AccessConditionType;
  /** Specific condition to be met */
  condition: string;
  /** Value or threshold for the condition */
  value: string;
  /** Additional parameters for the condition */
  parameters?: Record<string, unknown>;
}

/**
 * Types of access conditions supported
 */
export enum AccessConditionType {
  /** Token balance requirement */
  TOKEN_BALANCE = "token_balance",
  /** Time-based access (before/after specific date) */
  TIME_BASED = "time_based",
  /** Account-based access (specific wallet addresses) */
  ACCOUNT_BASED = "account_based",
  /** Smart contract condition */
  SMART_CONTRACT = "smart_contract",
  /** Custom condition */
  CUSTOM = "custom",
}

/**
 * Progress update for long-running operations
 */
export interface ProgressUpdate {
  /** Type of operation being performed */
  operation: OperationType;
  /** Current progress as a percentage (0-100) */
  progress: number;
  /** Current status message */
  status: string;
  /** File or item being processed */
  item?: string;
  /** Total number of items to process */
  total?: number;
  /** Number of items completed */
  completed?: number;
  /** Estimated time remaining in milliseconds */
  estimatedTimeRemaining?: number;
  /** Timestamp of the progress update */
  timestamp: Date;
}

/**
 * Types of operations that can generate progress updates
 */
export enum OperationType {
  /** File upload operation */
  UPLOAD = "upload",
  /** File download operation */
  DOWNLOAD = "download",
  /** Dataset creation operation */
  DATASET_CREATION = "dataset_creation",
  /** Encryption operation */
  ENCRYPTION = "encryption",
  /** Decryption operation */
  DECRYPTION = "decryption",
  /** Batch operation */
  BATCH = "batch",
  /** Custom operation */
  CUSTOM = "custom",
}

/**
 * Configuration for file upload operations
 */
export interface UploadConfig {
  /** Whether to encrypt the file before upload */
  encrypt?: boolean;
  /** Access conditions to apply to the file */
  accessConditions?: AccessCondition[];
  /** Tags to associate with the file */
  tags?: string[];
  /** Whether to pin the file to IPFS */
  pin?: boolean;
  /** Custom metadata for the file */
  metadata?: Record<string, unknown>;
}

/**
 * Configuration for dataset creation
 */
export interface DatasetConfig {
  /** Name of the dataset */
  name: string;
  /** Description of the dataset */
  description?: string;
  /** Whether to encrypt the dataset */
  encrypt?: boolean;
  /** Access conditions for the dataset */
  accessConditions?: AccessCondition[];
  /** Tags for the dataset */
  tags?: string[];
  /** Custom metadata for the dataset */
  metadata?: DatasetMetadata;
}

/**
 * Result of a file download operation
 */
export interface DownloadResult {
  /** Local path where the file was saved */
  filePath: string;
  /** Original CID of the downloaded file */
  cid: string;
  /** Size of the downloaded file in bytes */
  size: number;
  /** Whether the file was decrypted during download */
  decrypted: boolean;
  /** Timestamp when the download was completed */
  downloadedAt: Date;
  /** Hash of the downloaded file for integrity verification */
  hash?: string;
}

/**
 * Result of a batch upload operation
 */
export interface BatchUploadResult {
  /** Total number of files attempted */
  total: number;
  /** Number of successful uploads */
  successful: number;
  /** Number of failed uploads */
  failed: number;
  /** Array of successful upload results */
  successfulUploads: UploadResult[];
  /** Array of failed upload attempts */
  failedUploads: FailedUpload[];
  /** Total time taken for the batch operation */
  duration: number;
  /** Average upload speed in bytes per second */
  averageSpeed?: number;
}

/**
 * Information about a failed upload
 */
export interface FailedUpload {
  /** File path that failed to upload */
  filePath: string;
  /** Error message describing the failure */
  error: string;
  /** Number of retry attempts made */
  retryAttempts: number;
  /** Timestamp when the failure occurred */
  failedAt: Date;
}

/**
 * Dataset version information
 */
export interface DatasetVersion {
  /** Unique version identifier */
  id: string;
  /** Parent dataset ID */
  datasetId: string;
  /** Semantic version string (e.g., "1.0.0", "2.1.3") */
  version: string;
  /** Changes made in this version */
  changes: VersionChanges;
  /** Full snapshot of dataset state at this version */
  snapshot: DatasetSnapshot;
  /** Timestamp when version was created */
  createdAt: Date;
  /** User or system that created this version */
  createdBy?: string;
  /** Optional description of changes */
  changeDescription?: string;
  /** Tags associated with this version */
  tags?: string[];
}

/**
 * Changes made in a dataset version
 */
export interface VersionChanges {
  /** CIDs of files added in this version */
  filesAdded: string[];
  /** CIDs of files removed in this version */
  filesRemoved: string[];
  /** CIDs of files modified in this version */
  filesModified: string[];
  /** Whether metadata was changed */
  metadataChanged: boolean;
  /** Whether configuration was changed */
  configChanged: boolean;
  /** Summary of changes */
  summary: string;
}

/**
 * Snapshot of dataset state at a specific version
 */
export interface DatasetSnapshot {
  /** All files in the dataset at this version */
  files: UploadResult[];
  /** Metadata at this version */
  metadata: DatasetMetadata;
  /** Configuration at this version */
  config: Partial<DatasetConfig>;
  /** Size of dataset in bytes */
  totalSize: number;
  /** Number of files */
  fileCount: number;
}

/**
 * Update parameters for modifying an existing dataset
 */
export interface DatasetUpdate {
  /** New description for the dataset */
  description?: string;
  /** Updated metadata */
  metadata?: Partial<DatasetMetadata>;
  /** New version string (if manually specified) */
  version?: string;
  /** Files to add to the dataset */
  addFiles?: string[];
  /** CIDs of files to remove from the dataset */
  removeFiles?: string[];
  /** Tags to add */
  addTags?: string[];
  /** Tags to remove */
  removeTags?: string[];
}

/**
 * Filter criteria for listing datasets
 */
export interface DatasetFilter {
  /** Filter by encryption status */
  encrypted?: boolean;
  /** Filter by name pattern (regex) */
  namePattern?: string;
  /** Filter by tags (datasets must have at least one) */
  tags?: string[];
  /** Filter by author */
  author?: string;
  /** Filter by category */
  category?: string;
  /** Filter by creation date (after) */
  createdAfter?: Date;
  /** Filter by creation date (before) */
  createdBefore?: Date;
  /** Filter by minimum number of files */
  minFiles?: number;
  /** Filter by maximum number of files */
  maxFiles?: number;
  /** Pagination limit */
  limit?: number;
  /** Pagination offset */
  offset?: number;
}

/**
 * Statistics for a dataset
 */
export interface DatasetStats {
  /** Dataset ID */
  id: string;
  /** Dataset name */
  name: string;
  /** Total number of files */
  fileCount: number;
  /** Total size in bytes */
  totalSize: number;
  /** Whether dataset is encrypted */
  encrypted: boolean;
  /** Current version */
  version: string;
  /** Number of versions */
  versionCount: number;
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
  /** Last accessed timestamp */
  lastAccessedAt?: Date;
  /** Average file size */
  averageFileSize: number;
  /** Largest file size */
  largestFileSize: number;
  /** Smallest file size */
  smallestFileSize: number;
}

/**
 * Comparison result between two dataset versions
 */
export interface VersionDiff {
  /** Source version */
  fromVersion: string;
  /** Target version */
  toVersion: string;
  /** Files added between versions */
  filesAdded: UploadResult[];
  /** Files removed between versions */
  filesRemoved: UploadResult[];
  /** Files that exist in both but were modified */
  filesModified: UploadResult[];
  /** Metadata differences */
  metadataChanges: Record<string, { from: unknown; to: unknown }>;
  /** Summary of differences */
  summary: string;
}

/**
 * Progress information for batch operations
 */
export interface BatchProgress {
  /** Operation ID for tracking */
  operationId: string;
  /** Type of batch operation */
  operation: "upload" | "download" | "delete";
  /** Total items to process */
  total: number;
  /** Items completed successfully */
  completed: number;
  /** Items that failed */
  failed: number;
  /** Current item being processed */
  currentItem?: string;
  /** Progress percentage (0-100) */
  percentage: number;
  /** Estimated time remaining in milliseconds */
  estimatedTimeRemaining?: number;
  /** Current processing rate (items per second) */
  rate?: number;
  /** Start time */
  startedAt: Date;
  /** List of failed items */
  failures: FailedUpload[];
}
