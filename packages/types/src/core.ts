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
  TOKEN_BALANCE = 'token_balance',
  /** Time-based access (before/after specific date) */
  TIME_BASED = 'time_based',
  /** Account-based access (specific wallet addresses) */
  ACCOUNT_BASED = 'account_based',
  /** Smart contract condition */
  SMART_CONTRACT = 'smart_contract',
  /** Custom condition */
  CUSTOM = 'custom'
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
  UPLOAD = 'upload',
  /** File download operation */
  DOWNLOAD = 'download',
  /** Dataset creation operation */
  DATASET_CREATION = 'dataset_creation',
  /** Encryption operation */
  ENCRYPTION = 'encryption',
  /** Decryption operation */
  DECRYPTION = 'decryption',
  /** Batch operation */
  BATCH = 'batch',
  /** Custom operation */
  CUSTOM = 'custom'
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
