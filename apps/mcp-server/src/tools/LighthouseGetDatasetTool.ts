/**
 * Lighthouse Get Dataset Tool
 * MCP tool for retrieving dataset information
 */

import { Logger } from "@lighthouse-tooling/shared";
import { MCPToolDefinition, ExecutionTimeCategory } from "@lighthouse-tooling/types";
import { IDatasetService } from "../services/IDatasetService.js";
import { ProgressAwareToolResult } from "./types.js";

interface GetDatasetParams {
  datasetId: string;
  version?: string;
}

export class LighthouseGetDatasetTool {
  private service: IDatasetService;
  private logger: Logger;

  constructor(service: IDatasetService, logger?: Logger) {
    this.service = service;
    this.logger =
      logger || Logger.getInstance({ level: "info", component: "LighthouseGetDatasetTool" });
  }

  static getDefinition(): MCPToolDefinition {
    return {
      name: "lighthouse_get_dataset",
      description:
        "Retrieve a dataset by ID, optionally at a specific version. Returns dataset metadata, files, and version information.",
      inputSchema: {
        type: "object",
        properties: {
          datasetId: {
            type: "string",
            description: "Unique identifier of the dataset",
            minLength: 1,
          },
          version: {
            type: "string",
            description: 'Optional version string (e.g., "1.0.0") to retrieve a specific version',
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

  async execute(args: Record<string, unknown>): Promise<ProgressAwareToolResult> {
    const startTime = Date.now();

    try {
      const params: GetDatasetParams = {
        datasetId: args.datasetId as string,
        version: args.version as string | undefined,
      };

      if (!params.datasetId) {
        return {
          success: false,
          error: "datasetId is required",
          executionTime: Date.now() - startTime,
        };
      }

      const dataset = await this.service.getDataset(params.datasetId, params.version);
      const executionTime = Date.now() - startTime;

      return {
        success: true,
        data: {
          id: dataset.id,
          name: dataset.name,
          description: dataset.description,
          version: dataset.version,
          fileCount: dataset.files.length,
          totalSize: dataset.files.reduce((sum, f) => sum + f.size, 0),
          encrypted: dataset.encrypted,
          metadata: dataset.metadata,
          createdAt: dataset.createdAt.toISOString(),
          updatedAt: dataset.updatedAt.toISOString(),
          files: dataset.files.map((f) => ({
            cid: f.cid,
            size: f.size,
            originalPath: f.originalPath,
            encrypted: f.encrypted,
            uploadedAt: f.uploadedAt.toISOString(),
          })),
        },
        executionTime,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.logger.error("Failed to get dataset", error as Error, { args });
      return {
        success: false,
        error: (error as Error).message,
        executionTime,
      };
    }
  }
}
