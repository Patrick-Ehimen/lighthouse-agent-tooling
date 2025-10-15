# Lighthouse AI SDK Documentation

Comprehensive guides for integrating and using the Lighthouse AI SDK with intelligent error handling.

## Quick Start

```typescript
import { LighthouseAISDK } from "@lighthouse-tooling/sdk-wrapper";

const sdk = new LighthouseAISDK({
  apiKey: "your-lighthouse-api-key",
  maxRetries: 3,
  timeout: 30000,
});

await sdk.initialize();
const fileInfo = await sdk.uploadFile("./document.pdf");
```

## Documentation Structure

### 📚 Guides

- **[SDK Integration Guide](./guides/sdk-integration.md)** - Quick setup and basic usage
- **[Configuration Reference](./guides/configuration.md)** - Complete configuration options

### 🔧 Troubleshooting

- **[Common Issues](./troubleshooting/common-issues.md)** - Solutions for frequent problems
- **[Error Scenarios](./troubleshooting/error-scenarios.md)** - Specific error handling patterns

## Key Features

### ✅ Intelligent Error Handling

- Automatic error classification (Network, Auth, Rate Limit, etc.)
- Exponential backoff retry for transient failures
- Circuit breaker protection against cascading failures

### ✅ Comprehensive Monitoring

- Real-time error metrics and statistics
- Circuit breaker status monitoring
- Progress tracking with ETA calculations

### ✅ Developer-Friendly

- TypeScript support with full type definitions
- Rich event system for monitoring operations
- Detailed error messages and context

## Error Types

| Error Type            | Retryable | Description                         |
| --------------------- | --------- | ----------------------------------- |
| `NetworkError`        | ✅        | Connection issues, DNS failures     |
| `TimeoutError`        | ✅        | Request timeouts                    |
| `RateLimitError`      | ✅        | API rate limits exceeded            |
| `AuthenticationError` | ❌        | Invalid credentials, expired tokens |
| `ValidationError`     | ❌        | Invalid input parameters            |
| `FileNotFoundError`   | ❌        | Requested file doesn't exist        |

## Quick Examples

### Basic Error Handling

```typescript
try {
  await sdk.uploadFile("./file.txt");
} catch (error) {
  if (error instanceof NetworkError) {
    console.log("Network error - automatically retried");
  } else if (error instanceof AuthenticationError) {
    console.log("Check your API key");
  }
}
```

### Progress Monitoring

```typescript
await sdk.uploadFile("./large-file.zip", {
  onProgress: (progress) => {
    console.log(`${progress.percentage}% complete`);
    console.log(`ETA: ${progress.eta} seconds`);
  },
});
```

### Circuit Breaker Monitoring

```typescript
sdk.on("circuit:open", () => {
  console.log("Service temporarily unavailable");
});

sdk.on("circuit:closed", () => {
  console.log("Service recovered");
});
```
