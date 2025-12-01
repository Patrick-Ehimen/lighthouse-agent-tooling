/**
 * MCP Client for Cursor Extension
 * @fileoverview Client implementation for connecting to Lighthouse MCP Server
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { spawn, type ChildProcess } from "node:child_process";
import * as path from "node:path";
import * as fs from "node:fs";

export interface MCPClientConfig {
  /** Path to MCP server executable or command */
  serverPath?: string;
  /** API key for Lighthouse */
  apiKey?: string;
  /** Working directory for server process */
  cwd?: string;
  /** Environment variables for server process */
  env?: Record<string, string>;
  /** Auto-connect on initialization */
  autoConnect?: boolean;
}

export interface MCPToolCallResult {
  success: boolean;
  data?: unknown;
  error?: string;
  content?: Array<{ type: string; text: string }>;
}

/**
 * MCP Client for connecting to Lighthouse MCP Server
 */
export class MCPClient {
  private client: Client;
  private transport: StdioClientTransport | null = null;
  private serverProcess: ChildProcess | null = null;
  private config: MCPClientConfig;
  private isConnected = false;
  private isInitialized = false;
  private availableTools: Array<{ name: string; description: string; inputSchema: unknown }> = [];

  constructor(config: MCPClientConfig = {}) {
    this.config = {
      autoConnect: true,
      ...config,
    };

    // Initialize MCP client
    this.client = new Client(
      {
        name: "lighthouse-cursor-extension",
        version: "0.1.0",
      },
      {
        capabilities: {},
      },
    );
  }

  /**
   * Connect to MCP server
   */
  async connect(): Promise<void> {
    if (this.isConnected) {
      console.warn("Already connected to MCP server");
      return;
    }

    try {
      console.log("Connecting to MCP server...");

      // Determine server path
      const serverPath = this.getServerPath();

      // Create stdio transport
      this.transport = new StdioClientTransport({
        command: "node",
        args: [serverPath],
        env: {
          ...process.env,
          LIGHTHOUSE_API_KEY: this.config.apiKey || process.env.LIGHTHOUSE_API_KEY || "",
          ...this.config.env,
        },
      });

      // Connect client to transport (this also initializes)
      await this.client.connect(this.transport);

      this.isConnected = true;
      this.isInitialized = true;
      console.log("Connected to MCP server");

      // List available tools
      if (this.config.autoConnect) {
        await this.refreshTools();
      }
    } catch (error) {
      console.error("Failed to connect to MCP server:", error);
      this.isConnected = false;
      throw error;
    }
  }

  /**
   * Refresh list of available tools
   */
  async refreshTools(): Promise<void> {
    try {
      const result = await this.client.listTools();
      this.availableTools = (result.tools || []) as Array<{
        name: string;
        description: string;
        inputSchema: unknown;
      }>;
      console.log(`Refreshed available tools: ${this.availableTools.length} tools`);
    } catch (error) {
      console.error("Failed to refresh tools:", error);
      throw error;
    }
  }

  /**
   * Get list of available tools
   */
  getAvailableTools(): Array<{ name: string; description: string; inputSchema: unknown }> {
    return [...this.availableTools];
  }

  /**
   * Call an MCP tool
   */
  async callTool(toolName: string, args: Record<string, unknown>): Promise<MCPToolCallResult> {
    if (!this.isConnected || !this.isInitialized) {
      throw new Error("MCP client not connected. Call connect() first.");
    }

    try {
      console.log("Calling MCP tool:", toolName);

      // Add API key to args if not present
      const toolArgs = {
        ...args,
        apiKey: args.apiKey || this.config.apiKey || process.env.LIGHTHOUSE_API_KEY,
      };

      const result = await this.client.callTool({
        name: toolName,
        arguments: toolArgs,
      });

      // Parse result content
      const content = (result.content as Array<{ type: string; text: string }>) || [];
      let data: unknown;

      // Try to parse JSON from text content
      if (content.length > 0 && content[0]?.type === "text") {
        try {
          data = JSON.parse(content[0].text);
        } catch {
          data = content[0].text;
        }
      }

      console.log("MCP tool call completed:", toolName);

      return {
        success: true,
        data,
        content: content as Array<{ type: string; text: string }>,
      };
    } catch (error) {
      console.error("MCP tool call failed:", error);

      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * List available resources
   */
  async listResources(): Promise<unknown> {
    if (!this.isConnected || !this.isInitialized) {
      throw new Error("MCP client not connected. Call connect() first.");
    }

    try {
      const result = await this.client.listResources();
      return result;
    } catch (error) {
      console.error("Failed to list resources:", error);
      throw error;
    }
  }

  /**
   * Check if client is connected
   */
  isClientConnected(): boolean {
    return this.isConnected && this.isInitialized;
  }

  /**
   * Disconnect from MCP server
   */
  async disconnect(): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    try {
      console.log("Disconnecting from MCP server...");

      // Close client connection
      if (this.client) {
        await this.client.close();
      }

      // Kill server process if spawned
      if (this.serverProcess) {
        this.serverProcess.kill();
        this.serverProcess = null;
      }

      this.isConnected = false;
      this.isInitialized = false;
      this.availableTools = [];

      console.log("Disconnected from MCP server");
    } catch (error) {
      console.error("Error disconnecting from MCP server:", error);
      throw error;
    }
  }

  /**
   * Get server path
   */
  private getServerPath(): string {
    if (this.config.serverPath) {
      return this.config.serverPath;
    }

    // Try to find the built MCP server
    // In Cursor extension context, __dirname points to the compiled output
    const extensionRoot = path.resolve(__dirname, "../..");
    const workspaceRoot = path.resolve(extensionRoot, "../../..");

    const possiblePaths = [
      // Relative to workspace root
      path.join(workspaceRoot, "apps/mcp-server/dist/index.js"),
      // Relative to extension root
      path.join(extensionRoot, "../../apps/mcp-server/dist/index.js"),
      // Absolute path from workspace
      path.resolve(process.cwd(), "apps/mcp-server/dist/index.js"),
    ];

    for (const serverPath of possiblePaths) {
      if (fs.existsSync(serverPath)) {
        console.log("Found MCP server at:", serverPath);
        return serverPath;
      }
    }

    // Fallback: assume it's in node_modules or globally available
    console.warn("MCP server path not found, using default");
    return path.join(workspaceRoot, "apps/mcp-server/dist/index.js");
  }

  /**
   * Update API key
   */
  updateApiKey(apiKey: string): void {
    this.config.apiKey = apiKey;
    console.log("API key updated (reconnect required for changes to take effect)");
  }
}
