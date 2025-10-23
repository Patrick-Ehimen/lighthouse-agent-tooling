/**
 * CallToolHandler - Handles tools/call requests
 */

import { Logger } from "@lighthouse-tooling/shared";
import { MCPResponse, MCPErrorCode } from "@lighthouse-tooling/types";
import { ToolRegistry } from "../registry/ToolRegistry.js";
import { RequestValidator } from "../utils/request-validator.js";
import { ResponseBuilder } from "../utils/response-builder.js";

export class CallToolHandler {
  private registry: ToolRegistry;
  private logger: Logger;

  constructor(registry: ToolRegistry, logger?: Logger) {
    this.registry = registry;
    this.logger = logger || Logger.getInstance({ level: "info", component: "CallToolHandler" });
  }

  /**
   * Handle tools/call request
   */
  async handle(
    requestId: string | number,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<MCPResponse> {
    try {
      this.logger.info("Handling tools/call request", {
        requestId,
        toolName,
        args,
      });

      // Check if tool exists
      if (!this.registry.hasTool(toolName)) {
        this.logger.warn("Tool not found", { requestId, toolName });
        return ResponseBuilder.error(
          requestId,
          MCPErrorCode.METHOD_NOT_FOUND,
          `Tool not found: ${toolName}`,
        );
      }

      // Get tool definition
      const tool = this.registry.getTool(toolName);
      if (!tool) {
        return ResponseBuilder.error(
          requestId,
          MCPErrorCode.INTERNAL_ERROR,
          `Failed to retrieve tool: ${toolName}`,
        );
      }

      // Validate arguments
      const validation = RequestValidator.validateToolArguments(tool.definition, args);
      if (!validation.valid) {
        this.logger.warn("Invalid tool arguments", {
          requestId,
          toolName,
          errors: validation.errors,
        });

        return ResponseBuilder.error(
          requestId,
          MCPErrorCode.INVALID_PARAMS,
          "Invalid tool arguments",
          {
            errors: validation.errors,
          },
        );
      }

      // Sanitize input
      const sanitizedArgs = RequestValidator.sanitize(args) as Record<string, unknown>;

      // Execute tool
      const result = await this.registry.executeTool(toolName, sanitizedArgs);

      if (!result.success) {
        this.logger.error("Tool execution failed", new Error(result.error), {
          requestId,
          toolName,
          executionTime: result.executionTime,
        });

        return ResponseBuilder.error(
          requestId,
          MCPErrorCode.OPERATION_FAILED,
          result.error || "Tool execution failed",
          {
            executionTime: result.executionTime,
          },
        );
      }

      this.logger.info("Tool executed successfully", {
        requestId,
        toolName,
        executionTime: result.executionTime,
      });

      // Format response
      const content = ResponseBuilder.formatContent(result.data);

      return ResponseBuilder.toolCallResult(requestId, content, {
        executionTime: result.executionTime,
        toolName,
      });
    } catch (error) {
      this.logger.error("Failed to call tool", error as Error, {
        requestId,
        toolName,
      });
      return ResponseBuilder.fromError(requestId, error as Error);
    }
  }
}
