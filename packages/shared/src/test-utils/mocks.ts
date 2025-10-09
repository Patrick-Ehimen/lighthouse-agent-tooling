/**
 * Mock factories and utilities for testing
 * Local type definitions to avoid external dependencies
 */

// Local type definitions for testing
interface UploadResult {
  cid: string;
  size: number;
  encrypted: boolean;
  accessConditions?: AccessCondition[];
  uploadTime: string;
  tags?: string[];
}

interface Dataset {
  id: string;
  name: string;
  description: string;
  files: UploadResult[];
  metadata: DatasetMetadata;
  version: string;
  created: string;
  updated: string;
}

interface DatasetMetadata {
  creator: string;
  category: string;
  license: string;
  tags?: string[];
  collaborators?: string[];
}

interface AccessCondition {
  type: "token_balance" | "nft_ownership" | "time_based" | "custom";
  condition: string;
  value: string;
  operator?: "gt" | "lt" | "eq" | "gte" | "lte";
}

interface ProgressUpdate {
  operation: string;
  progress: number; // 0-100
  stage: string;
  file?: string;
  timestamp: string;
}

interface MCPRequest {
  id: string;
  method: string;
  params: Record<string, any>;
}

interface MCPResponse {
  id: string;
  result?: {
    success: boolean;
    data?: any;
    error?: string;
  };
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

interface AuthConfig {
  apiKey: string;
  endpoint: string;
  timeout?: number;
}

interface LighthouseError {
  code: string;
  message: string;
  details?: Record<string, any>;
  timestamp: string;
}

/**
 * Mock factory for UploadResult
 */
export const createMockUploadResult = (overrides: Partial<UploadResult> = {}): UploadResult => ({
  cid: "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG",
  size: 1024,
  encrypted: false,
  uploadTime: new Date().toISOString(),
  tags: ["test"],
  ...overrides,
});

/**
 * Mock factory for Dataset
 */
export const createMockDataset = (overrides: Partial<Dataset> = {}): Dataset => ({
  id: "dataset-123",
  name: "Test Dataset",
  description: "A test dataset for unit testing",
  files: [createMockUploadResult()],
  metadata: {
    creator: "test-user",
    category: "test",
    license: "MIT",
  },
  version: "1.0.0",
  created: new Date().toISOString(),
  updated: new Date().toISOString(),
  ...overrides,
});

/**
 * Mock factory for AccessCondition
 */
export const createMockAccessCondition = (
  overrides: Partial<AccessCondition> = {},
): AccessCondition => ({
  type: "token_balance",
  condition: "balance",
  value: "100",
  operator: "gte",
  ...overrides,
});

/**
 * Mock factory for ProgressUpdate
 */
export const createMockProgressUpdate = (
  overrides: Partial<ProgressUpdate> = {},
): ProgressUpdate => ({
  operation: "upload",
  progress: 50,
  stage: "uploading",
  file: "test-file.txt",
  timestamp: new Date().toISOString(),
  ...overrides,
});

/**
 * Mock factory for MCP Request
 */
export const createMockMCPRequest = (overrides: Partial<MCPRequest> = {}): MCPRequest => ({
  id: "req-123",
  method: "lighthouse/upload",
  params: {
    filePath: "/test/file.txt",
    apiKey: "test-api-key",
  },
  ...overrides,
});

/**
 * Mock factory for MCP Response
 */
export const createMockMCPResponse = (overrides: Partial<MCPResponse> = {}): MCPResponse => ({
  id: "req-123",
  result: {
    success: true,
    data: createMockUploadResult(),
  },
  ...overrides,
});

/**
 * Mock factory for AuthConfig
 */
export const createMockAuthConfig = (overrides: Partial<AuthConfig> = {}): AuthConfig => ({
  apiKey: "test-api-key-123",
  endpoint: "https://api.lighthouse.storage",
  timeout: 30000,
  ...overrides,
});

/**
 * Mock factory for LighthouseError
 */
export const createMockError = (overrides: Partial<LighthouseError> = {}): LighthouseError => ({
  code: "TEST_ERROR",
  message: "Test error message",
  details: { test: true },
  timestamp: new Date().toISOString(),
  ...overrides,
});

/**
 * Mock HTTP response factory
 */
export const createMockHttpResponse = (status: number = 200, data: any = {}) => ({
  status,
  statusText: status === 200 ? "OK" : "Error",
  data,
  headers: {
    "content-type": "application/json",
  },
});

/**
 * Mock file system operations
 */
export const mockFs = {
  readFile: jest.fn(),
  writeFile: jest.fn(),
  exists: jest.fn(),
  stat: jest.fn(),
  mkdir: jest.fn(),
  readdir: jest.fn(),
};

/**
 * Mock console methods for testing
 */
export const mockConsole = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

/**
 * Mock timer utilities
 */
export const mockTimers = {
  setup: () => {
    jest.useFakeTimers();
  },
  teardown: () => {
    jest.useRealTimers();
  },
  advanceBy: (ms: number) => {
    jest.advanceTimersByTime(ms);
  },
  runAll: () => {
    jest.runAllTimers();
  },
};
