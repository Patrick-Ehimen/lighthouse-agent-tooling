/**
 * Lighthouse Setup Access Control Tool - MCP tool for configuring file access conditions
 */

import { Logger } from "@lighthouse-tooling/shared";
import {
  MCPToolDefinition,
  ExecutionTimeCategory,
  AccessCondition,
} from "@lighthouse-tooling/types";
import { EnhancedAccessCondition } from "@lighthouse-tooling/sdk-wrapper";
import { ILighthouseService } from "../services/ILighthouseService.js";
import { ToolResult, ProgressAwareToolResult } from "./types.js";

/**
 * Input parameters for lighthouse_setup_access_control tool
 */
interface SetupAccessControlParams {
  address: string;
  cid: string;
  conditions: EnhancedAccessCondition[];
  aggregator?: string;
  chainType?: "evm" | "solana";
  keyShards?: Array<{ key: string; index: string }>;
  authToken: string;
}

/**
 * MCP tool for setting up access control conditions for encrypted files
 */
export class LighthouseSetupAccessControlTool {
  private service: ILighthouseService;
  private logger: Logger;

  constructor(service: ILighthouseService, logger?: Logger) {
    this.service = service;
    this.logger =
      logger ||
      Logger.getInstance({ level: "info", component: "LighthouseSetupAccessControlTool" });
  }

