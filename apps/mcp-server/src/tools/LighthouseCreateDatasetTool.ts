/**
 * Lighthouse Create Dataset Tool
 * MCP tool for creating datasets with parallel file uploads and progress tracking
 */

import { Logger } from "@lighthouse-tooling/shared";
import {
  MCPToolDefinition,
  ExecutionTimeCategory,
  AccessCondition,
  DatasetConfig,
} from "@lighthouse-tooling/types";
import { IDatasetService, DatasetCreateOptions } from "../services/IDatasetService.js";
import { ProgressAwareToolResult } from "./types.js";

/**
 * Input parameters for lighthouse_create_dataset tool
 */
interface CreateDatasetParams {
  name: string;
  description?: string;
  files: string[];
  metadata?: {
    author?: string;
    license?: string;
    category?: string;
    keywords?: string[];
    custom?: Record<string, unknown>;
  };
  encrypt?: boolean;
  accessConditions?: AccessCondition[];
  tags?: string[];
  concurrency?: number;
  timeout?: number;
  maxRetries?: number;
  continueOnError?: boolean;
}

/**
 * MCP tool for creating datasets with multiple files
 */
export class LighthouseCreateDatasetTool {
  private service: IDatasetService;
  private logger: Logger;

  constructor(service: IDatasetService, logger?: Logger) {
    this.service = service;
    this.logger =
      logger || Logger.getInstance({ level: "info", component: "LighthouseCreateDatasetTool" });
  }

  /**
   * Get tool definition for MCP
   */
  static getDefinition(): MCPToolDefinition {
    return {
      name: "lighthouse_create_dataset",
      description:
        "Create a managed dataset with multiple files uploaded in parallel. Supports progress tracking, partial success handling, and automatic versioning. Efficiently handles 1000+ files with configurable concurrency.",
      inputSchema: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Unique name for the dataset",
            minLength: 1,
          },
          description: {
            type: "string",
            description: "Optional description of the dataset contents and purpose",
          },
          files: {
            type: "array",
            description: "Array of file paths to upload to the dataset",
            items: { type: "string", description: "File path" },
          },
          metadata: {
            type: "object",
            description: "Rich metadata for the dataset",
            properties: {
              author: {
                type: "string",
                description: "Author or creator of the dataset",
              },
              license: {
                type: "string",
                description: "License information (e.g., MIT, Apache-2.0)",
              },
              category: {
                type: "string",
                description: "Category or domain (e.g., research, backup, media)",
              },
              keywords: {
                type: "array",
                description: "Search keywords for dataset discovery",
                items: { type: "string", description: "Keyword" },
              },
              custom: {
                type: "object",
                description: "Custom metadata properties",
              },
            },
          },
          encrypt: {
            type: "boolean",
            description: "Whether to encrypt all files in the dataset",
            default: false,
          },
          accessConditions: {
            type: "array",
            description: "Access control conditions for encrypted datasets",
            items: {
              type: "object",
              description: "Access condition",
              properties: {
                type: { type: "string", description: "Condition type" },
                condition: { type: "string", description: "Condition name" },
                value: { type: "string", description: "Condition value" },
              },
              required: ["type", "condition", "value"],
            },
          },
          tags: {
            type: "array",
            description: "Tags for organization and filtering",
            items: { type: "string", description: "Tag" },
          },
          concurrency: {
            type: "number",
            description: "Number of parallel uploads (default: 5, max: 20)",
            default: 5,
            minimum: 1,
            maximum: 20,
          },
          timeout: {
            type: "number",
            description: "Timeout per file upload in milliseconds (default: 30000)",
            default: 30000,
          },
          maxRetries: {
            type: "number",
            description: "Maximum retry attempts per file (default: 3)",
            default: 3,
            minimum: 0,
            maximum: 10,
          },
          continueOnError: {
            type: "boolean",
            description:
              "Continue creating dataset even if some files fail to upload (default: true)",
            default: true,
          },
        },
        required: ["name", "files"],
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

    if (params.name.trim().length === 0) {
      return "name cannot be empty";
    }

    if (params.name.length > 255) {
      return "name must be less than 255 characters";
    }

    if (!params.files || !Array.isArray(params.files)) {
      return "files is required and must be an array";
    }

    if (params.files.length === 0) {
      return "files array cannot be empty";
    }

    if (params.files.length > 10000) {
      return "Maximum 10,000 files per dataset";
    }

    // Validate files are strings
    for (let i = 0; i < params.files.length; i++) {
      const file = params.files[i];
      if (typeof file !== "string") {
        return `files[${i}] must be a string`;
      }

      if (file.trim().length === 0) {
        return `files[${i}] cannot be empty`;
      }
    }

    // Validate optional parameters
    if (params.description !== undefined && typeof params.description !== "string") {
      return "description must be a string";
    }

    if (params.encrypt !== undefined && typeof params.encrypt !== "boolean") {
      return "encrypt must be a boolean";
    }

    if (params.concurrency !== undefined) {
      if (typeof params.concurrency !== "number") {
        return "concurrency must be a number";
      }
      if (params.concurrency < 1 || params.concurrency > 20) {
        return "concurrency must be between 1 and 20";
      }
    }

    if (params.timeout !== undefined) {
      if (typeof params.timeout !== "number") {
        return "timeout must be a number";
      }
      if (params.timeout < 1000) {
        return "timeout must be at least 1000ms";
      }
    }

