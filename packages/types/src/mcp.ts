/**
 * MCP (Model Context Protocol) specific types and interfaces
 * @fileoverview Defines types for MCP server implementation and tool definitions
 */

import { AccessCondition, UploadConfig, DatasetConfig } from "./core.js";

/**
 * Definition of an MCP tool that can be called by AI agents
 */
export interface MCPToolDefinition {
  /** Unique name of the tool */
  name: string;
  /** Human-readable description of what the tool does */
  description: string;
  /** JSON schema defining the input parameters */
  inputSchema: MCPToolInputSchema;
  /** Whether the tool requires authentication */
  requiresAuth?: boolean;
  /** Whether the tool can be called in batch operations */
  supportsBatch?: boolean;
  /** Estimated execution time category */
  executionTime?: ExecutionTimeCategory;
}

/**
 * JSON schema for MCP tool input parameters
 */
export interface MCPToolInputSchema {
  /** JSON schema type */
  type: "object";
  /** Properties of the input object */
  properties: Record<string, MCPToolProperty>;
  /** Required properties */
  required?: string[];
  /** Additional schema constraints */
  additionalProperties?: boolean;
}

/**
 * Property definition for MCP tool input schema
 */
export interface MCPToolProperty {
  /** Type of the property */
  type: "string" | "number" | "boolean" | "array" | "object";
  /** Description of the property */
  description: string;
  /** Default value for the property */
  default?: unknown;
  /** Items schema for array types */
  items?: MCPToolProperty;
  /** Properties for object types */
  properties?: Record<string, MCPToolProperty>;
  /** Whether the property is required */
  required?: string[];
  /** Minimum value for numeric types */
  minimum?: number;
  /** Maximum value for numeric types */
  maximum?: number;
  /** Minimum length for string types */
  minLength?: number;
  /** Maximum length for string types */
  maxLength?: number;
  /** Allowed values for the property */
  enum?: unknown[];
}

/**
 * Categories for tool execution time estimation
 */
export enum ExecutionTimeCategory {
  /** Fast operations (< 1 second) */
  FAST = "fast",
  /** Medium operations (1-10 seconds) */
  MEDIUM = "medium",
  /** Slow operations (10+ seconds) */
  SLOW = "slow",
  /** Variable execution time */
  VARIABLE = "variable",
}

/**
 * MCP request structure
 */
export interface MCPRequest {
  /** JSON-RPC version */
  jsonrpc: "2.0";
  /** Unique request identifier */
  id: string | number;
  /** Method being called */
  method: MCPMethod;
  /** Parameters for the method */
  params?: MCPRequestParams;
}

/**
 * MCP response structure
 */
export interface MCPResponse {
  /** JSON-RPC version */
  jsonrpc: "2.0";
  /** Request identifier (matches request) */
  id: string | number;
  /** Result data (for successful responses) */
  result?: MCPResult;
  /** Error information (for failed responses) */
  error?: MCPError;
}

/**
 * MCP methods supported by the Lighthouse server
 */
export enum MCPMethod {
  /** List available tools */
  LIST_TOOLS = "tools/list",
  /** Call a specific tool */
  CALL_TOOL = "tools/call",
  /** List available resources */
  LIST_RESOURCES = "resources/list",
  /** Read a specific resource */
  READ_RESOURCE = "resources/read",
  /** Initialize the connection */
  INITIALIZE = "initialize",
  /** Notify of completion */
  NOTIFY = "notify",
}

/**
 * Parameters for MCP requests
 */
export interface MCPRequestParams {
  /** Tool name (for tool calls) */
  name?: string;
  /** Tool arguments (for tool calls) */
  arguments?: Record<string, unknown>;
  /** Resource URI (for resource operations) */
  uri?: string;
  /** Client capabilities */
  capabilities?: ClientCapabilities;
}

/**
 * Result of an MCP operation
 */
