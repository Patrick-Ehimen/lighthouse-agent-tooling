/**
 * @lighthouse-tooling/sdk-wrapper
 *
 * Unified SDK wrapper that abstracts Lighthouse and Kavach SDK complexity for AI agents.
 * This is a foundational component used by MCP servers and IDE extensions to interact
 * with Lighthouse storage services.
 */

// Main SDK class
export { LighthouseAISDK } from "./LighthouseAISDK";

// Core managers
export { AuthenticationManager } from "./auth/AuthenticationManager";
export { ProgressTracker } from "./progress/ProgressTracker";
export { EncryptionManager } from "./encryption/EncryptionManager";

// Error handling system
export {
  ErrorHandler,
  CircuitBreaker,
  CircuitState,
  LighthouseError,
  NetworkError,
  AuthenticationError,
  RateLimitError,
  TimeoutError,
  ValidationError,
  FileNotFoundError,
  InsufficientStorageError,
} from "./errors";

// Types and interfaces
export type {
  LighthouseConfig,
  AuthState,
  UploadOptions,
  DownloadOptions,
  ProgressInfo,
  FileInfo,
  ListFilesResponse,
  DatasetOptions,
  DatasetInfo,
  ListDatasetsResponse,
  SDKEventType,
  SDKEvent,
  GeneratedKey,
  KeyShard,
  EncryptionOptions,
  AccessControlConfig,
  EncryptionResponse,
  AuthToken,
  EnhancedAccessCondition,
  EVMAccessCondition,
  SolanaAccessCondition,
  ReturnValueTest,
  ChainType,
  DecryptionType,
} from "./types";

// Error handling types
export type { RetryPolicy, ErrorMetrics, CircuitBreakerConfig } from "./errors/types";

// Performance and caching modules
export { LRUCache, CacheManager } from "./cache";
export type { CacheManagerConfig, CacheOptions } from "./cache";
export { ConnectionPool } from "./pool";
export type { ConnectionPoolConfig } from "./pool";
export { BatchProcessor } from "./batch";
export type { BatchOptions, BatchOperation, BatchResult, BatchStats } from "./batch";
export { MemoryManager } from "./memory";
export type { MemoryManagerConfig, MemoryStats } from "./memory";

// Utility functions
export {
  generateOperationId,
  validateFile,
  createFileInfo,
  getMimeType,
  formatBytes,
  formatDuration,
  retryWithBackoff,
  isRetryableError,
} from "./utils/helpers";

// Default export
import { LighthouseAISDK } from "./LighthouseAISDK";
export default LighthouseAISDK;
