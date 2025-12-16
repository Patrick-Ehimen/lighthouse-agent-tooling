# Performance Features

This package includes comprehensive performance optimizations for the Lighthouse SDK.

## Quick Start

```typescript
import {
  LighthouseAISDK,
  CacheManager,
  BatchProcessor,
  MemoryManager,
} from "@lighthouse-tooling/sdk-wrapper";

// Create SDK with caching
const cache = new CacheManager();
const memory = new MemoryManager();

const sdk = new LighthouseAISDK({
  apiKey: process.env.LIGHTHOUSE_API_KEY,
});

// Use batch processor for multiple uploads
const uploadProcessor = new BatchProcessor(
  async (file) => {
    // Track memory
    memory.track(file.name, file.size);

    try {
      // Upload file
      const result = await sdk.uploadFile(file.path);

      // Cache metadata
      cache.setFileMetadata(result.hash, result);

      return result;
    } finally {
      memory.untrack(file.name);
    }
  },
  { concurrency: 5 },
);

// Upload multiple files
const files = [
  { id: "1", data: { path: "./file1.txt", name: "file1.txt", size: 1024 } },
  { id: "2", data: { path: "./file2.txt", name: "file2.txt", size: 2048 } },
];

const results = await uploadProcessor.addBatch(files);
```

## Features

- **LRU Cache**: Fast caching with automatic eviction
- **Connection Pool**: Reusable HTTP connections
- **Batch Processor**: Parallel processing with concurrency control
- **Memory Manager**: Memory tracking and backpressure handling

## Documentation

See [/docs/PERFORMANCE_OPTIMIZATIONS.md](../../docs/PERFORMANCE_OPTIMIZATIONS.md) for complete documentation.

## Performance Metrics

- **Cache**: > 99% hit rate for frequently accessed data
- **Batch Processing**: Up to 10x speedup with parallel processing
- **Memory**: Minimal overhead (< 1ms for tracking/untracking)

## Testing

Run performance benchmarks:

```bash
npm run test -- performance.bench.ts
```

Run unit tests:

```bash
npm test
```
