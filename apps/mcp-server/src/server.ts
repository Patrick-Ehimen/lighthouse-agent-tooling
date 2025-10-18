/**
 * Lighthouse MCP Server - Main server implementation
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { Logger } from "@lighthouse-tooling/shared";
import { LIGHTHOUSE_MCP_TOOLS } from "@lighthouse-tooling/types";

import { ToolRegistry } from "./registry/ToolRegistry.js";
import { LighthouseService } from "./services/LighthouseService.js";
import { ILighthouseService } from "./services/ILighthouseService.js";
import { MockDatasetService } from "./services/MockDatasetService.js";
import { LighthouseUploadFileTool, LighthouseFetchFileTool } from "./tools/index.js";
import {
  ListToolsHandler,
  CallToolHandler,
  ListResourcesHandler,
  InitializeHandler,
} from "./handlers/index.js";
import { ServerConfig, DEFAULT_SERVER_CONFIG } from "./config/server-config.js";

export class LighthouseMCPServer {
  private server: Server;
  private registry: ToolRegistry;
  private lighthouseService: ILighthouseService;
  private datasetService: MockDatasetService;
  private logger: Logger;
  private config: ServerConfig;

  // Handlers
  private listToolsHandler: ListToolsHandler;
  private callToolHandler: CallToolHandler;
  private listResourcesHandler: ListResourcesHandler;
  private initializeHandler: InitializeHandler;

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

    // Initialize services
    if (services?.lighthouseService) {
      this.lighthouseService = services.lighthouseService;
    } else {
      if (!this.config.lighthouseApiKey) {
        throw new Error("LIGHTHOUSE_API_KEY environment variable is required");
      }
      this.lighthouseService = new LighthouseService(this.config.lighthouseApiKey, this.logger);
    }

    if (services?.datasetService) {
      this.datasetService = services.datasetService;
    } else {
      this.datasetService = new MockDatasetService(this.lighthouseService, this.logger);
    }

    // Initialize registry
    this.registry = new ToolRegistry(this.logger);

    // Initialize handlers
    this.listToolsHandler = new ListToolsHandler(this.registry, this.logger);
    this.callToolHandler = new CallToolHandler(this.registry, this.logger);
    this.listResourcesHandler = new ListResourcesHandler(
      this.lighthouseService,
      this.datasetService,
      this.logger,
    );
    this.initializeHandler = new InitializeHandler(
      {
        name: this.config.name,
        version: this.config.version,
      },
      this.logger,
    );

    this.logger.info("Lighthouse MCP Server created", {
      name: this.config.name,
      version: this.config.version,
    });
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

    // Register lighthouse_upload_file tool
    this.registry.register(
      LighthouseUploadFileTool.getDefinition(),
      async (args) => await uploadFileTool.execute(args),
    );

    // Register lighthouse_fetch_file tool
    this.registry.register(
      LighthouseFetchFileTool.getDefinition(),
      async (args) => await fetchFileTool.execute(args),
    );

    // Register lighthouse_create_dataset tool (keeping existing implementation)
    const datasetTool = LIGHTHOUSE_MCP_TOOLS.find((t) => t.name === "lighthouse_create_dataset");
    if (datasetTool) {
      this.registry.register(datasetTool, async (args) => {
        const result = await this.datasetService.createDataset({
          name: args.name as string,
          description: args.description as string | undefined,
          files: args.files as string[],
          metadata: args.metadata as Record<string, unknown> | undefined,
          encrypt: args.encrypt as boolean | undefined,
        });

        return {
          success: true,
          data: result,
          executionTime: 0,
        };
      });
    }

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

    // Handle CallTool
    this.server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
      const { name, arguments: args } = request.params;
      const result = await this.registry.executeTool(name, (args as Record<string, unknown>) || {});

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
    });

    // Handle ListResources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      const files = await this.lighthouseService.listFiles();
      const datasets = this.datasetService.listDatasets();

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
}
