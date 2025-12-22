/**
 * Lighthouse MCP Server - Main server implementation
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { Logger } from "@lighthouse-tooling/shared";

import { ToolRegistry } from "./registry/ToolRegistry.js";
import { LighthouseService } from "./services/LighthouseService.js";
import { ILighthouseService } from "./services/ILighthouseService.js";
import { MockDatasetService } from "./services/MockDatasetService.js";
import {
  LighthouseUploadFileTool,
  LighthouseFetchFileTool,
  LighthouseCreateDatasetTool,
  LighthouseListDatasetsTool,
  LighthouseGetDatasetTool,
  LighthouseUpdateDatasetTool,
  LighthouseGenerateKeyTool,
  LighthouseSetupAccessControlTool,
} from "./tools/index.js";
import { ServerConfig, DEFAULT_SERVER_CONFIG } from "./config/server-config.js";
import { AuthManager } from "./auth/AuthManager.js";
import { LighthouseServiceFactory } from "./auth/LighthouseServiceFactory.js";
import { RequestContext } from "./auth/RequestContext.js";
import { AuthenticationError } from "./errors/AuthenticationError.js";

export class LighthouseMCPServer {
  private server: Server;
  private registry: ToolRegistry;
  private lighthouseService: ILighthouseService;
  private datasetService: MockDatasetService;
  private logger: Logger;
  private config: ServerConfig;

  // Authentication components
  private authManager: AuthManager;
  private serviceFactory: LighthouseServiceFactory;

  constructor(
    config: Partial<ServerConfig> = {},
    services?: {
      lighthouseService?: ILighthouseService;
      datasetService?: MockDatasetService;
    },
  ) {
    this.config = { ...DEFAULT_SERVER_CONFIG, ...config };

    // Initialize logger
    this.logger = Logger.getInstance({
      level: this.config.logLevel,
      component: "LighthouseMCPServer",
    });

    // Initialize server
    this.server = new Server(
      {
        name: this.config.name,
        version: this.config.version,
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      },
    );

    // Initialize authentication components
    if (!this.config.authentication) {
      throw new Error("Authentication configuration is required");
    }
    this.authManager = new AuthManager(this.config.authentication);
    this.serviceFactory = new LighthouseServiceFactory(
      this.config.performance || {
        servicePoolSize: 50,
        serviceTimeoutMinutes: 30,
        concurrentRequestLimit: 100,
      },
    );

    // Initialize services
    if (services?.lighthouseService) {
      this.lighthouseService = services.lighthouseService;
    } else {
      // For backward compatibility, still support direct API key configuration
      if (!this.config.lighthouseApiKey && !this.config.authentication?.defaultApiKey) {
        throw new Error(
          "LIGHTHOUSE_API_KEY environment variable or authentication.defaultApiKey is required",
        );
      }
      const apiKey = this.config.lighthouseApiKey || this.config.authentication?.defaultApiKey;
      if (apiKey) {
        this.lighthouseService = new LighthouseService(apiKey, this.logger);
      } else {
        // Create a placeholder service - actual services will be created per-request
        this.lighthouseService = new LighthouseService("placeholder", this.logger);
      }
    }

    if (services?.datasetService) {
      this.datasetService = services.datasetService;
    } else {
      this.datasetService = new MockDatasetService(this.lighthouseService, this.logger);
    }

    // Initialize registry
    this.registry = new ToolRegistry(this.logger);

    this.logger.info("Lighthouse MCP Server created", {
      name: this.config.name,
      version: this.config.version,
    });
  }

  /**
   * Handle CallTool requests with authentication
   */
  private async handleCallTool(request: {
    params: { name: string; arguments: Record<string, unknown> };
  }): Promise<{
    content: Array<{
      type: "text";
      text: string;
    }>;
  }> {
    const { name, arguments: args } = request.params;
    const startTime = Date.now();

    try {
      this.logger.debug("Processing tool call", {
        tool: name,
        hasApiKey: !!args?.apiKey,
        argCount: Object.keys(args || {}).length,
      });

      // Extract API key from request parameters
      const requestApiKey = args?.apiKey as string | undefined;

      // Authenticate the request
      const authResult = await this.authManager.authenticate(requestApiKey);

      if (!authResult.success) {
        this.logger.warn("Authentication failed", {
          tool: name,
          keyHash: authResult.keyHash,
          usedFallback: authResult.usedFallback,
          rateLimited: authResult.rateLimited,
          authTime: authResult.authTime,
        });

        // Throw appropriate authentication error
        if (authResult.rateLimited) {
          throw AuthenticationError.rateLimited(authResult.keyHash, 60);
        } else if (authResult.errorMessage?.includes("required")) {
          throw AuthenticationError.missingApiKey();
        } else {
          throw AuthenticationError.invalidApiKey(authResult.keyHash);
        }
      }

      // Get effective API key for service creation
      const effectiveApiKey = await this.authManager.getEffectiveApiKey(requestApiKey);

      // Get service instance for this API key
      const service = await this.serviceFactory.getService(effectiveApiKey);

      // Create request context
      const context = new RequestContext({
        apiKey: effectiveApiKey,
        keyHash: authResult.keyHash,
        service,
        toolName: name,
      });

      this.logger.info("Authentication successful", {
        ...context.toLogContext(),
        usedFallback: authResult.usedFallback,
        authTime: authResult.authTime,
      });

      // Route to appropriate tool handler with context
      const result = await this.routeToolCall(name, args, context);

      const totalTime = Date.now() - startTime;
      this.logger.info("Tool call completed", {
        ...context.toLogContext(),
        totalTime,
      });

      return result;
    } catch (error) {
      const totalTime = Date.now() - startTime;

      // Log error without exposing API key
      const sanitizedKey = args?.apiKey
        ? this.authManager.sanitizeApiKey(args.apiKey as string)
        : "none";
      this.logger.error("Tool call failed", error as Error, {
        tool: name,
        sanitizedApiKey: sanitizedKey,
        totalTime,
      });

      // Re-throw authentication errors as-is
      if (error instanceof AuthenticationError) {
        throw error;
      }

      // Wrap other errors
      throw new Error(
        `Tool execution failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Route tool call to appropriate handler with request context
   */
  private async routeToolCall(
    toolName: string,
    params: Record<string, unknown>,
    context: RequestContext,
  ): Promise<{
    content: Array<{
      type: "text";
      text: string;
    }>;
  }> {
    // Remove apiKey from params before passing to tool
    const { apiKey: _apiKey, ...toolParams } = params;

    // Execute tool with context-aware service
    const result = await this.registry.executeToolWithContext(toolName, toolParams, context);

    if (!result.success) {
      throw new Error(result.error || "Tool execution failed");
    }

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(result.data, null, 2),
        },
      ],
    };
  }

  /**
   * Register all tools
   * Made public for testing purposes
   */
  async registerTools(): Promise<void> {
    const startTime = Date.now();
    this.logger.info("Registering tools...");

    // Create tool instances with service dependencies
    const uploadFileTool = new LighthouseUploadFileTool(this.lighthouseService, this.logger);
    const fetchFileTool = new LighthouseFetchFileTool(this.lighthouseService, this.logger);
    const createDatasetTool = new LighthouseCreateDatasetTool(this.lighthouseService, this.logger);
    const listDatasetsTool = new LighthouseListDatasetsTool(this.lighthouseService, this.logger);
    const getDatasetTool = new LighthouseGetDatasetTool(this.lighthouseService, this.logger);
    const updateDatasetTool = new LighthouseUpdateDatasetTool(this.lighthouseService, this.logger);
    const generateKeyTool = new LighthouseGenerateKeyTool(this.lighthouseService, this.logger);
    const setupAccessControlTool = new LighthouseSetupAccessControlTool(
      this.lighthouseService,
      this.logger,
    );

    // Register file operation tools
    this.registry.register(
      LighthouseUploadFileTool.getDefinition(),
      async (args) => await uploadFileTool.execute(args),
    );

    this.registry.register(
      LighthouseFetchFileTool.getDefinition(),
      async (args) => await fetchFileTool.execute(args),
    );

    // Register dataset management tools
    this.registry.register(
      LighthouseCreateDatasetTool.getDefinition(),
      async (args) => await createDatasetTool.execute(args),
    );

    this.registry.register(
      LighthouseListDatasetsTool.getDefinition(),
      async (args) => await listDatasetsTool.execute(args),
    );

    this.registry.register(
      LighthouseGetDatasetTool.getDefinition(),
      async (args) => await getDatasetTool.execute(args),
    );

    this.registry.register(
      LighthouseUpdateDatasetTool.getDefinition(),
      async (args) => await updateDatasetTool.execute(args),
    );

    // Register encryption tools
    this.registry.register(
      LighthouseGenerateKeyTool.getDefinition(),
      async (args) => await generateKeyTool.execute(args),
    );

    this.registry.register(
      LighthouseSetupAccessControlTool.getDefinition(),
      async (args) => await setupAccessControlTool.execute(args),
    );

    const registeredTools = this.registry.listTools();
    const registrationTime = Date.now() - startTime;

    this.logger.info("All tools registered", {
      toolCount: registeredTools.length,
      toolNames: registeredTools.map((t) => t.name),
      registrationTime,
    });

    // Check if registration time exceeds threshold
    if (registrationTime > 100) {
      this.logger.warn("Tool registration exceeded 100ms threshold", {
        registrationTime,
      });
    }
  }

  /**
   * Setup request handlers
   */
  private setupHandlers(): void {
    this.logger.info("Setting up request handlers...");

    // Handle ListTools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = this.registry.listTools();
      return { tools };
    });

    // Handle CallTool with authentication
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      return await this.handleCallTool({
        params: {
          name: request.params.name,
          arguments: request.params.arguments || {},
        },
      });
    });

    // Handle ListResources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      const files = await this.lighthouseService.listFiles();

      // Get datasets from LighthouseService (where they're actually stored)
      let datasets: any[] = [];
      try {
        const datasetsResponse = await this.lighthouseService.listDatasets({
          limit: 100,
          offset: 0,
        });
        datasets = datasetsResponse.datasets || [];
      } catch (error) {
        // Fallback to MockDatasetService if LighthouseService fails
        this.logger.debug(
          "Failed to get datasets from LighthouseService, using MockDatasetService",
          error as Error,
        );
        datasets = this.datasetService.listDatasets();
      }

      const resources = [
        ...files.map((file) => ({
          uri: `lighthouse://file/${file.cid}`,
          name: file.filePath,
          description: `Uploaded file: ${file.filePath}`,
          mimeType: "application/octet-stream",
        })),
        ...datasets.map((dataset) => ({
          uri: `lighthouse://dataset/${dataset.id}`,
          name: dataset.name,
          description: dataset.description || `Dataset: ${dataset.name}`,
          mimeType: "application/json",
        })),
      ];

      return { resources };
    });

    // Handle ReadResource
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const uri = request.params.uri;
      this.logger.info("Reading resource", { uri });

      try {
        // Parse URI: lighthouse://dataset/{id} or lighthouse://file/{cid}
        if (uri.startsWith("lighthouse://dataset/")) {
          const datasetId = uri.replace("lighthouse://dataset/", "");
          const dataset = await this.lighthouseService.getDataset(datasetId);

          if (!dataset) {
            throw new Error(`Dataset not found: ${datasetId}`);
          }

          // Clean and serialize dataset with proper handling
          const cleanedDataset: Record<string, any> = {
            id: String(dataset.id || ""),
            name: String(dataset.name || ""),
            description: String(dataset.description || ""),
            files: (dataset.files || []).map((file: any) => {
              const cleanedFile: Record<string, any> = {
                cid: String(file.cid || ""),
                size: Number(file.size || 0),
                encrypted: Boolean(file.encrypted),
                uploadedAt:
                  file.uploadedAt instanceof Date
                    ? file.uploadedAt.toISOString()
                    : String(file.uploadedAt || ""),
              };
              if (file.hash) {
                cleanedFile.hash = String(file.hash);
              }
              return cleanedFile;
            }),
            metadata: dataset.metadata || {},
            version: String(dataset.version || "1.0.0"),
            createdAt:
              dataset.createdAt instanceof Date
                ? dataset.createdAt.toISOString()
                : String(dataset.createdAt || ""),
            updatedAt:
              dataset.updatedAt instanceof Date
                ? dataset.updatedAt.toISOString()
                : String(dataset.updatedAt || ""),
            encrypted: Boolean(dataset.encrypted),
          };

          // Only add accessConditions if it exists and is not empty
          if (
            dataset.accessConditions &&
            Array.isArray(dataset.accessConditions) &&
            dataset.accessConditions.length > 0
          ) {
            cleanedDataset.accessConditions = dataset.accessConditions;
          }

          // Serialize with error handling
          let serializedDataset: string;
          try {
            serializedDataset = JSON.stringify(cleanedDataset, null, 2);
          } catch (error) {
            this.logger.error("Failed to serialize dataset", error as Error, { datasetId });
            throw new Error(
              `Failed to serialize dataset: ${error instanceof Error ? error.message : "Unknown error"}`,
            );
          }

          return {
            contents: [
              {
                uri,
                mimeType: "application/json",
                text: serializedDataset,
              },
            ],
          };
        } else if (uri.startsWith("lighthouse://file/")) {
          const cid = uri.replace("lighthouse://file/", "");
          const file = await this.lighthouseService.getFileInfo(cid);

          if (!file) {
            throw new Error(`File not found: ${cid}`);
          }

          // Clean and serialize file with proper handling
          const cleanedFile: Record<string, any> = {
            cid: String(file.cid || ""),
            filePath: String(file.filePath || ""),
            size: Number(file.size || 0),
            encrypted: Boolean(file.encrypted),
            uploadedAt:
              file.uploadedAt instanceof Date
                ? file.uploadedAt.toISOString()
                : String(file.uploadedAt || ""),
            pinned: Boolean(file.pinned),
          };

          // Only add hash if it exists
          if (file.hash) {
            cleanedFile.hash = String(file.hash);
          }

          // Serialize with error handling
          let serializedFile: string;
          try {
            serializedFile = JSON.stringify(cleanedFile, null, 2);
          } catch (error) {
            this.logger.error("Failed to serialize file", error as Error, { cid });
            throw new Error(
              `Failed to serialize file: ${error instanceof Error ? error.message : "Unknown error"}`,
            );
          }

          return {
            contents: [
              {
                uri,
                mimeType: "application/json",
                text: serializedFile,
              },
            ],
          };
        } else {
          throw new Error(`Unknown resource URI format: ${uri}`);
        }
      } catch (error) {
        this.logger.error("Failed to read resource", error as Error, { uri });
        throw error;
      }
    });

    this.logger.info("Request handlers setup complete");
  }

  /**
   * Start the MCP server
   */
  async start(): Promise<void> {
    const startTime = Date.now();

    try {
      this.logger.info("Starting Lighthouse MCP Server...", {
        name: this.config.name,
        version: this.config.version,
      });

      // Initialize Lighthouse service
      if (this.lighthouseService.initialize) {
        await this.lighthouseService.initialize();
      }

      // Register tools
      await this.registerTools();

      // Setup handlers
      this.setupHandlers();

      // Start metrics collection if enabled
      if (this.config.enableMetrics) {
        this.startMetricsCollection();
      }

      // Connect to stdio transport
      const transport = new StdioServerTransport();
      await this.server.connect(transport);

      const startupTime = Date.now() - startTime;
      this.logger.info("Lighthouse MCP Server started successfully", {
        startupTime,
        toolCount: this.registry.listTools().length,
      });

      // Check if startup time exceeds threshold
      if (startupTime > 2000) {
        this.logger.warn("Server startup exceeded 2s threshold", {
          startupTime,
        });
      }
    } catch (error) {
      this.logger.error("Failed to start server", error as Error);
      throw error;
    }
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    setInterval(() => {
      const registryMetrics = this.registry.getMetrics();
      const storageStats = this.lighthouseService.getStorageStats();
      const datasetStats = this.datasetService.getAllStats();

      this.logger.info("Server metrics", {
        registry: registryMetrics,
        storage: storageStats,
        datasets: datasetStats,
      });
    }, this.config.metricsInterval);

    this.logger.info("Metrics collection started", {
      interval: this.config.metricsInterval,
    });
  }

  /**
   * Stop the server
   */
  async stop(): Promise<void> {
    try {
      this.logger.info("Stopping server...");

      // Cleanup authentication resources
      if (this.authManager) {
        this.authManager.destroy();
      }

      // Cleanup service factory
      if (this.serviceFactory) {
        this.serviceFactory.destroy();
      }

      await this.server.close();
      this.logger.info("Server stopped successfully");
    } catch (error) {
      this.logger.error("Error stopping server", error as Error);
      throw error;
    }
  }

  /**
   * Get server statistics
   */
  getStats(): {
    registry: any;
    storage: any;
    datasets: unknown;
  } {
    return {
      registry: this.registry.getMetrics(),
      storage: this.lighthouseService.getStorageStats(),
      datasets: this.datasetService.getAllStats(),
    };
  }

  /**
   * Get registry instance (for testing)
   */
  getRegistry(): ToolRegistry {
    return this.registry;
  }

  /**
   * Get lighthouse service instance (for testing)
   */
  getLighthouseService(): ILighthouseService {
    return this.lighthouseService;
  }

  /**
   * Get dataset service instance (for testing)
   */
  getDatasetService(): MockDatasetService {
    return this.datasetService;
  }

  /**
   * Get authentication manager instance (for testing)
   */
  getAuthManager(): AuthManager {
    return this.authManager;
  }

  /**
   * Get service factory instance (for testing)
   */
  getServiceFactory(): LighthouseServiceFactory {
    return this.serviceFactory;
  }

  /**
   * Get authentication statistics
   */
  getAuthStats(): {
    cache: any;
    servicePool: unknown;
  } {
    return {
      cache: this.authManager.getCacheStats(),
      servicePool: this.serviceFactory.getStats(),
    };
  }

  /**
   * Invalidate cached API key validation
   */
  invalidateApiKey(apiKey: string): void {
    this.authManager.invalidateKey(apiKey);
    this.serviceFactory.removeService(apiKey);
  }
}
