# Lighthouse MCP Server

A Model Context Protocol (MCP) server implementation that bridges AI agents with Lighthouse decentralized storage. This server provides AI-accessible tools for file storage, dataset management, and IPFS operations through a standardized protocol.

## 🎯 Features

- **MCP Protocol Compliance**: Full implementation of MCP specification
- **Mock Lighthouse Operations**: Realistic file upload, download, and pinning simulations
- **Dataset Management**: Create and manage file collections with metadata
- **Tool Registry**: Dynamic tool registration and discovery system
- **Request Validation**: Comprehensive input validation and sanitization
- **Structured Logging**: Detailed operation logging for debugging and monitoring
- **Performance Optimized**: Meets strict performance requirements (<2s startup, <500ms operations)

## 📦 Installation

```bash
# Install dependencies
pnpm install

# Build the server
pnpm run build

# Run tests
pnpm test

# Run tests with coverage
pnpm run test:coverage
```

## 🚀 Quick Start

### Running the Server

```bash
# Start with default configuration
node dist/index.js

# Start with custom log level
node dist/index.js --log-level debug

# Start with custom storage limit
node dist/index.js --max-storage 2147483648

# View help
node dist/index.js --help
```

### Programmatic Usage

```typescript
import { LighthouseMCPServer } from '@lighthouse-tooling/mcp-server';

// Create server instance
const server = new LighthouseMCPServer({
  name: 'lighthouse-storage',
  version: '0.1.0',
  logLevel: 'info',
  maxStorageSize: 1024 * 1024 * 1024, // 1GB
  enableMetrics: true,
});

// Start the server
await server.start();

// Get server statistics
const stats = server.getStats();
console.log('Server stats:', stats);

// Graceful shutdown
await server.stop();
```

## 🛠️ Available MCP Tools

### 1. lighthouse_upload_file

Upload a file to IPFS via Lighthouse with optional encryption.

**Parameters:**
- `filePath` (required): Path to the file to upload
- `encrypt` (optional): Whether to encrypt the file
- `accessConditions` (optional): Access control conditions
- `tags` (optional): Tags for organization

**Example:**
```json
{
  "filePath": "/path/to/file.txt",
  "encrypt": true,
  "tags": ["dataset", "ml-model"]
}
```

### 2. lighthouse_create_dataset

Create a managed dataset collection with metadata.

**Parameters:**
- `name` (required): Dataset name
- `description` (optional): Dataset description
- `files` (required): Array of file paths to include
- `metadata` (optional): Additional metadata
- `encrypt` (optional): Whether to encrypt the dataset

**Example:**
```json
{
  "name": "Training Dataset",
  "description": "ML training data",
  "files": ["/data/train.csv", "/data/validate.csv"],
  "metadata": {
    "author": "Data Team",
    "version": "1.0.0"
  }
}
```

### 3. lighthouse_fetch_file

Download and optionally decrypt a file from Lighthouse.

**Parameters:**
- `cid` (required): IPFS CID of the file
- `outputPath` (optional): Local path to save the file
- `decrypt` (optional): Whether to decrypt the file

**Example:**
```json
{
  "cid": "QmYwAPJzv5CZsnA...",
  "outputPath": "/local/path/file.txt",
  "decrypt": true
}
```

## 🏗️ Architecture

```
LighthouseMCPServer
├── ToolRegistry          # Tool management and execution
├── MockLighthouseService # File operations (upload, fetch, pin)
├── MockDatasetService    # Dataset management
├── Handlers
│   ├── ListToolsHandler      # Handle tools/list
│   ├── CallToolHandler       # Handle tools/call
│   ├── ListResourcesHandler  # Handle resources/list
│   └── InitializeHandler     # Handle initialize
└── Utilities
    ├── RequestValidator  # Input validation
    ├── ResponseBuilder   # Response formatting
    └── CIDGenerator      # Mock CID generation
```

## 📊 Performance Metrics

The server meets the following performance requirements:

- **Server Startup**: < 2 seconds
- **Tool Registration**: < 100ms per tool
- **Mock Operations**: < 500ms per operation
- **Memory Usage**: < 50MB

## 🧪 Testing

```bash
# Run all tests
pnpm test

# Run with coverage
pnpm run test:coverage

# Run in watch mode
pnpm run test:watch
```

### Test Coverage

The test suite includes:
- **Unit Tests**: Individual component testing
- **Integration Tests**: End-to-end workflow testing
- **Performance Tests**: Metric validation

Target: **>90% code coverage** ✅

## 📝 Configuration

### Server Config Options

```typescript
interface ServerConfig {
  name: string;              // Server name
  version: string;           // Server version
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  maxStorageSize: number;    // Max storage in bytes
  enableMetrics: boolean;    // Enable metrics collection
  metricsInterval: number;   // Metrics collection interval (ms)
}
```

### Environment Variables

```bash
# Log level
LOG_LEVEL=info

# Maximum storage size (bytes)
MAX_STORAGE_SIZE=1073741824

# Enable metrics
ENABLE_METRICS=true
```

## 🔍 Logging

The server uses structured logging with different log levels:

```typescript
// Log levels: debug, info, warn, error
logger.info('Operation started', { operationId: '123' });
logger.error('Operation failed', error, { context: {...} });
```

## 🤝 Integration with AI Agents

The server follows the MCP specification, making it compatible with:

- **Cursor AI**: Direct integration via MCP
- **Claude Desktop**: MCP server connection
- **Custom AI Agents**: Any MCP-compliant client

### Example Client Configuration

```json
{
  "mcpServers": {
    "lighthouse-storage": {
      "command": "node",
      "args": ["/path/to/lighthouse-mcp-server/dist/index.js"],
      "env": {
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

## 🛡️ Error Handling

The server implements comprehensive error handling:

- **Validation Errors**: Input parameter validation
- **Not Found Errors**: Missing files or datasets
- **Operation Errors**: Failed uploads or downloads
- **System Errors**: Resource exhaustion

All errors follow MCP error code standards.

## 📚 API Documentation

### Tool Registry API

```typescript
// Register a tool
registry.register(toolDefinition, executor);

// Execute a tool
const result = await registry.executeTool(toolName, args);

// List all tools
const tools = registry.listTools();

// Get metrics
const metrics = registry.getMetrics();
```

### Mock Service API

```typescript
// Upload file
const result = await lighthouseService.uploadFile({
  filePath: '/path/to/file',
  encrypt: true
});

// Fetch file
const file = await lighthouseService.fetchFile({
  cid: 'QmYwAPJzv5CZsnA...'
});

// Get storage stats
const stats = lighthouseService.getStorageStats();
```

## 🔮 Future Enhancements

- [ ] Integration with real Lighthouse SDK (Issue #11)
- [ ] WebSocket support for real-time updates
- [ ] Caching layer for improved performance
- [ ] Batch operation support
- [ ] Advanced access control management

## 📄 License

MIT License - see LICENSE file for details

## 🤝 Contributing

Contributions are welcome! Please read CONTRIBUTING.md for guidelines.

## 📞 Support

For issues and questions:
- GitHub Issues: [lighthouse-agent-tooling/issues](https://github.com/Patrick-Ehimen/lighthouse-agent-tooling/issues)
- Documentation: See `/apps/docs/TECHNICAL_PROPOSAL.md`

---

**Built with ❤️ for the Lighthouse ecosystem**

