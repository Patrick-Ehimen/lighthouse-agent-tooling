/**
 * Lighthouse Batch Upload Tool - MCP tool for batch uploading files to IPFS via Lighthouse
 */

import fs from "fs/promises";
import { Logger } from "@lighthouse-tooling/shared";
import {
  MCPToolDefinition,
  AccessCondition,
  ExecutionTimeCategory,
} from "@lighthouse-tooling/types";
import { BatchFileResult, FileInfo } from "@lighthouse-tooling/sdk-wrapper";
import { ILighthouseService } from "../services/ILighthouseService.js";
import { ProgressAwareToolResult } from "./types.js";

/**
 * Input parameters for lighthouse_batch_upload tool
 */
interface BatchUploadParams {
  apiKey?: string;
  filePaths: string[];
  concurrency?: number;
  encrypt?: boolean;
  accessConditions?: AccessCondition[];
  tags?: string[];
  continueOnError?: boolean;
}

/**
 * MCP tool for batch uploading files to Lighthouse/IPFS
 */
export class LighthouseBatchUploadTool {
  private service: ILighthouseService;
  private logger: Logger;

  constructor(service: ILighthouseService, logger?: Logger) {
    this.service = service;
    this.logger =
      logger || Logger.getInstance({ level: "info", component: "LighthouseBatchUploadTool" });
  }

  /**
   * Get tool definition
   */
  static getDefinition(): MCPToolDefinition {
    return {
      name: "lighthouse_batch_upload",
      description:
        "Upload multiple files to IPFS via Lighthouse with configurable concurrency and partial failure handling",
      inputSchema: {
        type: "object",
        properties: {
          apiKey: {
            type: "string",
            description: "Optional API key for per-request authentication",
          },
          filePaths: {
            type: "array",
            description: "Array of file paths to upload (1-100 files)",
            items: { type: "string", description: "Path to a file to upload" },
          },
          concurrency: {
            type: "number",
            description: "Maximum concurrent uploads (default: 3, max: 10)",
            minimum: 1,
            maximum: 10,
            default: 3,
          },
          encrypt: {
            type: "boolean",
            description: "Whether to encrypt the files before upload",
            default: false,
          },
          accessConditions: {
            type: "array",
            description: "Array of access control conditions for encrypted files",
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
          continueOnError: {
            type: "boolean",
            description: "Whether to continue uploading other files if one fails (default: true)",
            default: true,
          },
        },
        required: ["filePaths"],
        additionalProperties: false,
      },
      requiresAuth: true,
      supportsBatch: true,
      executionTime: ExecutionTimeCategory.SLOW,
    };
  }

  /**
   * Validate input parameters
   */
  private async validateParams(params: BatchUploadParams): Promise<string | null> {
    // Check required parameters
    if (!params.filePaths || !Array.isArray(params.filePaths)) {
      return "filePaths is required and must be an array";
    }

    if (params.filePaths.length === 0) {
      return "filePaths cannot be empty";
    }

    if (params.filePaths.length > 100) {
      return "filePaths cannot exceed 100 files per batch";
    }

    // Validate each file path
    const maxSize = 100 * 1024 * 1024; // 100MB per file
    const invalidFiles: string[] = [];
    const oversizedFiles: string[] = [];

    for (const filePath of params.filePaths) {
      if (typeof filePath !== "string" || filePath.length === 0) {
        return "Each filePath must be a non-empty string";
      }

      try {
        const stats = await fs.stat(filePath);
        if (!stats.isFile()) {
          invalidFiles.push(filePath);
        } else if (stats.size > maxSize) {
          oversizedFiles.push(`${filePath} (${Math.round(stats.size / 1024 / 1024)}MB)`);
        }
      } catch {
        invalidFiles.push(filePath);
      }
    }

    if (invalidFiles.length > 0) {
      return `Cannot access files: ${invalidFiles.slice(0, 5).join(", ")}${invalidFiles.length > 5 ? ` and ${invalidFiles.length - 5} more` : ""}`;
    }

    if (oversizedFiles.length > 0) {
      return `Files exceed 100MB limit: ${oversizedFiles.slice(0, 3).join(", ")}${oversizedFiles.length > 3 ? ` and ${oversizedFiles.length - 3} more` : ""}`;
    }

    // Validate concurrency
    if (params.concurrency !== undefined) {
      if (
        typeof params.concurrency !== "number" ||
        params.concurrency < 1 ||
        params.concurrency > 10
      ) {
        return "concurrency must be a number between 1 and 10";
      }
    }

    // Validate encrypt parameter
    if (params.encrypt !== undefined && typeof params.encrypt !== "boolean") {
      return "encrypt must be a boolean";
    }

    // Validate access conditions
    if (params.accessConditions) {
      if (!Array.isArray(params.accessConditions)) {
        return "accessConditions must be an array";
      }

      if (params.accessConditions.length > 0 && !params.encrypt) {
        return "Access conditions require encryption to be enabled";
      }
    }

    // Validate tags
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
   * Execute the batch upload operation
   */
  async execute(args: Record<string, unknown>): Promise<ProgressAwareToolResult> {
    const startTime = Date.now();

    try {
      this.logger.info("Executing lighthouse_batch_upload tool", {
        fileCount: (args.filePaths as string[])?.length,
        concurrency: args.concurrency,
      });

      // Cast and validate parameters
      const params: BatchUploadParams = {
        apiKey: args.apiKey as string | undefined,
        filePaths: args.filePaths as string[],
        concurrency: args.concurrency as number | undefined,
        encrypt: args.encrypt as boolean | undefined,
        accessConditions: args.accessConditions as AccessCondition[] | undefined,
        tags: args.tags as string[] | undefined,
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

      this.logger.info("Starting batch upload", {
        fileCount: params.filePaths.length,
        concurrency: params.concurrency || 3,
        encrypt: params.encrypt,
      });

      // Execute batch upload
      const result = await this.service.batchUploadFiles(params.filePaths, {
        concurrency: params.concurrency || 3,
        encrypt: params.encrypt,
        accessConditions: params.accessConditions,
        tags: params.tags,
        continueOnError: params.continueOnError ?? true,
      });

      const executionTime = Date.now() - startTime;

      this.logger.info("Batch upload completed", {
        total: result.total,
        successful: result.successful,
        failed: result.failed,
        successRate: result.successRate,
        executionTime,
      });

      // Format the response data
      const responseData = {
        success: result.failed === 0,
        total: result.total,
        successful: result.successful,
        failed: result.failed,
        successRate: result.successRate,
        totalDuration: result.totalDuration,
        averageDuration: result.averageDuration,
        results: result.results.map((r: BatchFileResult<FileInfo>) => ({
          id: r.id,
          success: r.success,
          cid: r.data?.hash,
          fileName: r.data?.name,
          size: r.data?.size,
          encrypted: r.data?.encrypted,
          error: r.error,
          duration: r.duration,
          retries: r.retries,
        })),
      };

      return {
        success: result.failed === 0,
        data: responseData,
        executionTime,
        metadata: {
          executionTime,
          totalFiles: result.total,
          successfulUploads: result.successful,
          failedUploads: result.failed,
          successRate: result.successRate,
        },
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

      this.logger.error("Batch upload failed", error as Error, {
        fileCount: (args.filePaths as string[])?.length,
        executionTime,
      });

      return {
        success: false,
        error: `Batch upload failed: ${errorMessage}`,
        executionTime,
        metadata: {
          executionTime,
        },
      };
    }
  }
}
