# Lighthouse MCP Server - Real SDK Integration

This document describes the integration between the MCP server foundation (task 3) and the unified SDK wrapper (task 2).

## What Changed

The MCP server has been updated to use the real `LighthouseService` instead of the mock service:

### Key Changes

1. **Real Lighthouse Integration**: The server now uses `LighthouseService` which integrates with the actual Lighthouse SDK wrapper from task 2.

2. **Common Interface**: Created `ILighthouseService` interface that both mock and real services implement, ensuring compatibility.

3. **API Key Configuration**: Added `lighthouseApiKey` to server configuration, supporting both environment variable and command-line argument.

4. **Async Operations**: Updated all file operations to be properly async, matching the real SDK behavior.

## Usage

### Environment Setup

```bash
export LIGHTHOUSE_API_KEY="your-lighthouse-api-key"
```

### Command Line

```bash
node dist/index.js --api-key "your-lighthouse-api-key"
```

### Programmatic Usage

```typescript
import { LighthouseMCPServer } from "@lighthouse-tooling/mcp-server";

const server = new LighthouseMCPServer({
  lighthouseApiKey: "your-api-key",
  logLevel: "info",
});

await server.start();
```

## MCP Tools Available

1. **lighthouse_upload_file**: Upload files to IPFS via Lighthouse
2. **lighthouse_create_dataset**: Create managed datasets with metadata
3. **lighthouse_fetch_file**: Download and optionally decrypt files

## Architecture

```
AI Agent (Cursor/Claude)
    ↓ MCP Protocol
LighthouseMCPServer
    ↓ Interface
LighthouseService
    ↓ SDK Wrapper
LighthouseAISDK
    ↓ HTTP API
Lighthouse Infrastructure
```

## Testing

The integration includes comprehensive tests:

```bash
npm test -- integration.test.ts
```

## Next Steps

- Task 4: Implement core MCP tools for file operations with real file handling
- Task 5: Add encryption and access control features using Kavach SDK
- Task 6: Implement dataset management functionality with versioning

## Error Handling

The real service includes:

- Retry logic with exponential backoff
- Circuit breaker pattern for API failures
- Comprehensive error logging
- Authentication token refresh

## Performance

- Progress tracking for long-running operations
- Connection pooling for API requests
- Intelligent caching with LRU cache
- Memory management and backpressure handling
