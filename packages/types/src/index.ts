/**
 * Lighthouse AI Integration Types
 * @fileoverview Main export file for all Lighthouse AI integration types
 *
 * This package provides comprehensive TypeScript interfaces and data models
 * that are shared across all components of the Lighthouse AI integration system.
 *
 * @packageDocumentation
 */

// Core interfaces and data models
export * from "./core.js";

// MCP (Model Context Protocol) types
export * from "./mcp.js";

// Authentication and authorization types
export * from "./auth.js";

// Error handling and retry configuration types
export * from "./errors.js";

// Workspace context and project file types
export * from "./workspace.js";

// Re-export commonly used types for convenience
export type {
  // Core types
  UploadResult,
  Dataset,
  AccessCondition,
  ProgressUpdate,
  UploadConfig,
  DatasetConfig,
  DownloadResult,
  BatchUploadResult,
  FailedUpload,
  DatasetVersion,
  VersionChanges,
  DatasetSnapshot,
  DatasetUpdate,
  DatasetFilter,
  DatasetStats,
  VersionDiff,
  BatchProgress,
} from "./core.js";

export type {
  // MCP types
  MCPToolDefinition,
  MCPRequest,
  MCPResponse,
  MCPResult,
  MCPError,
} from "./mcp.js";

export type {
  // Auth types
  AuthConfig,
  TokenInfo,
  APICredentials,
  AuthContext,
} from "./auth.js";

export type {
  // Error types
  LighthouseError,
  RetryConfig,
  ErrorHandlerConfig,
} from "./errors.js";

export type {
  // Workspace types
  WorkspaceContext,
  ProjectFile,
  GitInfo,
  DatasetReference,
  AIContext,
} from "./workspace.js";

// Re-export enums for convenience
export {
  // Core enums
  AccessConditionType,
  OperationType,
} from "./core.js";

export {
  // MCP enums
  ExecutionTimeCategory,
  MCPMethod,
  MCPErrorCode,
  SamplingStrategy,
} from "./mcp.js";

export {
  // Auth enums
  AuthMethod,
  TokenType,
  APIAuthMethod,
  ConditionType,
  ConditionOperator,
  NotificationType,
  AuthErrorCode,
} from "./auth.js";

export {
  // Error enums
  ErrorType,
  ErrorSeverity,
} from "./errors.js";

export {
  // Workspace enums
  DatasetStatus,
  WorkspaceType,
  FrameworkType,
  DependencyType,
  AgentType,
  EncryptionStrength,
  KeyStorageMethod,
  HistoryEntryType,
  CacheStorageType,
} from "./workspace.js";

// Export default retry configurations
export { DEFAULT_RETRY_CONFIGS } from "./errors.js";

// Export Lighthouse MCP tools
export { LIGHTHOUSE_MCP_TOOLS } from "./mcp.js";
