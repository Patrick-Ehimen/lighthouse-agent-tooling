/**
 * Test fixtures and sample data for testing
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

interface WorkspaceContext {
  rootPath: string;
  projectName: string;
  files: ProjectFile[];
  gitInfo?: GitInfo;
}

interface ProjectFile {
  path: string;
  type: string;
  size: number;
  lastModified: string;
}

interface GitInfo {
  branch: string;
  commit: string;
  remote: string;
  isDirty: boolean;
}

/**
 * Sample file content for testing
 */
export const SAMPLE_FILE_CONTENT = {
  text: "This is a sample text file for testing purposes.",
  json: JSON.stringify({ test: true, data: [1, 2, 3] }),
  csv: "name,age,city\nJohn,30,New York\nJane,25,Los Angeles",
  markdown:
    "# Test Document\n\nThis is a test markdown file.\n\n## Section 1\n\nSample content here.",
};

/**
 * Sample CIDs for testing
 */
export const SAMPLE_CIDS = {
  valid: [
    "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG",
    "QmPZ9gcCEpqKTo6aq61g2nXGUhM4iCL3ewB6LDXZCtioEB",
    "QmYjtig7VJQ6XsnUjqqJvj7QaMcCAwtrgNdahSiFofrE7o",
  ],
  invalid: ["invalid-cid", "Qm123", "", "not-a-cid-at-all"],
};

/**
 * Sample upload results for different scenarios
 */
export const SAMPLE_UPLOAD_RESULTS: Record<string, UploadResult> = {
  small: {
    cid: "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG",
    size: 1024,
    encrypted: false,
    uploadTime: "2024-01-01T00:00:00.000Z",
    tags: ["small", "test"],
  },
  large: {
    cid: "QmPZ9gcCEpqKTo6aq61g2nXGUhM4iCL3ewB6LDXZCtioEB",
    size: 10485760, // 10MB
    encrypted: true,
    uploadTime: "2024-01-01T01:00:00.000Z",
    tags: ["large", "encrypted"],
    accessConditions: [
      {
        type: "token_balance",
        condition: "balance",
        value: "1000",
        operator: "gte",
      },
    ],
  },
  withConditions: {
    cid: "QmYjtig7VJQ6XsnUjqqJvj7QaMcCAwtrgNdahSiFofrE7o",
    size: 2048,
    encrypted: true,
    uploadTime: "2024-01-01T02:00:00.000Z",
    tags: ["conditional"],
    accessConditions: [
      {
        type: "nft_ownership",
        condition: "owns",
        value: "0x1234567890abcdef",
      },
      {
        type: "time_based",
        condition: "after",
        value: "2024-12-31T23:59:59.999Z",
      },
    ],
  },
};

/**
 * Sample datasets for testing
 */
export const SAMPLE_DATASETS: Record<string, Dataset> = {
  simple: {
    id: "dataset-simple",
    name: "Simple Test Dataset",
    description: "A simple dataset for basic testing",
    files: [SAMPLE_UPLOAD_RESULTS.small!],
    metadata: {
      creator: "test-user",
      category: "test",
      license: "MIT",
    },
    version: "1.0.0",
    created: "2024-01-01T00:00:00.000Z",
    updated: "2024-01-01T00:00:00.000Z",
  },
  complex: {
    id: "dataset-complex",
    name: "Complex Test Dataset",
    description: "A complex dataset with multiple files and conditions",
    files: [SAMPLE_UPLOAD_RESULTS.large!, SAMPLE_UPLOAD_RESULTS.withConditions!],
    metadata: {
      creator: "advanced-user",
      category: "research",
      license: "Apache-2.0",
      tags: ["machine-learning", "encrypted"],
      collaborators: ["user1", "user2"],
    },
    version: "2.1.0",
    created: "2024-01-01T00:00:00.000Z",
    updated: "2024-01-15T12:30:00.000Z",
  },
};

/**
 * Sample access conditions for testing
 */
export const SAMPLE_ACCESS_CONDITIONS: Record<string, AccessCondition> = {
  tokenBalance: {
    type: "token_balance",
    condition: "balance",
    value: "100",
    operator: "gte",
  },
  nftOwnership: {
    type: "nft_ownership",
    condition: "owns",
    value: "0x1234567890abcdef1234567890abcdef12345678",
  },
  timeBased: {
    type: "time_based",
    condition: "after",
    value: "2024-12-31T23:59:59.999Z",
  },
  custom: {
    type: "custom",
    condition: "custom_logic",
    value: 'user.role === "premium"',
  },
};

/**
 * Sample workspace context for testing
 */
export const SAMPLE_WORKSPACE_CONTEXT: WorkspaceContext = {
  rootPath: "/test/workspace",
  projectName: "test-project",
  files: [
    {
      path: "src/index.ts",
      type: "typescript",
      size: 1024,
      lastModified: "2024-01-01T00:00:00.000Z",
    },
    {
      path: "package.json",
      type: "json",
      size: 512,
      lastModified: "2024-01-01T00:00:00.000Z",
    },
    {
      path: "README.md",
      type: "markdown",
      size: 2048,
      lastModified: "2024-01-01T00:00:00.000Z",
    },
  ],
  gitInfo: {
    branch: "main",
    commit: "abc123def456",
    remote: "https://github.com/test/test-project.git",
    isDirty: false,
  },
};

/**
 * Sample project files for testing
 */
export const SAMPLE_PROJECT_FILES: Record<string, ProjectFile> = {
  typescript: {
    path: "src/utils/helper.ts",
    type: "typescript",
    size: 1536,
    lastModified: "2024-01-01T10:30:00.000Z",
  },
  javascript: {
    path: "scripts/build.js",
    type: "javascript",
    size: 2048,
    lastModified: "2024-01-01T09:15:00.000Z",
  },
  json: {
    path: "config/settings.json",
    type: "json",
    size: 256,
    lastModified: "2024-01-01T08:00:00.000Z",
  },
  markdown: {
    path: "docs/api.md",
    type: "markdown",
    size: 4096,
    lastModified: "2024-01-01T14:45:00.000Z",
  },
};

/**
 * Sample error scenarios for testing
 */
export const SAMPLE_ERRORS = {
  networkError: new Error("Network request failed"),
  authError: new Error("Authentication failed"),
  validationError: new Error("Validation failed: Invalid input"),
  fileNotFound: new Error("File not found"),
  permissionDenied: new Error("Permission denied"),
};

/**
 * Sample API responses for testing
 */
export const SAMPLE_API_RESPONSES = {
  uploadSuccess: {
    status: 200,
    data: {
      Hash: SAMPLE_CIDS.valid[0],
      Size: "1024",
    },
  },
  uploadError: {
    status: 400,
    data: {
      error: "Invalid file format",
    },
  },
  authError: {
    status: 401,
    data: {
      error: "Invalid API key",
    },
  },
  serverError: {
    status: 500,
    data: {
      error: "Internal server error",
    },
  },
};
