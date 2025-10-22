/**
 * Lighthouse List Datasets Tool - MCP tool for listing all datasets with pagination
 */

import { Logger } from "@lighthouse-tooling/shared";
import { MCPToolDefinition, ExecutionTimeCategory } from "@lighthouse-tooling/types";
import { ILighthouseService } from "../services/ILighthouseService.js";
import { ToolResult, ProgressAwareToolResult } from "./types.js";

/**
 * Input parameters for lighthouse_list_datasets tool
 */
interface ListDatasetsParams {
  limit?: number;
  offset?: number;
}

/**
 * MCP tool for listing datasets with pagination support
 */
export class LighthouseListDatasetsTool {
  private service: ILighthouseService;
  private logger: Logger;

  constructor(service: ILighthouseService, logger?: Logger) {
    this.service = service;
    this.logger =
      logger || Logger.getInstance({ level: "info", component: "LighthouseListDatasetsTool" });
  }

  /**
   * Get tool definition
   */
  static getDefinition(): MCPToolDefinition {
    return {
      name: "lighthouse_list_datasets",
      description: "List all datasets with pagination support, showing metadata and file counts",
      inputSchema: {
        type: "object",
        properties: {
          limit: {
            type: "number",
            description: "Maximum number of datasets to return (default: 10, max: 100)",
            minimum: 1,
            maximum: 100,
            default: 10,
          },
          offset: {
            type: "number",
            description: "Number of datasets to skip for pagination (default: 0)",
            minimum: 0,
            default: 0,
          },
        },
        additionalProperties: false,
      },
      requiresAuth: true,
      supportsBatch: false,
      executionTime: ExecutionTimeCategory.FAST,
    };
  }

  /**
   * Validate input parameters
   */
  private validateParams(params: ListDatasetsParams): string | null {
    // Validate limit
    if (params.limit !== undefined) {
      if (typeof params.limit !== "number" || !Number.isInteger(params.limit)) {
        return "limit must be an integer";
      }
      if (params.limit < 1 || params.limit > 100) {
        return "limit must be between 1 and 100";
      }
    }

    // Validate offset
    if (params.offset !== undefined) {
      if (typeof params.offset !== "number" || !Number.isInteger(params.offset)) {
        return "offset must be an integer";
      }
      if (params.offset < 0) {
        return "offset must be 0 or greater";
      }
    }

    return null;
  }

  /**
   * Execute the list datasets operation
   */
  async execute(args: Record<string, unknown>): Promise<ProgressAwareToolResult> {
    const startTime = Date.now();

    try {
      this.logger.info("Executing lighthouse_list_datasets tool", { args });

      // Cast and validate parameters
      const params: ListDatasetsParams = {
        limit: args.limit as number | undefined,
        offset: args.offset as number | undefined,
      };

      const validationError = this.validateParams(params);
      if (validationError) {
        this.logger.warn("Parameter validation failed", { error: validationError, args });
        return {
          success: false,
          error: `Invalid parameters: ${validationError}`,
          executionTime: Date.now() - startTime,
        };
      }

      // Set defaults
      const limit = params.limit || 10;
      const offset = params.offset || 0;

      this.logger.info("Listing datasets", { limit, offset });

      // List datasets using Lighthouse service
      const response = await this.service.listDatasets({ limit, offset });

      const executionTime = Date.now() - startTime;

      this.logger.info("Datasets listed successfully", {
        count: response.datasets.length,
        total: response.total,
        hasMore: response.hasMore,
        executionTime,
      });

      // Format the response data
      const responseData = {
        success: true,
        datasets: response.datasets.map((dataset) => ({
          id: dataset.id,
          name: dataset.name,
          description: dataset.description,
          version: dataset.version,
          fileCount: dataset.files.length,
          totalSize: dataset.files.reduce((sum, file) => sum + file.size, 0),
          encrypted: dataset.encrypted,
          tags: dataset.metadata?.keywords || [],
          createdAt: dataset.createdAt.toISOString(),
          updatedAt: dataset.updatedAt.toISOString(),
          metadata: {
            author: dataset.metadata?.author,
            license: dataset.metadata?.license,
            category: dataset.metadata?.category,
          },
        })),
        pagination: {
          limit,
          offset,
          total: response.total,
          hasMore: response.hasMore,
          nextOffset: response.hasMore ? offset + limit : null,
        },
      };

      return {
        success: true,
        data: responseData,
        executionTime,
        metadata: {
          executionTime,
          datasetCount: response.datasets.length,
          totalDatasets: response.total,
        },
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

      this.logger.error("List datasets failed", error as Error, {
        limit: args.limit,
        offset: args.offset,
        executionTime,
      });

      return {
        success: false,
        error: `List datasets failed: ${errorMessage}`,
        executionTime,
        metadata: {
          executionTime,
        },
      };
    }
  }
}
