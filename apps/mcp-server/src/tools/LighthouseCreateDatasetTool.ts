/**
 * Lighthouse Create Dataset Tool - MCP tool for creating datasets with multiple files
 */

import fs from "fs/promises";
import path from "path";
import { Logger, FileUtils } from "@lighthouse-tooling/shared";
import {
  MCPToolDefinition,
  AccessCondition,
  ExecutionTimeCategory,
} from "@lighthouse-tooling/types";
import { ILighthouseService } from "../services/ILighthouseService.js";
import { ToolResult, ProgressAwareToolResult } from "./types.js";

/**
 * Input parameters for lighthouse_create_dataset tool
 */
interface CreateDatasetParams {
  name: string;
  description?: string;
  filePaths: string[];
  encrypt?: boolean;
  accessConditions?: AccessCondition[];
  tags?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * MCP tool for creating datasets with multiple files
 */
export class LighthouseCreateDatasetTool {
  private service: ILighthouseService;
  private logger: Logger;

  constructor(service: ILighthouseService, logger?: Logger) {
    this.service = service;
    this.logger =
      logger || Logger.getInstance({ level: "info", component: "LighthouseCreateDatasetTool" });
  }

  /**
   * Get tool definition
   */
  static getDefinition(): MCPToolDefinition {
    return {
      name: "lighthouse_create_dataset",
      description:
        "Create a new dataset by uploading multiple files to IPFS via Lighthouse with metadata and versioning",
      inputSchema: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Name of the dataset",
            minLength: 1,
            maxLength: 100,
          },
          description: {
            type: "string",
            description: "Description of the dataset contents and purpose",
            maxLength: 500,
          },
          filePaths: {
            type: "array",
            description: "Array of file paths to include in the dataset",
            items: {
              type: "string",
              description: "Path to a file to include in the dataset",
            },
          },
          encrypt: {
            type: "boolean",
            description: "Whether to encrypt all files in the dataset",
            default: false,
          },
          accessConditions: {
            type: "array",
            description: "Array of access control conditions for encrypted datasets",
            items: {
              type: "object",
              description: "Access condition object",
              properties: {
                type: { type: "string", description: "Type of access condition" },
                condition: { type: "string", description: "Access condition to be met" },
                value: { type: "string", description: "Value or threshold for the condition" },
                parameters: { type: "object", description: "Additional parameters" },
              },
              required: ["type", "condition", "value"],
            },
          },
          tags: {
            type: "array",
            description: "Tags for organization and metadata",
            items: { type: "string", description: "Tag string" },
          },
          metadata: {
            type: "object",
            description: "Custom metadata for the dataset",
          },
        },
        required: ["name", "filePaths"],
        additionalProperties: false,
      },
      requiresAuth: true,
      supportsBatch: false,
      executionTime: ExecutionTimeCategory.SLOW,
    };
  }

  /**
   * Validate input parameters
   */
  private async validateParams(params: CreateDatasetParams): Promise<string | null> {
    // Check required parameters
    if (!params.name || typeof params.name !== "string") {
      return "name is required and must be a string";
    }

    if (params.name.length > 100) {
      return "name must be 100 characters or less";
    }

    if (!params.filePaths || !Array.isArray(params.filePaths) || params.filePaths.length === 0) {
      return "filePaths is required and must be a non-empty array";
    }

    if (params.filePaths.length > 50) {
      return "Maximum 50 files allowed per dataset";
    }

    // Check all files exist and are accessible
    let totalSize = 0;
    const maxTotalSize = 1024 * 1024 * 1024; // 1GB limit for datasets

    for (let i = 0; i < params.filePaths.length; i++) {
      const filePath = params.filePaths[i];

      if (!filePath || typeof filePath !== "string") {
        return `filePaths[${i}] must be a string`;
      }

      try {
        const fileExists = await FileUtils.fileExists(filePath);
        if (!fileExists) {
          return `File not found: ${filePath}`;
        }

        const fileInfo = await FileUtils.getFileInfo(filePath);

        totalSize += fileInfo.size;
        if (totalSize > maxTotalSize) {
          return `Total dataset size exceeds 1GB limit (current: ${Math.round(totalSize / 1024 / 1024)}MB)`;
        }

        // Check individual file size (100MB limit per file)
        const maxFileSize = 100 * 1024 * 1024;
        if (fileInfo.size > maxFileSize) {
          return `File too large: ${filePath} (${Math.round(fileInfo.size / 1024 / 1024)}MB). Maximum size per file is 100MB`;
        }
      } catch (error) {
        return `Cannot access file: ${filePath} - ${(error as Error).message}`;
      }
    }

    // Validate optional parameters
    if (params.description && typeof params.description !== "string") {
      return "description must be a string";
    }

    if (params.description && params.description.length > 500) {
      return "description must be 500 characters or less";
    }

    if (params.encrypt !== undefined && typeof params.encrypt !== "boolean") {
      return "encrypt must be a boolean";
    }

    // Validate access conditions
    if (params.accessConditions) {
      if (!Array.isArray(params.accessConditions)) {
        return "accessConditions must be an array";
      }

      for (let i = 0; i < params.accessConditions.length; i++) {
        const condition = params.accessConditions[i];
        if (!condition || typeof condition !== "object") {
          return `accessConditions[${i}] must be an object`;
        }
        if (!condition.type || typeof condition.type !== "string") {
          return `accessConditions[${i}].type is required and must be a string`;
        }
        if (!condition.condition || typeof condition.condition !== "string") {
          return `accessConditions[${i}].condition is required and must be a string`;
        }
        if (!condition.value || typeof condition.value !== "string") {
          return `accessConditions[${i}].value is required and must be a string`;
        }
      }

      // If access conditions are specified, encryption should be enabled
      if (params.accessConditions.length > 0 && !params.encrypt) {
        return "Access conditions require encryption to be enabled";
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
   * Execute the create dataset operation
   */
  async execute(args: Record<string, unknown>): Promise<ProgressAwareToolResult> {
    const startTime = Date.now();

    try {
      this.logger.info("Executing lighthouse_create_dataset tool", { args });

      // Cast and validate parameters
      const params: CreateDatasetParams = {
        name: args.name as string,
        description: args.description as string | undefined,
        filePaths: args.filePaths as string[],
        encrypt: args.encrypt as boolean | undefined,
        accessConditions: args.accessConditions as AccessCondition[] | undefined,
        tags: args.tags as string[] | undefined,
        metadata: args.metadata as Record<string, unknown> | undefined,
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

      this.logger.info("Starting dataset creation", {
        name: params.name,
        fileCount: params.filePaths.length,
        encrypt: params.encrypt,
        hasAccessConditions: !!params.accessConditions?.length,
        tagCount: params.tags?.length || 0,
      });

      // Create dataset using Lighthouse service
      const dataset = await this.service.createDataset({
        name: params.name,
        description: params.description,
        filePaths: params.filePaths,
        encrypt: params.encrypt,
        accessConditions: params.accessConditions,
        tags: params.tags,
        metadata: params.metadata,
      });

      const executionTime = Date.now() - startTime;

      this.logger.info("Dataset created successfully", {
        id: dataset.id,
        name: dataset.name,
        fileCount: dataset.files.length,
        version: dataset.version,
        executionTime,
      });

      // Format the response data
      const responseData = {
        success: true,
        dataset: {
          id: dataset.id,
          name: dataset.name,
          description: dataset.description,
          version: dataset.version,
          fileCount: dataset.files.length,
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
      };

      return {
        success: true,
        data: responseData,
        executionTime,
        metadata: {
          executionTime,
          fileCount: dataset.files.length,
          encrypted: dataset.encrypted,
          datasetId: dataset.id,
        },
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

      this.logger.error("Create dataset failed", error as Error, {
        name: args.name as string,
        fileCount: (args.filePaths as string[])?.length || 0,
        executionTime,
      });

      return {
        success: false,
        error: `Dataset creation failed: ${errorMessage}`,
        executionTime,
        metadata: {
          executionTime,
        },
      };
    }
  }
}