export interface MCPResult {
  /** List of available tools */
  tools?: MCPToolDefinition[];
  /** Content of the tool call result */
  content?: MCPContent[];
  /** Text content */
  text?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Content structure for MCP responses
 */
export interface MCPContent {
  /** Type of content */
  type: "text" | "image" | "file" | "data";
  /** Text content */
  text?: string;
  /** Binary data (base64 encoded) */
  data?: string;
  /** MIME type of the content */
  mimeType?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * MCP error structure
 */
export interface MCPError {
  /** Error code */
  code: MCPErrorCode;
  /** Error message */
  message: string;
  /** Additional error data */
  data?: Record<string, unknown>;
}

/**
 * MCP error codes
 */
export enum MCPErrorCode {
  /** Parse error */
  PARSE_ERROR = -32700,
  /** Invalid request */
  INVALID_REQUEST = -32600,
  /** Method not found */
  METHOD_NOT_FOUND = -32601,
  /** Invalid parameters */
  INVALID_PARAMS = -32602,
  /** Internal error */
  INTERNAL_ERROR = -32603,
  /** Server error */
  SERVER_ERROR = -32000,
  /** Authentication required */
  AUTH_REQUIRED = -32001,
  /** Permission denied */
  PERMISSION_DENIED = -32002,
  /** Resource not found */
  RESOURCE_NOT_FOUND = -32003,
  /** Operation failed */
  OPERATION_FAILED = -32004,
}

/**
 * Client capabilities for MCP
 */
export interface ClientCapabilities {
  /** Supported experimental features */
  experimental?: Record<string, unknown>;
  /** Sampling configuration */
  sampling?: SamplingConfiguration;
}

/**
 * Sampling configuration for MCP operations
 */
export interface SamplingConfiguration {
  /** Whether sampling is enabled */
  enabled: boolean;
  /** Sampling rate (0-1) */
  rate: number;
  /** Sampling strategy */
  strategy: SamplingStrategy;
}

/**
 * Sampling strategies
 */
export enum SamplingStrategy {
  /** Random sampling */
  RANDOM = "random",
  /** Systematic sampling */
  SYSTEMATIC = "systematic",
  /** Stratified sampling */
  STRATIFIED = "stratified",
}

/**
 * Lighthouse-specific MCP tool definitions
 */
export const LIGHTHOUSE_MCP_TOOLS: MCPToolDefinition[] = [
  {
    name: "lighthouse_upload_file",
    description: "Upload a file to IPFS via Lighthouse with optional encryption",
    inputSchema: {
      type: "object",
      properties: {
        filePath: {
          type: "string",
          description: "Path to the file to upload",
        },
        encrypt: {
          type: "boolean",
          description: "Whether to encrypt the file",
          default: false,
        },
        accessConditions: {
          type: "array",
          description: "Array of access control conditions",
          items: {
            type: "object",
            description: "Access condition object",
            properties: {
              type: { type: "string", description: "Type of access condition" },
              condition: { type: "string", description: "Access condition to be met" },
              value: { type: "string", description: "Value or threshold for the condition" },
            },
            required: ["type", "condition", "value"],
          },
        },
        tags: {
          type: "array",
          description: "Tags for organization",
          items: { type: "string", description: "Tag string" },
        },
      },
      required: ["filePath"],
    },
    requiresAuth: true,
    supportsBatch: false,
    executionTime: ExecutionTimeCategory.MEDIUM,
  },
  {
    name: "lighthouse_create_dataset",
    description: "Create a managed dataset collection with metadata",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Dataset name",
        },
        description: {
          type: "string",
          description: "Dataset description",
        },
        files: {
          type: "array",
          description: "Array of file paths to include",
          items: { type: "string", description: "File path string" },
        },
        metadata: {
          type: "object",
          description: "Additional metadata",
          properties: {
            version: { type: "string", description: "Dataset version" },
            author: { type: "string", description: "Dataset author" },
            license: { type: "string", description: "Dataset license" },
          },
        },
        encrypt: {
          type: "boolean",
          description: "Whether to encrypt the dataset",
          default: false,
        },
      },
      required: ["name", "files"],
    },
    requiresAuth: true,
    supportsBatch: true,
    executionTime: ExecutionTimeCategory.SLOW,
  },
  {
    name: "lighthouse_fetch_file",
    description: "Download and optionally decrypt a file from Lighthouse",
    inputSchema: {
      type: "object",
      properties: {
        cid: {
          type: "string",
          description: "IPFS CID of the file",
        },
        outputPath: {
          type: "string",
          description: "Local path to save the file",
        },
        decrypt: {
          type: "boolean",
          description: "Whether to decrypt the file",
          default: false,
        },
      },
      required: ["cid"],
    },
    requiresAuth: true,
    supportsBatch: false,
    executionTime: ExecutionTimeCategory.MEDIUM,
  },
];
