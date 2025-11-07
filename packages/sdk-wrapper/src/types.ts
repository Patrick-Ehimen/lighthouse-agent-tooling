import { AccessCondition } from "@lighthouse-tooling/types";

/**
 * Configuration options for the Lighthouse AI SDK
 */
export interface LighthouseConfig {
  /** API key for authentication */
  apiKey: string;
  /** Base URL for Lighthouse API (optional) */
  baseUrl?: string;
  /** Timeout for requests in milliseconds */
  timeout?: number;
  /** Maximum number of retry attempts */
  maxRetries?: number;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Authentication state and token information
 */
export interface AuthState {
  /** JWT access token */
  accessToken: string | null;
  /** Token expiration timestamp */
  expiresAt: number | null;
  /** Whether currently authenticated */
  isAuthenticated: boolean;
  /** Last authentication error */
  lastError: string | null;
}

/**
 * File upload options
 */
export interface UploadOptions {
  /** File name override */
  fileName?: string;
  /** MIME type override */
  mimeType?: string;
  /** Progress callback function */
  onProgress?: (progress: ProgressInfo) => void;
  /** Enable encryption */
  encrypt?: boolean;
  /** Encryption options */
  encryptionOptions?: EncryptionOptions;
  /** Access control conditions */
  accessConditions?: AccessCondition[];
  /** Custom metadata */
  metadata?: Record<string, any>;
}

/**
 * File download options
 */
export interface DownloadOptions {
  /** Progress callback function */
  onProgress?: (progress: ProgressInfo) => void;
  /** Expected file size for progress calculation */
  expectedSize?: number;
}

/**
 * Progress information for file operations
 */
export interface ProgressInfo {
  /** Bytes transferred */
  loaded: number;
  /** Total bytes (if known) */
  total?: number;
  /** Progress percentage (0-100) */
  percentage: number;
  /** Transfer rate in bytes per second */
  rate: number;
  /** Estimated time remaining in seconds */
  eta?: number;
  /** Operation phase */
  phase: "preparing" | "uploading" | "downloading" | "processing" | "complete";
}

/**
 * File information from Lighthouse
 */
export interface FileInfo {
  /** File hash/CID */
  hash: string;
  /** File name */
  name: string;
  /** File size in bytes */
  size: number;
  /** MIME type */
  mimeType: string;
  /** Upload timestamp */
  uploadedAt: Date;
  /** File metadata */
  metadata?: Record<string, any>;
  /** Whether file is encrypted */
  encrypted: boolean;
}

/**
 * List files response
 */
export interface ListFilesResponse {
  /** Array of file information */
  files: FileInfo[];
  /** Total number of files */
  total: number;
  /** Whether there are more files */
  hasMore: boolean;
  /** Cursor for pagination */
  cursor?: string;
}

/**
 * Event types emitted by the SDK
 */
export type SDKEventType =
  | "upload:start"
  | "upload:progress"
  | "upload:complete"
  | "upload:error"
  | "download:start"
  | "download:progress"
  | "download:complete"
  | "download:error"
  | "auth:refresh"
  | "auth:error";

/**
 * SDK event data
 */
export interface SDKEvent {
  type: SDKEventType;
  operationId: string;
  data?: any;
  error?: Error;
  timestamp: Date;
}

// Dataset Management Types

/**
 * Dataset creation options
 */
export interface DatasetOptions {
  /** Dataset name */
  name: string;
  /** Dataset description */
  description?: string;
  /** Enable encryption for the dataset */
  encrypt?: boolean;
  /** Custom metadata */
  metadata?: Record<string, any>;
  /** Tags for organization */
  tags?: string[];
  /** Progress callback function */
  onProgress?: (progress: ProgressInfo) => void;
}

/**
 * Dataset information
 */
export interface DatasetInfo {
  /** Dataset ID */
  id: string;
  /** Dataset name */
  name: string;
  /** Dataset description */
  description?: string;
  /** Array of file hashes in the dataset */
  files: string[];
  /** Dataset version */
  version: string;
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
  /** Whether dataset is encrypted */
  encrypted: boolean;
  /** Dataset metadata */
  metadata?: Record<string, any>;
  /** Tags */
  tags?: string[];
  /** Total size in bytes */
  totalSize: number;
  /** Number of files */
  fileCount: number;
}

/**
 * List datasets response
 */
export interface ListDatasetsResponse {
  /** Array of dataset information */
  datasets: DatasetInfo[];
  /** Total number of datasets */
  total: number;
  /** Whether there are more datasets */
  hasMore: boolean;
  /** Cursor for pagination */
  cursor?: string;
}

// Encryption and Access Control Types

/**
 * Key shard for threshold cryptography
 */
export interface KeyShard {
  key: string;
  index: string;
}

/**
 * Generated encryption key with shards
 */
export interface GeneratedKey {
  masterKey: string | null;
  keyShards: KeyShard[];
}

/**
 * Encryption configuration options
 */
export interface EncryptionOptions {
  /** Threshold for key recovery (default: 3) */
  threshold?: number;
  /** Total number of key shards (default: 5) */
  keyCount?: number;
  /** Use existing key shards instead of generating new ones */
  keyShards?: KeyShard[];
  /** Chain type for access conditions */
  chainType?: ChainType;
  /** Decryption type */
  decryptionType?: DecryptionType;
}

/**
 * Chain type for blockchain networks
 */
export type ChainType = "evm" | "solana";

/**
 * Decryption type for access control
 */
export type DecryptionType = "ADDRESS" | "ACCESS_CONDITIONS";

/**
 * Return value test for access conditions
 */
export interface ReturnValueTest {
  comparator: "==" | ">=" | "<=" | "!=" | ">" | "<";
  value: number | string | any[];
}

/**
 * EVM-based access condition
 */
export interface EVMAccessCondition {
  id: number;
  standardContractType: "ERC20" | "ERC721" | "ERC1155" | "Custom" | "";
  contractAddress?: string;
  chain: string;
  method: string;
  parameters?: any[];
  returnValueTest: ReturnValueTest;
  inputArrayType?: string[];
  outputType?: string;
}

/**
 * Solana-based access condition
 */
export interface SolanaAccessCondition {
  id: number;
  contractAddress?: string;
  chain: string;
  method: string;
  standardContractType: "spl-token" | "";
  parameters?: any[];
  pdaInterface: {
    offset?: number;
    selector?: string;
  };
  returnValueTest: ReturnValueTest;
}

/**
 * Enhanced access condition (EVM or Solana)
 */
export type EnhancedAccessCondition = EVMAccessCondition | SolanaAccessCondition;

/**
 * Access control configuration
 */
export interface AccessControlConfig {
  /** Wallet address of the file owner */
  address: string;
  /** File CID/hash */
  cid: string;
  /** Access conditions */
  conditions: EnhancedAccessCondition[];
  /** Condition aggregator (AND/OR logic) */
  aggregator?: string;
  /** Chain type */
  chainType?: ChainType;
  /** Key shards for encryption */
  keyShards?: KeyShard[];
  /** Decryption type */
  decryptionType?: DecryptionType;
}

/**
 * Response from encryption operations
 */
export interface EncryptionResponse {
  isSuccess: boolean;
  error: string | null;
  keyShards?: KeyShard[];
  masterKey?: string;
}

/**
 * Authentication token types
 */
export type AuthToken = string;