    if (params.maxRetries !== undefined) {
      if (typeof params.maxRetries !== "number") {
        return "maxRetries must be a number";
      }
      if (params.maxRetries < 0 || params.maxRetries > 10) {
        return "maxRetries must be between 0 and 10";
      }
    }

    // Validate access conditions if provided
    if (params.accessConditions) {
      if (!Array.isArray(params.accessConditions)) {
        return "accessConditions must be an array";
      }

      for (let i = 0; i < params.accessConditions.length; i++) {
        const condition = params.accessConditions[i];
        if (!condition || typeof condition !== "object") {
          return `accessConditions[${i}] must be an object`;
        }
        if (!condition.type || !condition.condition || !condition.value) {
          return `accessConditions[${i}] must have type, condition, and value fields`;
        }
      }

      // If access conditions specified, encryption must be enabled
      if (params.accessConditions.length > 0 && !params.encrypt) {
        return "Access conditions require encryption to be enabled";
      }
    }

    // Validate metadata if provided
    if (params.metadata) {
      if (typeof params.metadata !== "object") {
        return "metadata must be an object";
      }

      if (params.metadata.keywords && !Array.isArray(params.metadata.keywords)) {
        return "metadata.keywords must be an array";
      }
    }

    // Validate tags if provided
    if (params.tags) {
      if (!Array.isArray(params.tags)) {
        return "tags must be an array";
      }

      for (let i = 0; i < params.tags.length; i++) {
        if (typeof params.tags[i] !== "string") {
          return `tags[${i}] must be a string`;
        }
      }
    }

    return null;
  }

  /**
   * Execute the create dataset operation
   */
  async execute(args: Record<string, unknown>): Promise<ProgressAwareToolResult> {
    const startTime = Date.now();

    try {
      this.logger.info("Executing lighthouse_create_dataset tool", {
        name: args.name,
        fileCount: (args.files as string[])?.length,
      });

      // Cast and validate parameters
      const params: CreateDatasetParams = {
        name: args.name as string,
        description: args.description as string | undefined,
        files: args.files as string[],
        metadata: args.metadata as CreateDatasetParams["metadata"],
        encrypt: args.encrypt as boolean | undefined,
        accessConditions: args.accessConditions as AccessCondition[] | undefined,
        tags: args.tags as string[] | undefined,
        concurrency: args.concurrency as number | undefined,
        timeout: args.timeout as number | undefined,
        maxRetries: args.maxRetries as number | undefined,
        continueOnError: args.continueOnError as boolean | undefined,
      };

      const validationError = await this.validateParams(params);
      if (validationError) {
        this.logger.warn("Parameter validation failed", { error: validationError });
        return {
          success: false,
          error: `Invalid parameters: ${validationError}`,
          executionTime: Date.now() - startTime,
        };
      }

      // Prepare dataset configuration
      const config: DatasetConfig = {
        name: params.name,
        description: params.description,
        encrypt: params.encrypt,
        accessConditions: params.accessConditions,
        tags: params.tags,
        metadata: params.metadata,
      };

      // Prepare create options
      const options: DatasetCreateOptions = {
        concurrency: params.concurrency,
        timeout: params.timeout,
        maxRetries: params.maxRetries,
        continueOnError: params.continueOnError !== false, // default true
      };

      this.logger.info("Creating dataset", {
        name: config.name,
        fileCount: params.files.length,
        encrypted: config.encrypt,
        concurrency: options.concurrency,
      });

      // Create dataset
      const dataset = await this.service.createDataset(config, params.files, options);

      const executionTime = Date.now() - startTime;

      this.logger.info("Dataset created successfully", {
        datasetId: dataset.id,
        name: dataset.name,
        fileCount: dataset.files.length,
        version: dataset.version,
        executionTime,
        executionTimeMinutes: (executionTime / 1000 / 60).toFixed(2),
      });

      // Format response
      const responseData = {
        success: true,
        dataset: {
          id: dataset.id,
          name: dataset.name,
          description: dataset.description,
          fileCount: dataset.files.length,
          totalSize: dataset.files.reduce((sum, f) => sum + f.size, 0),
          version: dataset.version,
          encrypted: dataset.encrypted,
          createdAt: dataset.createdAt.toISOString(),
          files: dataset.files.map((f) => ({
            cid: f.cid,
            size: f.size,
            originalPath: f.originalPath,
            encrypted: f.encrypted,
          })),
        },
        executionTimeMs: executionTime,
        executionTimeMinutes: (executionTime / 1000 / 60).toFixed(2),
        performance: {
          filesPerSecond: (dataset.files.length / (executionTime / 1000)).toFixed(2),
          averageFileSizeMB:
            dataset.files.length > 0
              ? (
                  dataset.files.reduce((sum, f) => sum + f.size, 0) /
                  dataset.files.length /
                  1024 /
                  1024
                ).toFixed(2)
              : "0",
        },
      };

      return {
        success: true,
        data: responseData,
        executionTime,
        metadata: {
          datasetId: dataset.id,
          fileCount: dataset.files.length,
          version: dataset.version,
        },
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

      this.logger.error("Dataset creation failed", error as Error, {
        name: args.name as string,
        fileCount: (args.files as string[])?.length,
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
