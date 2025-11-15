/**
 * Lighthouse Upload File Tool - MCP tool for uploading files to IPFS via Lighthouse
 */

import fs from "fs/promises";
import path from "path";
import { Logger } from "@lighthouse-tooling/shared";
import {
  MCPToolDefinition,
  AccessCondition,
  ExecutionTimeCategory,
} from "@lighthouse-tooling/types";
import { ILighthouseService } from "../services/ILighthouseService.js";
import { ToolResult, ProgressAwareToolResult } from "./types.js";

/**
 * Input parameters for lighthouse_upload_file tool
 */
interface UploadFileParams {
  apiKey?: string;
  filePath: string;
  encrypt?: boolean;
  accessConditions?: AccessCondition[];
  tags?: string[];
}

/**
 * MCP tool for uploading files to Lighthouse/IPFS
 */
export class LighthouseUploadFileTool {
  private service: ILighthouseService;
  private logger: Logger;

  constructor(service: ILighthouseService, logger?: Logger) {
    this.service = service;
    this.logger =
      logger || Logger.getInstance({ level: "info", component: "LighthouseUploadFileTool" });
  }

  /**
   * Get tool definition
   */
  static getDefinition(): MCPToolDefinition {
    return {
      name: "lighthouse_upload_file",
      description:
        "Upload a file to IPFS via Lighthouse with optional encryption and access control",
      inputSchema: {
        type: "object",
        properties: {
          apiKey: {
            type: "string",
            description: "Optional API key for per-request authentication",
          },
          filePath: {
            type: "string",
            description: "Path to the file to upload",
            minLength: 1,
          },
          encrypt: {
            type: "boolean",
            description: "Whether to encrypt the file before upload",
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
        },
        required: ["filePath"],
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
  private async validateParams(params: UploadFileParams): Promise<string | null> {
    // Check required parameters
    if (!params.filePath || typeof params.filePath !== "string") {
      return "filePath is required and must be a string";
    }

    // Check file exists and is accessible
    try {
      const stats = await fs.stat(params.filePath);
      if (!stats.isFile()) {
        return `Path is not a file: ${params.filePath}`;
      }

      // Check file is not too large (100MB limit for reasonable processing)
      const maxSize = 100 * 1024 * 1024; // 100MB
      if (stats.size > maxSize) {
        return `File too large (${Math.round(stats.size / 1024 / 1024)}MB). Maximum size is ${Math.round(maxSize / 1024 / 1024)}MB`;
      }
    } catch (error) {
      return `Cannot access file: ${(error as Error).message}`;
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

      for (let i = 0; i < params.tags.length; i++) {
        if (typeof params.tags[i] !== "string") {
          return `tags[${i}] must be a string`;
        }
      }
    }

    return null;
  }

  /**
   * Execute the upload file operation
   */
  async execute(args: Record<string, unknown>): Promise<ProgressAwareToolResult> {
    const startTime = Date.now();

    try {
      this.logger.info("Executing lighthouse_upload_file tool", { args });

      // Cast and validate parameters
      const params: UploadFileParams = {
        filePath: args.filePath as string,
        encrypt: args.encrypt as boolean | undefined,
        accessConditions: args.accessConditions as AccessCondition[] | undefined,
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

      // Get file information
      const stats = await fs.stat(params.filePath);
      const fileName = path.basename(params.filePath);

      this.logger.info("Starting file upload", {
        filePath: params.filePath,
        fileName,
        size: stats.size,
        encrypt: params.encrypt,
        hasAccessConditions: !!params.accessConditions?.length,
        tagCount: params.tags?.length || 0,
      });

      // Upload file using Lighthouse service
      const result = await this.service.uploadFile({
        filePath: params.filePath,
        encrypt: params.encrypt,
        accessConditions: params.accessConditions,
        tags: params.tags,
      });

      const executionTime = Date.now() - startTime;

      this.logger.info("File uploaded successfully", {
        cid: result.cid,
        size: result.size,
        encrypted: result.encrypted,
        executionTime,
      });

      // Format the response data
      const responseData = {
        success: true,
        cid: result.cid,
        hash: result.hash || result.cid,
        size: result.size,
        fileName,
        encrypted: result.encrypted,
        accessConditions: result.accessConditions,
        tags: result.tags,
        uploadedAt: result.uploadedAt.toISOString(),
        originalPath: result.originalPath,
      };

      return {
        success: true,
        data: responseData,
        executionTime,
        metadata: {
          executionTime,
          fileSize: result.size,
          encrypted: result.encrypted,
        },
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

      this.logger.error("Upload file failed", error as Error, {
        filePath: args.filePath as string,
        executionTime,
      });

      return {
        success: false,
        error: `Upload failed: ${errorMessage}`,
        executionTime,
        metadata: {
          executionTime,
        },
      };
    }
  }
}