  /**
   * Get tool definition
   */
  static getDefinition(): MCPToolDefinition {
    return {
      name: "lighthouse_setup_access_control",
      description:
        "Set up access control conditions for encrypted files using smart contract conditions",
      inputSchema: {
        type: "object",
        properties: {
          address: {
            type: "string",
            description: "Wallet address of the file owner",
            minLength: 1,
          },
          cid: {
            type: "string",
            description: "Content identifier (hash) of the uploaded file",
            minLength: 1,
          },
          conditions: {
            type: "array",
            description: "Array of access control conditions",
            items: {
              type: "object",
              description: "Access control condition configuration",
              properties: {
                id: { type: "number", description: "Unique condition ID" },
                chain: {
                  type: "string",
                  description: "Blockchain network (ethereum, polygon, etc.)",
                },
                method: { type: "string", description: "Smart contract method to call" },
                standardContractType: {
                  type: "string",
                  description: "Contract standard (ERC20, ERC721, ERC1155, Custom)",
                },
                contractAddress: { type: "string", description: "Smart contract address" },
                returnValueTest: {
                  type: "object",
                  description: "Return value test configuration for the contract method",
                  properties: {
                    comparator: {
                      type: "string",
                      enum: ["==", ">=", "<=", "!=", ">", "<"],
                      description: "Comparison operator",
                    },
                    value: {
                      type: "string",
                      description: "Value to compare against",
                    },
                  },
                  required: ["comparator", "value"],
                },
                parameters: {
                  type: "array",
                  description: "Parameters for the contract method call",
                },
              },
              required: ["id", "chain", "method", "returnValueTest"],
            },
          },
          aggregator: {
            type: "string",
            description: "Logic operator for multiple conditions (AND/OR)",
            enum: ["AND", "OR"],
            default: "AND",
          },
          chainType: {
            type: "string",
            description: "Blockchain type",
            enum: ["evm", "solana"],
            default: "evm",
          },
          keyShards: {
            type: "array",
            description: "Encryption key shards for the file",
            items: {
              type: "object",
              description: "Key shard object",
              properties: {
                key: { type: "string", description: "Key shard data" },
                index: { type: "string", description: "Key shard index" },
              },
              required: ["key", "index"],
            },
          },
          authToken: {
            type: "string",
            description: "JWT authentication token",
            minLength: 1,
          },
        },
        required: ["address", "cid", "conditions", "authToken"],
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
  private validateParams(params: SetupAccessControlParams): string | null {
    if (!params.address || typeof params.address !== "string") {
      return "address is required and must be a string";
    }

    if (!params.cid || typeof params.cid !== "string") {
      return "cid is required and must be a string";
    }

    if (!params.authToken || typeof params.authToken !== "string") {
      return "authToken is required and must be a string";
    }

    if (!Array.isArray(params.conditions) || params.conditions.length === 0) {
      return "conditions must be a non-empty array";
    }

    // Validate each condition
    for (let i = 0; i < params.conditions.length; i++) {
      const condition = params.conditions[i] as any;
      if (!condition || typeof condition !== "object") {
        return `conditions[${i}] must be an object`;
      }

      if (typeof condition.id !== "number") {
        return `conditions[${i}].id must be a number`;
      }

      if (!condition.chain || typeof condition.chain !== "string") {
        return `conditions[${i}].chain is required and must be a string`;
      }

      if (!condition.method || typeof condition.method !== "string") {
        return `conditions[${i}].method is required and must be a string`;
      }

      if (!condition.returnValueTest || typeof condition.returnValueTest !== "object") {
        return `conditions[${i}].returnValueTest is required and must be an object`;
      }

      const rvt = condition.returnValueTest;
      if (!rvt.comparator || !["==", ">=", "<=", "!=", ">", "<"].includes(rvt.comparator)) {
        return `conditions[${i}].returnValueTest.comparator must be one of: ==, >=, <=, !=, >, <`;
      }

      if (rvt.value === undefined || rvt.value === null) {
        return `conditions[${i}].returnValueTest.value is required`;
      }
    }

    if (params.aggregator && !["AND", "OR"].includes(params.aggregator)) {
      return "aggregator must be either 'AND' or 'OR'";
    }

    if (params.chainType && !["evm", "solana"].includes(params.chainType)) {
      return "chainType must be either 'evm' or 'solana'";
    }

    if (params.keyShards) {
      if (!Array.isArray(params.keyShards)) {
        return "keyShards must be an array";
      }

      for (let i = 0; i < params.keyShards.length; i++) {
        const shard = params.keyShards[i];
        if (!shard || typeof shard !== "object") {
          return `keyShards[${i}] must be an object`;
        }
        if (!shard.key || typeof shard.key !== "string") {
          return `keyShards[${i}].key is required and must be a string`;
        }
        if (!shard.index || typeof shard.index !== "string") {
          return `keyShards[${i}].index is required and must be a string`;
        }
      }
    }

    return null;
  }

  /**
   * Execute the access control setup operation
   */
  async execute(args: Record<string, unknown>): Promise<ProgressAwareToolResult> {
    const startTime = Date.now();

    try {
      this.logger.info("Executing lighthouse_setup_access_control tool", {
        address: args.address,
        cid: args.cid,
        conditionCount: (args.conditions as any[])?.length || 0,
      });

      // Cast and validate parameters
      const params: SetupAccessControlParams = {
        address: args.address as string,
        cid: args.cid as string,
        conditions: args.conditions as EnhancedAccessCondition[],
        aggregator: args.aggregator as string | undefined,
        chainType: args.chainType as "evm" | "solana" | undefined,
        keyShards: args.keyShards as Array<{ key: string; index: string }> | undefined,
        authToken: args.authToken as string,
      };

      const validationError = this.validateParams(params);
      if (validationError) {
        this.logger.warn("Parameter validation failed", { error: validationError });
        return {
          success: false,
          error: `Invalid parameters: ${validationError}`,
          executionTime: Date.now() - startTime,
        };
      }

      this.logger.info("Setting up access control", {
        address: params.address,
        cid: params.cid,
        conditionCount: params.conditions.length,
        aggregator: params.aggregator || "AND",
        chainType: params.chainType || "evm",
        hasKeyShards: !!params.keyShards?.length,
      });

      // Setup access control using service
      if (!this.service.setupAccessControl) {
        return {
          success: false,
          error: "Access control features not available in service",
          executionTime: Date.now() - startTime,
        };
      }

      const result = await this.service.setupAccessControl(
        {
          address: params.address,
          cid: params.cid,
          conditions: params.conditions,
          aggregator: params.aggregator,
          chainType: params.chainType || "evm",
          keyShards: params.keyShards,
        },
        params.authToken,
      );

      const executionTime = Date.now() - startTime;

      if (!result.success) {
        const errorMsg = result.error || "Unknown error";
        this.logger.error("Access control setup failed", new Error(errorMsg));
        return {
          success: false,
          error: `Access control setup failed: ${errorMsg}`,
          executionTime,
        };
      }

      this.logger.info("Access control set up successfully", {
        address: params.address,
        cid: params.cid,
        executionTime,
      });

      // Format the response data
      const responseData = {
        success: true,
        address: params.address,
        cid: params.cid,
        conditions: params.conditions,
        aggregator: params.aggregator || "AND",
        chainType: params.chainType || "evm",
        setupAt: new Date().toISOString(),
      };

      return {
        success: true,
        data: responseData,
        executionTime,
        metadata: {
          executionTime,
          conditionCount: params.conditions.length,
          chainType: params.chainType || "evm",
        },
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

      this.logger.error("Setup access control failed", error as Error, {
        address: args.address as string,
        cid: args.cid as string,
        executionTime,
      });

      return {
        success: false,
        error: `Access control setup failed: ${errorMessage}`,
        executionTime,
        metadata: {
          executionTime,
        },
      };
    }
  }
}
