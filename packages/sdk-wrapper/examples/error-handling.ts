/**
 * Example demonstrating comprehensive error handling capabilities
 */

import {
  LighthouseAISDK,
  NetworkError,
  AuthenticationError,
  RateLimitError,
  TimeoutError,
  ValidationError,
} from "../src";

async function demonstrateErrorHandling() {
  const sdk = new LighthouseAISDK({
    apiKey: "demo-api-key",
    maxRetries: 3,
    timeout: 30000,
  });

  // Listen to error handling events
  sdk.on("retry", (event) => {
    console.log(`🔄 Retry attempt ${event.attempt} for ${event.context}: ${event.error.message}`);
  });

  sdk.on("circuit:open", (event) => {
    console.log(`⚡ Circuit breaker opened for ${event.operationName}`);
  });

  sdk.on("circuit:closed", (event) => {
    console.log(`✅ Circuit breaker closed for ${event.operationName}`);
  });

  try {
    // This will demonstrate error classification and retry logic
    await sdk.initialize();

    const fileInfo = await sdk.uploadFile("./non-existent-file.txt", {
      fileName: "test-file.txt",
      onProgress: (progress) => {
        console.log(`📤 Upload progress: ${progress.percentage}%`);
      },
    });

    console.log("✅ File uploaded successfully:", fileInfo.hash);
  } catch (error) {
    // Demonstrate intelligent error handling
    if (error instanceof NetworkError) {
      console.error("🌐 Network error (automatically retried):", error.message);
      console.log("💡 Check your internet connection");
    } else if (error instanceof AuthenticationError) {
      console.error("🔐 Authentication error:", error.message);
      console.log("💡 Please check your API key");
    } else if (error instanceof RateLimitError) {
      console.error("⏱️ Rate limit exceeded:", error.message);
      if (error.retryAfter) {
        console.log(`💡 Retry after ${error.retryAfter}ms`);
      }
    } else if (error instanceof TimeoutError) {
      console.error("⏰ Operation timed out:", error.message);
      console.log("💡 Try increasing the timeout or check network conditions");
    } else if (error instanceof ValidationError) {
      console.error("❌ Validation error:", error.message);
      console.log("💡 Please check your input parameters");
    } else {
      console.error("❓ Unknown error:", error.message);
    }

    // Display error metrics
    const metrics = sdk.getErrorMetrics();
    console.log("\n📊 Error Metrics:");
    console.log(`Total errors: ${metrics.totalErrors}`);
    console.log(`Retry attempts: ${metrics.retryAttempts}`);
    console.log(`Successful retries: ${metrics.successfulRetries}`);
    console.log("Errors by type:", metrics.errorsByType);

    // Display circuit breaker status
    const circuitStatus = sdk.getCircuitBreakerStatus();
    console.log("\n⚡ Circuit Breaker Status:");
    console.log(`State: ${circuitStatus.state}`);
    console.log(`Failure count: ${circuitStatus.failureCount}`);
  } finally {
    sdk.destroy();
  }
}

// Run the example
if (require.main === module) {
  demonstrateErrorHandling().catch(console.error);
}

export { demonstrateErrorHandling };
