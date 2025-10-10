# SDK Integration Guide

Quick guide to integrate the Lighthouse AI SDK with comprehensive error handling.

## Installation

```bash
npm install @lighthouse-tooling/sdk-wrapper
```

## Basic Setup

```typescript
import { LighthouseAISDK } from "@lighthouse-tooling/sdk-wrapper";

const sdk = new LighthouseAISDK({
  apiKey: "your-lighthouse-api-key",
  maxRetries: 3,
  timeout: 30000,
});

await sdk.initialize();
```

## Error Handling Configuration

### Default Configuration

```typescript
const sdk = new LighthouseAISDK({
  apiKey: "your-key",
  maxRetries: 3, // Retry failed operations 3 times
  timeout: 30000, // 30 second timeout per operation
});
```

### Custom Retry Policy

```typescript
const sdk = new LighthouseAISDK({
  apiKey: "your-key",
  maxRetries: 5,
  timeout: 60000,
});

// Operations will automatically retry with exponential backoff:
// Attempt 1: immediate
// Attempt 2: ~1s delay
// Attempt 3: ~2s delay
// Attempt 4: ~4s delay
// Attempt 5: ~8s delay
```

## Error Types and Handling

### Automatic Retry (Transient Errors)

- **NetworkError**: Connection issues, DNS failures
- **TimeoutError**: Request timeouts
- **RateLimitError**: API rate limits exceeded

```typescript
try {
  const fileInfo = await sdk.uploadFile("./file.txt");
} catch (error) {
  if (error instanceof NetworkError) {
    // Already retried automatically with backoff
    console.log("Network error after retries:", error.message);
  }
}
```

### No Retry (Permanent Errors)

- **AuthenticationError**: Invalid API key, expired tokens
- **ValidationError**: Invalid input parameters
- **FileNotFoundError**: File doesn't exist

```typescript
try {
  await sdk.initialize();
} catch (error) {
  if (error instanceof AuthenticationError) {
    // Fix API key - retrying won't help
    console.error("Check your API key:", error.message);
  }
}
```

## Event Monitoring

```typescript
// Monitor retry attempts
sdk.on("retry", (event) => {
  console.log(`Retry ${event.attempt} for ${event.context}`);
});

// Monitor circuit breaker
sdk.on("circuit:open", (event) => {
  console.log(`Circuit breaker opened for ${event.operationName}`);
});

// Monitor progress
sdk.on("upload:progress", (event) => {
  console.log(`Upload: ${event.data.percentage}%`);
});
```

## Error Metrics

```typescript
// Get error statistics
const metrics = sdk.getErrorMetrics();
console.log(`Total errors: ${metrics.totalErrors}`);
console.log(`Retry attempts: ${metrics.retryAttempts}`);
console.log(`Successful retries: ${metrics.successfulRetries}`);

// Get circuit breaker status
const status = sdk.getCircuitBreakerStatus();
console.log(`Circuit state: ${status.state}`);
```

## Best Practices

### 1. Handle Specific Error Types

```typescript
try {
  await sdk.uploadFile("./file.txt");
} catch (error) {
  if (error instanceof AuthenticationError) {
    // Show login prompt
  } else if (error instanceof ValidationError) {
    // Show validation errors to user
  } else if (error instanceof NetworkError) {
    // Show "check connection" message
  }
}
```

### 2. Use Progress Callbacks

```typescript
await sdk.uploadFile("./large-file.zip", {
  onProgress: (progress) => {
    updateProgressBar(progress.percentage);
    showETA(progress.eta);
  },
});
```

### 3. Monitor Circuit Breaker

```typescript
sdk.on("circuit:open", () => {
  // Disable upload UI temporarily
  showMessage("Service temporarily unavailable");
});

sdk.on("circuit:closed", () => {
  // Re-enable upload UI
  hideMessage();
});
```

### 4. Cleanup Resources

```typescript
// Always cleanup when done
process.on("exit", () => {
  sdk.destroy();
});
```

## Next Steps

- Check [Configuration Reference](./configuration.md) for advanced options
