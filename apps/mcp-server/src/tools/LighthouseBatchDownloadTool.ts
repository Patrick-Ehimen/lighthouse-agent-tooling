/**
 * Lighthouse Batch Download Tool - MCP tool for batch downloading files from IPFS via Lighthouse
 */

import fs from "fs/promises";
import { constants as fsConstants } from "fs";
import { Logger } from "@lighthouse-tooling/shared";
import { MCPToolDefinition, ExecutionTimeCategory } from "@lighthouse-tooling/types";
import { BatchFileResult, BatchDownloadFileResult } from "@lighthouse-tooling/sdk-wrapper";
import { ILighthouseService } from "../services/ILighthouseService.js";
import { ProgressAwareToolResult } from "./types.js";

/**
 * Input parameters for lighthouse_batch_download tool
 */
interface BatchDownloadParams {
  apiKey?: string;
  cids: string[];
  outputDir?: string;
  concurrency?: number;
  decrypt?: boolean;
  continueOnError?: boolean;
}

/**
 * MCP tool for batch downloading files from Lighthouse/IPFS
 */
export class LighthouseBatchDownloadTool {
  private service: ILighthouseService;
  private logger: Logger;

  constructor(service: ILighthouseService, logger?: Logger) {
    this.service = service;
    this.logger =
      logger || Logger.getInstance({ level: "info", component: "LighthouseBatchDownloadTool" });
  }

  /**
   * Get tool definition
   */
  static getDefinition(): MCPToolDefinition {
    return {
      name: "lighthouse_batch_download",
      description:
        "Download multiple files from IPFS via Lighthouse with configurable concurrency and partial failure handling",
      inputSchema: {
        type: "object",
        properties: {
          apiKey: {
            type: "string",
            description: "Optional API key for per-request authentication",
          },
          cids: {
            type: "array",
            description: "Array of IPFS Content Identifiers (CIDs) to download (1-100 CIDs)",
            items: { type: "string", description: "IPFS CID to download" },
          },
          outputDir: {
            type: "string",
            description: "Directory where files should be saved (defaults to current directory)",
          },
          concurrency: {
            type: "number",
            description: "Maximum concurrent downloads (default: 3, max: 10)",
            minimum: 1,
            maximum: 10,
            default: 3,
          },
          decrypt: {
            type: "boolean",
            description: "Whether to decrypt the files during download",
            default: false,
          },
          continueOnError: {
            type: "boolean",
            description: "Whether to continue downloading other files if one fails (default: true)",
            default: true,
          },
        },
        required: ["cids"],
        additionalProperties: false,
      },
      requiresAuth: true,
      supportsBatch: true,
      executionTime: ExecutionTimeCategory.SLOW,
    };
  }

  /**
   * Validate CID format (basic validation)
   */
  private isValidCID(cid: string): boolean {
    if (typeof cid !== "string" || cid.length === 0) return false;

    // CID v0 (base58, starts with Qm, 46 characters)
    if (cid.startsWith("Qm") && cid.length === 46) {
      return /^Qm[1-9A-HJ-NP-Za-km-z]{44}$/.test(cid);
    }

    // CID v1 (multibase, various encodings)
    if (cid.startsWith("baf") && cid.length >= 59) {
      return /^[a-zA-Z0-9]+$/.test(cid);
    }

    return false;
  }

  /**
   * Validate input parameters
   */
  private async validateParams(params: BatchDownloadParams): Promise<string | null> {
    // Check required parameters
    if (!params.cids || !Array.isArray(params.cids)) {
      return "cids is required and must be an array";
    }

    if (params.cids.length === 0) {
      return "cids cannot be empty";
    }

    if (params.cids.length > 100) {
      return "cids cannot exceed 100 files per batch";
    }

    // Validate each CID
    const invalidCIDs: string[] = [];
    for (const cid of params.cids) {
      if (!this.isValidCID(cid)) {
        invalidCIDs.push(cid);
      }
    }

    if (invalidCIDs.length > 0) {
      return `Invalid CID format: ${invalidCIDs.slice(0, 5).join(", ")}${invalidCIDs.length > 5 ? ` and ${invalidCIDs.length - 5} more` : ""}`;
    }

    // Validate output directory if provided
    if (params.outputDir) {
      if (typeof params.outputDir !== "string") {
        return "outputDir must be a string";
      }

      try {
        await fs.access(params.outputDir, fsConstants.W_OK);
      } catch {
        // Try to create directory
        try {
          await fs.mkdir(params.outputDir, { recursive: true });
        } catch {
          return `Cannot write to output directory: ${params.outputDir}`;
        }
      }
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

    // Validate decrypt parameter
    if (params.decrypt !== undefined && typeof params.decrypt !== "boolean") {
      return "decrypt must be a boolean";
    }

    return null;
  }

  /**
   * Execute the batch download operation
   */
  async execute(args: Record<string, unknown>): Promise<ProgressAwareToolResult> {
    const startTime = Date.now();

    try {
      this.logger.info("Executing lighthouse_batch_download tool", {
        cidCount: (args.cids as string[])?.length,
        concurrency: args.concurrency,
        outputDir: args.outputDir,
      });

      // Cast and validate parameters
      const params: BatchDownloadParams = {
        apiKey: args.apiKey as string | undefined,
        cids: args.cids as string[],
        outputDir: args.outputDir as string | undefined,
        concurrency: args.concurrency as number | undefined,
        decrypt: args.decrypt as boolean | undefined,
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

      this.logger.info("Starting batch download", {
        cidCount: params.cids.length,
        concurrency: params.concurrency || 3,
        outputDir: params.outputDir || ".",
        decrypt: params.decrypt,
      });

      // Execute batch download
      const result = await this.service.batchDownloadFiles(params.cids, {
        concurrency: params.concurrency || 3,
        outputDir: params.outputDir,
        decrypt: params.decrypt,
        continueOnError: params.continueOnError ?? true,
      });

      const executionTime = Date.now() - startTime;

      this.logger.info("Batch download completed", {
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
        results: result.results.map((r: BatchFileResult<BatchDownloadFileResult>) => ({
          id: r.id,
          success: r.success,
          cid: r.data?.cid,
          filePath: r.data?.filePath,
          size: r.data?.size,
          decrypted: r.data?.decrypted,
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
          successfulDownloads: result.successful,
          failedDownloads: result.failed,
          successRate: result.successRate,
          outputDir: params.outputDir || ".",
        },
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

      this.logger.error("Batch download failed", error as Error, {
        cidCount: (args.cids as string[])?.length,
        executionTime,
      });

      return {
        success: false,
        error: `Batch download failed: ${errorMessage}`,
        executionTime,
        metadata: {
          executionTime,
        },
      };
    }
  }
}
