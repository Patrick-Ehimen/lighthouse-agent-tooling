/**
 * Types and interfaces for MCP tools
 */

import { MCPContent } from "@lighthouse-tooling/types";

/**
 * Base interface for MCP tool executors
 */
export interface ToolExecutionContext {
  /** Request ID for tracking */
  requestId?: string | number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Result of tool execution
 */
export interface ToolResult {
  /** Whether the execution was successful */
  success: boolean;
  /** Result data */
  data?: unknown;
  /** Error message if execution failed */
  error?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Progress event for long-running operations
 */
export interface ToolProgressEvent {
  /** Operation ID */
  operationId: string;
  /** Progress percentage (0-100) */
  progress: number;
  /** Current status message */
  status: string;
  /** Additional data */
  data?: Record<string, unknown>;
}

/**
 * Interface for tools that support progress tracking
 */
export interface ProgressAwareToolResult extends ToolResult {
  /** Operation ID for tracking progress */
  operationId?: string;
  /** Whether the operation is still running */
  isRunning?: boolean;
  /** Execution time in milliseconds */
  executionTime: number;
}
