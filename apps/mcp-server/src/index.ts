/**
 * Lighthouse MCP Server - Entry Point
 */

import { LighthouseMCPServer } from './server.js';
import { ServerConfig } from './config/server-config.js';

// Export main server class
export { LighthouseMCPServer } from './server.js';
export { ToolRegistry } from './registry/ToolRegistry.js';
export { MockLighthouseService } from './services/MockLighthouseService.js';
export { MockDatasetService } from './services/MockDatasetService.js';
export * from './registry/types.js';
export * from './config/server-config.js';

/**
 * Main entry point when run as a script
 */
async function main() {
  try {
    // Parse command line arguments
    const args = process.argv.slice(2);
    const config: Partial<ServerConfig> = {};

    // Parse arguments
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      switch (arg) {
        case '--log-level':
          i++;
          if (args[i]) config.logLevel = args[i] as any;
          break;
        case '--max-storage':
          i++;
          if (args[i] !== undefined) config.maxStorageSize = parseInt(args[i]!, 10);
          break;
        case '--name':
          i++;
          if (args[i]) config.name = args[i];
          break;
        case '--version':
          i++;
          if (args[i]) config.version = args[i];
          break;
        case '--help':
          console.log(`
Lighthouse MCP Server

Usage: node dist/index.js [options]

Options:
  --log-level <level>    Set log level (debug, info, warn, error) [default: info]
  --max-storage <bytes>  Set maximum storage size in bytes [default: 1073741824]
  --name <name>         Set server name [default: lighthouse-storage]
  --version <version>    Set server version [default: 0.1.0]
  --help                Show this help message

Examples:
  node dist/index.js --log-level debug
  node dist/index.js --max-storage 2147483648 --log-level info
          `);
          process.exit(0);
          break;
      }
    }

    // Create and start server
    const server = new LighthouseMCPServer(config);
    await server.start();

    // Handle graceful shutdown
    const shutdown = async () => {
      console.log('\nShutting down server...');
      try {
        await server.stop();
        process.exit(0);
      } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run main function if this is the entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}

