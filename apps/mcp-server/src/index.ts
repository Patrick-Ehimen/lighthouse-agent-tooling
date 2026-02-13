/**
 * Lighthouse MCP Server - Entry Point
 */

import { LighthouseMCPServer } from "./server.js";
import { ServerConfig } from "./config/server-config.js";
import { EnvLoader } from "./config/env-loader.js";

// Export main server class
export { LighthouseMCPServer } from "./server.js";
export { ToolRegistry } from "./registry/ToolRegistry.js";
export { LighthouseService } from "./services/LighthouseService.js";
export { MockDatasetService } from "./services/MockDatasetService.js";
export * from "./registry/types.js";
export * from "./config/server-config.js";
export { EnvLoader } from "./config/env-loader.js";
export { HealthCheckServer } from "./health/index.js";

/**
 * Main entry point when run as a script
 */
async function main() {
  try {
    // Load environment variables from .env file
    EnvLoader.load();

    // Start with environment configuration
    const config: Partial<ServerConfig> = EnvLoader.parseConfig();

    // Parse command line arguments (override env vars)
    const args = process.argv.slice(2);

    // Check for help first
    if (args.includes("--help")) {
      console.log(`
Lighthouse MCP Server

Usage: node dist/index.js [options]

Options:
  --log-level <level>    Set log level (debug, info, warn, error) [default: info]
  --max-storage <bytes>  Set maximum storage size in bytes [default: 1073741824]
  --name <name>          Set server name [default: lighthouse-storage]
  --version <version>    Set server version [default: 0.1.0]
  --api-key <key>        Set Lighthouse API key (or use LIGHTHOUSE_API_KEY env var)
  --health-port <port>   Enable health check server on given port [default: 8080]
  --env <path>           Path to .env file [default: .env]
  --show-config          Display current configuration and exit
  --help                 Show this help message

Environment Variables:
  SERVER_NAME            Server name
  SERVER_VERSION         Server version
  LOG_LEVEL              Logging level (debug, info, warn, error)
  MAX_STORAGE_SIZE       Maximum storage size in bytes
  ENABLE_METRICS         Enable metrics collection (true/false)
  METRICS_INTERVAL       Metrics collection interval in ms
  LIGHTHOUSE_API_KEY     Lighthouse API key
  HEALTH_CHECK_ENABLED   Enable health check server (true/false)
  HEALTH_CHECK_PORT      Health check server port [default: 8080]
  LIGHTHOUSE_API_URL     Lighthouse API URL for connectivity checks

Examples:
  node dist/index.js --log-level debug
  node dist/index.js --max-storage 2147483648 --log-level info
  node dist/index.js --api-key YOUR_API_KEY
  node dist/index.js --env /path/to/.env
  node dist/index.js --show-config
  LOG_LEVEL=debug node dist/index.js
      `);
      process.exit(0);
    }

    // Check for show-config before parsing all args
    if (args.includes("--show-config")) {
      EnvLoader.displayConfig(config);
      process.exit(0);
    }

    // Parse remaining arguments
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      switch (arg) {
        case "--log-level":
          i++;
          if (args[i]) config.logLevel = args[i] as any;
          break;
        case "--max-storage":
          i++;
          if (args[i] !== undefined) config.maxStorageSize = parseInt(args[i]!, 10);
          break;
        case "--name":
          i++;
          if (args[i]) config.name = args[i];
          break;
        case "--version":
          i++;
          if (args[i]) config.version = args[i];
          break;
        case "--api-key":
          i++;
          if (args[i]) config.lighthouseApiKey = args[i];
          break;
        case "--health-port":
          i++;
          if (args[i] !== undefined) {
            if (!config.healthCheck) {
              config.healthCheck = { enabled: true, port: 8080 };
            }
            config.healthCheck.port = parseInt(args[i]!, 10);
            config.healthCheck.enabled = true;
          }
          break;
        case "--env":
          i++;
          if (args[i]) {
            EnvLoader.load(args[i]);
            const envConfig = EnvLoader.parseConfig();
            Object.assign(config, envConfig);
          }
          break;
      }
    }

    // Display config if debug mode
    if (config.logLevel === "debug") {
      EnvLoader.displayConfig(config);
    }

    // Create and start server
    const server = new LighthouseMCPServer(config);
    await server.start();

    // Handle graceful shutdown
    const shutdown = async () => {
      // Use stderr to avoid corrupting MCP stdio protocol on stdout
      process.stderr.write("\nShutting down server...\n");
      try {
        await server.stop();
        process.exit(0);
      } catch (error) {
        process.stderr.write(`Error during shutdown: ${error}\n`);
        process.exit(1);
      }
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } catch (error) {
    // Use stderr to avoid corrupting MCP stdio protocol on stdout
    process.stderr.write(`Fatal error: ${error}\n`);
    process.exit(1);
  }
}

// Run main function if this is the entry point
// Handle URL encoding differences (spaces become %20 in import.meta.url)
const currentFileUrl = import.meta.url;
const expectedFileUrl = `file://${process.argv[1]}`;
const expectedFileUrlEncoded = `file://${encodeURI(process.argv[1] || "").replace(/%2F/g, "/")}`;

if (currentFileUrl === expectedFileUrl || currentFileUrl === expectedFileUrlEncoded) {
  main().catch((error) => {
    // Use stderr to avoid corrupting MCP stdio protocol on stdout
    process.stderr.write(`Failed to start server: ${error}\n`);
    process.exit(1);
  });
}
