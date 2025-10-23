#!/usr/bin/env node

/**
 * Test script to run MCP server with mock services
 */

import { LighthouseMCPServer } from "./dist/server.js";
import { MockLighthouseService } from "./dist/services/MockLighthouseService.js";
import { MockDatasetService } from "./dist/services/MockDatasetService.js";

async function main() {
  try {
    console.log("Starting MCP server with mock services...");

    // Create mock services
    const mockLighthouseService = new MockLighthouseService();
    const mockDatasetService = new MockDatasetService(mockLighthouseService);

    // Create server with mock services
    const server = new LighthouseMCPServer(
      {
        name: "lighthouse-storage-mock",
        version: "0.1.0",
        logLevel: "info",
      },
      {
        lighthouseService: mockLighthouseService,
        datasetService: mockDatasetService,
      },
    );

    await server.start();

    console.log("MCP server started successfully with mock services!");

    // Handle graceful shutdown
    const shutdown = async () => {
      console.log("\nShutting down server...");
      try {
        await server.stop();
        process.exit(0);
      } catch (error) {
        console.error("Error during shutdown:", error);
        process.exit(1);
      }
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
