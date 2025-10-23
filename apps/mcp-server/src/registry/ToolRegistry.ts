/**
 * Tool Registry - Manages registration and discovery of MCP tools
 */

import { MCPToolDefinition } from "@lighthouse-tooling/types";
import { Logger } from "@lighthouse-tooling/shared";
import {
  RegisteredTool,
  ToolExecutor,
  ToolFilter,
  RegistryMetrics,
  ToolRegistrationOptions,
  ToolExecutionResult,
} from "./types.js";

export class ToolRegistry {
  private tools: Map<string, RegisteredTool> = new Map();
  private logger: Logger;
  private registrationStartTime: number;

  constructor(logger?: Logger) {
    this.logger = logger || Logger.getInstance({ level: "info", component: "ToolRegistry" });
    this.registrationStartTime = Date.now();
    this.logger.info("Tool Registry initialized");
  }

  /**
   * Register a tool with its executor
   */
  register(
    tool: MCPToolDefinition,
    executor: ToolExecutor,
    options: ToolRegistrationOptions = {},
  ): void {
    const startTime = Date.now();

    try {
      // Validate tool definition
      if (!tool.name || !tool.description || !tool.inputSchema) {
        throw new Error(`Invalid tool definition: ${tool.name}`);
      }

      // Check if tool already exists
      if (this.tools.has(tool.name) && !options.override) {
        throw new Error(`Tool already registered: ${tool.name}`);
      }

      // Register the tool
      const registeredTool: RegisteredTool = {
        definition: tool,
        executor,
        registeredAt: new Date(),
        callCount: 0,
        averageExecutionTime: 0,
      };

      this.tools.set(tool.name, registeredTool);

      const registrationTime = Date.now() - startTime;
      this.logger.info(`Tool registered: ${tool.name}`, {
        registrationTime,
        requiresAuth: tool.requiresAuth,
        supportsBatch: tool.supportsBatch,
      });

      // Ensure registration time is under 100ms
      if (registrationTime > 100) {
        this.logger.warn(`Tool registration exceeded 100ms threshold: ${registrationTime}ms`, {
          toolName: tool.name,
        });
      }
    } catch (error) {
      this.logger.error(`Failed to register tool: ${tool.name}`, error as Error);
      throw error;
    }
  }

  /**
   * Register multiple tools at once
   */
  registerBatch(tools: Array<{ definition: MCPToolDefinition; executor: ToolExecutor }>): void {
    const startTime = Date.now();

    for (const { definition, executor } of tools) {
      this.register(definition, executor, { override: false });
    }

    const totalTime = Date.now() - startTime;
    this.logger.info(`Batch registration completed`, {
      toolCount: tools.length,
      totalTime,
      averageTime: totalTime / tools.length,
    });
  }

  /**
   * Get a registered tool
   */
  getTool(name: string): RegisteredTool | undefined {
    return this.tools.get(name);
  }

  /**
   * Check if a tool is registered
   */
  hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Get tool executor
   */
  getExecutor(name: string): ToolExecutor | undefined {
    const tool = this.tools.get(name);
    return tool?.executor;
  }

  /**
   * Discover tools based on filter criteria
   */
  discoverTools(filter?: ToolFilter): MCPToolDefinition[] {
    let tools = Array.from(this.tools.values()).map((t) => t.definition);

    if (filter) {
      if (filter.requiresAuth !== undefined) {
        tools = tools.filter((t) => t.requiresAuth === filter.requiresAuth);
      }

      if (filter.supportsBatch !== undefined) {
        tools = tools.filter((t) => t.supportsBatch === filter.supportsBatch);
      }

      if (filter.executionTime) {
        tools = tools.filter((t) => t.executionTime === filter.executionTime);
      }

      if (filter.namePattern) {
        const pattern = new RegExp(filter.namePattern, "i");
        tools = tools.filter((t) => pattern.test(t.name));
      }
    }

    return tools;
  }

  /**
   * List all registered tools
   */
  listTools(): MCPToolDefinition[] {
    return Array.from(this.tools.values()).map((t) => t.definition);
  }

  /**
   * Execute a tool by name
   */
  async executeTool(name: string, args: Record<string, unknown>): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    const tool = this.tools.get(name);

    if (!tool) {
      return {
        success: false,
        error: `Tool not found: ${name}`,
        executionTime: Date.now() - startTime,
      };
    }

    try {
      this.logger.debug(`Executing tool: ${name}`, { args });

      const result = await tool.executor(args);

      // Update tool metrics
      tool.callCount++;
      tool.lastCalled = new Date();
      const executionTime = Date.now() - startTime;

      // Update average execution time
      tool.averageExecutionTime =
        (tool.averageExecutionTime * (tool.callCount - 1) + executionTime) / tool.callCount;

      this.logger.info(`Tool executed successfully: ${name}`, {
        executionTime,
        callCount: tool.callCount,
      });

      return {
        ...result,
        executionTime,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.logger.error(`Tool execution failed: ${name}`, error as Error);

      return {
        success: false,
        error: (error as Error).message,
        executionTime,
      };
    }
  }

  /**
   * Get registry metrics
   */
  getMetrics(): RegistryMetrics {
    const totalCalls = Array.from(this.tools.values()).reduce(
      (sum, tool) => sum + tool.callCount,
      0,
    );

    const registrationTimes = Array.from(this.tools.values()).map(
      (tool) => tool.registeredAt.getTime() - this.registrationStartTime,
    );

    const averageRegistrationTime =
      registrationTimes.length > 0
        ? registrationTimes.reduce((sum, time) => sum + time, 0) / registrationTimes.length
        : 0;

    return {
      totalTools: this.tools.size,
      totalCalls,
      averageRegistrationTime,
      toolsRegistered: Array.from(this.tools.keys()),
      registrationTimestamp: new Date(this.registrationStartTime),
    };
  }

  /**
   * Unregister a tool
   */
  unregister(name: string): boolean {
    const result = this.tools.delete(name);
    if (result) {
      this.logger.info(`Tool unregistered: ${name}`);
    }
    return result;
  }

  /**
   * Clear all registered tools
   */
  clear(): void {
    const count = this.tools.size;
    this.tools.clear();
    this.logger.info(`All tools cleared`, { count });
  }

  /**
   * Get tool statistics
   */
  getToolStats(name: string):
    | {
        callCount: number;
        averageExecutionTime: number;
        lastCalled?: Date;
      }
    | undefined {
    const tool = this.tools.get(name);
    if (!tool) return undefined;

    return {
      callCount: tool.callCount,
      averageExecutionTime: tool.averageExecutionTime,
      lastCalled: tool.lastCalled,
    };
  }
}
