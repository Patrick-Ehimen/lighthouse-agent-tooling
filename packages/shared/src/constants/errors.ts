/**
 * Error codes and messages for consistent error handling across the system
 */

export const ERROR_CODES = {
  // Authentication errors
  AUTHENTICATION_FAILED: "AUTH_001",
  INVALID_API_KEY: "AUTH_002",
  TOKEN_EXPIRED: "AUTH_003",
  INSUFFICIENT_PERMISSIONS: "AUTH_004",

  // File operation errors
  FILE_NOT_FOUND: "FILE_001",
  FILE_TOO_LARGE: "FILE_002",
  INVALID_FILE_TYPE: "FILE_003",
  FILE_UPLOAD_FAILED: "FILE_004",
  FILE_ENCRYPTION_FAILED: "FILE_005",
  FILE_DECRYPTION_FAILED: "FILE_006",

  // Network errors
  NETWORK_ERROR: "NET_001",
  CONNECTION_TIMEOUT: "NET_002",
  REQUEST_FAILED: "NET_003",
  RATE_LIMITED: "NET_004",

  // Validation errors
  VALIDATION_ERROR: "VAL_001",
  INVALID_CID: "VAL_002",
  INVALID_PATH: "VAL_003",
  MISSING_REQUIRED_FIELD: "VAL_004",
  INVALID_FORMAT: "VAL_005",

  // System errors
  SYSTEM_ERROR: "SYS_001",
  CONFIGURATION_ERROR: "SYS_002",
  DEPENDENCY_ERROR: "SYS_003",
  RESOURCE_EXHAUSTED: "SYS_004",

  // MCP specific errors
  MCP_TOOL_NOT_FOUND: "MCP_001",
  MCP_INVALID_REQUEST: "MCP_002",
  MCP_EXECUTION_FAILED: "MCP_003",
  MCP_TIMEOUT: "MCP_004",
} as const;

export const ERROR_MESSAGES = {
  [ERROR_CODES.AUTHENTICATION_FAILED]:
    "Authentication failed. Please check your credentials.",
  [ERROR_CODES.INVALID_API_KEY]: "Invalid API key provided.",
  [ERROR_CODES.TOKEN_EXPIRED]: "Authentication token has expired.",
  [ERROR_CODES.INSUFFICIENT_PERMISSIONS]:
    "Insufficient permissions for this operation.",

  [ERROR_CODES.FILE_NOT_FOUND]: "The specified file could not be found.",
  [ERROR_CODES.FILE_TOO_LARGE]: "File size exceeds the maximum allowed limit.",
  [ERROR_CODES.INVALID_FILE_TYPE]: "File type is not supported.",
  [ERROR_CODES.FILE_UPLOAD_FAILED]: "File upload failed. Please try again.",
  [ERROR_CODES.FILE_ENCRYPTION_FAILED]: "File encryption failed.",
  [ERROR_CODES.FILE_DECRYPTION_FAILED]: "File decryption failed.",

  [ERROR_CODES.NETWORK_ERROR]:
    "Network error occurred. Please check your connection.",
  [ERROR_CODES.CONNECTION_TIMEOUT]: "Connection timed out. Please try again.",
  [ERROR_CODES.REQUEST_FAILED]: "Request failed. Please try again later.",
  [ERROR_CODES.RATE_LIMITED]:
    "Rate limit exceeded. Please wait before retrying.",

  [ERROR_CODES.VALIDATION_ERROR]: "Validation error occurred.",
  [ERROR_CODES.INVALID_CID]: "Invalid CID format provided.",
  [ERROR_CODES.INVALID_PATH]: "Invalid file path provided.",
  [ERROR_CODES.MISSING_REQUIRED_FIELD]: "Required field is missing.",
  [ERROR_CODES.INVALID_FORMAT]: "Invalid format provided.",

  [ERROR_CODES.SYSTEM_ERROR]: "System error occurred.",
  [ERROR_CODES.CONFIGURATION_ERROR]: "Configuration error detected.",
  [ERROR_CODES.DEPENDENCY_ERROR]: "Dependency error occurred.",
  [ERROR_CODES.RESOURCE_EXHAUSTED]: "System resources exhausted.",

  [ERROR_CODES.MCP_TOOL_NOT_FOUND]: "MCP tool not found.",
  [ERROR_CODES.MCP_INVALID_REQUEST]: "Invalid MCP request format.",
  [ERROR_CODES.MCP_EXECUTION_FAILED]: "MCP tool execution failed.",
  [ERROR_CODES.MCP_TIMEOUT]: "MCP operation timed out.",
} as const;

export const ERROR_CATEGORIES = {
  RECOVERABLE: "recoverable",
  NON_RECOVERABLE: "non_recoverable",
  USER_ERROR: "user_error",
  SYSTEM_ERROR: "system_error",
} as const;

export const RECOVERABLE_ERROR_CODES = [
  ERROR_CODES.NETWORK_ERROR,
  ERROR_CODES.CONNECTION_TIMEOUT,
  ERROR_CODES.REQUEST_FAILED,
  ERROR_CODES.RATE_LIMITED,
  ERROR_CODES.FILE_UPLOAD_FAILED,
] as const;
