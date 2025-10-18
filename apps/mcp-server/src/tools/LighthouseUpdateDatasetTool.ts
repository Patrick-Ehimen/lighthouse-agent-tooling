/**
 * Lighthouse Update Dataset Tool
 * MCP tool for updating datasets with automatic versioning
 */

import { Logger } from "@lighthouse-tooling/shared";
import { MCPToolDefinition, ExecutionTimeCategory, DatasetUpdate } from "@lighthouse-tooling/types";
import { IDatasetService } from "../services/IDatasetService.js";
import { ProgressAwareToolResult } from "./types.js";

export class LighthouseUpdateDatasetTool {
  private service: IDatasetService;
  private logger: Logger;

  constructor(service: IDatasetService, logger?: Logger) {
    this.service = service;
    this.logger =
      logger || Logger.getInstance({ level: "info", component: "LighthouseUpdateDatasetTool" });
  }

  static getDefinition(): MCPToolDefinition {
    return {
      name: "lighthouse_update_dataset",
      description:
        "Update a dataset's metadata, description, or files. Automatically creates a new version. Supports adding/removing files and tags.",
      inputSchema: {
        type: "object",
        properties: {
          datasetId: {
            type: "string",
            description: "Unique identifier of the dataset to update",
            minLength: 1,
          },
          description: {
            type: "string",
            description: "Updated description",
          },
          metadata: {
            type: "object",
            description: "Updated metadata fields",
            properties: {
              author: { type: "string", description: "Dataset author" },
              license: { type: "string", description: "Dataset license" },
              category: { type: "string", description: "Dataset category" },
              keywords: {
                type: "array",
                description: "Dataset keywords",
                items: { type: "string", description: "Keyword" },
              },
              custom: { type: "object", description: "Custom metadata" },
            },
          },
          addFiles: {
            type: "array",
            description: "Array of file paths to add to the dataset",
            items: { type: "string", description: "File path" },
          },
          removeFiles: {
            type: "array",
            description: "Array of CIDs to remove from the dataset",
            items: { type: "string", description: "File CID" },
          },
          addTags: {
            type: "array",
            description: "Tags to add to the dataset",
            items: { type: "string", description: "Tag" },
          },
          removeTags: {
            type: "array",
            description: "Tags to remove from the dataset",
            items: { type: "string", description: "Tag" },
          },
        },
        required: ["datasetId"],
        additionalProperties: false,
      },
      requiresAuth: true,
      supportsBatch: false,
      executionTime: ExecutionTimeCategory.MEDIUM,
    };
  }

  async execute(args: Record<string, unknown>): Promise<ProgressAwareToolResult> {
    const startTime = Date.now();

    try {
      const datasetId = args.datasetId as string;
      if (!datasetId) {
        return {
          success: false,
          error: "datasetId is required",
          executionTime: Date.now() - startTime,
        };
      }

      const updates: DatasetUpdate = {
        description: args.description as string | undefined,
        metadata: args.metadata as DatasetUpdate["metadata"],
        addFiles: args.addFiles as string[] | undefined,
        removeFiles: args.removeFiles as string[] | undefined,
        addTags: args.addTags as string[] | undefined,
        removeTags: args.removeTags as string[] | undefined,
      };

      const dataset = await this.service.updateDataset(datasetId, updates);
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
          updatedAt: dataset.updatedAt.toISOString(),
        },
        executionTime,
        metadata: {
          newVersion: dataset.version,
          filesAdded: updates.addFiles?.length || 0,
          filesRemoved: updates.removeFiles?.length || 0,
        },
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.logger.error("Failed to update dataset", error as Error, { args });
      return {
        success: false,
        error: (error as Error).message,
        executionTime,
      };
    }
  }
}
