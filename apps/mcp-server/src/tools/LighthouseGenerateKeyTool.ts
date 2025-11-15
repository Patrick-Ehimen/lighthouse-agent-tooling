/**
 * Lighthouse Generate Key Tool - MCP tool for generating threshold encryption keys
 */

import { Logger } from "@lighthouse-tooling/shared";
import { MCPToolDefinition, ExecutionTimeCategory } from "@lighthouse-tooling/types";
import { ILighthouseService } from "../services/ILighthouseService.js";
import { ToolResult, ProgressAwareToolResult } from "./types.js";

/**
 * Input parameters for lighthouse_generate_key tool
 */
interface GenerateKeyParams {
  apiKey?: string;
  threshold?: number;
  keyCount?: number;
}

/**
 * MCP tool for generating encryption keys with threshold cryptography
 */
export class LighthouseGenerateKeyTool {
  private service: ILighthouseService;
  private logger: Logger;

  constructor(service: ILighthouseService, logger?: Logger) {
    this.service = service;
    this.logger =
      logger || Logger.getInstance({ level: "info", component: "LighthouseGenerateKeyTool" });
  }

  /**
   * Get tool definition
   */
  static getDefinition(): MCPToolDefinition {
    return {
      name: "lighthouse_generate_key",
      description:
        "Generate encryption keys using threshold cryptography for secure file access control",
      inputSchema: {
        type: "object",
        properties: {
          apiKey: {
            type: "string",
            description: "Optional API key for per-request authentication",
          },
          threshold: {
            type: "number",
            description: "Minimum number of key shards needed for decryption (default: 3)",
            minimum: 2,
            maximum: 10,
            default: 3,
          },
          keyCount: {
            type: "number",
            description: "Total number of key shards to generate (default: 5)",
            minimum: 3,
            maximum: 15,
            default: 5,
          },
        },
        additionalProperties: false,
      },
      requiresAuth: false, // Key generation doesn't require authentication
      supportsBatch: false,
      executionTime: ExecutionTimeCategory.FAST,
    };
  }

  /**
   * Validate input parameters
   */
  private validateParams(params: GenerateKeyParams): string | null {
    if (params.threshold !== undefined) {
      if (!Number.isInteger(params.threshold) || params.threshold < 2 || params.threshold > 10) {
        return "threshold must be an integer between 2 and 10";
      }
    }

    if (params.keyCount !== undefined) {
      if (!Number.isInteger(params.keyCount) || params.keyCount < 3 || params.keyCount > 15) {
        return "keyCount must be an integer between 3 and 15";
      }
    }

    // Ensure threshold <= keyCount
    const threshold = params.threshold || 3;
    const keyCount = params.keyCount || 5;
    if (threshold > keyCount) {
      return "threshold cannot be greater than keyCount";
    }

    return null;
  }

  /**
   * Execute the key generation operation
   */
  async execute(args: Record<string, unknown>): Promise<ProgressAwareToolResult> {
    const startTime = Date.now();

    try {
      this.logger.info("Executing lighthouse_generate_key tool", { args });

      // Cast and validate parameters
      const params: GenerateKeyParams = {
        threshold: args.threshold as number | undefined,
        keyCount: args.keyCount as number | undefined,
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

      const threshold = params.threshold || 3;
      const keyCount = params.keyCount || 5;

      this.logger.info("Generating encryption key", { threshold, keyCount });

      // Generate key using service
      if (!this.service.generateEncryptionKey) {
        return {
          success: false,
          error: "Encryption features not available in service",
          executionTime: Date.now() - startTime,
        };
      }

      const result = await this.service.generateEncryptionKey(threshold, keyCount);

      const executionTime = Date.now() - startTime;

      if (!result.success) {
        const errorMsg = result.error || "Unknown error";
        this.logger.error("Key generation failed", new Error(errorMsg));
        return {
          success: false,
          error: `Key generation failed: ${errorMsg}`,
          executionTime,
        };
      }

      this.logger.info("Encryption key generated successfully", {
        hasKeyShards: !!(result.data as any)?.keyShards?.length,
        keyShardCount: (result.data as any)?.keyShards?.length || 0,
        executionTime,
      });

      const keyData = result.data as {
        masterKey: string;
        keyShards: Array<{ key: string; index: string }>;
      };

      // Format the response data - exclude the master key from the response for security
      const responseData = {
        success: true,
        threshold,
        keyCount,
        keyShards: keyData.keyShards.map((shard, index) => ({
          id: index + 1,
          shard: shard.key,
          index: shard.index,
        })),
        // Don't include master key in response for security
        generatedAt: new Date().toISOString(),
      };

      return {
        success: true,
        data: responseData,
        executionTime,
        metadata: {
          executionTime,
          threshold,
          keyCount,
          keyShardCount: keyData.keyShards.length,
        },
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

      this.logger.error("Generate key failed", error as Error, {
        threshold: args.threshold as number,
        keyCount: args.keyCount as number,
        executionTime,
      });

      return {
        success: false,
        error: `Key generation failed: ${errorMessage}`,
        executionTime,
        metadata: {
          executionTime,
        },
      };
    }
  }
}
