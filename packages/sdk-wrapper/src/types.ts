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
