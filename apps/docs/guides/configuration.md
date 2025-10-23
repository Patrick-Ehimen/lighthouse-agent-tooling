# Configuration Reference

Complete configuration options for the Lighthouse AI SDK error handling system.

## SDK Configuration

### Basic Configuration

```typescript
interface LighthouseConfig {
  apiKey: string; // Required: Your Lighthouse API key
  baseUrl?: string; // Optional: Custom API endpoint
  timeout?: number; // Optional: Request timeout (default: 30000ms)
  maxRetries?: number; // Optional: Max retry attempts (default: 3)
  debug?: boolean; // Optional: Enable debug logging (default: false)
}
```

### Example Configurations

#### Development

```typescript
const sdk = new LighthouseAISDK({
  apiKey: process.env.LIGHTHOUSE_API_KEY,
  timeout: 10000, // Shorter timeout for dev
  maxRetries: 1, // Fewer retries for faster feedback
  debug: true, // Enable debug logs
});
```

#### Production

```typescript
const sdk = new LighthouseAISDK({
  apiKey: process.env.LIGHTHOUSE_API_KEY,
  timeout: 60000, // Longer timeout for large files
  maxRetries: 5, // More retries for reliability
  debug: false, // Disable debug logs
});
```

#### High-Volume Applications

```typescript
const sdk = new LighthouseAISDK({
  apiKey: process.env.LIGHTHOUSE_API_KEY,
  timeout: 120000, // Very long timeout
  maxRetries: 3, // Moderate retries to avoid delays
  debug: false,
});
```

## Retry Policy Configuration

### Default Retry Policy

```typescript
{
  maxRetries: 3,            // Maximum retry attempts
  baseDelay: 1000,          // Base delay: 1 second
  maxDelay: 30000,          // Maximum delay: 30 seconds
  backoffMultiplier: 2,     // Exponential multiplier
  jitter: true,             // Add random jitter
  timeout: 30000            // Per-attempt timeout
}
```

### Custom Retry Policy

```typescript
// Create custom error handler with specific policy
import { ErrorHandler } from "@lighthouse-tooling/sdk-wrapper";

const errorHandler = new ErrorHandler({
  maxRetries: 5,
  baseDelay: 2000, // Start with 2 second delay
  maxDelay: 60000, // Cap at 1 minute
  backoffMultiplier: 1.5, // Slower exponential growth
  jitter: false, // No jitter for predictable timing
  timeout: 45000, // 45 second timeout per attempt
});
```

## Circuit Breaker Configuration

### Default Circuit Breaker

```typescript
{
  failureThreshold: 5,      // Open after 5 failures
  successThreshold: 3,      // Close after 3 successes
  timeout: 60000,           // Wait 1 minute before retry
  monitoringWindow: 300000  // 5 minute monitoring window
}
```

### Custom Circuit Breaker

```typescript
import { CircuitBreaker } from "@lighthouse-tooling/sdk-wrapper";

const circuitBreaker = new CircuitBreaker({
  failureThreshold: 10, // More tolerant of failures
  successThreshold: 5, // Require more successes to close
  timeout: 120000, // Wait 2 minutes before retry
  monitoringWindow: 600000, // 10 minute monitoring window
});
```

## Environment-Specific Configurations

### Environment Variables

```bash
# .env file
LIGHTHOUSE_API_KEY=your_api_key_here
LIGHTHOUSE_BASE_URL=https://node.lighthouse.storage
LIGHTHOUSE_TIMEOUT=30000
LIGHTHOUSE_MAX_RETRIES=3
LIGHTHOUSE_DEBUG=false
```

### Loading from Environment

```typescript
const sdk = new LighthouseAISDK({
  apiKey: process.env.LIGHTHOUSE_API_KEY!,
  baseUrl: process.env.LIGHTHOUSE_BASE_URL,
  timeout: parseInt(process.env.LIGHTHOUSE_TIMEOUT || "30000"),
  maxRetries: parseInt(process.env.LIGHTHOUSE_MAX_RETRIES || "3"),
  debug: process.env.LIGHTHOUSE_DEBUG === "true",
});
```

## Operation-Specific Configuration

### Upload Configuration

```typescript
await sdk.uploadFile("./file.txt", {
  fileName: "custom-name.txt",
  mimeType: "text/plain",
  encrypt: true,
  metadata: { version: "1.0" },
  onProgress: (progress) => console.log(progress),
});
```

### Download Configuration

```typescript
await sdk.downloadFile("QmHash...", "./output.txt", {
  expectedSize: 1024 * 1024, // 1MB for better progress tracking
  onProgress: (progress) => updateUI(progress),
});
```

## Monitoring Configuration

### Error Metrics

```typescript
// Check metrics periodically
setInterval(() => {
  const metrics = sdk.getErrorMetrics();

  if (metrics.totalErrors > 100) {
    console.warn("High error rate detected");
  }

  if (metrics.retryAttempts / metrics.totalErrors > 2) {
    console.warn("Many operations requiring retries");
  }
}, 60000); // Check every minute
```

### Circuit Breaker Monitoring

```typescript
sdk.on("circuit:open", (event) => {
  // Alert monitoring system
  sendAlert(`Circuit breaker opened for ${event.operationName}`);
});

sdk.on("circuit:closed", (event) => {
  // Clear alerts
  clearAlert(`Circuit breaker closed for ${event.operationName}`);
});
```

## Performance Tuning

### For Large Files

```typescript
const sdk = new LighthouseAISDK({
  apiKey: process.env.LIGHTHOUSE_API_KEY,
  timeout: 300000, // 5 minute timeout
  maxRetries: 2, // Fewer retries for large operations
});
```

### For High Frequency Operations

```typescript
const sdk = new LighthouseAISDK({
  apiKey: process.env.LIGHTHOUSE_API_KEY,
  timeout: 15000, // Shorter timeout
  maxRetries: 1, // Quick failure for high throughput
});
```

### For Critical Operations

```typescript
const sdk = new LighthouseAISDK({
  apiKey: process.env.LIGHTHOUSE_API_KEY,
  timeout: 120000, // Long timeout
  maxRetries: 10, // Many retries for critical data
});
```
