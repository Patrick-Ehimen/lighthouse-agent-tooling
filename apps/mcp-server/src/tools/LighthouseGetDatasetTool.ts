/**
 * Lighthouse Get Dataset Tool - MCP tool for retrieving dataset information by ID
 */

import { Logger } from "@lighthouse-tooling/shared";
import { MCPToolDefinition, ExecutionTimeCategory } from "@lighthouse-tooling/types";
import { ILighthouseService } from "../services/ILighthouseService.js";
import { ToolResult, ProgressAwareToolResult } from "./types.js";

/**
 * Input parameters for lighthouse_get_dataset tool
 */
interface GetDatasetParams {
  apiKey?: string;
  datasetId: string;
}

/**
 * MCP tool for retrieving dataset information by ID
 */
export class LighthouseGetDatasetTool {
  private service: ILighthouseService;
  private logger: Logger;

  constructor(service: ILighthouseService, logger?: Logger) {
    this.service = service;
    this.logger =
      logger || Logger.getInstance({ level: "info", component: "LighthouseGetDatasetTool" });
  }

  /**
   * Get tool definition
   */
  static getDefinition(): MCPToolDefinition {
    return {
      name: "lighthouse_get_dataset",
      description:
        "Retrieve detailed information about a specific dataset by its ID, including file list and metadata",
      inputSchema: {
        type: "object",
        properties: {
          apiKey: {
            type: "string",
            description: "Optional API key for per-request authentication",
          },
          datasetId: {
            type: "string",
            description: "Unique identifier of the dataset to retrieve",
            minLength: 1,
            maxLength: 100,
          },
        },
        required: ["datasetId"],
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
  private validateParams(params: GetDatasetParams): string | null {
    // Check required parameters
    if (!params.datasetId || typeof params.datasetId !== "string") {
      return "datasetId is required and must be a string";
    }

    if (params.datasetId.length > 100) {
      return "datasetId must be 100 characters or less";
    }

    return null;
  }

  /**
   * Execute the get dataset operation
   */
  async execute(args: Record<string, unknown>): Promise<ProgressAwareToolResult> {
    const startTime = Date.now();

    try {
      this.logger.info("Executing lighthouse_get_dataset tool", { args });

      // Cast and validate parameters
      const params: GetDatasetParams = {
        datasetId: args.datasetId as string,
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

      this.logger.info("Retrieving dataset", { datasetId: params.datasetId });

      // Get dataset using Lighthouse service
      const dataset = await this.service.getDataset(params.datasetId);

      const executionTime = Date.now() - startTime;

      if (!dataset) {
        this.logger.warn("Dataset not found", { datasetId: params.datasetId });
        return {
          success: false,
          error: `Dataset not found: ${params.datasetId}`,
          executionTime,
          metadata: {
            executionTime,
            datasetId: params.datasetId,
          },
        };
      }

      this.logger.info("Dataset retrieved successfully", {
        id: dataset.id,
        name: dataset.name,
        fileCount: dataset.files.length,
        version: dataset.version,
        executionTime,
      });

      // Calculate total size
      const totalSize = dataset.files.reduce((sum, file) => sum + file.size, 0);

      // Format the response data
      const responseData = {
        success: true,
        dataset: {
          id: dataset.id,
          name: dataset.name,
          description: dataset.description,
          version: dataset.version,
          fileCount: dataset.files.length,
          totalSize,
          encrypted: dataset.encrypted,
          accessConditions: dataset.accessConditions,
          createdAt: dataset.createdAt.toISOString(),
          updatedAt: dataset.updatedAt.toISOString(),
          files: dataset.files.map((file) => ({
            cid: file.cid,
            size: file.size,
            encrypted: file.encrypted,
            tags: file.tags,
            uploadedAt: file.uploadedAt.toISOString(),
            hash: file.hash,
          })),
          metadata: {
            author: dataset.metadata?.author,
            license: dataset.metadata?.license,
            category: dataset.metadata?.category,
            keywords: dataset.metadata?.keywords,
            custom: dataset.metadata?.custom,
          },
        },
      };

      return {
        success: true,
        data: responseData,
        executionTime,
        metadata: {
          executionTime,
          datasetId: dataset.id,
          fileCount: dataset.files.length,
          totalSize,
        },
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

      this.logger.error("Get dataset failed", error as Error, {
        datasetId: args.datasetId as string,
        executionTime,
      });

      return {
        success: false,
        error: `Get dataset failed: ${errorMessage}`,
        executionTime,
        metadata: {
          executionTime,
          datasetId: args.datasetId as string,
        },
      };
    }
  }
}
