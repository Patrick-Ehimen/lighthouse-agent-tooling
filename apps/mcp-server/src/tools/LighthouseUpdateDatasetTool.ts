/**
 * Lighthouse Update Dataset Tool - MCP tool for updating existing datasets
 */

import fs from "fs/promises";
import { Logger, FileUtils } from "@lighthouse-tooling/shared";
import { MCPToolDefinition, ExecutionTimeCategory } from "@lighthouse-tooling/types";
import { ILighthouseService } from "../services/ILighthouseService.js";
import { ToolResult, ProgressAwareToolResult } from "./types.js";

/**
 * Input parameters for lighthouse_update_dataset tool
 */
interface UpdateDatasetParams {
  datasetId: string;
  addFiles?: string[];
  removeFiles?: string[];
  description?: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
}

/**
 * MCP tool for updating existing datasets
 */
export class LighthouseUpdateDatasetTool {
  private service: ILighthouseService;
  private logger: Logger;

  constructor(service: ILighthouseService, logger?: Logger) {
    this.service = service;
    this.logger =
      logger || Logger.getInstance({ level: "info", component: "LighthouseUpdateDatasetTool" });
  }

  /**
   * Get tool definition
   */
  static getDefinition(): MCPToolDefinition {
    return {
      name: "lighthouse_update_dataset",
      description: "Update an existing dataset by adding/removing files or updating metadata",
      inputSchema: {
        type: "object",
        properties: {
          datasetId: {
            type: "string",
            description: "Unique identifier of the dataset to update",
            minLength: 1,
            maxLength: 100,
          },
          addFiles: {
            type: "array",
            description: "Array of file paths to add to the dataset",
            items: {
              type: "string",
              description: "Path to a file to add to the dataset",
            },
          },
          removeFiles: {
            type: "array",
            description: "Array of file CIDs to remove from the dataset",
            items: {
              type: "string",
              description: "CID of a file to remove from the dataset",
            },
          },
          description: {
            type: "string",
            description: "Updated description of the dataset",
            maxLength: 500,
          },
          metadata: {
            type: "object",
            description: "Updated custom metadata for the dataset",
          },
          tags: {
            type: "array",
            description: "Updated tags for organization and metadata",
            items: { type: "string", description: "Tag string" },
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

  /**
   * Validate input parameters
   */
  private async validateParams(params: UpdateDatasetParams): Promise<string | null> {
    // Check required parameters
    if (!params.datasetId || typeof params.datasetId !== "string") {
      return "datasetId is required and must be a string";
    }

    if (params.datasetId.length > 100) {
      return "datasetId must be 100 characters or less";
    }

    // At least one update operation must be specified
    if (
      !params.addFiles &&
      !params.removeFiles &&
      !params.description &&
      !params.metadata &&
      !params.tags
    ) {
      return "At least one update operation must be specified (addFiles, removeFiles, description, metadata, or tags)";
    }

    // Validate addFiles
    if (params.addFiles) {
      if (!Array.isArray(params.addFiles)) {
        return "addFiles must be an array";
      }

      if (params.addFiles.length > 20) {
        return "Maximum 20 files can be added at once";
      }

      // Check all files exist and are accessible
      for (let i = 0; i < params.addFiles.length; i++) {
        const filePath = params.addFiles[i];

        if (!filePath || typeof filePath !== "string") {
          return `addFiles[${i}] must be a string`;
        }

        try {
          const fileExists = await FileUtils.fileExists(filePath);
          if (!fileExists) {
            return `File not found: ${filePath}`;
          }

          const fileInfo = await FileUtils.getFileInfo(filePath);

          // Check individual file size (100MB limit per file)
          const maxFileSize = 100 * 1024 * 1024;
          if (fileInfo.size > maxFileSize) {
            return `File too large: ${filePath} (${Math.round(fileInfo.size / 1024 / 1024)}MB). Maximum size per file is 100MB`;
          }
        } catch (error) {
          return `Cannot access file: ${filePath} - ${(error as Error).message}`;
        }
      }
    }

    // Validate removeFiles
    if (params.removeFiles) {
      if (!Array.isArray(params.removeFiles)) {
        return "removeFiles must be an array";
      }

      if (params.removeFiles.length > 20) {
        return "Maximum 20 files can be removed at once";
      }

      for (let i = 0; i < params.removeFiles.length; i++) {
        if (typeof params.removeFiles[i] !== "string") {
          return `removeFiles[${i}] must be a string`;
        }
        const removeFile = params.removeFiles[i];
        if (removeFile && removeFile.length === 0) {
          return `removeFiles[${i}] cannot be empty`;
        }
      }
    }

    // Validate description
    if (params.description !== undefined) {
      if (typeof params.description !== "string") {
        return "description must be a string";
      }
      if (params.description.length > 500) {
        return "description must be 500 characters or less";
      }
    }

    // Validate tags
    if (params.tags) {
      if (!Array.isArray(params.tags)) {
        return "tags must be an array";
      }

      if (params.tags.length > 20) {
        return "Maximum 20 tags allowed";
      }

      for (let i = 0; i < params.tags.length; i++) {
        if (typeof params.tags[i] !== "string") {
          return `tags[${i}] must be a string`;
        }
        const tag = params.tags[i];
        if (tag && tag.length > 50) {
          return `tags[${i}] must be 50 characters or less`;
        }
      }
    }

    // Validate metadata
    if (params.metadata && typeof params.metadata !== "object") {
      return "metadata must be an object";
    }

    return null;
  }

  /**
   * Execute the update dataset operation
   */
  async execute(args: Record<string, unknown>): Promise<ProgressAwareToolResult> {
    const startTime = Date.now();

    try {
      this.logger.info("Executing lighthouse_update_dataset tool", { args });

      // Cast and validate parameters
      const params: UpdateDatasetParams = {
        datasetId: args.datasetId as string,
        addFiles: args.addFiles as string[] | undefined,
        removeFiles: args.removeFiles as string[] | undefined,
        description: args.description as string | undefined,
        metadata: args.metadata as Record<string, unknown> | undefined,
        tags: args.tags as string[] | undefined,
      };

      const validationError = await this.validateParams(params);
      if (validationError) {
        this.logger.warn("Parameter validation failed", { error: validationError, args });
        return {
          success: false,
          error: `Invalid parameters: ${validationError}`,
          executionTime: Date.now() - startTime,
        };
      }

      this.logger.info("Starting dataset update", {
        datasetId: params.datasetId,
        addFileCount: params.addFiles?.length || 0,
        removeFileCount: params.removeFiles?.length || 0,
        hasDescription: !!params.description,
        hasMetadata: !!params.metadata,
        tagCount: params.tags?.length || 0,
      });

      // Update dataset using Lighthouse service
      const dataset = await this.service.updateDataset({
        datasetId: params.datasetId,
        addFiles: params.addFiles,
        removeFiles: params.removeFiles,
        description: params.description,
        metadata: params.metadata,
        tags: params.tags,
      });

      const executionTime = Date.now() - startTime;

      this.logger.info("Dataset updated successfully", {
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
          files: dataset.files.map((file) => ({
            cid: file.cid,
            size: file.size,
            encrypted: file.encrypted,
            uploadedAt: file.uploadedAt.toISOString(),
          })),
          encrypted: dataset.encrypted,
          accessConditions: dataset.accessConditions,
          tags: params.tags,
          metadata: dataset.metadata,
          createdAt: dataset.createdAt.toISOString(),
          updatedAt: dataset.updatedAt.toISOString(),
        },
        changes: {
          filesAdded: params.addFiles?.length || 0,
          filesRemoved: params.removeFiles?.length || 0,
          descriptionUpdated: !!params.description,
          metadataUpdated: !!params.metadata,
          tagsUpdated: !!params.tags,
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
          filesAdded: params.addFiles?.length || 0,
          filesRemoved: params.removeFiles?.length || 0,
        },
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

      this.logger.error("Update dataset failed", error as Error, {
        datasetId: args.datasetId as string,
        addFileCount: (args.addFiles as string[])?.length || 0,
        removeFileCount: (args.removeFiles as string[])?.length || 0,
        executionTime,
      });

      return {
        success: false,
        error: `Dataset update failed: ${errorMessage}`,
        executionTime,
        metadata: {
          executionTime,
          datasetId: args.datasetId as string,
        },
      };
    }
  }
}
