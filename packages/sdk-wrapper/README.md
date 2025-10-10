# @lighthouse-tooling/sdk-wrapper

Unified SDK wrapper that abstracts Lighthouse and Kavach SDK complexity for AI agents. This is a foundational component used by MCP servers and IDE extensions to interact with Lighthouse storage services.

## Features

- **Unified Interface**: Single SDK for all Lighthouse operations
- **Authentication Management**: Automatic JWT token refresh
- **Progress Tracking**: Real-time progress updates with event emission
- **Error Handling**: Comprehensive error handling with retry logic
- **TypeScript Support**: Full TypeScript definitions and documentation
- **AI-Friendly**: Designed specifically for AI agent integration

## Installation

```bash
npm install @lighthouse-tooling/sdk-wrapper
```

## Quick Start

```typescript
import { LighthouseAISDK } from "@lighthouse-tooling/sdk-wrapper";

// Initialize SDK
const sdk = new LighthouseAISDK({
  apiKey: "your-lighthouse-api-key",
  baseUrl: "https://node.lighthouse.storage", // optional
  timeout: 30000, // optional
  maxRetries: 3, // optional
  debug: false, // optional
});

// Initialize and authenticate
await sdk.initialize();

// Upload a file
const fileInfo = await sdk.uploadFile("./data/model.json", {
  fileName: "my-model.json",
  mimeType: "application/json",
  encrypt: false,
  onProgress: (progress) => {
    console.log(`Upload progress: ${progress.percentage}%`);
  },
});

console.log("File uploaded:", fileInfo.hash);

// Download a file
await sdk.downloadFile(fileInfo.hash, "./downloads/model.json", {
  onProgress: (progress) => {
    console.log(`Download progress: ${progress.percentage}%`);
  },
});

// List uploaded files
const files = await sdk.listFiles(10, 0);
console.log("Uploaded files:", files.files);

// Cleanup
sdk.destroy();
```

## API Reference

### LighthouseAISDK

Main SDK class that provides unified access to Lighthouse functionality.

#### Constructor

```typescript
new LighthouseAISDK(config: LighthouseConfig)
```

#### Methods

##### `initialize(): Promise<void>`

Initialize the SDK and authenticate with Lighthouse.

##### `uploadFile(filePath: string, options?: UploadOptions): Promise<FileInfo>`

Upload a file to Lighthouse with progress tracking.

**Parameters:**

- `filePath`: Path to the file to upload
- `options`: Upload configuration options

**Returns:** Promise resolving to file information

##### `downloadFile(cid: string, outputPath: string, options?: DownloadOptions): Promise<string>`

Download a file from Lighthouse.

**Parameters:**

- `cid`: IPFS CID of the file to download
- `outputPath`: Local path to save the downloaded file
- `options`: Download configuration options

**Returns:** Promise resolving to the output file path

##### `getFileInfo(cid: string): Promise<FileInfo>`

Get metadata and information about a file.

##### `listFiles(limit?: number, offset?: number): Promise<ListFilesResponse>`

List files uploaded by the authenticated user.

##### `getAuthState(): AuthState`

Get current authentication state.

##### `getActiveOperations(): string[]`

Get list of active operation IDs.

##### `getOperationProgress(operationId: string): ProgressInfo | null`

Get progress information for a specific operation.

##### `cancelOperation(operationId: string): void`

Cancel an ongoing operation.

##### `destroy(): void`

Cleanup resources and disconnect.

### Events

The SDK emits various events for progress tracking and status updates:

```typescript
sdk.on("upload:start", (event) => console.log("Upload started"));
sdk.on("upload:progress", (event) => console.log("Upload progress:", event.data));
sdk.on("upload:complete", (event) => console.log("Upload completed"));
sdk.on("upload:error", (event) => console.error("Upload failed:", event.error));

sdk.on("download:start", (event) => console.log("Download started"));
sdk.on("download:progress", (event) => console.log("Download progress:", event.data));
sdk.on("download:complete", (event) => console.log("Download completed"));
sdk.on("download:error", (event) => console.error("Download failed:", event.error));

sdk.on("auth:refresh", () => console.log("Token refreshed"));
sdk.on("auth:error", (error) => console.error("Auth error:", error));
```

## Configuration

### LighthouseConfig

```typescript
interface LighthouseConfig {
  /** API key for authentication */
  apiKey: string;
  /** Base URL for Lighthouse API (optional) */
  baseUrl?: string;
  /** Timeout for requests in milliseconds */
  timeout?: number;
  /** Maximum number of retry attempts */
  maxRetries?: number;
  /** Enable debug logging */
  debug?: boolean;
}
```

### UploadOptions

```typescript
interface UploadOptions {
  /** File name override */
  fileName?: string;
  /** MIME type override */
  mimeType?: string;
  /** Progress callback function */
  onProgress?: (progress: ProgressInfo) => void;
  /** Enable encryption */
  encrypt?: boolean;
  /** Custom metadata */
  metadata?: Record<string, any>;
}
```

### DownloadOptions

```typescript
interface DownloadOptions {
  /** Progress callback function */
  onProgress?: (progress: ProgressInfo) => void;
  /** Expected file size for progress calculation */
  expectedSize?: number;
}
```

## Error Handling

The SDK provides comprehensive error handling with intelligent error classification, automatic retry logic, and circuit breaker protection:

### Error Types

- **NetworkError**: Connection issues, DNS failures (retryable)
- **AuthenticationError**: Invalid credentials, expired tokens (not retryable)
- **RateLimitError**: API rate limits exceeded (retryable with backoff)
- **TimeoutError**: Request timeouts (retryable)
- **ValidationError**: Invalid input parameters (not retryable)
- **FileNotFoundError**: Requested file doesn't exist (not retryable)
- **InsufficientStorageError**: Storage quota exceeded (not retryable)

### Retry Logic

```typescript
import { NetworkError, RateLimitError } from "@lighthouse-tooling/sdk-wrapper";

try {
  const fileInfo = await sdk.uploadFile("./large-file.zip");
  console.log("Upload successful:", fileInfo.hash);
} catch (error) {
  if (error instanceof NetworkError) {
    console.log("Network error - automatically retried with exponential backoff");
  } else if (error instanceof RateLimitError) {
    console.log(`Rate limited - retry after ${error.retryAfter}ms`);
  } else {
    console.error("Upload failed:", error.message);
  }
}
```

### Circuit Breaker

The SDK includes circuit breaker protection to prevent cascading failures:

```typescript
// Monitor circuit breaker events
sdk.on("circuit:open", (event) => {
  console.log("Circuit breaker opened for:", event.operationName);
});

sdk.on("circuit:closed", (event) => {
  console.log("Circuit breaker closed for:", event.operationName);
});

// Get circuit breaker status
const status = sdk.getCircuitBreakerStatus();
console.log("Circuit state:", status.state);
```

### Error Metrics

```typescript
// Get error metrics for monitoring
const metrics = sdk.getErrorMetrics();
console.log("Total errors:", metrics.totalErrors);
console.log("Errors by type:", metrics.errorsByType);
console.log("Retry attempts:", metrics.retryAttempts);
console.log("Successful retries:", metrics.successfulRetries);

// Reset metrics
sdk.resetErrorMetrics();
```

## Development

### Building

```bash
npm run build
```

### Testing

```bash
npm test
npm run test:watch
npm run test:coverage
```

### Linting

```bash
npm run lint
npm run lint:fix
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## License

MIT License - see LICENSE file for details.
