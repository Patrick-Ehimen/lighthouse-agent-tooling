# @lighthouse-tooling/types

Shared TypeScript types and interfaces for the Lighthouse AI integration system.

## Overview

This package provides comprehensive TypeScript interfaces and data models that are shared across all components of the Lighthouse AI integration system, including:

- **Core interfaces** for file operations, datasets, and progress tracking
- **MCP (Model Context Protocol) types** for AI agent integration
- **Authentication types** for secure API access
- **Error handling types** with retry configurations
- **Workspace context types** for IDE integration

## Installation

```bash
# Using pnpm (recommended)
pnpm add @lighthouse-tooling/types

# Using npm
npm install @lighthouse-tooling/types

# Using yarn
yarn add @lighthouse-tooling/types
```

## Usage

### Basic Import

```typescript
import { UploadResult, Dataset, AuthConfig } from '@lighthouse-tooling/types';
```

### Core Types

```typescript
import { 
  UploadResult, 
  Dataset, 
  AccessCondition, 
  ProgressUpdate,
  UploadConfig,
  DatasetConfig 
} from '@lighthouse-tooling/types';

// File upload result
const uploadResult: UploadResult = {
  cid: 'QmHash...',
  size: 1024,
  encrypted: true,
  uploadedAt: new Date(),
  accessConditions: [{
    type: AccessConditionType.TOKEN_BALANCE,
    condition: 'balance',
    value: '100'
  }]
};

// Dataset configuration
const datasetConfig: DatasetConfig = {
  name: 'my-dataset',
  description: 'Machine learning dataset',
  encrypt: true,
  tags: ['ml', 'training']
};
```

### MCP Integration

```typescript
import { 
  MCPToolDefinition, 
  MCPRequest, 
  MCPResponse,
  LIGHTHOUSE_MCP_TOOLS 
} from '@lighthouse-tooling/types';

// Use predefined Lighthouse MCP tools
const tools = LIGHTHOUSE_MCP_TOOLS;

// Create MCP request
const request: MCPRequest = {
  jsonrpc: '2.0',
  id: '1',
  method: MCPMethod.CALL_TOOL,
  params: {
    name: 'lighthouse_upload_file',
    arguments: {
      filePath: '/path/to/file.txt',
      encrypt: true
    }
  }
};
```

### Authentication

```typescript
import { 
  AuthConfig, 
  TokenInfo, 
  AuthMethod,
  TokenType 
} from '@lighthouse-tooling/types';

const authConfig: AuthConfig = {
  method: AuthMethod.API_KEY,
  apiKey: 'your-api-key',
  address: '0x...'
};

const tokenInfo: TokenInfo = {
  token: 'bearer-token',
  type: TokenType.BEARER,
  expiresAt: new Date(Date.now() + 3600000),
  isValid: true
};
```

### Error Handling

```typescript
import { 
  LighthouseError, 
  ErrorType, 
  ErrorSeverity,
  RetryConfig,
  DEFAULT_RETRY_CONFIGS 
} from '@lighthouse-tooling/types';

// Create custom error
const error = new LighthouseError(
  'Upload failed',
  ErrorType.UPLOAD_ERROR,
  ErrorSeverity.ERROR,
  { filePath: '/path/to/file.txt' },
  undefined,
  true // retryable
);

// Use default retry configuration
const retryConfig = DEFAULT_RETRY_CONFIGS.upload;
```

### Workspace Context

```typescript
import { 
  WorkspaceContext, 
  ProjectFile, 
  GitInfo,
  DatasetReference,
  AIContext 
} from '@lighthouse-tooling/types';

const workspaceContext: WorkspaceContext = {
  projectPath: '/path/to/project',
  gitInfo: {
    branch: 'main',
    commit: 'abc123',
    isClean: true,
    modifiedFiles: [],
    stagedFiles: [],
    untrackedFiles: []
  },
  lighthouseFiles: [],
  activeDatasets: [],
  metadata: {
    name: 'my-project',
    type: WorkspaceType.WEB_APP,
    languages: ['typescript', 'javascript'],
    frameworks: [],
    dependencies: [],
    size: 0,
    fileCount: 0,
    lastActivity: new Date(),
    tags: []
  },
  configuration: {
    autoSync: {
      enabled: true,
      interval: 30000,
      fileTypes: ['.ts', '.js'],
      excludePatterns: ['node_modules/**'],
      includePatterns: ['src/**']
    },
    encryption: {
      defaultEncryption: false,
      algorithm: 'AES-256-GCM',
      keySize: 256,
      keyDerivation: 'PBKDF2'
    },
    aiIntegration: {
      enabled: true,
      supportedAgents: [AgentType.CURSOR_AI],
      capabilities: ['upload', 'download', 'encrypt'],
      preferences: {}
    },
    performance: {
      maxConcurrentOperations: 5,
      cache: {
        enabled: true,
        sizeLimit: 100000000,
        ttl: 3600000,
        storageType: CacheStorageType.MEMORY
      },
      timeouts: {
        default: 30000,
        upload: 60000,
        download: 60000,
        aiOperation: 120000
      }
    }
  }
};
```

## Type Categories

### Core Types
- `UploadResult` - Result of file upload operations
- `Dataset` - Dataset collection with metadata
- `AccessCondition` - Access control conditions
- `ProgressUpdate` - Progress tracking for operations
- `UploadConfig` - Configuration for uploads
- `DatasetConfig` - Configuration for datasets

### MCP Types
- `MCPToolDefinition` - Definition of MCP tools
- `MCPRequest` - MCP request structure
- `MCPResponse` - MCP response structure
- `LIGHTHOUSE_MCP_TOOLS` - Predefined Lighthouse MCP tools

### Authentication Types
- `AuthConfig` - Authentication configuration
- `TokenInfo` - Token information and metadata
- `APICredentials` - API credentials for external services
- `AuthContext` - User authentication context

### Error Types
- `LighthouseError` - Base error class
- `RetryConfig` - Retry configuration
- `ErrorHandlerConfig` - Error handling configuration
- `DEFAULT_RETRY_CONFIGS` - Default retry configurations

### Workspace Types
- `WorkspaceContext` - Workspace context information
- `ProjectFile` - Project file information
- `GitInfo` - Git repository information
- `DatasetReference` - Dataset reference in workspace
- `AIContext` - AI agent context

## Development

### Building

```bash
# Build the package
pnpm build

# Watch mode for development
pnpm dev

# Type checking only
pnpm type-check

# Clean build artifacts
pnpm clean
```

### TypeScript Configuration

This package uses strict TypeScript configuration with:
- Strict mode enabled
- No unchecked index access
- Declaration files generated
- ES2022 target with NodeNext module resolution

## Contributing

When adding new types:

1. Follow the existing naming conventions
2. Add comprehensive JSDoc documentation
3. Include proper TypeScript types and interfaces
4. Export types through the main index.ts file
5. Add examples in this README if applicable

## License

MIT
