/**
 * Tool Registry specific types
 */

import { MCPToolDefinition } from '@lighthouse-tooling/types';

/**
 * Registered tool with executor function
 */
export interface RegisteredTool {
  definition: MCPToolDefinition;
  executor: ToolExecutor;
  registeredAt: Date;
  callCount: number;
  lastCalled?: Date;
  averageExecutionTime: number;
}

/**
 * Tool executor function type
 */
export type ToolExecutor = (args: Record<string, unknown>) => Promise<ToolExecutionResult>;

/**
 * Result of tool execution
 */
export interface ToolExecutionResult {
  success: boolean;
  data?: unknown;
  error?: string;
  executionTime: number;
}

/**
 * Tool filter criteria
 */
export interface ToolFilter {
  requiresAuth?: boolean;
  supportsBatch?: boolean;
  executionTime?: string;
  namePattern?: string;
}

/**
 * Registry metrics
 */
export interface RegistryMetrics {
  totalTools: number;
  totalCalls: number;
  averageRegistrationTime: number;
  toolsRegistered: string[];
  registrationTimestamp: Date;
}

/**
 * Tool registration options
 */
export interface ToolRegistrationOptions {
  override?: boolean;
  validateSchema?: boolean;
}

